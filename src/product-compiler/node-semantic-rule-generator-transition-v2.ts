import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  BuildTopologyVerificationErrorV2,
  verifyBuildTopologyV2,
  verifyBuildTopologyV2ForTest,
} from "./build-topology-v2.js";
import type { BuildTopologyV2 } from "./schemas/build-topology-v2.js";
import { isProductionNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import type { MaterializedNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import {
  compileSemanticSourceIntentSetV1,
} from "./semantic-source-intent-set-v1.js";
import {
  compileSemanticSourcePathTokenSetV2,
} from "./semantic-source-path-token-set-v2.js";
import {
  getCodeOwnedStackSemanticSourceRuleSetV1,
} from "./stack-semantic-source-rules-catalog-v1.js";
import {
  NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
  NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BOUNDED_WORK_LIMITS_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_V2_SCHEMA,
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2,
  NodeSemanticRuleGeneratorTransitionEntryV2Schema,
  NodeSemanticRuleGeneratorTransitionV2Schema,
  deriveNodeSemanticRuleGeneratorTransitionRefV2,
  hashNodeSemanticRuleGeneratorTransitionEntryV2,
  hashNodeSemanticRuleGeneratorTransitionMembershipV2,
  hashNodeSemanticRuleGeneratorTransitionV2,
  hashNodeEntrypointGeneratorProfileV2,
  nodeSemanticRuleGeneratorDispositionV2,
  recursivelyFreezeNodeSemanticRuleGeneratorTransitionV2,
  type NodeSemanticRuleGeneratorTransitionEntryHashPayloadV2,
  type NodeSemanticRuleGeneratorTransitionEntryV2,
  type NodeSemanticRuleGeneratorTransitionHashPayloadV2,
  type NodeSemanticRuleGeneratorTransitionV2,
} from "./schemas/node-semantic-rule-generator-transition-v2.js";
import {
  FileTreeManifestV2Schema,
  type FileTreeEntrypointRequirementBindingV2,
  type FileTreeManifestV2,
} from "./schemas/file-tree-manifest-v2.js";
import type { SemanticSourceIntentSetV1, SemanticSourceIntentV1 } from
  "./schemas/semantic-source-intent-set-v1.js";
import {
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
  type SemanticSourceExternalPathRequirementV2,
  type SemanticSourcePathTokenSetV2,
} from "./schemas/semantic-source-path-token-set-v2.js";
import {
  STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
  TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
  type SemanticSourceRuleV1,
  type StackSemanticSourceRuleSetV1,
} from "./schemas/stack-semantic-source-rules-v1.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 20 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 24 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 24,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 120_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 120_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const NO_DESIGN_CLOSURE_V2 = Object.freeze({
  schema: "setfarm.design-source-closure.v2" as const,
  kind: "none" as const,
  reason: "product_delivery_design_not_required" as const,
});
const TRANSITION_RESPONSIBILITIES = new Set([
  "entrypoint_registration",
  "route_registration",
  "runtime_registration",
] as const);

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  fileTree: z.unknown(),
  buildTopology: z.unknown(),
}).strict();

const VerifierInputV2Schema = CompilerInputV2Schema.extend({
  candidate: z.unknown(),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

export type NodeSemanticRuleGeneratorTransitionDiagnosticCodeV2 =
  | "NODE_RULE_GENERATOR_TRANSITION_V2_ARTIFACT_INVALID"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_BUILD_TOPOLOGY_REJECTED"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_INPUT_INVALID"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_OUTPUT_LIMIT_EXCEEDED"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_TEST_AUTHORITY_REQUIRED"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_UPSTREAM_AUTHORITY_REJECTED";

export type NodeSemanticRuleGeneratorTransitionDiagnosticV2 = Readonly<{
  code: NodeSemanticRuleGeneratorTransitionDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type NodeSemanticRuleGeneratorTransitionCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<NodeSemanticRuleGeneratorTransitionV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeSemanticRuleGeneratorTransitionDiagnosticV2[];
    }>;

function rejected(
  code: NodeSemanticRuleGeneratorTransitionDiagnosticCodeV2,
  path: string,
  message: string,
): NodeSemanticRuleGeneratorTransitionCompilationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class NodeRuleGeneratorTransitionAuthorityErrorV2 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "NodeRuleGeneratorTransitionAuthorityErrorV2";
  }
}

