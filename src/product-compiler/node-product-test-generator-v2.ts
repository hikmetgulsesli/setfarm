import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  BuildTopologyVerificationErrorV3,
  verifyBuildTopologyV3,
  verifyBuildTopologyV3ForTest,
} from "./build-topology-v3.js";
import {
  compileInvocationInputTransportSetV2,
  encodeInvocationRequestV2,
  type CliEncodedInvocationRequestV2,
  type HttpEncodedInvocationRequestV2,
} from "./invocation-input-transport-v2.js";
import {
  isProductionNodeScaffoldPrivateStageV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  NodeProductRuntimeSourceVerificationErrorV2,
  projectNodeProductRuntimeProgramV2,
  verifyNodeProductRuntimeSourceV2,
  verifyNodeProductRuntimeSourceV2ForTest,
  type NodeProductRuntimeProgramV2,
} from "./node-product-runtime-generator-v2.js";
import { verifyProductRuntimeBehaviorContractV1 } from
  "./product-runtime-behavior-contract-v1.js";
import {
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  SemanticRealizationPlanVerificationErrorV2,
  verifySemanticRealizationPlanV2,
} from "./semantic-realization-plan-v2.js";
import type { BuildTopologyV3 } from "./schemas/build-topology-v3.js";
import {
  FileTreeManifestV3Schema,
  hashFileTreeTestCoverageMembershipV3,
  type FileTreeManifestV3,
  type FileTreeTestCoverageBindingV3,
} from "./schemas/file-tree-manifest-v3.js";
import type { InvocationInputTransportSetV2 } from
  "./schemas/invocation-input-transport-set-v2.js";
import {
  NODE_PRODUCT_TEST_PROGRAM_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2,
  NodeProductTestSourceReceiptV2Schema,
  deriveNodeProductTestCoverageSymbolRefV2,
  hashNodeProductActionTestMembershipV2,
  hashNodeProductBehaviorAssertionTestMembershipV2,
  hashNodeProductEntityFieldTestMembershipV2,
  hashNodeProductTestCoverageMemberMembershipV2,
  hashNodeProductTestSourceIdentityV2,
  hashNodeProductTestSourceLogicalReceiptV2,
  hashNodeProductTestSourceReceiptV2,
  recursivelyFreezeNodeProductTestSourceV2,
  type NodeProductActionTestBindingV2,
  type NodeProductBehaviorAssertionTestBindingV2,
  type NodeProductEntityFieldTestBindingV2,
  type NodeProductTestCoverageMemberV2,
  type NodeProductTestSourceReceiptHashPayloadV2,
  type NodeProductTestSourceReceiptLogicalIdentityV2,
  type NodeProductTestSourceReceiptV2,
} from "./schemas/node-product-test-source-v2.js";
import {
  ProductSpecV2Schema,
  type EvidencePredicateV2,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import type { ProductRuntimeBehaviorContractV1 } from
  "./schemas/product-runtime-behavior-contract-v1.js";
import {
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductTestGeneratorProfileV2,
  type SemanticRealizationPlanV2,
} from "./schemas/semantic-realization-plan-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 50 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 68 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 28,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 180_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (10 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 180_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (12 * 1024 * 1024),
});
const MAX_DIAGNOSTICS_V2 = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const GeneratorInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
  realizationPlan: z.unknown(),
  fileTree: z.unknown(),
  buildTopology: z.unknown(),
  runtimeSourceText: z.string().min(1).max(12 * 1024 * 1024),
  runtimeSourceReceipt: z.unknown(),
}).strict();

const VerifierInputV2Schema = GeneratorInputV2Schema.extend({
  candidateReceipt: z.unknown(),
  candidateSourceText: z.string().min(1).max(
    NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2,
  ),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rawSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1_500) : "Unknown error";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type NodeProductTestSourceDiagnosticCodeV2 =
  | "NODE_TEST_SOURCE_V2_ARTIFACT_INVALID"
  | "NODE_TEST_SOURCE_V2_BUILD_TOPOLOGY_REJECTED"
  | "NODE_TEST_SOURCE_V2_CLI_SEQUENCE_REJECTED"
  | "NODE_TEST_SOURCE_V2_EVIDENCE_KIND_REJECTED"
  | "NODE_TEST_SOURCE_V2_INPUT_INVALID"
  | "NODE_TEST_SOURCE_V2_OUTPUT_LIMIT_EXCEEDED"
  | "NODE_TEST_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "NODE_TEST_SOURCE_V2_REALIZATION_PLAN_REJECTED"
  | "NODE_TEST_SOURCE_V2_RUNTIME_SOURCE_REJECTED"
  | "NODE_TEST_SOURCE_V2_TRANSPORT_REJECTED"
  | "NODE_TEST_SOURCE_V2_UPSTREAM_AUTHORITY_MISMATCH";

export type NodeProductTestSourceDiagnosticV2 = Readonly<{
  code: NodeProductTestSourceDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type NodeProductTestSourceGenerationResultV2 =
  | Readonly<{
      status: "shadow_generated";
      diagnostics: readonly [];
      sourceText: string;
      sourceContentHash: string;
      testProgramHash: string;
      receipt: Readonly<NodeProductTestSourceReceiptV2>;
      canonicalReceiptBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeProductTestSourceDiagnosticV2[];
    }>;

function diagnostic(
  code: NodeProductTestSourceDiagnosticCodeV2,
  path: string,
  message: string,
): NodeProductTestSourceDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 1_000),
    message: message.slice(0, 1_500),
  });
}

function rejected(
  diagnostics: readonly NodeProductTestSourceDiagnosticV2[],
): NodeProductTestSourceGenerationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([...diagnostics].slice(0, MAX_DIAGNOSTICS_V2)),
  });
}

function singleRejected(
  code: NodeProductTestSourceDiagnosticCodeV2,
  path: string,
  message: string,
): NodeProductTestSourceGenerationResultV2 {
  return rejected([diagnostic(code, path, message)]);
}

type TestScenarioStepV2 = Readonly<{
  actionRef: string;
  invocationKind: "cli_command" | "http_request";
  request: Readonly<CliEncodedInvocationRequestV2 | HttpEncodedInvocationRequestV2>;
  requestHash: string;
  successCode: number;
  expectedBody: unknown;
  expectedCanonicalBody: string;
}>;

