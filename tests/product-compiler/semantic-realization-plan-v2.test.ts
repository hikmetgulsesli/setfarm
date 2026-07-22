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
import type { ProductSpecV2 } from
  "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "2f36ccaf6ccc5d88d89c770ea01daf139afc18b3736c4b282f9e01fea005b41f";
const TEST_GENERATOR_CONTRACT_HASH_GOLDEN_V2 =
  "478ecd63be81483a71d9becd769483e7c9b194c047223374eb35c0731e0c4f28";
const POLICY_HASH_GOLDEN_V2 =
  "9dc1212f1c7fd1a6801dfbd9d3a2823b68292f76cdb9d8c7501fa8ac5beb120e";
const PLAN_CONTRACT_HASH_GOLDEN_V2 =
  "fcb011c9bcd79d4178415f0b7b419572d8a57eb38a94a8ece54d8a68f07d645e";
const CLI_PLAN_HASH_GOLDEN_V2 =
  "4bf2b8117db2b84cecefb8b50ed5230c31fdac0350f97277a51816b69d30a191";
const API_PLAN_HASH_GOLDEN_V2 =
  "a650d4b1923d098171181dd2de466df2cbce025782b556902cb5fc24e711a6c2";
const TWO_STORY_API_PLAN_HASH_GOLDEN_V2 =
  "7584d7e0c06858154ceaadba0707f0b01e0b56c320f362438f1ec8e9f0f6f16a";
const CLI_MEMBERSHIP_HASH_GOLDEN_V2 =
  "da6de6fa7a1c2005be03459827dcb0dffccf917ac56acd6b4d11f9cbec370875";
const API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "f1ca02a8a6709b51efc79165b89516789c2e6fefd8f84197717dc80a88ecb342";
const TWO_STORY_API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "8526fcb2f070e794a6df705abe0a4e9f0c2c2f7e64f98945aad80cebc232222e";

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
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const result = compileSemanticRealizationPlanV2({
    productSpec,
    deliverySelection,
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
      "reject_without_versioned_product_spec_behavior_contract",
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
      },
      {
        compiled: compiled(
          genuineNodeExpressApiProductSpecV2(),
          "node-express-api",
        ),
        coverage: [19, 11, 5, 1, 2],
        planHash: API_PLAN_HASH_GOLDEN_V2,
        membershipHash: API_MEMBERSHIP_HASH_GOLDEN_V2,
      },
      {
        compiled: compiled(
          twoStoryNodeExpressApiProductSpecV2(),
          "node-express-api",
        ),
        coverage: [32, 20, 6, 2, 4],
        planHash: TWO_STORY_API_PLAN_HASH_GOLDEN_V2,
        membershipHash: TWO_STORY_API_MEMBERSHIP_HASH_GOLDEN_V2,
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
      assert.equal(SemanticRealizationPlanV2Schema.safeParse(value).success, true);
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

  it("rejects stale candidates and caller-authored upstream authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const changedSpec = structuredClone(cli.productSpec);
    changedSpec.product.name = "Changed Task CLI";
    assertVerificationError(() => verifySemanticRealizationPlanV2({
      productSpec: changedSpec,
      deliverySelection: cli.deliverySelection,
      candidate: cli.value,
    }), "SEMANTIC_REALIZATION_V2_VERIFICATION_REPRODUCTION_REJECTED");

    for (const field of ["intentSet", "policy", "realizations", "pathMap"] as const) {
      const result = compileSemanticRealizationPlanV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
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
      candidate,
    }), "SEMANTIC_REALIZATION_V2_VERIFICATION_INPUT_INVALID");
    assert.equal(proxyTrapCalls, 0);
  });
});