function authorityFailure(message: string): never {
  throw new NodeRuleGeneratorTransitionAuthorityErrorV2(message);
}

type FreshSemanticAuthorityV2 = Readonly<{
  intentSet: Readonly<SemanticSourceIntentSetV1>;
  pathSet: Readonly<SemanticSourcePathTokenSetV2>;
  ruleSet: Readonly<StackSemanticSourceRuleSetV1>;
}>;

function reproduceFreshSemanticAuthorityV2(input: Readonly<{
  productSpec: unknown;
  deliverySelection: unknown;
  stackPackId: "node-cli" | "node-express-api";
}>): FreshSemanticAuthorityV2 {
  const intentResult = compileSemanticSourceIntentSetV1({
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
    designSourceClosure: NO_DESIGN_CLOSURE_V2,
  });
  if (intentResult.status !== "shadow_compiled") {
    authorityFailure(
      intentResult.diagnostics[0]?.message
      ?? "Semantic source intent authority was rejected",
    );
  }
  const pathResult = compileSemanticSourcePathTokenSetV2({
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
  });
  if (pathResult.status !== "shadow_compiled") {
    authorityFailure(
      pathResult.diagnostics[0]?.message
      ?? "Semantic source path authority was rejected",
    );
  }
  const ruleSet = getCodeOwnedStackSemanticSourceRuleSetV1(input.stackPackId);
  if (
    !ruleSet
    || ruleSet.schema !== STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1
    || ruleSet.ruleSetVersion !== "1.0.0"
    || ruleSet.ruleSetHash
      !== intentResult.intentSet.authority.semanticRuleSet.ruleSetHash
    || pathResult.value.sourceAuthority.semanticRuleSetHash !== ruleSet.ruleSetHash
    || pathResult.value.sourceAuthority.semanticIntentSetHash
      !== intentResult.intentSet.intentSetHash
  ) {
    authorityFailure(
      "Fresh Node rules, semantic intents and semantic path authorities diverged",
    );
  }
  return Object.freeze({
    intentSet: intentResult.intentSet,
    pathSet: pathResult.value,
    ruleSet,
  });
}

function exactlyOneByRef<T extends Readonly<{ [key: string]: unknown }>>(
  values: readonly T[],
  field: keyof T,
  reference: unknown,
  label: string,
): T {
  const matches = values.filter((value) => value[field] === reference);
  if (matches.length !== 1) {
    authorityFailure(`Expected exactly one ${label} for ${String(reference)}`);
  }
  return matches[0]!;
}

type LegacyTransitionRuleViewV2 = Readonly<{
  pathSourceEntrypointKind: "cli" | "api";
  maxMembers: 64 | 500;
  slotKeyDomainRef: string;
  parserRef: "PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1";
  parserContractHash: string;
  slotKind:
    | "api_route_registration"
    | "cli_command_registration"
    | "entrypoint_registration"
    | "runtime_registration";
  slotTokenDomainRef: string;
  structuralPostconditionRef: string;
}>;