type TestScenarioV2 = Readonly<{
  testRef: string;
  actionRef: string;
  scenarioHash: string;
  transportContractHash: string;
  targetRequestHash: string;
  steps: readonly TestScenarioStepV2[];
}>;

type NodeProductTestProgramV2 = Readonly<{
  schema: "setfarm.node-product-test-program.v2";
  programVersion: "2.0.0";
  testProgramContractHash: string;
  runtimeProgramHash: string;
  runtimeImportSpecifier: "./cli.js" | "./app.js";
  profileId: NodeProductRuntimeProgramV2["profileId"];
  tests: readonly TestScenarioV2[];
}>;

function jsonCloneV2<T>(value: T): T {
  return JSON.parse(canonicalJsonStringify(value)) as T;
}

function pointerSegmentsV2(pointer: string): readonly string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function defineJsonValueV2(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function pointerDocumentV2(
  entries: readonly Readonly<{ pointer: string; value: unknown }>[],
): unknown {
  if (entries.length === 0) return null;
  if (entries.length === 1 && entries[0]!.pointer === "") {
    return jsonCloneV2(entries[0]!.value);
  }
  const root = Object.create(null) as Record<string, unknown>;
  for (const entry of entries) {
    const segments = pointerSegmentsV2(entry.pointer);
    if (segments.length === 0) {
      throw new Error("Root JSON Pointer overlaps another output projection");
    }
    let current = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      if (!Object.prototype.hasOwnProperty.call(current, segment)) {
        defineJsonValueV2(current, segment, Object.create(null));
      }
      const child = current[segment];
      if (child === null || typeof child !== "object" || Array.isArray(child)) {
        throw new Error(`Output projection pointer ${entry.pointer} collides`);
      }
      current = child as Record<string, unknown>;
    }
    defineJsonValueV2(current, segments.at(-1)!, jsonCloneV2(entry.value));
  }
  return root;
}

function expectedActionBodyV2(
  action: NodeProductRuntimeProgramV2["actions"][number],
  inputValues: Readonly<Record<string, unknown>>,
): unknown {
  const resultValue = pointerDocumentV2(action.outputProjections.map((projection) => ({
    pointer: projection.pointer,
    value: projection.valueFrom.kind === "input"
      ? inputValues[projection.valueFrom.fieldName]
      : projection.valueFrom.value,
  })));
  return pointerDocumentV2([{
    pointer: action.transport.result.valuePointer,
    value: resultValue,
  }]);
}

function hashTestScenarioV2(input: Readonly<{
  actionRef: string;
  evidenceScenario: ProductSpecV2["actions"][number]["evidenceScenario"];
  steps: readonly TestScenarioStepV2[];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-scenario-hash.v2",
    scenario: input,
  });
}

function deriveTestRefV2(
  actionRef: string,
  scenarioHash: string,
  runtimeProgramHash: string,
): string {
  return `TEST_${hashCanonicalJson({
    schema: "setfarm.node-product-action-test-ref.v2",
    actionRef,
    scenarioHash,
    runtimeProgramHash,
  }).toUpperCase()}`;
}

function unsupportedEvidenceDiagnosticsV2(
  productSpec: Readonly<ProductSpecV2>,
): readonly NodeProductTestSourceDiagnosticV2[] {
  return Object.freeze(productSpec.evidencePredicates.flatMap((predicate, index) =>
    predicate.kind === "action_invocation"
    || predicate.kind === "observable_outcome"
      ? []
      : [diagnostic(
          "NODE_TEST_SOURCE_V2_EVIDENCE_KIND_REJECTED",
          `/productSpec/evidencePredicates/${index}/kind`,
          `${predicate.id} requires unsupported ${predicate.kind} evidence; generated tests never fake or silently omit evidence`,
        )]).slice(0, MAX_DIAGNOSTICS_V2));
}

function evidenceOwnerActionRefV2(
  productSpec: Readonly<ProductSpecV2>,
  predicate: Readonly<EvidencePredicateV2>,
): string {
  if (predicate.kind === "action_invocation") {
    const owners = productSpec.actions.filter((action) =>
      action.id === predicate.subjectRef && action.evidenceRefs.includes(predicate.id));
    if (owners.length !== 1) {
      throw new Error(
        `${predicate.id} action-invocation evidence has ${owners.length} exact action owners`,
      );
    }
    return owners[0]!.id;
  }
  if (predicate.kind === "observable_outcome") {
    const owners = productSpec.actions.filter((action) =>
      action.evidenceRefs.includes(predicate.id)
      && action.observableEffects.some((effect) =>
        effect.id === predicate.subjectRef && effect.evidenceRef === predicate.id));
    if (owners.length !== 1) {
      throw new Error(
        `${predicate.id} observable evidence has ${owners.length} exact action owners`,
      );
    }
    return owners[0]!.id;
  }
  throw new Error(`${predicate.id} has unsupported ${predicate.kind} evidence`);
}

function compileScenarioStepV2(
  actionRef: string,
  inputValues: Readonly<Record<string, unknown>>,
  runtimeProgram: Readonly<NodeProductRuntimeProgramV2>,
): TestScenarioStepV2 {
  const action = runtimeProgram.actions.find((candidate) =>
    candidate.actionRef === actionRef);
  if (!action) throw new Error(`Scenario action ${actionRef} is absent from runtime program`);
  const encoded = encodeInvocationRequestV2({
    contract: action.transport,
    inputValues,
  });
  if (encoded.kind !== action.transport.kind) {
    throw new Error(`Scenario transport kind drifted for ${actionRef}`);
  }
  const expectedBody = expectedActionBodyV2(action, inputValues);
  return Object.freeze({
    actionRef,
    invocationKind: encoded.kind,
    request: Object.freeze(structuredClone(encoded.request)),
    requestHash: encoded.requestHash,
    successCode: action.transport.kind === "cli_command"
      ? action.transport.result.successExitCodes[0]!
      : action.transport.result.successStatusCodes[0]!,
    expectedBody: recursivelyFreezeNodeProductTestSourceV2(
      structuredClone(expectedBody),
    ),
    expectedCanonicalBody: canonicalJsonStringify(expectedBody),
  });
}

