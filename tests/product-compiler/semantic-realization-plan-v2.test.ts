import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SemanticRealizationPlanVerificationErrorV2,
  compileSemanticRealizationPlanV2,
  verifySemanticRealizationPlanV2,
} from "../../src/product-compiler/semantic-realization-plan-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
  NODE_SEMANTIC_REALIZATION_POLICY_V2,
  SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
  SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES,
  SemanticRealizationPlanV2Schema,
  hashSemanticRealizationMembershipV2,
  hashSemanticRealizationPlanV2,
  hashSemanticRealizationV2,
  type SemanticRealizationPlanV2,
} from "../../src/product-compiler/schemas/semantic-realization-plan-v2.js";
import { hashProductRuntimeBehaviorContractV1 } from
  "../../src/product-compiler/schemas/product-runtime-behavior-contract-v1.js";
import {
  getEvidenceAdapterDefinitionCatalogV2,
  hashEvidenceAdapterRequirementDefinitionV2,
} from "../../src/evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import type { ProductSpecV2 } from
  "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  entityFieldNodeExpressApiProductSpecV2,
  entityFieldNodeRuntimeBehaviorAuthorityV1,
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  nodeRuntimeBehaviorAuthorityV1,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "9e2088447e943be9cff3550d9984606051e7b2048998e15a3c3887db7e4d24cc";
const TEST_GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "abefe8ed28a8ac3cd69e38d7f80011b7392eb0a66473b64564638bd95f3c17f0";
const POLICY_HASH_GOLDEN_V2 =
  "03764bc5ed420e9ae5c8a674942c2659bef3717f83bae5f8272510bd22c3eee5";
const PLAN_CONTRACT_HASH_GOLDEN_V2 =
  "a6c673c06a45f9ac8e5eae6c13d770678d58c136e51fbc298a9cac0dc852d9c8";
const CLI_PLAN_HASH_GOLDEN_V2 =
  "d8ebede65efe6587f765fbfaf8ae252bb0d429b2b8aa60b1241822b30527f606";
const API_PLAN_HASH_GOLDEN_V2 =
  "92d44d9da16c4b893a099abcec0990e372bf026decde33654437b8afa1381827";
const TWO_STORY_API_PLAN_HASH_GOLDEN_V2 =
  "0cc880893675617256443e6f722240694cad9c3ff45c1f651710fd9697e40172";
const CLI_MEMBERSHIP_HASH_GOLDEN_V2 =
  "739c187e343e8625470b21f60361d0755e41e3332c19dd97a51c3f01c277edda";
const API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "ba081c8b4b20f214253e23b532f5c4f16cf6e607ada3378b6e9b9aea91adcd05";
const TWO_STORY_API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "cc029a6feb7cd3a45f3f19e05f3598bae254ea1949b9c09b22c99fcb63fe3e56";
const ENTITY_API_PLAN_HASH_GOLDEN_V2 =
  "8b69f4dd7db719a573eb877bd2b61aaaca60ce0aca124474f41fbaa31f9053d8";
const ENTITY_API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "f6d6405feb6cf6a68dd1964b69a075509800014cb42dc29dd96f65acb2a2609a";

type SupportedStackPackIdV2 = "node-cli" | "node-express-api";

function selectionFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: SupportedStackPackIdV2,
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function compiled(
  productSpec: ProductSpecV2,
  requestedStackPackId: SupportedStackPackIdV2,
  runtimeBehaviorAuthority: typeof nodeRuntimeBehaviorAuthorityV1 =
    nodeRuntimeBehaviorAuthorityV1,
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const runtimeBehavior = runtimeBehaviorAuthority(productSpec);
  const result = compileSemanticRealizationPlanV2({
    productSpec,
    deliverySelection,
    ...runtimeBehavior,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected compilation");
  return {
    productSpec,
    deliverySelection,
    ...runtimeBehavior,
    value: result.value,
    canonicalBytes: result.canonicalBytes,
  };
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function rehashPlan(candidate: any): void {
  candidate.realizationMembershipHash = hashSemanticRealizationMembershipV2(
    candidate.realizations,
  );
  candidate.planHash = hashSemanticRealizationPlanV2(candidate);
}

function assertVerificationError(
  operation: () => unknown,
  code: SemanticRealizationPlanVerificationErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof SemanticRealizationPlanVerificationErrorV2
    && error.code === code);
}

describe("SemanticRealizationPlanV2 contract and compiler", () => {
  it("pins the generator, policy and plan contracts", () => {
    assert.equal(
      NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
      GENERATOR_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.equal(
      NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
      TEST_GENERATOR_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.equal(NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2, POLICY_HASH_GOLDEN_V2);
    assert.equal(
      SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
      PLAN_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.deepEqual(SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES, [
      "SEMANTIC_REALIZATION_V2_BUILD_TOPOLOGY_V3_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_EVIDENCE_REGISTRY_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_FILE_TREE_V3_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_NODE_RUNTIME_GENERATOR_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_RELEASE_MANIFEST_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_SOURCE_RECEIPT_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_TEST_GENERATOR_UNVERIFIED",
      "SEMANTIC_REALIZATION_V2_TEST_SOURCE_RECEIPT_UNVERIFIED",
    ]);
    assert.equal(
      NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.semanticExecution
        .opaqueBehaviorPolicy,
      "require_fresh_verified_versioned_behavior_contract_projection",
    );
    assert.deepEqual(
      NODE_SEMANTIC_REALIZATION_POLICY_V2.profiles.map((profile) => ({
        profileId: profile.profileId,
        deliveryProfileHash: profile.deliveryProfileHash,
        stackPackVersion: profile.stackPackVersion,
        stackPackContentHash: profile.stackPackContentHash,
        semanticRuleSetHash: profile.semanticRuleSetHash,
      })),
      [
        {
          profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
          deliveryProfileHash:
            "e57f520d4bb71bfea2907f8858f6e40772c6355109d43d74d139ee1e9592ea3f",
          stackPackVersion: "1.6.0",
          stackPackContentHash:
            "5ad5e6bdc56a2a970c03897a4e205b75166e5edf83a5168ce6526f2f397693d3",
          semanticRuleSetHash:
            "1ad3aa4c68a939ab11273ec7538daed921eb4ea4d0f77e196080c069feff7c08",
        },
        {
          profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
          deliveryProfileHash:
            "b7c78f2585b22c8720c321c4c311be62f039ed6f6d6527cae139cea7a98cded1",
          stackPackVersion: "1.6.0",
          stackPackContentHash:
            "7dec84cecdf4f3400fa9e10559cfe7d94fe11bac81132bbfdc9158afdccdbdc4",
          semanticRuleSetHash:
            "fe53d956a9af0db8c7636598d7cd8839887877fe13415907490289bb08b45528",
        },
      ],
    );
  });

  it("realizes every CLI, one-route API, and two-route API intent exactly once", () => {
    const cases = [
      {
        compiled: compiled(genuineNodeCliProductSpecV2(), "node-cli"),
        coverage: [17, 10, 4, 1, 2],
        planHash: CLI_PLAN_HASH_GOLDEN_V2,
        membershipHash: CLI_MEMBERSHIP_HASH_GOLDEN_V2,
        behaviorHashes: [
          "9d7cc59164e10dceed7c98e951b1a98a23fd36318a083b8b4233c55abaf49e97",
          "58d46b62baf2a91fc7ae23c478dd776efdfe4d15356889faec7030ab5c73bcc5",
        ],
        behaviorBindingCount: 1,
        entityFieldBindingCount: 0,
      },
      {
        compiled: compiled(
          genuineNodeExpressApiProductSpecV2(),
          "node-express-api",
        ),
        coverage: [19, 11, 5, 1, 2],
        planHash: API_PLAN_HASH_GOLDEN_V2,
        membershipHash: API_MEMBERSHIP_HASH_GOLDEN_V2,
        behaviorHashes: [
          "c8a31b07122d512e4752a12860eb0c06443ab3f712c3ae44a2d92f89bfd3ae8a",
          "363acfdc0747deffe9b18ef99216d188ce984c549ef68ce0cb8dc7e0a838a362",
        ],
        behaviorBindingCount: 1,
        entityFieldBindingCount: 0,
      },
      {
        compiled: compiled(
          twoStoryNodeExpressApiProductSpecV2(),
          "node-express-api",
        ),
        coverage: [32, 20, 6, 2, 4],
        planHash: TWO_STORY_API_PLAN_HASH_GOLDEN_V2,
        membershipHash: TWO_STORY_API_MEMBERSHIP_HASH_GOLDEN_V2,
        behaviorHashes: [
          "abf0efeacee4d1bbdfc510ae553c9729d2e0f2c7c087fe380b104202c5a7c300",
          "e12d6c09ecde3a7c76ee2b1242fbb11e1785e0d08bc403fe43c5de9b785b1d3c",
        ],
        behaviorBindingCount: 2,
        entityFieldBindingCount: 0,
      },
      {
        compiled: compiled(
          entityFieldNodeExpressApiProductSpecV2(),
          "node-express-api",
          entityFieldNodeRuntimeBehaviorAuthorityV1,
        ),
        coverage: [21, 13, 5, 1, 2],
        planHash: ENTITY_API_PLAN_HASH_GOLDEN_V2,
        membershipHash: ENTITY_API_MEMBERSHIP_HASH_GOLDEN_V2,
        behaviorHashes: [
          "9d637570600ea28eb4bb97a07a56da996ff5a83320c081b06d0c9d58504b29b5",
          "2ff2e6749634f34a6405a8e470e7506a5797b6def9f81179b12ec400a73b40ef",
        ],
        behaviorBindingCount: 1,
        entityFieldBindingCount: 1,
      },
    ] as const;

    for (const testCase of cases) {
      const value = testCase.compiled.value;
      assert.deepEqual([
        value.coverage.sourceIntentCount,
        value.coverage.generatorMemberCount,
        value.coverage.platformBindingCount,
        value.coverage.typedExemptionCount,
        value.coverage.evidenceRelationCount,
      ], testCase.coverage);
      assert.equal(value.realizationCount, value.coverage.sourceIntentCount);
      assert.equal(value.realizations.length, value.realizationCount);
      assert.equal(value.coverage.supersededLegacyModelWriteCount,
        value.coverage.generatorMemberCount);
      assert.equal(value.coverage.modelWriteGrantCount, 0);
      assert.equal(
        value.coverage.evidenceRequirementDefinitionCount,
        value.coverage.evidenceRelationCount,
      );
      assert.equal(value.coverage.evidenceRequirementMissingCount, 0);
      assert.equal(value.planHash, testCase.planHash);
      assert.equal(value.realizationMembershipHash, testCase.membershipHash);
      assert.deepEqual([
        value.authority.runtimeBehavior.proposalHash,
        value.authority.runtimeBehavior.contractHash,
      ], testCase.behaviorHashes);
      assert.equal(
        value.authority.runtimeBehavior.invariantBindingCount,
        testCase.behaviorBindingCount,
      );
      assert.equal(
        value.authority.runtimeBehavior.entityFieldBindingCount,
        testCase.entityFieldBindingCount,
      );
      assert.equal(
        value.authority.runtimeBehavior.verification,
        "fresh_product_spec_plus_proposal_reproduction",
      );
      assert.equal(SemanticRealizationPlanV2Schema.safeParse(value).success, true);
    }
  });

  it("realizes exact entity ownership as one generated runtime member", () => {
    const value = compiled(
      entityFieldNodeExpressApiProductSpecV2(),
      "node-express-api",
      entityFieldNodeRuntimeBehaviorAuthorityV1,
    ).value;
    const entityRealizations = value.realizations.filter((entry) =>
      entry.sourceIntent.subjectKind === "entity");
    assert.equal(entityRealizations.length, 1);
    assert.equal(entityRealizations[0]!.sourceIntent.subjectRef,
      "ENTITY_TASK_CATALOG_ENTRY");
    assert.equal(entityRealizations[0]!.sourceIntent.storyId, "US-001");
    assert.equal(
      entityRealizations[0]!.target.kind,
      "node_product_runtime_generator_member",
    );
    if (entityRealizations[0]!.target.kind === "node_product_runtime_generator_member") {
      assert.equal(entityRealizations[0]!.target.memberKind, "entity_model");
      assert.equal(entityRealizations[0]!.target.modelWriteAuthority, "forbidden");
    }
  });

  it("removes legacy per-intent source paths and model write authority", () => {
    const { value, canonicalBytes } = compiled(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    for (const realization of value.realizations) {
      assert.equal(
        realization.sourceIntent.legacyTargetDisposition,
        "compatibility_evidence_only",
      );
      if (realization.target.kind === "node_product_runtime_generator_member") {
        assert.equal(realization.sourceIntent.legacyIntentKind, "source_slot");
        assert.equal(realization.sourceIntent.legacyTargetKind, "project_source");
        assert.equal(realization.target.modelWriteAuthority, "forbidden");
        assert.equal(
          realization.target.sourceTopology,
          "single_generated_entrypoint_no_semantic_leaf",
        );
        assert.equal(realization.target.sourceReceiptState, "absent");
      }
    }
    assert.equal(canonicalBytes.includes("normalizedLocator"), false);
    assert.equal(canonicalBytes.includes("\"pathRef\""), false);
    assert.equal(canonicalBytes.includes("/Users/"), false);
    assert.equal(canonicalBytes.includes("/Library/Application Support/Setfarm"), false);
    assert.equal(canonicalBytes.includes("model_writable"), false);
  });

  it("binds every supported predicate to exact V2 requirement authority", () => {
    const catalog = getEvidenceAdapterDefinitionCatalogV2();
    const cases = [
      compiled(genuineNodeCliProductSpecV2(), "node-cli"),
      compiled(genuineNodeExpressApiProductSpecV2(), "node-express-api"),
    ];
    for (const authority of cases) {
      assert.equal(authority.value.planVersion, "2.1.0");
      assert.deepEqual(authority.value.authority.evidenceAdapterDefinitions, {
        schema: catalog.schema,
        version: catalog.version,
        catalogHash: catalog.catalogHash,
        readiness: "shadow_blocked",
        productionUse: "forbidden",
      });
      const relations = authority.value.realizations.filter((entry) =>
        entry.target.kind === "evidence_relation");
      assert.equal(relations.length, 2);
      for (const relation of relations) {
        if (relation.target.kind !== "evidence_relation") {
          throw new Error("Expected evidence relation");
        }
        const target = relation.target;
        assert.equal(target.predicateBinding.evidenceRef,
          relation.sourceIntent.subjectRef);
        assert.equal(target.definitionCatalog.catalogHash, catalog.catalogHash);
        assert.equal(target.requirementResolution.status, "requirement_defined");
        if (target.requirementResolution.status !== "requirement_defined") {
          throw new Error("Expected defined evidence requirement");
        }
        const definition = target.requirementResolution.requirementDefinition;
        assert.equal(definition.profileRequirement.profileId,
          authority.value.authority.profileId);
        assert.equal(definition.checkRequirement.predicateKind,
          target.predicateBinding.predicateKind);
        assert.equal(definition.checkRequirement.selectorRequirement,
          target.predicateBinding.selector.kind);
        assert.equal(
          target.requirementResolution.requiredOperationalRegistrySchema,
          "setfarm.evidence-adapter-registry.v2",
        );
        assert.equal(
          target.requirementResolution.resolutionState,
          "requirement_only_operational_registry_unmaterialized",
        );
      }
      assert.equal(authority.canonicalBytes.includes(
        "setfarm.evidence-adapter-registry.v1"), false);
      assert.equal(authority.canonicalBytes.includes(
        "setfarm.evidence-adapter-support-signature.v1"), false);
      assert.equal(authority.canonicalBytes.includes(
        "EVIDENCE_ADAPTER_EXACT_SUPPORT_SIGNATURE_V1"), false);
    }
  });

  it("keeps the generated CLI and API runtime ABI exact", () => {
    const cliProfile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
      (profile) => profile.stackPackId === "node-cli",
    );
    const apiProfile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
      (profile) => profile.stackPackId === "node-express-api",
    );
    assert.ok(cliProfile && cliProfile.runtimeTarget.kind === "cli_process_module");
    assert.equal(cliProfile.runtimeTarget.exportName, null);
    assert.equal(cliProfile.runtimeTarget.transportArguments, "append_after_module");
    assert.ok(apiProfile && apiProfile.runtimeTarget.kind === "http_handler_export");
    assert.equal(apiProfile.runtimeTarget.exportName, "setfarmHttpHandlerV2");
    assert.equal(apiProfile.runtimeTarget.listenerOwnership, "platform_owned");
    assert.equal(apiProfile.runtimeTarget.candidateListen, "forbidden");

    const api = compiled(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).value;
    const runtimeData = api.realizations.filter((entry) =>
      entry.sourceIntent.responsibility === "runtime_data_fixture");
    assert.equal(runtimeData.length, 2);
    assert.deepEqual(
      runtimeData.map((entry) => entry.sourceIntent.storyId).sort(),
      ["US-001", "US-002"],
    );
    assert.equal(runtimeData.every((entry) =>
      entry.target.kind === "node_product_runtime_generator_member"
      && entry.target.memberKind === "runtime_data_seed"), true);
  });

  it("pins exact generated test source, output and direct runner authority", () => {
    const cliProfile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
      (profile) => profile.stackPackId === "node-cli",
    );
    const apiProfile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
      (profile) => profile.stackPackId === "node-express-api",
    );
    assert.ok(cliProfile);
    assert.deepEqual({
      source: cliProfile.sourceNormalizedLocator,
      output: cliProfile.compiledNormalizedLocator,
      importSpecifier: cliProfile.runtimeImportSpecifier,
      runner: cliProfile.execution.directArgvPrefix,
      subprocess: cliProfile.execution.subprocessPolicy,
      network: cliProfile.execution.networkPolicy,
    }, {
      source: "src/cli.setfarm.test.ts",
      output: "dist/cli.setfarm.test.js",
      importSpecifier: "./cli.js",
      runner: ["node", "--test"],
      subprocess: "exact_same_runtime_cli_module_only",
      network: "forbidden",
    });
    assert.ok(apiProfile);
    assert.deepEqual({
      source: apiProfile.sourceNormalizedLocator,
      output: apiProfile.compiledNormalizedLocator,
      importSpecifier: apiProfile.runtimeImportSpecifier,
      runner: apiProfile.execution.directArgvPrefix,
      subprocess: apiProfile.execution.subprocessPolicy,
      network: apiProfile.execution.networkPolicy,
    }, {
      source: "src/app.setfarm.test.ts",
      output: "dist/app.setfarm.test.js",
      importSpecifier: "./app.js",
      runner: ["node", "--test"],
      subprocess: "forbidden",
      network: "forbidden",
    });

    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").value;
    assert.deepEqual(cli.authority.testGeneratorProfile, {
      generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2",
      generatorProfileHash:
        "de094967886500722208094d508be9043cb387f0a0d157c79848898b1be17c3b",
      sourcePathRef: "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2",
      compiledPathRef: "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2",
      runnerAbi: "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2",
    });
  });

  it("resolves memory persistence to the generated state runtime", () => {
    const value = compiled(
      twoStoryNodeExpressApiProductSpecV2({ memoryOnOriginalStory: true }),
      "node-express-api",
    ).value;
    const memoryExemptions = value.realizations.filter((entry) =>
      entry.target.kind === "typed_exemption"
      && entry.target.exemptionCode === "PERSISTENCE_MEMORY_USES_STATE_STORE");
    assert.equal(memoryExemptions.length, 1);
    const target = memoryExemptions[0]!.target;
    assert.equal(target.kind, "typed_exemption");
    if (target.kind !== "typed_exemption") throw new Error("Expected exemption");
    assert.equal(target.backingResponsibility, "state_store");
    assert.equal(target.backingResolutionState, "generated_runtime_member");
    assert.equal(value.coverage.modelWriteGrantCount, 0);
    assert.equal(value.coverage.evidenceRequirementMissingCount, 1);
    const missing = value.realizations.filter((entry) =>
      entry.target.kind === "evidence_relation"
      && entry.target.requirementResolution.status
        === "requirement_definition_missing");
    assert.equal(missing.length, 1);
    assert.equal(missing[0]!.target.kind, "evidence_relation");
    if (missing[0]!.target.kind !== "evidence_relation") {
      throw new Error("Expected evidence relation");
    }
    assert.equal(missing[0]!.target.predicateBinding.predicateKind,
      "persistence_round_trip");
    assert.deepEqual(missing[0]!.target.requirementResolution, {
      status: "requirement_definition_missing",
      blockerCode: "EVIDENCE_ADAPTER_V2_REQUIREMENT_DEFINITION_MISSING",
      requiredOperationalRegistrySchema: "setfarm.evidence-adapter-registry.v2",
      resolutionState: "blocked_requirement_definition_missing",
    });
  });

  it("is deterministic, recursively frozen, and freshly reproducible", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const first = compiled(productSpec, "node-cli");
    const second = compiled(structuredClone(productSpec), "node-cli");
    assert.equal(first.canonicalBytes, second.canonicalBytes);
    assert.deepEqual(first.value, second.value);
    assertRecursivelyFrozen(first.value);

    const verified = verifySemanticRealizationPlanV2({
      productSpec: first.productSpec,
      deliverySelection: first.deliverySelection,
      runtimeBehaviorProposal: first.runtimeBehaviorProposal,
      runtimeBehaviorContract: first.runtimeBehaviorContract,
      candidate: first.value,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.canonicalBytes, first.canonicalBytes);
    assert.deepEqual(verified.value, first.value);
    assertRecursivelyFrozen(verified);
  });

  it("rejects a schema-valid, self-rehashed omission against fresh authority", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const candidate = structuredClone(authority.value) as any;
    const removedIndex = candidate.realizations.findIndex((entry: any) =>
      entry.target.kind === "evidence_relation");
    assert.notEqual(removedIndex, -1);
    const [removed] = candidate.realizations.splice(removedIndex, 1);
    candidate.realizationCount = candidate.realizations.length;
    candidate.authority.semanticIntentSet.intentCount = candidate.realizations.length;
    candidate.coverage.sourceIntentCount = candidate.realizations.length;
    candidate.coverage.evidenceRelationCount -= 1;
    if (removed.target.requirementResolution.status === "requirement_defined") {
      candidate.coverage.evidenceRequirementDefinitionCount -= 1;
    } else {
      candidate.coverage.evidenceRequirementMissingCount -= 1;
    }
    rehashPlan(candidate);
    assert.equal(SemanticRealizationPlanV2Schema.safeParse(candidate).success, true);

    assertVerificationError(() => verifySemanticRealizationPlanV2({
      productSpec: authority.productSpec,
      deliverySelection: authority.deliverySelection,
      runtimeBehaviorProposal: authority.runtimeBehaviorProposal,
      runtimeBehaviorContract: authority.runtimeBehaviorContract,
      candidate,
    }), "SEMANTIC_REALIZATION_V2_VERIFICATION_AUTHORITY_MISMATCH");
  });

  it("rejects a self-rehashed policy realization forgery structurally", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const candidate = structuredClone(authority.value) as any;
    const action = candidate.realizations.find((entry: any) =>
      entry.sourceIntent.responsibility === "action_handler");
    assert.ok(action);
    action.target.memberKind = "output_codec";
    action.realizationHash = hashSemanticRealizationV2(action);
    rehashPlan(candidate);
    assert.equal(SemanticRealizationPlanV2Schema.safeParse(candidate).success, false);
  });

  it("rejects self-rehashed evidence definition and profile substitutions", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const catalog = getEvidenceAdapterDefinitionCatalogV2();

    const forgedBody = structuredClone(authority.value) as any;
    const forgedRelation = forgedBody.realizations.find((entry: any) =>
      entry.target.kind === "evidence_relation"
      && entry.target.requirementResolution.status === "requirement_defined");
    assert.ok(forgedRelation);
    const forgedDefinition =
      forgedRelation.target.requirementResolution.requirementDefinition;
    forgedDefinition.profileRequirement.profileHash = "f".repeat(64);
    forgedDefinition.definitionHash =
      hashEvidenceAdapterRequirementDefinitionV2(forgedDefinition);
    forgedRelation.realizationHash = hashSemanticRealizationV2(forgedRelation);
    rehashPlan(forgedBody);
    assert.equal(
      SemanticRealizationPlanV2Schema.safeParse(forgedBody).success,
      false,
    );

    const crossProfile = structuredClone(authority.value) as any;
    const crossRelation = crossProfile.realizations.find((entry: any) =>
      entry.target.kind === "evidence_relation"
      && entry.target.requirementResolution.status === "requirement_defined");
    assert.ok(crossRelation);
    const currentDefinition =
      crossRelation.target.requirementResolution.requirementDefinition;
    const apiDefinition = catalog.definitions.find((definition) =>
      definition.profileRequirement.profileId
        === "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
      && definition.checkRequirement.predicateKind
        === currentDefinition.checkRequirement.predicateKind
      && definition.checkRequirement.selectorRequirement
        === currentDefinition.checkRequirement.selectorRequirement);
    assert.ok(apiDefinition);
    crossRelation.target.requirementResolution.requirementDefinition =
      structuredClone(apiDefinition);
    crossRelation.realizationHash = hashSemanticRealizationV2(crossRelation);
    rehashPlan(crossProfile);
    assert.equal(
      SemanticRealizationPlanV2Schema.safeParse(crossProfile).success,
      false,
    );
  });

  it("rejects laundering a catalog-backed requirement into a missing blocker", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const candidate = structuredClone(authority.value) as any;
    const relation = candidate.realizations.find((entry: any) =>
      entry.target.kind === "evidence_relation"
      && entry.target.requirementResolution.status === "requirement_defined");
    assert.ok(relation);
    relation.target.requirementResolution = {
      status: "requirement_definition_missing",
      blockerCode: "EVIDENCE_ADAPTER_V2_REQUIREMENT_DEFINITION_MISSING",
      requiredOperationalRegistrySchema: "setfarm.evidence-adapter-registry.v2",
      resolutionState: "blocked_requirement_definition_missing",
    };
    relation.realizationHash = hashSemanticRealizationV2(relation);
    candidate.coverage.evidenceRequirementDefinitionCount -= 1;
    candidate.coverage.evidenceRequirementMissingCount += 1;
    rehashPlan(candidate);
    assert.equal(
      SemanticRealizationPlanV2Schema.safeParse(candidate).success,
      false,
    );
  });

  it("rejects a self-rehashed cross-profile test path forgery", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const candidate = structuredClone(authority.value) as any;
    candidate.authority.testGeneratorProfile.sourcePathRef =
      "PATH_NODE_API_GENERATED_TEST_SOURCE_V2";
    rehashPlan(candidate);
    assert.equal(SemanticRealizationPlanV2Schema.safeParse(candidate).success, false);
  });

  it("requires one fresh, exact runtime-behavior proposal and contract join", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    const missing = compileSemanticRealizationPlanV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
    });
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.equal(
        missing.diagnostics[0]?.code,
        "SEMANTIC_REALIZATION_V2_INPUT_INVALID",
      );
    }

    const crossJoined = compileSemanticRealizationPlanV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      runtimeBehaviorProposal: api.runtimeBehaviorProposal,
      runtimeBehaviorContract: api.runtimeBehaviorContract,
    });
    assert.equal(crossJoined.status, "rejected");
    if (crossJoined.status === "rejected") {
      assert.equal(
        crossJoined.diagnostics[0]?.code,
        "SEMANTIC_REALIZATION_V2_BEHAVIOR_AUTHORITY_REJECTED",
      );
    }

    const selfRehashed = structuredClone(cli.runtimeBehaviorContract) as any;
    selfRehashed.authority.proposalHash = "f".repeat(64);
    selfRehashed.contractHash = hashProductRuntimeBehaviorContractV1(selfRehashed);
    const forged = compileSemanticRealizationPlanV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      runtimeBehaviorProposal: cli.runtimeBehaviorProposal,
      runtimeBehaviorContract: selfRehashed,
    });
    assert.equal(forged.status, "rejected");
    if (forged.status === "rejected") {
      assert.equal(
        forged.diagnostics[0]?.code,
        "SEMANTIC_REALIZATION_V2_BEHAVIOR_AUTHORITY_REJECTED",
      );
    }
  });

  it("rejects stale candidates and caller-authored upstream authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const changedSpec = structuredClone(cli.productSpec);
    changedSpec.product.name = "Changed Task CLI";
    assertVerificationError(() => verifySemanticRealizationPlanV2({
      productSpec: changedSpec,
      deliverySelection: cli.deliverySelection,
      runtimeBehaviorProposal: cli.runtimeBehaviorProposal,
      runtimeBehaviorContract: cli.runtimeBehaviorContract,
      candidate: cli.value,
    }), "SEMANTIC_REALIZATION_V2_VERIFICATION_REPRODUCTION_REJECTED");

    for (const field of ["intentSet", "policy", "realizations", "pathMap"] as const) {
      const result = compileSemanticRealizationPlanV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        runtimeBehaviorProposal: cli.runtimeBehaviorProposal,
        runtimeBehaviorContract: cli.runtimeBehaviorContract,
        [field]: "caller-owned",
      });
      assert.equal(result.status, "rejected", field);
      if (result.status === "rejected") {
        assert.equal(result.diagnostics[0]?.code,
          "SEMANTIC_REALIZATION_V2_INPUT_INVALID");
      }
    }
  });
});