function requireLegacyTransitionRuleV2(
  rule: Readonly<SemanticSourceRuleV1>,
  entrypointKind: "cli" | "api",
): LegacyTransitionRuleViewV2 {
  const transitionResponsibility = TRANSITION_RESPONSIBILITIES.has(
    rule.responsibility as "entrypoint_registration"
      | "route_registration"
      | "runtime_registration",
  )
    ? rule.responsibility as
      | "entrypoint_registration"
      | "route_registration"
      | "runtime_registration"
    : null;
  if (
    rule.ruleKind !== "source_slot"
    || rule.ruleVersion !== "1.0.0"
    || !transitionResponsibility
    || rule.targetKind !== "project_source"
    || rule.ownerPolicy !== "setup_owner"
    || rule.pathResolution.kind !== "shared_structural_slot_path"
    || rule.pathResolution.pathSource.kind !== "selected_entrypoint_path"
    || rule.pathResolution.pathSource.entrypointKind !== entrypointKind
    || rule.cardinality.kind !== "catalog_bounded_aggregate"
    || rule.locatorContract.kind !== "versioned_ast_slot"
    || rule.accessPolicy !== "granted_writable"
    || rule.outputPolicy.kind !== "model_writable"
    || rule.outputPolicy.structuralPostconditionRefs.length !== 1
    || rule.subjectContractResolution.kind !== "none"
  ) {
    authorityFailure(
      `Legacy Node rule ${rule.ruleRef} is not the exact shared model-writable entrypoint ABI`,
    );
  }
  const expectedMaxMembers = transitionResponsibility === "route_registration"
    ? 500
    : 64;
  const expectedSlotKind = transitionResponsibility === "route_registration"
    ? entrypointKind === "cli"
      ? "cli_command_registration"
      : "api_route_registration"
    : transitionResponsibility;
  const expectedSlotKeyDomain =
    `SLOT_DOMAIN_${transitionResponsibility.toUpperCase()}_V1`;
  const expectedSlotTokenDomain =
    `SLOT_TOKEN_${transitionResponsibility.toUpperCase()}_V1`;
  const expectedPostcondition =
    `POSTCONDITION_${transitionResponsibility.toUpperCase()}_V1`;
  if (
    rule.cardinality.maxMembers !== expectedMaxMembers
    || rule.cardinality.slotKeyDomainRef !== expectedSlotKeyDomain
    || rule.locatorContract.parserRef !== "PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1"
    || rule.locatorContract.parserContractHash
      !== TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1
    || rule.locatorContract.slotKind !== expectedSlotKind
    || rule.locatorContract.slotTokenDomainRef !== expectedSlotTokenDomain
    || rule.outputPolicy.structuralPostconditionRefs[0] !== expectedPostcondition
  ) {
    authorityFailure(
      `Legacy Node rule ${rule.ruleRef} diverged from its complete V1 shared-entrypoint ABI`,
    );
  }
  return Object.freeze({
    pathSourceEntrypointKind: rule.pathResolution.pathSource.entrypointKind as
      "cli" | "api",
    maxMembers: rule.cardinality.maxMembers as 64 | 500,
    slotKeyDomainRef: rule.cardinality.slotKeyDomainRef,
    parserRef: rule.locatorContract.parserRef,
    parserContractHash: rule.locatorContract.parserContractHash,
    slotKind: rule.locatorContract.slotKind as LegacyTransitionRuleViewV2["slotKind"],
    slotTokenDomainRef: rule.locatorContract.slotTokenDomainRef,
    structuralPostconditionRef:
      rule.outputPolicy.structuralPostconditionRefs[0]!,
  });
}