function compileTestScenariosV2(
  productSpec: Readonly<ProductSpecV2>,
  runtimeProgram: Readonly<NodeProductRuntimeProgramV2>,
  runtimeProgramHash: string,
): readonly TestScenarioV2[] {
  return Object.freeze([...productSpec.actions]
    .sort((left, right) => compareUtf16(left.id, right.id))
    .map((action) => {
      const steps = [
        ...action.evidenceScenario.prerequisiteSteps.map((step) =>
          compileScenarioStepV2(
            step.actionRef,
            step.inputValues,
            runtimeProgram,
          )),
        compileScenarioStepV2(
          action.id,
          action.evidenceScenario.targetInputValues,
          runtimeProgram,
        ),
      ];
      const scenarioHash = hashTestScenarioV2({
        actionRef: action.id,
        evidenceScenario: action.evidenceScenario,
        steps,
      });
      const target = steps.at(-1)!;
      const runtimeAction = runtimeProgram.actions.find((candidate) =>
        candidate.actionRef === action.id)!;
      return Object.freeze({
        testRef: deriveTestRefV2(action.id, scenarioHash, runtimeProgramHash),
        actionRef: action.id,
        scenarioHash,
        transportContractHash: runtimeAction.transport.contractHash,
        targetRequestHash: target.requestHash,
        steps: Object.freeze(steps),
      });
    }));
}

function exactTestTargetV2(fileTree: Readonly<FileTreeManifestV3>) {
  const targets = fileTree.paths.filter((entry) =>
    entry.authority.kind === "generated_test_source_target");
  if (targets.length !== 1) {
    throw new Error("FileTreeV3 must contain one exact generated-test target");
  }
  return targets[0]!;
}

function evidenceRelationRefsV2(
  plan: Readonly<SemanticRealizationPlanV2>,
): readonly string[] {
  return Object.freeze(plan.realizations.flatMap((realization) =>
    realization.target.kind === "evidence_relation"
      ? [realization.sourceIntent.subjectRef]
      : []).sort(compareUtf16));
}

function assertAuthorityJoinsV2(input: Readonly<{
  productSpec: ProductSpecV2;
  deliverySelectionHash: string;
  runtimeBehaviorContract: Readonly<ProductRuntimeBehaviorContractV1>;
  realizationPlan: Readonly<SemanticRealizationPlanV2>;
  fileTree: Readonly<FileTreeManifestV3>;
  buildTopology: Readonly<BuildTopologyV3>;
  transportSet: Readonly<InvocationInputTransportSetV2>;
  runtimeSourceReceipt: Readonly<{
    receiptHash: string;
    logicalReceiptHash: string;
    source: Readonly<{
      contentHash: string;
      runtimeProgramHash: string;
    }>;
    authority: Readonly<{
      productRef: string;
      productSpecHash: string;
      deliverySelectionHash: string;
      profileId: string;
      stackPackId: string;
      runtimeProgramContractHash: string;
      runtimeBehavior: Readonly<{ contractHash: string }>;
    }>;
  }>;
  runtimeProgramHash: string;
}>): void {
  const testTarget = exactTestTargetV2(input.fileTree);
  if (testTarget.authority.kind !== "generated_test_source_target") {
    throw new Error("Generated-test target authority kind changed");
  }
  const testBuildPath = input.buildTopology.paths.find((entry) =>
    entry.pathRef === testTarget.pathRef);
  const profile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
    (candidate) => candidate.profileId === input.realizationPlan.authority.profileId,
  );
  if (!profile) throw new Error("Generated-test profile is absent");
  const predicates = new Set(input.productSpec.evidencePredicates.map((item) => item.id));
  const evidenceRelations = evidenceRelationRefsV2(input.realizationPlan);
  const coverageEvidence = testTarget.authority.coverageBindings.flatMap((binding) =>
    binding.coverageKind === "evidence_relation" ? [binding.subjectRef] : []);
  const coverageActions = testTarget.authority.coverageBindings.flatMap((binding) =>
    binding.coverageKind === "action" ? [binding.subjectRef] : []);
  const joins = [
    ["behavior_product_spec", input.runtimeBehaviorContract.authority.productSpecHash
      === input.realizationPlan.authority.productSpecHash],
    ["behavior_proposal", input.runtimeBehaviorContract.authority.proposalHash
      === input.realizationPlan.authority.runtimeBehavior.proposalHash],
    ["behavior_contract", input.runtimeBehaviorContract.contractHash
      === input.realizationPlan.authority.runtimeBehavior.contractHash],
    ["realization_product_spec", input.realizationPlan.authority.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["realization_delivery", input.realizationPlan.authority.deliverySelectionHash
      === input.deliverySelectionHash],
    ["file_tree_product_spec", input.fileTree.authority.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["file_tree_delivery", input.fileTree.authority.deliverySelectionHash
      === input.deliverySelectionHash],
    ["file_tree_realization", input.fileTree.authority.semanticRealizationPlan.planHash
      === input.realizationPlan.planHash],
    ["topology_file_tree", input.buildTopology.authority.fileTree.manifestHash
      === input.fileTree.manifestHash],
    ["transport_product_spec", input.transportSet.productSpecHash
      === input.buildTopology.authority.productSpecHash],
    ["transport_delivery", input.transportSet.deliverySelectionHash
      === input.deliverySelectionHash],
    ["transport_action_count", input.transportSet.contractCount
      === input.productSpec.actions.length],
    ["test_realization_hash", testTarget.authority.realizationPlanHash
      === input.realizationPlan.planHash],
    ["test_realization_membership", testTarget.authority.realizationMembershipHash
      === input.realizationPlan.realizationMembershipHash],
    ["test_generator_contract", testTarget.authority.generatorContractHash
      === NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2],
    ["test_generator_profile", testTarget.authority.generatorProfileHash
      === hashNodeProductTestGeneratorProfileV2(profile)],
    ["test_source_profile_ref", testTarget.authority.sourcePathRef
      === profile.sourcePathRef],
    ["test_compiled_profile_ref", testTarget.authority.compiledPathRef
      === profile.compiledPathRef],
    ["test_runtime_import", testTarget.authority.runtimeImportSpecifier
      === profile.runtimeImportSpecifier],
    ["test_coverage_hash", testTarget.authority.coverageMembershipHash
      === hashFileTreeTestCoverageMembershipV3(testTarget.authority.coverageBindings)],
    ["test_action_coverage", canonicalJsonStringify(coverageActions.sort(compareUtf16))
      === canonicalJsonStringify(input.productSpec.actions.map((action) => action.id)
        .sort(compareUtf16))],
    ["test_evidence_coverage", canonicalJsonStringify(coverageEvidence.sort(compareUtf16))
      === canonicalJsonStringify(evidenceRelations)],
    ["test_evidence_subjects", evidenceRelations.every((reference) =>
      predicates.has(reference))],
    ["topology_test_path", testBuildPath?.authority.kind === "file_tree_v3_path"
      && testBuildPath.authority.fileTreeEntryHash === testTarget.entryHash],
    ["topology_test_projection", testBuildPath?.currentState.state
      === "file_tree_v3_projection"
      && testBuildPath.currentState.projectedState === "absent"],
    ["compilation_test_source", input.buildTopology.compilation.test.sourcePathRef
      === testTarget.pathRef],
    ["compilation_test_locator", input.buildTopology.compilation.test
      .sourceNormalizedLocator === testTarget.normalizedLocator],
    ["compilation_test_profile_source", input.buildTopology.compilation.test
      .profileSourcePathRef === profile.sourcePathRef],
    ["compilation_test_profile_output", input.buildTopology.compilation.test
      .profileCompiledPathRef === profile.compiledPathRef],
    ["compilation_test_import", input.buildTopology.compilation.test
      .runtimeImportSpecifier === profile.runtimeImportSpecifier],
    ["compilation_test_coverage", input.buildTopology.compilation.test
      .coverageMembershipHash === testTarget.authority.coverageMembershipHash],
    ["runtime_receipt_product", input.runtimeSourceReceipt.authority.productRef
      === input.productSpec.product.id],
    ["runtime_receipt_spec", input.runtimeSourceReceipt.authority.productSpecHash
      === input.realizationPlan.authority.productSpecHash],
    ["runtime_receipt_delivery", input.runtimeSourceReceipt.authority
      .deliverySelectionHash === input.deliverySelectionHash],
    ["runtime_receipt_profile", input.runtimeSourceReceipt.authority.profileId
      === profile.profileId],
    ["runtime_receipt_stack", input.runtimeSourceReceipt.authority.stackPackId
      === profile.stackPackId],
    ["runtime_receipt_behavior", input.runtimeSourceReceipt.authority.runtimeBehavior
      .contractHash === input.runtimeBehaviorContract.contractHash],
    ["runtime_program", input.runtimeSourceReceipt.source.runtimeProgramHash
      === input.runtimeProgramHash],
  ] as const;
  const failed = joins.filter(([, joined]) => !joined).map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(
      `ProductSpec, behavior, runtime source, realization, FileTreeV3 and BuildTopologyV3 authority do not join exactly: ${failed.join(",")}`,
    );
  }
}

