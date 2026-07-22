import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import { compileSemanticSourceIntentSetV1 } from
  "./semantic-source-intent-set-v1.js";
import { getCodeOwnedStackSemanticSourceRuleSetV1 } from
  "./stack-semantic-source-rules-catalog-v1.js";
import type { SemanticSourceIntentV1, SemanticSourceIntentSetV1 } from
  "./schemas/semantic-source-intent-set-v1.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
  NODE_SEMANTIC_REALIZATION_POLICY_V2,
  SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
  SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES,
  SEMANTIC_REALIZATION_PLAN_V2_BOUNDED_WORK_LIMITS,
  SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES,
  SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
  SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  SemanticRealizationPlanV2Schema,
  SemanticRealizationV2Schema,
  deriveSemanticRealizationRefV2,
  hashNodeProductRuntimeGeneratorProfileV2,
  hashNodeProductTestGeneratorProfileV2,
  hashSemanticRealizationLegacyTargetV2,
  hashSemanticRealizationMembershipV2,
  hashSemanticRealizationPlanV2,
  hashSemanticRealizationPolicyRuleV2,
  hashSemanticRealizationV2,
  recursivelyFreezeSemanticRealizationPlanV2,
  type SemanticRealizationHashPayloadV2,
  type SemanticRealizationPlanHashPayloadV2,
  type SemanticRealizationPlanV2,
  type SemanticRealizationV2,
} from "./schemas/semantic-realization-plan-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 12 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 18 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 100_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 100_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const NO_DESIGN_CLOSURE_V2 = Object.freeze({
  schema: "setfarm.design-source-closure.v2" as const,
  kind: "none" as const,
  reason: "product_delivery_design_not_required" as const,
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
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

export type SemanticRealizationPlanDiagnosticCodeV2 =
  | "SEMANTIC_REALIZATION_V2_ARTIFACT_INVALID"
  | "SEMANTIC_REALIZATION_V2_INPUT_INVALID"
  | "SEMANTIC_REALIZATION_V2_INTENT_COMPILATION_REJECTED"
  | "SEMANTIC_REALIZATION_V2_OUTPUT_LIMIT_EXCEEDED"
  | "SEMANTIC_REALIZATION_V2_POLICY_REJECTED";

export type SemanticRealizationPlanDiagnosticV2 = Readonly<{
  code: SemanticRealizationPlanDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type SemanticRealizationPlanCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<SemanticRealizationPlanV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly SemanticRealizationPlanDiagnosticV2[];
    }>;

function rejected(
  code: SemanticRealizationPlanDiagnosticCodeV2,
  path: string,
  message: string,
): SemanticRealizationPlanCompilationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class SemanticRealizationPolicyErrorV2 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "SemanticRealizationPolicyErrorV2";
  }
}

function policyFailure(message: string): never {
  throw new SemanticRealizationPolicyErrorV2(message);
}

function intentKindsV2(intent: SemanticSourceIntentV1): Readonly<{
  legacyIntentKind:
    | "source_slot"
    | "platform_contract"
    | "typed_exemption"
    | "predicate_requirement";
  legacyTargetKind:
    | "project_source"
    | "generated_source"
    | "platform_contract"
    | "typed_exemption"
    | "predicate_relation";
}> {
  return {
    legacyIntentKind: intent.target.kind,
    legacyTargetKind: intent.target.targetKind,
  };
}

function sourceIntentBindingV2(intent: SemanticSourceIntentV1) {
  const kinds = intentKindsV2(intent);
  return {
    intentRef: intent.intentRef,
    intentHash: intent.intentHash,
    ruleSetHash: intent.ruleSetHash,
    ruleRef: intent.ruleRef,
    ruleHash: intent.ruleHash,
    scopeRef: intent.semanticScope.scopeRef,
    subjectKind: intent.subjectKind,
    subjectRef: intent.subjectRef,
    subjectHash: intent.subjectHash,
    responsibility: intent.responsibility,
    storyId: intent.semanticScope.kind === "story"
      ? intent.semanticScope.storyId
      : null,
    ...kinds,
    legacyTargetHash: hashSemanticRealizationLegacyTargetV2(intent.target),
    legacyTargetDisposition: "compatibility_evidence_only" as const,
  };
}

type PolicyProfileV2 = typeof NODE_SEMANTIC_REALIZATION_POLICY_V2.profiles[number];
type PolicyRuleV2 = PolicyProfileV2["rules"][number];