function buildTransitionEntryV2(input: Readonly<{
  requirement: FileTreeEntrypointRequirementBindingV2;
  external: SemanticSourceExternalPathRequirementV2;
  intent: SemanticSourceIntentV1;
  rule: SemanticSourceRuleV1;
  ruleSetRef: string;
  ruleSetVersion: "1.0.0";
  entrypointPathRef: string;
  entrypointKind: "cli" | "api";
  sourcePathSlotRef:
    | "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2"
    | "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2";
  sourcePathToken: string;
  sourceTokenBindingHash: string;
  generatorProfileHash: string;
}>): NodeSemanticRuleGeneratorTransitionEntryV2 {
  const { requirement, external, intent, rule } = input;
  const legacyRule = requireLegacyTransitionRuleV2(rule, input.entrypointKind);
  if (
    intent.target.kind !== "source_slot"
    || intent.intentRef !== requirement.intentRef
    || intent.intentHash !== requirement.intentHash
    || intent.ruleSetHash !== requirement.ruleSetHash
    || intent.ruleRef !== requirement.ruleRef
    || intent.ruleHash !== requirement.ruleHash
    || rule.ruleHash !== requirement.ruleHash
    || rule.ruleRef !== requirement.ruleRef
    || intent.semanticScope.scopeRef !== requirement.scopeRef
    || intent.subjectKind !== requirement.subjectKind
    || intent.subjectRef !== requirement.subjectRef
    || intent.subjectHash !== requirement.subjectHash
    || intent.responsibility !== requirement.responsibility
    || external.intentRef !== requirement.intentRef
    || external.intentHash !== requirement.intentHash
    || external.requirementHash !== requirement.requirementHash
    || external.pathAuthorityProjectionHash
      !== requirement.pathAuthorityProjectionHash
    || external.ruleSetHash !== requirement.ruleSetHash
    || external.ruleRef !== requirement.ruleRef
    || external.responsibility !== requirement.responsibility
    || external.expectation.kind !== "shared_structural_selected_entrypoint"
    || external.expectation.entrypointKind !== input.entrypointKind
    || requirement.expectation.entrypointKind !== input.entrypointKind
    || requirement.expectation.requiredAuthority
      !== "node_execution_path_token_v2"
    || requirement.compatibilityStatus
      !== "current_v1_rule_unmigrated_v2_activation_forbidden"
  ) {
    authorityFailure(
      `Entrypoint requirement ${requirement.intentRef} diverged across V1 rule, intent, path and FileTree authority`,
    );
  }
  const responsibility = requirement.responsibility;
  if (!TRANSITION_RESPONSIBILITIES.has(
    responsibility as "entrypoint_registration"
      | "route_registration"
      | "runtime_registration",
  )) {
    authorityFailure(
      `Entrypoint requirement ${requirement.intentRef} has an unsupported transition responsibility`,
    );
  }
  const typedResponsibility = responsibility as
    | "entrypoint_registration"
    | "route_registration"
    | "runtime_registration";
  const expectedSubjectKind = typedResponsibility === "route_registration"
    ? "route"
    : "entrypoint";
  if (
    requirement.subjectKind !== expectedSubjectKind
    || (typedResponsibility === "route_registration")
      !== (requirement.storyId !== null)
  ) {
    authorityFailure(
      `Entrypoint requirement ${requirement.intentRef} has incompatible subject or story scope`,
    );
  }
  const transitionRef = deriveNodeSemanticRuleGeneratorTransitionRefV2({
    generatorContractHash: NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
    generatorProfileHash: input.generatorProfileHash,
    ruleSetHash: requirement.ruleSetHash,
    intentRef: requirement.intentRef,
    requirementHash: requirement.requirementHash,
    entrypointPathRef: input.entrypointPathRef,
  });
  const identity: NodeSemanticRuleGeneratorTransitionEntryHashPayloadV2 = {
    transitionRef,
    source: {
      ruleSetSchema: STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
      ruleSetRef: input.ruleSetRef,
      ruleSetVersion: input.ruleSetVersion,
      ruleSetHash: requirement.ruleSetHash,
      ruleRef: requirement.ruleRef,
      ruleVersion: "1.0.0",
      ruleHash: requirement.ruleHash,
      intentRef: requirement.intentRef,
      intentHash: requirement.intentHash,
      requirementHash: requirement.requirementHash,
      pathAuthorityProjectionHash: requirement.pathAuthorityProjectionHash,
      scopeRef: requirement.scopeRef,
      subjectKind: requirement.subjectKind as "entrypoint" | "route",
      subjectRef: requirement.subjectRef,
      subjectHash: requirement.subjectHash,
      responsibility: typedResponsibility,
      storyId: requirement.storyId,
      writerOwnerRef: requirement.writerOwnerRef,
      ruleKind: "source_slot",
      targetKind: "project_source",
      ownerPolicy: "setup_owner",
      pathResolution: "shared_structural_selected_entrypoint",
      pathSourceEntrypointKind: legacyRule.pathSourceEntrypointKind,
      cardinality: {
        kind: "catalog_bounded_aggregate",
        maxMembers: legacyRule.maxMembers,
        slotKeyDomainRef: legacyRule.slotKeyDomainRef,
      },
      locatorKind: "versioned_ast_slot",
      parserRef: legacyRule.parserRef,
      parserContractHash: legacyRule.parserContractHash,
      slotKind: legacyRule.slotKind,
      slotTokenDomainRef: legacyRule.slotTokenDomainRef,
      accessPolicy: "granted_writable",
      outputPolicy: "model_writable",
      structuralPostconditionRef: legacyRule.structuralPostconditionRef,
      compatibilityStatus: requirement.compatibilityStatus,
    },
    target: {
      generatorRef: "NODE_ENTRYPOINT_GENERATOR_V2",
      generatorContractHash: NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
      generatorProfileHash: input.generatorProfileHash,
      ownerRef: "OWNER_NODE_ENTRYPOINT_GENERATOR_V2",
      entrypointPathRef: input.entrypointPathRef,
      entrypointKind: input.entrypointKind,
      sourcePathSlotRef: input.sourcePathSlotRef,
      sourcePathToken: input.sourcePathToken,
      sourceTokenBindingHash: input.sourceTokenBindingHash,
      access: "generator_whole_file_future",
      outputPolicy: "deterministic_generated",
      modelWriteAuthority: "forbidden",
      sourceReceiptSchema: "setfarm.node-entrypoint-source-receipt.v2",
      sourceReceiptState: "absent",
      declarationState: "required_unverified",
      disposition: nodeSemanticRuleGeneratorDispositionV2(typedResponsibility),
    },
  };
  return NodeSemanticRuleGeneratorTransitionEntryV2Schema.parse({
    ...identity,
    entryHash: hashNodeSemanticRuleGeneratorTransitionEntryV2(identity),
  });
}