type TestCoverageDraftV2 = Readonly<{
  binding: Readonly<FileTreeTestCoverageBindingV3>;
  testRef: string;
  coverageSymbolRef: string;
}>;

function buildCoverageV2(input: Readonly<{
  productSpec: Readonly<ProductSpecV2>;
  runtimeProgram: Readonly<NodeProductRuntimeProgramV2>;
  scenarios: readonly TestScenarioV2[];
  fileTree: Readonly<FileTreeManifestV3>;
}>): Readonly<{
  actionTests: readonly NodeProductActionTestBindingV2[];
  assertionBindings: readonly NodeProductBehaviorAssertionTestBindingV2[];
  entityBindings: readonly NodeProductEntityFieldTestBindingV2[];
  coverageDrafts: readonly TestCoverageDraftV2[];
}> {
  const testTarget = exactTestTargetV2(input.fileTree);
  if (testTarget.authority.kind !== "generated_test_source_target") {
    throw new Error("Generated-test target authority kind changed");
  }
  const scenarioByAction = new Map(input.scenarios.map((scenario) =>
    [scenario.actionRef, scenario] as const));
  const predicateByRef = new Map(input.productSpec.evidencePredicates.map((predicate) =>
    [predicate.id, predicate] as const));
  const evidenceOwnerByRef = new Map<string, string>();
  for (const binding of testTarget.authority.coverageBindings) {
    if (binding.coverageKind !== "evidence_relation") continue;
    const predicate = predicateByRef.get(binding.subjectRef);
    if (!predicate) {
      throw new Error(`Evidence coverage ${binding.subjectRef} has no ProductSpec predicate`);
    }
    evidenceOwnerByRef.set(
      binding.subjectRef,
      evidenceOwnerActionRefV2(input.productSpec, predicate),
    );
  }

  const assertionBindings = input.runtimeProgram.runtimeBehavior.assertions.map((assertion) => {
    const touching = input.runtimeProgram.actions.find((action) =>
      action.stateDeltas.some((delta) => delta.stateRef === assertion.stateRef));
    const owner = touching ?? input.runtimeProgram.actions[0];
    const scenario = owner ? scenarioByAction.get(owner.actionRef) : undefined;
    if (!scenario) {
      throw new Error(`Runtime assertion ${assertion.assertionRef} has no action test owner`);
    }
    return Object.freeze({
      invariantRef: assertion.invariantRef,
      assertionRef: assertion.assertionRef,
      assertionHash: assertion.assertionHash,
      testRef: scenario.testRef,
    });
  }).sort((left, right) => compareUtf16(left.assertionRef, right.assertionRef));

  const entityBindings = input.runtimeProgram.runtimeBehavior.entityFieldBindings.map((binding) => {
    const scenario = scenarioByAction.get(binding.actionRef);
    if (!scenario) {
      throw new Error(`Entity occurrence ${binding.occurrenceRef} has no owning action test`);
    }
    return Object.freeze({
      occurrenceRef: binding.occurrenceRef,
      snapshotBindingHash: binding.snapshotBindingHash,
      actionRef: binding.actionRef,
      testRef: scenario.testRef,
    });
  }).sort((left, right) => compareUtf16(left.occurrenceRef, right.occurrenceRef));

  const actionTests = input.scenarios.map((scenario) => {
    const evidenceRefs = [...evidenceOwnerByRef.entries()].flatMap(
      ([evidenceRef, actionRef]) => actionRef === scenario.actionRef ? [evidenceRef] : [],
    ).sort(compareUtf16);
    if (evidenceRefs.length === 0) {
      throw new Error(`${scenario.actionRef} has no generated evidence coverage`);
    }
    return Object.freeze({
      testRef: scenario.testRef,
      actionRef: scenario.actionRef,
      scenarioHash: scenario.scenarioHash,
      transportContractHash: scenario.transportContractHash,
      targetRequestHash: scenario.targetRequestHash,
      stepCount: scenario.steps.length,
      evidenceRefs,
      behaviorAssertionRefs: assertionBindings.flatMap((binding) =>
        binding.testRef === scenario.testRef ? [binding.assertionRef] : []),
      entityFieldOccurrenceRefs: entityBindings.flatMap((binding) =>
        binding.testRef === scenario.testRef ? [binding.occurrenceRef] : []),
    });
  });

  const coverageDrafts = testTarget.authority.coverageBindings.map((binding) => {
    const actionRef = binding.coverageKind === "action"
      ? binding.subjectRef
      : evidenceOwnerByRef.get(binding.subjectRef);
    const scenario = actionRef ? scenarioByAction.get(actionRef) : undefined;
    if (!scenario) {
      throw new Error(
        `Coverage ${binding.coverageKind}:${binding.subjectRef} has no exact action test`,
      );
    }
    return Object.freeze({
      binding: Object.freeze(structuredClone(binding)),
      testRef: scenario.testRef,
      coverageSymbolRef: deriveNodeProductTestCoverageSymbolRefV2(binding),
    });
  });

  return Object.freeze({
    actionTests: Object.freeze(actionTests),
    assertionBindings: Object.freeze(assertionBindings),
    entityBindings: Object.freeze(entityBindings),
    coverageDrafts: Object.freeze(coverageDrafts),
  });
}