function exactPolicyRuleV2(
  profile: PolicyProfileV2,
  intent: SemanticSourceIntentV1,
): PolicyRuleV2 {
  const kinds = intentKindsV2(intent);
  const matches = profile.rules.filter((rule) =>
    rule.subjectKind === intent.subjectKind
    && rule.responsibility === intent.responsibility
    && rule.legacyIntentKind === kinds.legacyIntentKind
    && rule.legacyTargetKind === kinds.legacyTargetKind);
  if (matches.length !== 1) {
    policyFailure(
      `Expected one realization policy for ${intent.subjectKind}/${intent.responsibility}/${kinds.legacyIntentKind}/${kinds.legacyTargetKind}`,
    );
  }
  return matches[0]!;
}

function requireLegacyGeneratorSourceV2(intent: SemanticSourceIntentV1): void {
  if (
    intent.target.kind !== "source_slot"
    || intent.target.targetKind !== "project_source"
    || intent.target.outputPolicy.kind !== "model_writable"
    || !["owned_writable", "granted_writable"].includes(intent.target.accessPolicy)
  ) {
    policyFailure(
      `Generator realization ${intent.intentRef} no longer matches the exact legacy model-writable source shape`,
    );
  }
  if (
    intent.responsibility === "action_input_transport"
    && intent.target.resolvedSubjectContract.kind
      !== "invocation_input_transport_v2"
  ) {
    policyFailure(
      `Action-input realization ${intent.intentRef} lacks fresh invocation transport authority`,
    );
  }
}

function buildTargetV2(
  intent: SemanticSourceIntentV1,
  rule: PolicyRuleV2,
  intentSet: Readonly<SemanticSourceIntentSetV1>,
): SemanticRealizationV2["target"] {
  const policyRuleHash = hashSemanticRealizationPolicyRuleV2(rule);
  if (rule.realization.kind === "node_product_runtime_generator_member") {
    requireLegacyGeneratorSourceV2(intent);
    return {
      kind: "node_product_runtime_generator_member",
      policyRuleRef: rule.policyRuleRef,
      policyRuleHash,
      generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2",
      generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
      memberKind: rule.realization.memberKind,
      ownerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
      modelWriteAuthority: "forbidden",
      sourceTopology: "single_generated_entrypoint_no_semantic_leaf",
      sourceReceiptSchema: "setfarm.node-product-runtime-source-receipt.v2",
      sourceReceiptState: "absent",
    };
  }
  if (rule.realization.kind === "platform_contract_binding") {
    if (intent.target.kind !== "platform_contract") {
      return policyFailure(`Platform realization ${intent.intentRef} lost its target`);
    }
    return {
      kind: "platform_contract_binding",
      policyRuleRef: rule.policyRuleRef,
      policyRuleHash,
      platformAuthorityRef: intent.target.platformAuthorityRef,
      platformContractProjectionHash: intent.target.platformContractProjectionHash,
      capabilityRefs: [...intent.target.capabilityRefs],
      bindingState: "planned_unverified",
    };
  }
  if (rule.realization.kind === "typed_exemption") {
    if (intent.target.kind !== "typed_exemption") {
      return policyFailure(`Typed exemption ${intent.intentRef} lost its target`);
    }
    const resolution = intent.target.backingResolution;
    if (resolution.state === "unresolved_shadow") {
      const backing = intentSet.intents.filter((candidate) =>
        candidate.semanticScope.scopeRef === intent.semanticScope.scopeRef
        && candidate.responsibility === resolution.requiredResponsibility);
      if (backing.length !== 1) {
        policyFailure(
          `Persistence exemption ${intent.intentRef} lacks one exact generated state runtime member`,
        );
      }
    }
    return {
      kind: "typed_exemption",
      policyRuleRef: rule.policyRuleRef,
      policyRuleHash,
      exemptionCode: intent.target.exemptionCode,
      backingResponsibility: intent.target.backingResponsibility,
      backingResolutionState: resolution.state === "not_applicable"
        ? "not_applicable"
        : "generated_runtime_member",
      modelWriteAuthority: "forbidden",
    };
  }
  if (intent.target.kind !== "predicate_requirement") {
    return policyFailure(`Evidence realization ${intent.intentRef} lost its target`);
  }
  return {
    kind: "evidence_relation",
    policyRuleRef: rule.policyRuleRef,
    policyRuleHash,
    registryArtifactType:
      intent.target.bindingResolution.registryArtifactType,
    supportSignatureSchema:
      intent.target.bindingResolution.supportSignatureSchema,
    resolutionContractRef:
      intent.target.bindingResolution.resolutionContractRef,
    resolutionState: "unresolved_shadow",
    modelWriteAuthority: "forbidden",
  };
}