function buildTransitionV2(input: Readonly<{
  semantic: FreshSemanticAuthorityV2;
  fileTree: Readonly<FileTreeManifestV2>;
  buildTopology: Readonly<BuildTopologyV2>;
}>): NodeSemanticRuleGeneratorTransitionV2 {
  const { semantic, fileTree, buildTopology } = input;
  const entrypointPath = exactlyOneByRef(
    fileTree.paths.filter((path) => path.authority.kind === "node_entrypoint_plan"),
    "classification",
    "entrypoint_generated",
    "FileTree entrypoint",
  );
  if (entrypointPath.authority.kind !== "node_entrypoint_plan") {
    return authorityFailure("FileTree entrypoint lost its node plan authority");
  }
  const entrypointAuthority = entrypointPath.authority;
  const topologySource = exactlyOneByRef(
    buildTopology.paths,
    "pathRef",
    buildTopology.entrypoint.sourcePathRef,
    "BuildTopology source path",
  );
  const entrypointKind = buildTopology.entrypoint.kind;
  const generatorProfile = NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2.profiles.find(
    (profile) =>
      profile.profileId === buildTopology.authority.profileId
      && profile.stackPackId === buildTopology.authority.stackPackId,
  );
  if (!generatorProfile) {
    authorityFailure("BuildTopology lacks one code-owned Node generator profile");
  }
  const generatorProfileHash = hashNodeEntrypointGeneratorProfileV2(
    generatorProfile,
  );
  const buildOutput = exactlyOneByRef(
    buildTopology.paths,
    "pathRef",
    buildTopology.entrypoint.buildOutputPathRef,
    "BuildTopology output path",
  );
  const candidateModule = exactlyOneByRef(
    buildTopology.paths,
    "pathRef",
    buildTopology.entrypoint.candidateModulePathRef,
    "BuildTopology candidate path",
  );
  if (
    topologySource.pathRef !== entrypointPath.pathRef
    || topologySource.authority.kind !== "file_tree_path"
    || topologySource.authority.fileTreeEntryHash !== entrypointPath.entryHash
    || entrypointPath.ownerRef !== "OWNER_NODE_ENTRYPOINT_GENERATOR_V2"
    || entrypointPath.writeGrantOwnerRefs.length !== 0
    || entrypointPath.access !== "generator_whole_file_future"
    || entrypointAuthority.finalOwnerRef !== "NODE_ENTRYPOINT_GENERATOR_V2"
    || entrypointAuthority.modelWriteAuthority !== "forbidden"
    || entrypointAuthority.sourceReceiptState !== "absent"
    || entrypointAuthority.sourceReceiptSchema
      !== "setfarm.node-entrypoint-source-receipt.v2"
    || entrypointAuthority.requirementCount
      !== semantic.pathSet.externalRequirementCount
    || entrypointAuthority.requirementCount
      !== entrypointAuthority.requirements.length
    || entrypointAuthority.pathSlotRef !== generatorProfile.sourcePathSlotRef
    || buildOutput.authority.kind !== "build_output_plan"
    || buildOutput.authority.pathSlotRef !== generatorProfile.buildOutputPathSlotRef
    || candidateModule.authority.kind !== "candidate_module_plan"
    || candidateModule.authority.pathSlotRef
      !== generatorProfile.candidateModulePathSlotRef
    || buildTopology.entrypoint.sourceToRuntime.sourceMediaType !== "text/typescript"
    || buildTopology.entrypoint.sourceToRuntime.moduleSystem !== "node_esm"
  ) {
    authorityFailure(
      "FileTree and BuildTopology do not expose one exact generator-owned entrypoint plan",
    );
  }
  if (generatorProfile.runtimeTarget.kind === "cli_process_module") {
    if (
      buildTopology.runtimeTarget.kind !== "cli"
      || entrypointKind !== "cli"
      || buildTopology.runtimeTarget.entrypointAbi
        !== generatorProfile.runtimeTarget.entrypointAbi
      || buildTopology.runtimeTarget.argvOwnership
        !== generatorProfile.runtimeTarget.argvOwnership
      || buildTopology.runtimeTarget.transportArguments
        !== generatorProfile.runtimeTarget.transportArguments
    ) {
      authorityFailure("CLI BuildTopology runtime ABI diverged from generator profile");
    }
  } else if (
    buildTopology.runtimeTarget.kind !== "http_handler"
    || entrypointKind !== "api"
    || buildTopology.runtimeTarget.exportName
      !== generatorProfile.runtimeTarget.exportName
    || buildTopology.runtimeTarget.handlerAbi
      !== generatorProfile.runtimeTarget.handlerAbi
    || buildTopology.runtimeTarget.serverOwnership
      !== generatorProfile.runtimeTarget.serverOwnership
    || buildTopology.runtimeTarget.listenerOwnership
      !== generatorProfile.runtimeTarget.listenerOwnership
    || buildTopology.runtimeTarget.socketOwnership
      !== generatorProfile.runtimeTarget.socketOwnership
    || buildTopology.runtimeTarget.candidateListen
      !== generatorProfile.runtimeTarget.candidateListen
  ) {
    authorityFailure("API BuildTopology runtime ABI diverged from generator profile");
  }
  const transitions = entrypointAuthority.requirements.map((requirement) => {
    const external = exactlyOneByRef(
      semantic.pathSet.externalRequirements,
      "intentRef",
      requirement.intentRef,
      "semantic external requirement",
    );
    const intent = exactlyOneByRef(
      semantic.intentSet.intents,
      "intentRef",
      requirement.intentRef,
      "semantic intent",
    );
    const rule = exactlyOneByRef(
      semantic.ruleSet.rules,
      "ruleRef",
      requirement.ruleRef,
      "code-owned V1 rule",
    );
    return buildTransitionEntryV2({
      requirement,
      external,
      intent,
      rule,
      ruleSetRef: semantic.ruleSet.ruleSetRef,
      ruleSetVersion: "1.0.0",
      entrypointPathRef: entrypointPath.pathRef,
      entrypointKind,
      sourcePathSlotRef: entrypointAuthority.pathSlotRef,
      sourcePathToken: entrypointAuthority.pathToken,
      sourceTokenBindingHash: entrypointAuthority.tokenBindingHash,
      generatorProfileHash,
    });
  }).sort((left, right) => compareUtf16(left.transitionRef, right.transitionRef));
  const entrypointRegistrationCount = transitions.filter((entry) =>
    entry.source.responsibility === "entrypoint_registration").length;
  const routeRegistrationCount = transitions.filter((entry) =>
    entry.source.responsibility === "route_registration").length;
  const runtimeRegistrationCount = transitions.filter((entry) =>
    entry.source.responsibility === "runtime_registration").length;
  if (
    entrypointRegistrationCount !== 1
    || routeRegistrationCount < 1
    || runtimeRegistrationCount !== 1
  ) {
    authorityFailure(
      "Node entrypoint transition requires one entrypoint, one runtime and at least one route registration",
    );
  }
  const identity: NodeSemanticRuleGeneratorTransitionHashPayloadV2 = {
    schema: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_V2_SCHEMA,
    transitionVersion: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2,
    contractHash: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2,
    generatorContractHash: NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [
        ...NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2,
      ],
    },
    authority: {
      productRef: fileTree.authority.productRef,
      productSpecHash: fileTree.authority.productSpecHash,
      deliverySelectionHash: fileTree.authority.deliverySelectionHash,
      profileId: fileTree.authority.profileId,
      stackPackId: fileTree.authority.stackPackId,
      semanticRuleSet: {
        schema: semantic.ruleSet.schema,
        ruleSetRef: semantic.ruleSet.ruleSetRef,
        ruleSetVersion: "1.0.0",
        ruleSetHash: semantic.ruleSet.ruleSetHash,
      },
      semanticIntentSet: {
        schema: semantic.intentSet.schema,
        intentSetHash: semantic.intentSet.intentSetHash,
      },
      semanticPathTokenSet: {
        schema: semantic.pathSet.schema,
        version: SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
        setHash: semantic.pathSet.setHash,
        externalRequirementMembershipHash:
          semantic.pathSet.externalRequirementMembershipHash,
      },
      fileTree: {
        schema: fileTree.schema,
        version: fileTree.manifestVersion,
        contractHash: fileTree.contractHash,
        manifestHash: fileTree.manifestHash,
      },
      buildTopology: {
        schema: buildTopology.schema,
        version: buildTopology.topologyVersion,
        contractHash: buildTopology.contractHash,
        logicalBuildHash: buildTopology.logicalBuildHash,
        operationalManifestBinding:
          "verified_but_excluded_from_transition_identity",
      },
      entrypoint: {
        pathRef: entrypointPath.pathRef,
        entrypointKind,
        sourcePathSlotRef: entrypointAuthority.pathSlotRef,
        sourcePathToken: entrypointAuthority.pathToken,
        sourceTokenBindingHash: entrypointAuthority.tokenBindingHash,
        generatorProfileHash,
        requirementCount: entrypointAuthority.requirementCount,
      },
    },
    coverage: {
      sourceRequirementCount: entrypointAuthority.requirementCount,
      transitionCount: transitions.length,
      entrypointRegistrationCount: entrypointRegistrationCount as 1,
      routeRegistrationCount,
      runtimeRegistrationCount: runtimeRegistrationCount as 1,
      disposition: "every_entrypoint_requirement_transitioned_exactly_once",
    },
    transitionCount: transitions.length,
    transitions,
    transitionMembershipHash:
      hashNodeSemanticRuleGeneratorTransitionMembershipV2(transitions),
  };
  return NodeSemanticRuleGeneratorTransitionV2Schema.parse({
    ...identity,
    transitionHash: hashNodeSemanticRuleGeneratorTransitionV2(identity),
  });
}