const CLI_TEST_SOURCE_V2 = String.raw`
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_PROGRAM_V2: any = JSON.parse(TEST_PROGRAM_JSON_V2);
const RUNTIME_MODULE_PATH_V2 = fileURLToPath(
  new URL(TEST_PROGRAM_V2.runtimeImportSpecifier, import.meta.url),
);

for (const testCaseV2 of TEST_PROGRAM_V2.tests) {
  test(testCaseV2.actionRef, { concurrency: false }, () => {
    assert.equal(
      testCaseV2.steps.length,
      1,
      "CLI evidence requires one fresh-process target step",
    );
    const stepV2 = testCaseV2.steps[0];
    assert.equal(stepV2.invocationKind, "cli_command");
    const invocationV2 = spawnSync(
      process.execPath,
      [
        RUNTIME_MODULE_PATH_V2,
        ...stepV2.request.subcommandTokens,
        ...stepV2.request.argvSuffix,
      ],
      {
        input: stepV2.request.stdinBytes === null
          ? undefined
          : stepV2.request.stdinBytes,
        encoding: "utf8",
        env: {},
        timeout: 5_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
    );
    assert.equal(invocationV2.error, undefined);
    assert.equal(invocationV2.signal, null);
    assert.equal(invocationV2.status, stepV2.successCode);
    assert.equal(invocationV2.stderr, "");
    assert.equal(invocationV2.stdout, stepV2.expectedCanonicalBody + "\n");
  });
}
`;

const API_TEST_SOURCE_V2 = String.raw`
import assert from "node:assert/strict";
import test from "node:test";

const TEST_PROGRAM_V2: any = JSON.parse(TEST_PROGRAM_JSON_V2);

for (const testCaseV2 of TEST_PROGRAM_V2.tests) {
  test(testCaseV2.actionRef, { concurrency: false }, async () => {
    const runtimeSpecifierV2 = TEST_PROGRAM_V2.runtimeImportSpecifier
      + "?setfarm_test="
      + encodeURIComponent(testCaseV2.testRef);
    const runtimeModuleV2: any = await import(runtimeSpecifierV2);
    const handlerV2: any = runtimeModuleV2.setfarmHttpHandlerV2;
    assert.equal(typeof handlerV2, "function");

    for (const stepV2 of testCaseV2.steps) {
      assert.equal(stepV2.invocationKind, "http_request");
      let responseStatusV2: number | undefined;
      let responseBodyV2: any;
      let nextCallCountV2 = 0;
      let nextErrorV2: any;
      const responseV2: any = {};
      responseV2.status = (statusV2: number): any => {
        responseStatusV2 = statusV2;
        return responseV2;
      };
      responseV2.json = (bodyV2: any): any => {
        responseBodyV2 = bodyV2;
        return responseV2;
      };
      const requestV2: any = {
        method: stepV2.request.method,
        originalUrl: stepV2.request.pathAndQuery,
        url: stepV2.request.pathAndQuery,
        body: stepV2.request.bodyBytes === null
          ? undefined
          : JSON.parse(stepV2.request.bodyBytes),
      };
      handlerV2(requestV2, responseV2, (errorV2?: any): void => {
        nextCallCountV2 += 1;
        nextErrorV2 = errorV2;
      });
      assert.equal(nextCallCountV2, 0);
      assert.equal(nextErrorV2, undefined);
      assert.equal(responseStatusV2, stepV2.successCode);
      assert.deepEqual(responseBodyV2, stepV2.expectedBody);
    }
  });
}
`;

function generatedSourceV2(
  program: Readonly<NodeProductTestProgramV2>,
  coverageDrafts: readonly TestCoverageDraftV2[],
): Readonly<{
  sourceText: string;
  coverageMembers: readonly NodeProductTestCoverageMemberV2[];
}> {
  const lines = [
    "/* Code-owned Setfarm NodeProductTestGeneratorV2 output. */",
    "/* Model writes, network access and ambient discovery are forbidden. */",
  ];
  const spans = new Map<string, Readonly<{
    markerLine: number;
    startByte: number;
    endByteExclusive: number;
    markerHash: string;
  }>>();
  let byteOffset = Buffer.byteLength(`${lines.join("\n")}\n`, "utf8");
  coverageDrafts.forEach((draft) => {
    const key = `${draft.binding.coverageKind}\0${draft.binding.subjectRef}\0${draft.binding.realizationRef}`;
    const marker = `// @setfarm-test-coverage-v2 ${draft.coverageSymbolRef} ${draft.testRef} ${draft.binding.coverageKind} ${draft.binding.subjectRef} ${draft.binding.realizationRef} ${draft.binding.realizationHash}`;
    const markerBytes = Buffer.byteLength(marker, "utf8");
    lines.push(marker);
    spans.set(key, Object.freeze({
      markerLine: lines.length,
      startByte: byteOffset,
      endByteExclusive: byteOffset + markerBytes,
      markerHash: rawSha256(marker),
    }));
    byteOffset += markerBytes + 1;
  });
  const programJson = canonicalJsonStringify(program);
  lines.push(`const TEST_PROGRAM_JSON_V2 = ${JSON.stringify(programJson)};`);
  const sourceText = `${lines.join("\n")}\n${
    program.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? CLI_TEST_SOURCE_V2
      : API_TEST_SOURCE_V2
  }`;
  const coverageMembers = coverageDrafts.map((draft) => {
    const key = `${draft.binding.coverageKind}\0${draft.binding.subjectRef}\0${draft.binding.realizationRef}`;
    return Object.freeze({
      ...draft.binding,
      testRef: draft.testRef,
      coverageSymbolRef: draft.coverageSymbolRef,
      sourceSpan: spans.get(key)!,
    });
  });
  return Object.freeze({
    sourceText,
    coverageMembers: Object.freeze(coverageMembers),
  });
}

