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
  "4fc036961b7449aec4eb171699f9559515820e1f5b8864c7440147082200f31b";
const TEST_GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "478ecd63be81483a71d9becd769483e7c9b194c047223374eb35c0731e0c4f28";
const POLICY_HASH_GOLDEN_V2 =
  "50ab59d4d93c3f01d84c3bf1ce680243be8928257f71417f31e0e2bc67183404";
const PLAN_CONTRACT_HASH_GOLDEN_V2 =
  "a9ec3b10e03926315d97126017a38b31de1098dcacbb8563d8a676848226585c";
const CLI_PLAN_HASH_GOLDEN_V2 =
  "8f89a0d9a0accba2feba665c8e532be058b5c9a0980683fce1c7efe13a045ed6";
const API_PLAN_HASH_GOLDEN_V2 =
  "3bc7265b858d380c4af50389ed3c9a20f0883d2d7c3d9cb280da6fc005b2f948";
const TWO_STORY_API_PLAN_HASH_GOLDEN_V2 =
  "02aef64b7b11d03f8431f77d0d4edf9f3bf9b5214f76e47cb2aacf4e9071831c";
const CLI_MEMBERSHIP_HASH_GOLDEN_V2 =
  "acf4b7c75f0a3729ddca7afb3fb6b7d3a56f84d5b5162b64aeda7a2fe38200c5";
const API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "a44103f6212a494c0c00651b8c8927a14a71961fab0998d24ffebb153357c35d";
const TWO_STORY_API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "2ce90ba06b797b34f4c6ebbb62c34d7e9313b69113aad787eedf2dbded75e2d6";
const ENTITY_API_PLAN_HASH_GOLDEN_V2 =
  "13f12e37051bd81548e38526c76c6e57c6185dcee576676de5cb4e4b98af7c92";
const ENTITY_API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "f6acb5edda26ca292afc3010ce18426ef8acd01efb37a2491f80fe83df2d16ce";

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
          "4173068e7e7b629fbe1b843e55ed7c0f1cc9cfbdedb9794450335049eac02a3e",
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
          "8fb4fe015ad5dff1d256887e0e25c02b705be097cd8af396be8a0597cd5af7d5",
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
          "257f9a6e6bc24f5900a5ac9b71d13a41598340d14a870c64391ef93e52134843",
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
          "815757c8dda7c0260c1682a9b70fef5792d877ebb3fb80e2eb0dafe95500e04d",
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
    candidate.realizations.splice(removedIndex, 1);
    candidate.realizationCount = candidate.realizations.length;
    candidate.authority.semanticIntentSet.intentCount = candidate.realizations.length;
    candidate.coverage.sourceIntentCount = candidate.realizations.length;
    candidate.coverage.evidenceRelationCount -= 1;
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