function assertExactAuthorityJoinsV2(input: Readonly<{
  semantic: FreshSemanticAuthorityV2;
  fileTree: Readonly<FileTreeManifestV2>;
  buildTopology: Readonly<BuildTopologyV2>;
}>): void {
  const { semantic, fileTree, buildTopology } = input;
  if (
    fileTree.manifestHash !== buildTopology.authority.fileTree.manifestHash
    || fileTree.authority.productSpecHash !== buildTopology.authority.productSpecHash
    || fileTree.authority.deliverySelectionHash
      !== buildTopology.authority.deliverySelectionHash
    || fileTree.authority.profileId !== buildTopology.authority.profileId
    || fileTree.authority.stackPackId !== buildTopology.authority.stackPackId
    || fileTree.authority.semanticRuleSetHash !== semantic.ruleSet.ruleSetHash
    || fileTree.authority.semanticIntentSetHash !== semantic.intentSet.intentSetHash
    || fileTree.authority.semanticPathTokenSetHash !== semantic.pathSet.setHash
    || semantic.pathSet.sourceAuthority.productSpecHash
      !== fileTree.authority.productSpecHash
    || semantic.pathSet.sourceAuthority.deliverySelectionHash
      !== fileTree.authority.deliverySelectionHash
    || semantic.pathSet.sourceAuthority.profileId !== fileTree.authority.profileId
    || semantic.pathSet.sourceAuthority.stackPackId !== fileTree.authority.stackPackId
  ) {
    authorityFailure(
      "Product, semantic, FileTree and logical BuildTopology authorities do not join",
    );
  }
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<NodeSemanticRuleGeneratorTransitionCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "NODE_RULE_GENERATOR_TRANSITION_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "NODE_RULE_GENERATOR_TRANSITION_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Node rule transition input is invalid",
    );
  }
  try {
    const production = isProductionNodeScaffoldPrivateStageV2(handle);
    if (expectedScope === "production_host" && !production) {
      return rejected(
        "NODE_RULE_GENERATOR_TRANSITION_V2_PRODUCTION_AUTHORITY_REQUIRED",
        "/stage",
        "Production Node rule transition requires production_host authority",
      );
    }
    if (expectedScope === "test_fixture" && production) {
      return rejected(
        "NODE_RULE_GENERATOR_TRANSITION_V2_TEST_AUTHORITY_REQUIRED",
        "/stage",
        "Test Node rule transition cannot consume or downgrade production authority",
      );
    }
    const verifiedBuildTopology = expectedScope === "production_host"
      ? await verifyBuildTopologyV2(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        })
      : await verifyBuildTopologyV2ForTest(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          fileTree: parsed.data.fileTree,
          candidate: parsed.data.buildTopology,
        });
    const fileTree = FileTreeManifestV2Schema.parse(parsed.data.fileTree);
    const semantic = reproduceFreshSemanticAuthorityV2({
      productSpec: parsed.data.productSpec,
      deliverySelection: parsed.data.deliverySelection,
      stackPackId: fileTree.authority.stackPackId,
    });
    assertExactAuthorityJoinsV2({
      semantic,
      fileTree,
      buildTopology: verifiedBuildTopology.value,
    });
    const value = recursivelyFreezeNodeSemanticRuleGeneratorTransitionV2(
      buildTransitionV2({
        semantic,
        fileTree,
        buildTopology: verifiedBuildTopology.value,
      }),
    );
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes:
          NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2,
        ...NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BOUNDED_WORK_LIMITS_V2,
      });
    } catch (error) {
      return rejected(
        "NODE_RULE_GENERATOR_TRANSITION_V2_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeNodeSemanticRuleGeneratorTransitionV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof BuildTopologyVerificationErrorV2
        ? "NODE_RULE_GENERATOR_TRANSITION_V2_BUILD_TOPOLOGY_REJECTED"
        : error instanceof NodeRuleGeneratorTransitionAuthorityErrorV2
          ? "NODE_RULE_GENERATOR_TRANSITION_V2_UPSTREAM_AUTHORITY_REJECTED"
          : "NODE_RULE_GENERATOR_TRANSITION_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export function compileNodeSemanticRuleGeneratorTransitionV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeSemanticRuleGeneratorTransitionCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileNodeSemanticRuleGeneratorTransitionV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeSemanticRuleGeneratorTransitionCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type NodeSemanticRuleGeneratorTransitionVerificationErrorCodeV2 =
  | "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_INPUT_INVALID"
  | "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class NodeSemanticRuleGeneratorTransitionVerificationErrorV2 extends Error {
  readonly code: NodeSemanticRuleGeneratorTransitionVerificationErrorCodeV2;

  constructor(
    code: NodeSemanticRuleGeneratorTransitionVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "NodeSemanticRuleGeneratorTransitionVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowNodeSemanticRuleGeneratorTransitionV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<NodeSemanticRuleGeneratorTransitionV2>;
  canonicalBytes: string;
}>;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowNodeSemanticRuleGeneratorTransitionV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new NodeSemanticRuleGeneratorTransitionVerificationErrorV2(
      "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new NodeSemanticRuleGeneratorTransitionVerificationErrorV2(
      "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Node rule transition verifier input is invalid",
    );
  }
  const candidate = NodeSemanticRuleGeneratorTransitionV2Schema.safeParse(
    parsed.data.candidate,
  );
  if (!candidate.success) {
    throw new NodeSemanticRuleGeneratorTransitionVerificationErrorV2(
      "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Node rule transition candidate is invalid",
    );
  }
  const reproduced = await compileInternalV2(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    fileTree: parsed.data.fileTree,
    buildTopology: parsed.data.buildTopology,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new NodeSemanticRuleGeneratorTransitionVerificationErrorV2(
      "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh Node rule transition reproduction failed",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new NodeSemanticRuleGeneratorTransitionVerificationErrorV2(
      "NODE_RULE_GENERATOR_TRANSITION_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Node rule transition candidate does not equal fresh semantic, FileTree and logical BuildTopology authority",
    );
  }
  return recursivelyFreezeNodeSemanticRuleGeneratorTransitionV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export function verifyNodeSemanticRuleGeneratorTransitionV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeSemanticRuleGeneratorTransitionV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyNodeSemanticRuleGeneratorTransitionV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowNodeSemanticRuleGeneratorTransitionV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}