describe("SemanticRealizationPlanV2 bounded hostile inputs", () => {
  it("rejects proxies, accessors, cycles, sparse arrays, and oversized input", () => {
    let proxyTrapCalls = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        proxyTrapCalls += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        proxyTrapCalls += 1;
        return undefined;
      },
    });
    assert.equal(compileSemanticRealizationPlanV2(proxy).status, "rejected");
    assert.equal(proxyTrapCalls, 0);

    let accessorCalls = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return genuineNodeCliProductSpecV2();
      },
    });
    assert.equal(compileSemanticRealizationPlanV2(accessor).status, "rejected");
    assert.equal(accessorCalls, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileSemanticRealizationPlanV2(cycle).status, "rejected");

    const sparse: any[] = [];
    sparse.length = 4;
    assert.equal(compileSemanticRealizationPlanV2(sparse).status, "rejected");

    assert.equal(compileSemanticRealizationPlanV2({
      payload: "x".repeat(13 * 1024 * 1024),
    }).status, "rejected");
  });

  it("rejects a hostile verifier candidate without executing proxy traps", () => {
    const authority = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    let proxyTrapCalls = 0;
    const candidate = new Proxy(authority.value, {
      get() {
        proxyTrapCalls += 1;
        throw new Error("candidate proxy trap must not execute");
      },
    });
    assertVerificationError(() => verifySemanticRealizationPlanV2({
      productSpec: authority.productSpec,
      deliverySelection: authority.deliverySelection,
      runtimeBehaviorProposal: authority.runtimeBehaviorProposal,
      runtimeBehaviorContract: authority.runtimeBehaviorContract,
      candidate,
    }), "SEMANTIC_REALIZATION_V2_VERIFICATION_INPUT_INVALID");
    assert.equal(proxyTrapCalls, 0);
  });
});
