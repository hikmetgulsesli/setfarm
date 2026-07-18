import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileSemanticSourcePathTokenSetV2,
  getCodeOwnedSemanticSourcePathTokenContractV2,
  getCodeOwnedSemanticSourcePathTokenSetContractV2,
  SemanticSourcePathTokenVerificationErrorV2,
  verifySemanticSourcePathTokenSetV2,
} from "../../src/product-compiler/semantic-source-path-token-set-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2,
  SemanticSourcePathTokenSetV2Schema,
  hashSemanticSourceExternalPathRequirementV2,
  hashSemanticSourceExternalRequirementMembershipV2,
  hashSemanticSourcePathTokenBindingV2,
  hashSemanticSourcePathTokenMembershipV2,
  hashSemanticSourcePathTokenSetV2,
  type SemanticSourcePathTokenSetV2,
} from "../../src/product-compiler/schemas/semantic-source-path-token-set-v2.js";
import {
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
} from "../../src/product-compiler/schemas/stack-semantic-source-rules-v1.js";
import {
  PATH_TOKEN_CONTRACT_HASH_V2,
} from "../../src/product-compiler/schemas/path-token-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const TOKEN_CONTRACT_HASH_GOLDEN_V2 =
  "95d3163989013d02135edbba27402fba903e9501451d0dd1bb269ec43a79f78b";
const SET_CONTRACT_HASH_GOLDEN_V2 =
  "a6cd5765406a55bcdec4799d002d58405cf2aac6d1d451bc8dd194aebcb66ee1";
const CLI_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2 =
  "df1d2eeb6d9340df24e4a344db44221fb6f7a8f7b4559e53dc3971d2eeb71caa";
const API_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2 =
  "492f5f1cb52b35cbc51a437438570addad6910e3a3f82e7c39ca4c02a8c835be";
const CLI_EXTERNAL_MEMBERSHIP_HASH_GOLDEN_V2 =
  "b58a3157f2e5df50f97073971faaf5192880ccbd68ddfd20a40a755e1e5a5ba6";
const API_EXTERNAL_MEMBERSHIP_HASH_GOLDEN_V2 =
  "870eaf7857472237b9e0daa24ebd30a414e00107e747f866d0b36b303d6dc793";
const CLI_SET_HASH_GOLDEN_V2 =
  "d3c98cb4547945755744591cf62cdf5aa152aaf6f53028d06b176c46269055c9";
const API_SET_HASH_GOLDEN_V2 =
  "a35d4786c1fdf3f20439923e34deeb08a1f7b14f5d8a1827ff1794bf4ee2dedb";

function selectionFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(result.status, "shadow_selected");
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function compiled(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const result = compileSemanticSourcePathTokenSetV2({
    productSpec,
    deliverySelection,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected compilation");
  return { productSpec, deliverySelection, tokenSet: result.value };
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertRecursivelyFrozen);
}

function rehashSet(candidate: any): void {
  candidate.tokenCount = candidate.tokens.length;
  candidate.uniquePathCount = new Set(candidate.tokens.map((token: any) =>
    `${token.physicalSpace}\0${token.normalizedLocator}`)).size;
  candidate.externalRequirementCount = candidate.externalRequirements.length;
  candidate.tokenMembershipHash = hashSemanticSourcePathTokenMembershipV2(
    candidate.tokens,
  );
  candidate.externalRequirementMembershipHash =
    hashSemanticSourceExternalRequirementMembershipV2(
      candidate.externalRequirements,
    );
  candidate.setHash = hashSemanticSourcePathTokenSetV2(candidate);
}

function assertVerificationError(
  operation: () => unknown,
  code: SemanticSourcePathTokenVerificationErrorV2["code"],
): void {
  assert.throws(operation, (error: unknown) =>
    error instanceof SemanticSourcePathTokenVerificationErrorV2
    && error.code === code);
}

describe("SemanticSourcePathTokenSetV2 contract and compiler", () => {
  it("separately pins immutable path identity and set compiler contracts", () => {
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
      TOKEN_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2,
      SET_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.equal(
      getCodeOwnedSemanticSourcePathTokenContractV2(),
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2,
    );
    assert.equal(
      getCodeOwnedSemanticSourcePathTokenSetContractV2(),
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2,
    );
    assert.equal(Object.isFrozen(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2), true);
    assert.equal(
      Object.isFrozen(SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2),
      true,
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.forbiddenIdentityInputs
        .includes("storyId"),
      true,
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.inputFields
        .some((field) => /story|ordinal|legacy|ruleSet|intentRef|scopeRef/iu.test(field)),
      false,
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.tokenContractHash,
      TOKEN_CONTRACT_HASH_GOLDEN_V2,
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.portabilityContractHash,
      PATH_TOKEN_CONTRACT_HASH_V2,
    );
    assert.deepEqual(
      Object.keys(SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains).sort(),
      [
        "externalMembership",
        "externalPathProjection",
        "externalRequirement",
        "legacyFixedReleaseProjection",
        "pathProjection",
        "portableCaseFoldPathIdentity",
        "portablePathIdentity",
        "set",
        "tokenBinding",
        "tokenMembership",
      ],
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.hashPayloadShapes.origin
        .domainField,
      "schema",
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
        .tokenMembership.wrapper,
      "members",
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
        .externalMembership.wrapper,
      "members",
    );
    assert.equal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
        .legacyFixedReleaseProjection.topLevelFields.locator,
      "normalizedLocator",
    );
    assert.equal(
      Object.values(
        SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules,
      ).every((rule) => rule.requiredAuthority.endsWith("_v2")),
      true,
    );
  });

  it("compiles every-and-only CLI/API source-slot path disposition with goldens", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    assert.deepEqual(
      {
        sourceSlots: cli.sourceAuthority.sourceSlotIntentCount,
        tokens: cli.tokenCount,
        paths: cli.uniquePathCount,
        external: cli.externalRequirementCount,
      },
      { sourceSlots: 10, tokens: 7, paths: 7, external: 3 },
    );
    assert.deepEqual(
      {
        sourceSlots: api.sourceAuthority.sourceSlotIntentCount,
        tokens: api.tokenCount,
        paths: api.uniquePathCount,
        external: api.externalRequirementCount,
      },
      { sourceSlots: 11, tokens: 8, paths: 8, external: 3 },
    );
    for (const set of [cli, api]) {
      assert.deepEqual(set.readiness, {
        status: "shadow",
        productionUse: "forbidden",
        blockerCodes: SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2,
      });
      assert.equal(
        set.tokenCount + set.externalRequirementCount,
        set.sourceAuthority.sourceSlotIntentCount,
      );
      assert.equal(set.setHash, hashSemanticSourcePathTokenSetV2(set));
      assert.equal(SemanticSourcePathTokenSetV2Schema.safeParse(set).success, true);
      assertRecursivelyFrozen(set);
    }
    assert.equal(cli.tokenMembershipHash, CLI_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(api.tokenMembershipHash, API_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(
      cli.externalRequirementMembershipHash,
      CLI_EXTERNAL_MEMBERSHIP_HASH_GOLDEN_V2,
    );
    assert.equal(
      api.externalRequirementMembershipHash,
      API_EXTERNAL_MEMBERSHIP_HASH_GOLDEN_V2,
    );
    assert.equal(cli.setHash, CLI_SET_HASH_GOLDEN_V2);
    assert.equal(api.setHash, API_SET_HASH_GOLDEN_V2);
  });

  it("uses stable scope identity and publishes no ordinal story or V1 token authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    const serialized = JSON.stringify(cli);
    const serializedOrigins = JSON.stringify(cli.tokens.map((token) => token.origin));
    assert.equal(serialized.includes("SEMANTIC_SOURCE_PATH_TOKEN_V1"), false);
    assert.equal(
      serializedOrigins.includes(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1),
      false,
    );
    assert.equal(/ruleSetHash|scopeRef|componentHash|intentRef|intentHash/u.test(
      serializedOrigins,
    ), false);
    assert.equal(serialized.includes("storyId"), false);
    assert.equal(serialized.includes("storyOrder"), false);
    assert.equal(serialized.includes("pathResolutionHash"), false);
    assert.equal(cli.tokens.every((token) =>
      token.origin.scopeIdentity.schema
        === "setfarm.semantic-source-path-scope-identity.v2"
      && token.intentAuthority.scopeRef.length > 0
      && token.intentAuthority.intentRef.length > 0
      && token.normalizedLocator
        === `src/setfarm/semantic/${token.pathToken}${token.pathProjection.extension}`), true);
  });

  it("keeps selected entrypoint paths as typed external requirements without raw locators", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    assert.equal(cli.externalRequirements.length, 3);
    assert.equal(cli.externalRequirements.every((requirement) =>
      requirement.expectation.kind === "shared_structural_selected_entrypoint"
      && requirement.expectation.entrypointKind === "cli"
      && requirement.expectation.requiredAuthority
        === "node_execution_path_token_v2"), true);
    const serialized = JSON.stringify(cli.externalRequirements);
    assert.equal(serialized.includes("src/cli.ts"), false);
    assert.equal(serialized.includes("src/index.ts"), false);
    assert.equal(serialized.includes("normalizedLocator"), false);

    const forged = structuredClone(cli) as any;
    const requirement = forged.externalRequirements[0];
    requirement.pathAuthorityProjectionHash = "f".repeat(64);
    const { requirementHash: _requirementHash, ...identity } = requirement;
    requirement.requirementHash =
      hashSemanticSourceExternalPathRequirementV2(identity);
    rehashSet(forged);
    assert.equal(SemanticSourcePathTokenSetV2Schema.safeParse(forged).success, false);
  });

  it("keeps common semantic token identities stable when an unrelated story is added", () => {
    const one = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    const two = compiled(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    const twoBySubjectResponsibility = new Map(two.tokens.map((token) => [
      `${JSON.stringify(token.origin.subjectIdentity)}\0${token.origin.responsibility}`,
      token,
    ]));
    let common = 0;
    let changedCurrentIntentBindings = 0;
    for (const token of one.tokens) {
      const matching = twoBySubjectResponsibility.get(
        `${JSON.stringify(token.origin.subjectIdentity)}\0${token.origin.responsibility}`,
      );
      if (!matching) continue;
      common += 1;
      assert.deepEqual(matching.origin, token.origin);
      assert.equal(matching.pathToken, token.pathToken);
      assert.equal(matching.normalizedLocator, token.normalizedLocator);
      if (
        matching.intentAuthority.intentHash !== token.intentAuthority.intentHash
        && matching.bindingHash !== token.bindingHash
      ) {
        changedCurrentIntentBindings += 1;
      }
    }
    assert.ok(common >= 4, `Expected at least four stable common tokens, got ${common}`);
    assert.ok(
      changedCurrentIntentBindings >= 4,
      "Expected current intent authority to change without churning stable paths",
    );
    assert.notEqual(two.setHash, one.setHash);
  });

  it("keeps unchanged obligations stable when the same story component grows", () => {
    const before = compiled(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    const after = compiled(
      twoStoryNodeExpressApiProductSpecV2({ memoryOnOriginalStory: true }),
      "node-express-api",
    ).tokenSet;
    const obligationKey = (token: typeof before.tokens[number]) => [
      token.intentAuthority.subjectKind,
      token.intentAuthority.subjectRef,
      token.origin.responsibility,
      token.origin.ruleRef,
    ].join("\0");
    const afterByObligation = new Map(after.tokens.map((token) => [
      obligationKey(token),
      token,
    ]));
    let common = 0;
    let changedV1Authority = 0;
    for (const token of before.tokens) {
      const matching = afterByObligation.get(obligationKey(token));
      if (!matching) continue;
      common += 1;
      assert.deepEqual(matching.origin, token.origin);
      assert.equal(matching.pathToken, token.pathToken);
      assert.equal(matching.normalizedLocator, token.normalizedLocator);
      if (
        JSON.stringify(matching.intentAuthority)
        !== JSON.stringify(token.intentAuthority)
      ) changedV1Authority += 1;
    }
    assert.ok(common >= 8, `Expected at least eight common obligations, got ${common}`);
    assert.ok(
      changedV1Authority >= 4,
      "Expected V1 story-component authority to change outside stable path origin",
    );
    const uniquePathInventory = (set: typeof before) => [...new Set(
      set.tokens.map((token) => token.normalizedLocator),
    )].sort();
    assert.deepEqual(uniquePathInventory(after), uniquePathInventory(before));
    const runtimeDataTokens = after.tokens.filter((token) =>
      token.origin.subjectIdentity.originKind === "runtime_data_contract");
    assert.equal(runtimeDataTokens.length, 2);
    assert.equal(new Set(runtimeDataTokens.map((token) => token.pathToken)).size, 1);
    assert.equal(runtimeDataTokens.every((token) =>
      token.materialization.kind === "shared_catalog_aggregate"
      && token.materialization.aggregationRef
        === "SEMANTIC_RUNTIME_DATA_FIXTURE_BY_PRODUCT_V2"), true);
    assert.equal(after.uniquePathCount, after.tokenCount - 1);
    assert.notEqual(after.setHash, before.setHash);
  });
});

describe("SemanticSourcePathTokenSetV2 fresh authority", () => {
  it("freshly verifies CLI/API and rejects cross-profile authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    const verifiedCli = verifySemanticSourcePathTokenSetV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      candidate: cli.tokenSet,
    });
    assert.equal(verifiedCli.status, "verified_shadow");
    assert.equal(verifiedCli.value.setHash, CLI_SET_HASH_GOLDEN_V2);
    assertRecursivelyFrozen(verifiedCli);
    assertVerificationError(
      () => verifySemanticSourcePathTokenSetV2({
        productSpec: api.productSpec,
        deliverySelection: api.deliverySelection,
        candidate: cli.tokenSet,
      }),
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects a schema-valid self-rehashed omission against fresh intent authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    for (const collection of ["tokens", "externalRequirements"] as const) {
      const incomplete = structuredClone(cli.tokenSet) as any;
      incomplete[collection].pop();
      incomplete.sourceAuthority.sourceSlotIntentCount -= 1;
      rehashSet(incomplete);
      assert.equal(
        SemanticSourcePathTokenSetV2Schema.safeParse(incomplete).success,
        true,
        collection,
      );
      assertVerificationError(
        () => verifySemanticSourcePathTokenSetV2({
          productSpec: cli.productSpec,
          deliverySelection: cli.deliverySelection,
          candidate: incomplete,
        }),
        "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
      );
    }
  });

  it("rejects a self-rehashed current-intent mutation while path identity stays fixed", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const changed = structuredClone(cli.tokenSet) as any;
    const token = changed.tokens[0];
    const originalPathToken = token.pathToken;
    const originalLocator = token.normalizedLocator;
    token.intentAuthority.intentHash = "f".repeat(64);
    const { bindingHash: _bindingHash, ...identity } = token;
    token.bindingHash = hashSemanticSourcePathTokenBindingV2(identity);
    rehashSet(changed);
    assert.equal(token.pathToken, originalPathToken);
    assert.equal(token.normalizedLocator, originalLocator);
    assert.equal(
      SemanticSourcePathTokenSetV2Schema.safeParse(changed).success,
      true,
    );
    assertVerificationError(
      () => verifySemanticSourcePathTokenSetV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: changed,
      }),
      "SEMANTIC_SOURCE_PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("allows only catalog aggregation, never exclusive-file path duplication", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const duplicate = structuredClone(cli.tokenSet) as any;
    const exclusive = duplicate.tokens.filter((token: any) =>
      token.materialization.kind === "exclusive_file");
    const source = exclusive[0];
    const target = exclusive[1];
    for (const field of [
      "origin",
      "materialization",
      "pathToken",
      "pathProjection",
      "namespace",
      "disposition",
      "nodeKind",
      "physicalSpace",
      "underRootRef",
      "normalizedLocator",
      "locatorByteLength",
      "segmentCount",
      "pathIdentityHash",
      "caseFoldPathIdentityHash",
    ]) target[field] = structuredClone(source[field]);
    const { bindingHash: _bindingHash, ...identity } = target;
    target.bindingHash = hashSemanticSourcePathTokenBindingV2(identity);
    rehashSet(duplicate);
    const parsed = SemanticSourcePathTokenSetV2Schema.safeParse(duplicate);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.issues.some((issue) =>
        issue.message.includes("collision-free")), true);
    }
  });

  it("rejects caller-authored path, intent, rule, and design authority", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const deliverySelection = selectionFor(productSpec, "node-cli");
    for (const field of [
      "path",
      "root",
      "tokens",
      "intentSet",
      "rules",
      "designSourceClosure",
      "scopeTargets",
    ]) {
      const result = compileSemanticSourcePathTokenSetV2({
        productSpec,
        deliverySelection,
        [field]: field === "tokens" ? [] : "caller-owned",
      });
      assert.equal(result.status, "rejected", field);
      if (result.status === "rejected") {
        assert.equal(
          result.diagnostics[0]?.code,
          "SEMANTIC_SOURCE_PATH_TOKEN_V2_INPUT_INVALID",
          field,
        );
      }
    }
  });
});

describe("SemanticSourcePathTokenSetV2 bounded hostile inputs", () => {
  it("rejects proxy, cycle, accessor, sparse, and oversized input without traps", () => {
    let trapCount = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        return undefined;
      },
    });
    assert.equal(compileSemanticSourcePathTokenSetV2(proxy).status, "rejected");
    assert.equal(trapCount, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileSemanticSourcePathTokenSetV2(cycle).status, "rejected");

    let accessorCalls = 0;
    const accessor: any = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return genuineNodeCliProductSpecV2();
      },
    });
    assert.equal(compileSemanticSourcePathTokenSetV2(accessor).status, "rejected");
    assert.equal(accessorCalls, 0);

    const sparse: any[] = [];
    sparse.length = 5;
    assert.equal(compileSemanticSourcePathTokenSetV2(sparse).status, "rejected");

    assert.equal(
      compileSemanticSourcePathTokenSetV2({ payload: "x".repeat(9 * 1024 * 1024) })
        .status,
      "rejected",
    );
  });
});