function buildRealizationV2(
  intent: SemanticSourceIntentV1,
  rule: PolicyRuleV2,
  intentSet: Readonly<SemanticSourceIntentSetV1>,
): SemanticRealizationV2 {
  const target = buildTargetV2(intent, rule, intentSet);
  const realizationRef = deriveSemanticRealizationRefV2({
    policyHash: NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
    policyRuleRef: rule.policyRuleRef,
    intentRef: intent.intentRef,
  });
  const identity: SemanticRealizationHashPayloadV2 = {
    realizationRef,
    sourceIntent: sourceIntentBindingV2(intent),
    target,
  };
  return SemanticRealizationV2Schema.parse({
    ...identity,
    realizationHash: hashSemanticRealizationV2(identity),
  });
}

function buildPlanV2(
  intentSet: Readonly<SemanticSourceIntentSetV1>,
): SemanticRealizationPlanV2 {
  const profile = NODE_SEMANTIC_REALIZATION_POLICY_V2.profiles.find((candidate) =>
    candidate.profileId === intentSet.authority.deliverySelection.profileId
    && candidate.stackPackId === intentSet.authority.stackPackBinding.stackPackId);
  const generatorProfile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
    (candidate) =>
      candidate.profileId === intentSet.authority.deliverySelection.profileId
      && candidate.stackPackId === intentSet.authority.stackPackBinding.stackPackId,
  );
  const testGeneratorProfile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
    (candidate) =>
      candidate.profileId === intentSet.authority.deliverySelection.profileId
      && candidate.stackPackId === intentSet.authority.stackPackBinding.stackPackId,
  );
  const ruleSet = getCodeOwnedStackSemanticSourceRuleSetV1(
    intentSet.authority.stackPackBinding.stackPackId,
  );
  if (
    !profile
    || !generatorProfile
    || !testGeneratorProfile
    || !ruleSet
    || ruleSet.ruleSetVersion !== "1.0.0"
    || profile.semanticRuleSetRef !== ruleSet.ruleSetRef
    || profile.semanticRuleSetHash !== ruleSet.ruleSetHash
    || ruleSet.ruleSetRef !== intentSet.authority.semanticRuleSet.ruleSetRef
    || ruleSet.ruleSetHash !== intentSet.authority.semanticRuleSet.ruleSetHash
    || profile.deliveryProfileHash
      !== intentSet.authority.deliverySelection.profileHash
    || profile.stackPackVersion
      !== intentSet.authority.stackPackBinding.stackPackVersion
    || profile.stackPackContentHash
      !== intentSet.authority.stackPackBinding.stackPackContentHash
  ) {
    policyFailure(
      "Product profile, semantic rule set and realization policy do not join",
    );
  }
  const policyRefs = profile.rules.map((rule) => rule.policyRuleRef);
  if (new Set(policyRefs).size !== policyRefs.length) {
    policyFailure("Active semantic realization policy contains duplicate rules");
  }
  const realizations = intentSet.intents.map((intent) =>
    buildRealizationV2(intent, exactPolicyRuleV2(profile, intent), intentSet))
    .sort((left, right) => compareUtf16(left.realizationRef, right.realizationRef));
  const generatorCount = realizations.filter((entry) =>
    entry.target.kind === "node_product_runtime_generator_member").length;
  const platformCount = realizations.filter((entry) =>
    entry.target.kind === "platform_contract_binding").length;
  const exemptionCount = realizations.filter((entry) =>
    entry.target.kind === "typed_exemption").length;
  const evidenceCount = realizations.filter((entry) =>
    entry.target.kind === "evidence_relation").length;
  if (generatorCount < 1 || evidenceCount < 1) {
    policyFailure("Node realization requires generator members and evidence relations");
  }
  const identity: SemanticRealizationPlanHashPayloadV2 = {
    schema: SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
    planVersion: SEMANTIC_REALIZATION_PLAN_V2_VERSION,
    contractHash: SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
    policyHash: NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
    generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
    testGeneratorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [...SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES],
    },
    authority: {
      productRef: intentSet.authority.productRef,
      productSpecHash: intentSet.authority.productSpecHash,
      deliverySelectionHash: intentSet.authority.deliverySelection.selectionHash,
      profileId: intentSet.authority.deliverySelection.profileId,
      deliveryProfileHash: intentSet.authority.deliverySelection.profileHash,
      stackPackId: intentSet.authority.stackPackBinding.stackPackId,
      stackPackVersion: intentSet.authority.stackPackBinding.stackPackVersion,
      stackPackContentHash: intentSet.authority.stackPackBinding.stackPackContentHash,
      semanticIntentSet: {
        schema: intentSet.schema,
        intentSetHash: intentSet.intentSetHash,
        intentCount: intentSet.intentCount,
      },
      semanticRuleSet: {
        ruleSetRef: ruleSet.ruleSetRef,
        ruleSetVersion: "1.0.0",
        ruleSetHash: ruleSet.ruleSetHash,
      },
      generatorProfile: {
        generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2",
        generatorProfileHash:
          hashNodeProductRuntimeGeneratorProfileV2(generatorProfile),
        entrypointKind: generatorProfile.entrypointKind,
        sourcePathSlotRef: generatorProfile.sourcePathSlotRef,
      },
      testGeneratorProfile: {
        generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2",
        generatorProfileHash:
          hashNodeProductTestGeneratorProfileV2(testGeneratorProfile),
        sourcePathRef: testGeneratorProfile.sourcePathRef,
        compiledPathRef: testGeneratorProfile.compiledPathRef,
        runnerAbi: testGeneratorProfile.execution.runnerAbi,
      },
    },
    coverage: {
      sourceIntentCount: realizations.length,
      generatorMemberCount: generatorCount,
      platformBindingCount: platformCount,
      typedExemptionCount: exemptionCount,
      evidenceRelationCount: evidenceCount,
      supersededLegacyModelWriteCount: generatorCount,
      modelWriteGrantCount: 0,
      disposition: "every_semantic_intent_realized_exactly_once",
    },
    realizationCount: realizations.length,
    realizations,
    realizationMembershipHash:
      hashSemanticRealizationMembershipV2(realizations),
  };
  return SemanticRealizationPlanV2Schema.parse({
    ...identity,
    planHash: hashSemanticRealizationPlanV2(identity),
  });
}