async function generateInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<NodeProductTestSourceGenerationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return singleRejected(
      "NODE_TEST_SOURCE_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = GeneratorInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return singleRejected(
      "NODE_TEST_SOURCE_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Test-source generator input is invalid",
    );
  }
  if (
    expectedScope === "production_host"
    && !isProductionNodeScaffoldPrivateStageV2(handle)
  ) {
    return singleRejected(
      "NODE_TEST_SOURCE_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "/stage",
      "Production test-source generation requires production private-stage authority",
    );
  }
  if (
    expectedScope === "test_fixture"
    && isProductionNodeScaffoldPrivateStageV2(handle)
  ) {
    return singleRejected(
      "NODE_TEST_SOURCE_V2_INPUT_INVALID",
      "/stage",
      "Test-source fixture generation cannot consume or downgrade production authority",
    );
  }

  const productSpecResult = ProductSpecV2Schema.safeParse(parsed.data.productSpec);
  if (!productSpecResult.success) {
    return singleRejected(
      "NODE_TEST_SOURCE_V2_INPUT_INVALID",
      `/productSpec/${productSpecResult.error.issues[0]?.path.join("/") ?? ""}`
        .replace(/\/$/u, ""),
      productSpecResult.error.issues[0]?.message ?? "ProductSpecV2 is invalid",
    );
  }
  const productSpec = productSpecResult.data;
  const evidenceDiagnostics = unsupportedEvidenceDiagnosticsV2(productSpec);
  if (evidenceDiagnostics.length > 0) return rejected(evidenceDiagnostics);

  try {
    const verifiedBehaviorContract = verifyProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: parsed.data.runtimeBehaviorProposal,
      candidate: parsed.data.runtimeBehaviorContract,
    });
    const selection = verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: parsed.data.deliverySelection
        && typeof parsed.data.deliverySelection === "object"
        && "requestedStackPackId" in parsed.data.deliverySelection
        ? (parsed.data.deliverySelection as { requestedStackPackId: unknown })
          .requestedStackPackId
        : undefined,
      candidate: parsed.data.deliverySelection,
    });
    if (
      selection.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      && productSpec.actions.some((action) =>
        action.evidenceScenario.prerequisiteSteps.length > 0)
    ) {
      const actionIndex = productSpec.actions.findIndex((action) =>
        action.evidenceScenario.prerequisiteSteps.length > 0);
      return singleRejected(
        "NODE_TEST_SOURCE_V2_CLI_SEQUENCE_REJECTED",
        `/productSpec/actions/${actionIndex}/evidenceScenario/prerequisiteSteps`,
        "CLI evidence prerequisites require a single-process sequence ABI; separate fresh processes would fabricate state continuity",
      );
    }
    const deliverySelectionHash = hashProductDeliverySelectionV2(selection);
    const verifiedPlan = verifySemanticRealizationPlanV2({
      productSpec,
      deliverySelection: selection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
      candidate: parsed.data.realizationPlan,
    });
    const verifiedTopology = expectedScope === "production_host"
      ? await verifyBuildTopologyV3(handle, {
          productSpec,
          deliverySelection: selection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        })
      : await verifyBuildTopologyV3ForTest(handle, {
          productSpec,
          deliverySelection: selection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        });
    const fileTree = FileTreeManifestV3Schema.parse(parsed.data.fileTree);
    const transportResult = compileInvocationInputTransportSetV2({
      productSpec,
      deliverySelection: selection,
    });
    if (transportResult.status !== "shadow_compiled") {
      return singleRejected(
        "NODE_TEST_SOURCE_V2_TRANSPORT_REJECTED",
        transportResult.diagnostics[0]?.path ?? "/",
        transportResult.diagnostics[0]?.message
          ?? "Fresh invocation transport compilation was rejected",
      );
    }
    let verifiedRuntimeSource;
    try {
      verifiedRuntimeSource = expectedScope === "production_host"
        ? await verifyNodeProductRuntimeSourceV2(handle, {
            productSpec,
            deliverySelection: selection,
            runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
            runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
            realizationPlan: parsed.data.realizationPlan,
            fileTree: parsed.data.fileTree,
            buildTopology: parsed.data.buildTopology,
            candidateSourceText: parsed.data.runtimeSourceText,
            candidateReceipt: parsed.data.runtimeSourceReceipt,
          })
        : await verifyNodeProductRuntimeSourceV2ForTest(handle, {
            productSpec,
            deliverySelection: selection,
            runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
            runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
            realizationPlan: parsed.data.realizationPlan,
            fileTree: parsed.data.fileTree,
            buildTopology: parsed.data.buildTopology,
            candidateSourceText: parsed.data.runtimeSourceText,
            candidateReceipt: parsed.data.runtimeSourceReceipt,
          });
    } catch (error) {
      if (error instanceof NodeProductRuntimeSourceVerificationErrorV2) {
        return singleRejected(
          "NODE_TEST_SOURCE_V2_RUNTIME_SOURCE_REJECTED",
          "/runtimeSourceReceipt",
          error.message,
        );
      }
      throw error;
    }

    const runtimeProgram = projectNodeProductRuntimeProgramV2(
      productSpec,
      verifiedBehaviorContract,
      transportResult.contractSet,
      selection.profileId,
    );
    const runtimeProgramHash = hashCanonicalJson({
      schema: "setfarm.node-product-runtime-program-hash.v2",
      program: runtimeProgram,
    });
    assertAuthorityJoinsV2({
      productSpec,
      deliverySelectionHash,
      runtimeBehaviorContract: verifiedBehaviorContract,
      realizationPlan: verifiedPlan.value,
      fileTree,
      buildTopology: verifiedTopology.value,
      transportSet: transportResult.contractSet,
      runtimeSourceReceipt: verifiedRuntimeSource.receipt,
      runtimeProgramHash,
    });

    const profile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
      (candidate) => candidate.profileId === selection.profileId,
    );
    if (!profile) throw new Error("Test generator profile is absent");
    const scenarios = compileTestScenariosV2(
      productSpec,
      runtimeProgram,
      runtimeProgramHash,
    );
    const program: NodeProductTestProgramV2 = Object.freeze({
      schema: "setfarm.node-product-test-program.v2" as const,
      programVersion: "2.0.0" as const,
      testProgramContractHash: NODE_PRODUCT_TEST_PROGRAM_CONTRACT_HASH_V2,
      runtimeProgramHash,
      runtimeImportSpecifier: profile.runtimeImportSpecifier,
      profileId: selection.profileId,
      tests: scenarios,
    });
    const testProgramHash = hashCanonicalJson({
      schema: "setfarm.node-product-test-program-hash.v2",
      program,
    });
    const coverage = buildCoverageV2({
      productSpec,
      runtimeProgram,
      scenarios,
      fileTree,
    });
    const generated = generatedSourceV2(program, coverage.coverageDrafts);
    const sourceBytes = Buffer.from(generated.sourceText, "utf8");
    if (
      sourceBytes.byteLength > NODE_PRODUCT_TEST_SOURCE_MAX_BYTES_V2
      || !generated.sourceText.endsWith("\n")
      || generated.sourceText.includes("\r")
      || generated.sourceText.includes("\0")
    ) {
      return singleRejected(
        "NODE_TEST_SOURCE_V2_OUTPUT_LIMIT_EXCEEDED",
        "/sourceText",
        "Generated test source violates byte, UTF-8 or LF-only bounds",
      );
    }
    for (const member of generated.coverageMembers) {
      const markerBytes = sourceBytes.subarray(
        member.sourceSpan.startByte,
        member.sourceSpan.endByteExclusive,
      );
      if (rawSha256(markerBytes) !== member.sourceSpan.markerHash) {
        throw new Error(
          `Generated test coverage marker drifted for ${member.realizationRef}`,
        );
      }
    }
    const testTarget = exactTestTargetV2(fileTree);
    if (
      testTarget.authority.kind !== "generated_test_source_target"
      || testTarget.normalizedLocator !== profile.sourceNormalizedLocator
    ) {
      throw new Error("Generated-test locator differs from exact profile authority");
    }
    const sourceWithoutHash = {
      pathRef: profile.sourcePathRef,
      normalizedLocator: profile.sourceNormalizedLocator,
      compiledPathRef: profile.compiledPathRef,
      compiledNormalizedLocator: profile.compiledNormalizedLocator,
      runtimeImportSpecifier: profile.runtimeImportSpecifier,
      mediaType: "text/typescript" as const,
      encoding: "utf-8" as const,
      newline: "lf" as const,
      finalNewline: true as const,
      moduleSystem: "node_esm" as const,
      contentHash: rawSha256(sourceBytes),
      byteLength: sourceBytes.byteLength,
      lineCount: generated.sourceText.split("\n").length - 1,
      testProgramHash,
    };
    const source = Object.freeze({
      ...sourceWithoutHash,
      sourceIdentityHash: hashNodeProductTestSourceIdentityV2(sourceWithoutHash),
    });
    const logicalIdentity: NodeProductTestSourceReceiptLogicalIdentityV2 = {
      schema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
      receiptVersion: "2.0.0",
      readiness: {
        status: "shadow_generated",
        productionUse: "forbidden",
      },
      authority: {
        productRef: productSpec.product.id,
        productSpecHash: selection.productSpecHash,
        deliverySelectionHash,
        profileId: selection.profileId,
        stackPackId: selection.requestedStackPackId,
        generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2",
        generatorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
        generatorProfileHash: hashNodeProductTestGeneratorProfileV2(profile),
        testProgramContractHash: NODE_PRODUCT_TEST_PROGRAM_CONTRACT_HASH_V2,
        invocationTransportSet: {
          schema: "setfarm.invocation-input-transport-set.v2",
          contractSetHash: transportResult.contractSetHash,
          membershipHash: transportResult.membershipHash,
          contractCount: transportResult.contractSet.contractCount,
        },
        runtimeBehavior: {
          proposalHash: verifiedBehaviorContract.authority.proposalHash,
          contractHash: verifiedBehaviorContract.contractHash,
          evaluatorContractHash:
            verifiedBehaviorContract.authority.evaluatorContractHash,
        },
        runtimeSource: {
          schema: verifiedRuntimeSource.receipt.schema,
          logicalReceiptHash: verifiedRuntimeSource.receipt.logicalReceiptHash,
          sourceContentHash: verifiedRuntimeSource.receipt.source.contentHash,
          runtimeProgramHash,
          runtimeProgramContractHash:
            verifiedRuntimeSource.receipt.authority.runtimeProgramContractHash,
          behaviorContractHash:
            verifiedRuntimeSource.receipt.authority.runtimeBehavior.contractHash,
        },
        semanticRealizationPlan: {
          schema: "setfarm.semantic-realization-plan.v2",
          planHash: verifiedPlan.value.planHash,
          realizationMembershipHash:
            verifiedPlan.value.realizationMembershipHash,
          actionTestCount: coverage.actionTests.length,
          evidenceRelationCount: verifiedPlan.value.coverage.evidenceRelationCount,
        },
        fileTree: {
          schema: "setfarm.file-tree-manifest.v3",
          manifestHash: fileTree.manifestHash,
          testPathEntryHash: testTarget.entryHash,
          coverageMembershipHash:
            testTarget.authority.coverageMembershipHash,
        },
        buildTopology: {
          schema: "setfarm.build-topology.v3",
          logicalBuildHash: verifiedTopology.value.logicalBuildHash,
          compilationContractHash:
            verifiedTopology.value.authority.compilationContractHash,
        },
      },
      source,
      coverage: {
        testCount: coverage.actionTests.length,
        actionTests: [...coverage.actionTests],
        actionTestMembershipHash:
          hashNodeProductActionTestMembershipV2(coverage.actionTests),
        coverageBindingCount: generated.coverageMembers.length,
        coverageMembers: [...generated.coverageMembers],
        fileTreeCoverageMembershipHash:
          testTarget.authority.coverageMembershipHash,
        generatedCoverageMembershipHash:
          hashNodeProductTestCoverageMemberMembershipV2(
            generated.coverageMembers,
          ),
        behavior: {
          contractHash: verifiedBehaviorContract.contractHash,
          assertionBindingCount: coverage.assertionBindings.length,
          assertionBindings: [...coverage.assertionBindings],
          assertionMembershipHash:
            hashNodeProductBehaviorAssertionTestMembershipV2(
              coverage.assertionBindings,
            ),
          entityFieldBindingCount: coverage.entityBindings.length,
          entityFieldBindings: [...coverage.entityBindings],
          entityFieldMembershipHash:
            hashNodeProductEntityFieldTestMembershipV2(coverage.entityBindings),
          checkpoints: {
            initial: "fresh_runtime_instance_per_action_test",
            afterAction: "target_and_prerequisite_invocations",
            afterRehydration:
              "not_applicable_selected_profiles_forbid_durable_rehydration",
          },
        },
        evidenceRelationCount: verifiedPlan.value.coverage.evidenceRelationCount,
        disposition:
          "every_action_evidence_relation_runtime_assertion_and_entity_binding_has_exact_generated_test_source",
      },
    };
    const receiptWithoutHash: NodeProductTestSourceReceiptHashPayloadV2 = {
      ...logicalIdentity,
      logicalReceiptHash:
        hashNodeProductTestSourceLogicalReceiptV2(logicalIdentity),
      operationalEvidence: {
        admissionScope: verifiedTopology.value.operationalEvidence.admissionScope,
        buildTopologyManifestHash: verifiedTopology.value.manifestHash,
        runtimeSourceReceiptHash: verifiedRuntimeSource.receipt.receiptHash,
        evidenceAuthority:
          "authenticated_private_dependency_stage_and_fresh_runtime_source_v2",
      },
    };
    const receipt = recursivelyFreezeNodeProductTestSourceV2(
      NodeProductTestSourceReceiptV2Schema.parse({
        ...receiptWithoutHash,
        receiptHash: hashNodeProductTestSourceReceiptV2(receiptWithoutHash),
      }),
    );
    return recursivelyFreezeNodeProductTestSourceV2({
      status: "shadow_generated" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      sourceText: generated.sourceText,
      sourceContentHash: source.contentHash,
      testProgramHash,
      receipt,
      canonicalReceiptBytes: canonicalJsonStringify(receipt),
    });
  } catch (error) {
    return singleRejected(
      error instanceof BuildTopologyVerificationErrorV3
        ? "NODE_TEST_SOURCE_V2_BUILD_TOPOLOGY_REJECTED"
        : error instanceof SemanticRealizationPlanVerificationErrorV2
          ? "NODE_TEST_SOURCE_V2_REALIZATION_PLAN_REJECTED"
          : error instanceof z.ZodError
            ? "NODE_TEST_SOURCE_V2_ARTIFACT_INVALID"
            : "NODE_TEST_SOURCE_V2_UPSTREAM_AUTHORITY_MISMATCH",
      "/",
      errorMessage(error),
    );
  }
}

export function generateNodeProductTestSourceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductTestSourceGenerationResultV2> {
  return generateInternalV2(handle, input, "production_host");
}

export function generateNodeProductTestSourceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductTestSourceGenerationResultV2> {
  return generateInternalV2(handle, input, "test_fixture");
}

export type NodeProductTestSourceVerificationErrorCodeV2 =
  | "NODE_TEST_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "NODE_TEST_SOURCE_V2_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_TEST_SOURCE_V2_VERIFICATION_INPUT_INVALID"
  | "NODE_TEST_SOURCE_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class NodeProductTestSourceVerificationErrorV2 extends Error {
  readonly code: NodeProductTestSourceVerificationErrorCodeV2;

  constructor(
    code: NodeProductTestSourceVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "NodeProductTestSourceVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowNodeProductTestSourceV2 = Readonly<{
  status: "verified_shadow";
  sourceText: string;
  receipt: Readonly<NodeProductTestSourceReceiptV2>;
  canonicalReceiptBytes: string;
}>;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowNodeProductTestSourceV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new NodeProductTestSourceVerificationErrorV2(
      "NODE_TEST_SOURCE_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new NodeProductTestSourceVerificationErrorV2(
      "NODE_TEST_SOURCE_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Test-source verifier input is invalid",
    );
  }
  const candidateReceipt = NodeProductTestSourceReceiptV2Schema.safeParse(
    parsed.data.candidateReceipt,
  );
  if (!candidateReceipt.success) {
    throw new NodeProductTestSourceVerificationErrorV2(
      "NODE_TEST_SOURCE_V2_VERIFICATION_CANDIDATE_INVALID",
      candidateReceipt.error.issues[0]?.message
        ?? "Test-source receipt candidate is invalid",
    );
  }
  const reproduced = await generateInternalV2(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    realizationPlan: parsed.data.realizationPlan,
    fileTree: parsed.data.fileTree,
    buildTopology: parsed.data.buildTopology,
    runtimeSourceText: parsed.data.runtimeSourceText,
    runtimeSourceReceipt: parsed.data.runtimeSourceReceipt,
  }, expectedScope);
  if (reproduced.status !== "shadow_generated") {
    throw new NodeProductTestSourceVerificationErrorV2(
      "NODE_TEST_SOURCE_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh test-source reproduction was rejected",
    );
  }
  if (
    parsed.data.candidateSourceText !== reproduced.sourceText
    || canonicalJsonStringify(candidateReceipt.data)
      !== reproduced.canonicalReceiptBytes
  ) {
    throw new NodeProductTestSourceVerificationErrorV2(
      "NODE_TEST_SOURCE_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Test source or receipt differs from fresh ProductSpec, behavior, runtime source, realization and topology authority",
    );
  }
  return recursivelyFreezeNodeProductTestSourceV2({
    status: "verified_shadow" as const,
    sourceText: reproduced.sourceText,
    receipt: reproduced.receipt,
    canonicalReceiptBytes: reproduced.canonicalReceiptBytes,
  });
}

export function verifyNodeProductTestSourceV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeProductTestSourceV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyNodeProductTestSourceV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeProductTestSourceV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}