export function compileSemanticRealizationPlanV2(
  input: unknown,
): SemanticRealizationPlanCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "SEMANTIC_REALIZATION_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "SEMANTIC_REALIZATION_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Semantic realization input is invalid",
    );
  }
  const intentResult = compileSemanticSourceIntentSetV1({
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    designSourceClosure: NO_DESIGN_CLOSURE_V2,
  });
  if (intentResult.status !== "shadow_compiled") {
    return rejected(
      "SEMANTIC_REALIZATION_V2_INTENT_COMPILATION_REJECTED",
      intentResult.diagnostics[0]?.path ?? "/",
      intentResult.diagnostics[0]?.message
        ?? "Fresh semantic intent compilation was rejected",
    );
  }
  try {
    const value = recursivelyFreezeSemanticRealizationPlanV2(
      buildPlanV2(intentResult.intentSet),
    );
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES,
        ...SEMANTIC_REALIZATION_PLAN_V2_BOUNDED_WORK_LIMITS,
      });
    } catch (error) {
      return rejected(
        "SEMANTIC_REALIZATION_V2_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeSemanticRealizationPlanV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof SemanticRealizationPolicyErrorV2
        ? "SEMANTIC_REALIZATION_V2_POLICY_REJECTED"
        : "SEMANTIC_REALIZATION_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export type SemanticRealizationPlanVerificationErrorCodeV2 =
  | "SEMANTIC_REALIZATION_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "SEMANTIC_REALIZATION_V2_VERIFICATION_CANDIDATE_INVALID"
  | "SEMANTIC_REALIZATION_V2_VERIFICATION_INPUT_INVALID"
  | "SEMANTIC_REALIZATION_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class SemanticRealizationPlanVerificationErrorV2 extends Error {
  readonly code: SemanticRealizationPlanVerificationErrorCodeV2;

  constructor(
    code: SemanticRealizationPlanVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "SemanticRealizationPlanVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowSemanticRealizationPlanV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<SemanticRealizationPlanV2>;
  canonicalBytes: string;
}>;

export function verifySemanticRealizationPlanV2(
  input: unknown,
): VerifiedShadowSemanticRealizationPlanV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new SemanticRealizationPlanVerificationErrorV2(
      "SEMANTIC_REALIZATION_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new SemanticRealizationPlanVerificationErrorV2(
      "SEMANTIC_REALIZATION_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Semantic realization verifier input is invalid",
    );
  }
  const candidate = SemanticRealizationPlanV2Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new SemanticRealizationPlanVerificationErrorV2(
      "SEMANTIC_REALIZATION_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Semantic realization candidate is invalid",
    );
  }
  const reproduced = compileSemanticRealizationPlanV2({
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new SemanticRealizationPlanVerificationErrorV2(
      "SEMANTIC_REALIZATION_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh semantic realization reproduction failed",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new SemanticRealizationPlanVerificationErrorV2(
      "SEMANTIC_REALIZATION_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Semantic realization candidate does not equal fresh ProductSpec, intent and code-owned policy authority",
    );
  }
  return recursivelyFreezeSemanticRealizationPlanV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}
