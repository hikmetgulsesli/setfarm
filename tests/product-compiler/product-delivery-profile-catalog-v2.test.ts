import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
  PRODUCT_DELIVERY_PROFILE_IDS_V2,
  PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
  PRODUCT_DELIVERY_SELECTION_V2_SCHEMA,
  ProductDeliveryProfileCatalogV2Schema,
  ProductDeliveryProfileV2Schema,
  ProductDeliverySelectionV2Schema,
  ProductDeliverySelectionVerificationErrorV2,
  canonicalProductDeliveryProfileCatalogV2,
  getProductDeliveryProfileCatalogV2,
  hashProductDeliveryProfileCatalogV2,
  hashProductDeliveryProfileV2,
  hashProductDeliverySelectionV2,
  productDeliveryProfileCatalogHashV2,
  resolveProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
  productEvidenceCapabilityPolicyHashV2,
} from "../../src/product-compiler/product-evidence-capability-policy-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import { STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1 } from "../../src/product-compiler/schemas/stack-semantic-source-rules-v1.js";
import { getCodeOwnedStackSemanticSourceRuleSetV1 } from "../../src/product-compiler/stack-semantic-source-rules-catalog-v1.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function selected(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
) {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  return result;
}

function withPersistencePolicy(
  source: ProductSpecV2,
  policy: Readonly<{
    id: string;
    kind: "none" | "memory" | "database" | "file";
    owner: "application" | "server";
    durability: "none" | "session" | "durable";
    rehydration: { kind: "none" } | { kind: "initialization" };
  }>,
  database: "none" | "sqlite" = "none",
): ProductSpecV2 {
  const value = clone(source) as any;
  value.delivery.database = database;
  value.persistencePolicies.push({
    ...policy,
    entityRefs: [],
  });
  value.traceability.bindings.push({
    semanticKind: "persistence",
    semanticRef: policy.id,
    requirementRefs: [...value.traceability.bindings[0].requirementRefs],
  });
  return ProductSpecV2Schema.parse(value);
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

describe("ProductDeliveryProfileCatalogV2", () => {
  it("owns exactly the two canonical no-design shadow profiles and their domain hashes", () => {
    const catalog = getProductDeliveryProfileCatalogV2();

    assert.equal(catalog.schema, PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA);
    assert.equal(catalog.catalogVersion, PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION);
    assert.deepEqual(catalog.profiles.map((profile) => profile.id), PRODUCT_DELIVERY_PROFILE_IDS_V2);
    assert.equal(catalog.catalogHash, productDeliveryProfileCatalogHashV2());
    assert.equal(catalog.catalogHash, hashProductDeliveryProfileCatalogV2(catalog));
    assert.equal(ProductDeliveryProfileCatalogV2Schema.safeParse(catalog).success, true);
    assert.equal(
      canonicalProductDeliveryProfileCatalogV2(),
      canonicalJsonStringify(catalog),
    );
    assertRecursivelyFrozen(catalog);

    for (const profile of catalog.profiles) {
      assert.equal(profile.schema, PRODUCT_DELIVERY_PROFILE_V2_SCHEMA);
      assert.equal(profile.profileHash, hashProductDeliveryProfileV2(profile));
      assert.equal(profile.delivery.designRequired, false);
      assert.deepEqual(profile.delivery.allowedDatabases, ["none"]);
      assert.equal(profile.designSource.kind, "none");
      assert.equal(profile.interfaceScopes.surfaceSemantics, "non_rendered_interface_scope");
      assert.equal(profile.readiness.status, "shadow");
      assert.equal(profile.readiness.productionSelection, "forbidden");
      assert.ok(profile.readiness.blockerCodes.length > 0);
      assert.equal(profile.readiness.blockerCodes.some((code) => /ACTIVE/.test(code)), false);
      assert.equal(
        profile.evidenceCapabilities.policyVersion,
        PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
      );
      assert.equal(
        profile.evidenceCapabilities.policyHash,
        productEvidenceCapabilityPolicyHashV2(),
      );
      assert.equal(
        profile.semanticSourceRules.catalogVersion,
        STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
      );
      const topology = getStackTopologyCatalogContract(profile.stackPackBinding.stackPackId)!;
      assert.equal(profile.stackPackBinding.stackPackVersion, topology.identity.version);
      assert.equal(profile.stackPackBinding.stackPackContentHash, topology.identity.contentHash);
      const ruleSet = getCodeOwnedStackSemanticSourceRuleSetV1(
        profile.stackPackBinding.stackPackId,
      )!;
      assert.equal(profile.semanticSourceRules.ruleSetRef, ruleSet.ruleSetRef);
      assert.equal(profile.semanticSourceRules.ruleSetVersion, ruleSet.ruleSetVersion);
      assert.equal(profile.semanticSourceRules.ruleSetHash, ruleSet.ruleSetHash);
      assert.deepEqual(profile.semanticSourceRules.readiness, ruleSet.readiness);
    }
  });

  it("binds exact CLI/API persistence and semantic-source domains without the old API claim", () => {
    const catalog = getProductDeliveryProfileCatalogV2();
    const cli = catalog.profiles[0]!;
    const api = catalog.profiles[1]!;

    assert.deepEqual({
      id: cli.id,
      productClass: cli.productClass,
      stack: cli.stackPackBinding.stackPackId,
      platform: cli.delivery.platform,
      techStack: cli.delivery.techStack,
      persistence: cli.delivery.allowedPersistenceKinds,
      route: cli.interfaceScopes.routeSemantics,
      invocation: cli.runtime.invocationKind,
      launcher: cli.runtime.launcherRef,
      ruleSet: cli.semanticSourceRules.ruleSetRef,
    }, {
      id: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      productClass: "developer_tool",
      stack: "node-cli",
      platform: "cli",
      techStack: "node-cli",
      persistence: ["none"],
      route: "cli_command_namespace",
      invocation: "cli_process",
      launcher: "LAUNCH_NODE_CLI_V2",
      ruleSet: "RULESET_NODE_CLI_V1",
    });
    assert.deepEqual({
      id: api.id,
      productClass: api.productClass,
      stack: api.stackPackBinding.stackPackId,
      platform: api.delivery.platform,
      techStack: api.delivery.techStack,
      persistence: api.delivery.allowedPersistenceKinds,
      route: api.interfaceScopes.routeSemantics,
      invocation: api.runtime.invocationKind,
      launcher: api.runtime.launcherRef,
      ruleSet: api.semanticSourceRules.ruleSetRef,
    }, {
      id: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      productClass: "service",
      stack: "node-express-api",
      platform: "api",
      techStack: "node-express",
      persistence: ["memory", "none"],
      route: "http_route_namespace",
      invocation: "http_service",
      launcher: "LAUNCH_NODE_EXPRESS_API_V2",
      ruleSet: "RULESET_NODE_EXPRESS_API_STATELESS_V1",
    });
    const apiRules = getCodeOwnedStackSemanticSourceRuleSetV1("node-express-api")!;
    assert.equal(apiRules.ruleSetRef === "RULESET_NODE_EXPRESS_API_V1", false);
    assert.equal(
      apiRules.rules.some((rule) => rule.responsibility === "persistence_adapter"),
      false,
    );
  });

  it("requires typed ProductSpecV2 plus the exact explicit stack and never falls back", () => {
    const cliSpec = genuineNodeCliProductSpecV2();
    const apiSpec = genuineNodeExpressApiProductSpecV2();
    const cli = selected(cliSpec, "node-cli");
    const api = selected(apiSpec, "node-express-api");

    assert.equal(cli.selection.schema, PRODUCT_DELIVERY_SELECTION_V2_SCHEMA);
    assert.equal(cli.selection.productSpecHash, hashCanonicalJson(cliSpec));
    assert.equal(cli.selectionHash, hashProductDeliverySelectionV2(cli.selection));
    assert.equal(cli.canonicalBytes, canonicalJsonStringify(cli.selection));
    assert.equal(cli.selection.selectionBasis, "explicit_stack_prefix");
    assert.equal(cli.selection.runtime.launcherRef, "LAUNCH_NODE_CLI_V2");
    assert.equal(cli.selection.readiness.status, "shadow");
    assert.equal(api.selection.productSpecHash, hashCanonicalJson(apiSpec));
    assert.equal(api.selectionHash, hashProductDeliverySelectionV2(api.selection));
    assert.equal(api.selection.runtime.launcherRef, "LAUNCH_NODE_EXPRESS_API_V2");
    assertRecursivelyFrozen(cli);
    assertRecursivelyFrozen(api);

    const missingStack = resolveProductDeliverySelectionV2({ productSpec: cliSpec });
    assert.equal(missingStack.status, "rejected");
    const pythonSubstitution = resolveProductDeliverySelectionV2({
      productSpec: cliSpec,
      requestedStackPackId: "python-cli",
    });
    assert.equal(pythonSubstitution.status, "rejected");
    if (pythonSubstitution.status === "rejected") {
      assert.equal(
        pythonSubstitution.diagnostics[0]?.code,
        "PRODUCT_DELIVERY_V2_EXPLICIT_STACK_UNSUPPORTED",
      );
    }
    const cliWrongStack = resolveProductDeliverySelectionV2({
      productSpec: cliSpec,
      requestedStackPackId: "node-express-api",
    });
    assert.equal(cliWrongStack.status, "rejected");
    if (cliWrongStack.status === "rejected") {
      assert.equal(
        cliWrongStack.diagnostics[0]?.code,
        "PRODUCT_DELIVERY_V2_EXPLICIT_STACK_UNSUPPORTED",
      );
    }
    const apiWrongStack = resolveProductDeliverySelectionV2({
      productSpec: apiSpec,
      requestedStackPackId: "node-cli",
    });
    assert.equal(apiWrongStack.status, "rejected");
    if (apiWrongStack.status === "rejected") {
      assert.equal(
        apiWrongStack.diagnostics[0]?.code,
        "PRODUCT_DELIVERY_V2_EXPLICIT_STACK_UNSUPPORTED",
      );
    }

    const unsupportedClass = clone(cliSpec) as any;
    unsupportedClass.product.class = "utility";
    const unsupported = resolveProductDeliverySelectionV2({
      productSpec: ProductSpecV2Schema.parse(unsupportedClass),
      requestedStackPackId: "node-cli",
    });
    assert.equal(unsupported.status, "rejected");
    if (unsupported.status === "rejected") {
      assert.equal(unsupported.diagnostics[0]?.code, "PRODUCT_DELIVERY_V2_PROFILE_UNSUPPORTED");
    }
  });

  it("accepts API memory only and rejects CLI memory plus API file/database semantics", () => {
    const apiSpec = genuineNodeExpressApiProductSpecV2();
    const cliSpec = genuineNodeCliProductSpecV2();
    const apiMemory = withPersistencePolicy(apiSpec, {
      id: "PERSIST_API_MEMORY",
      kind: "memory",
      owner: "server",
      durability: "session",
      rehydration: { kind: "none" },
    });
    assert.equal(selected(apiMemory, "node-express-api").status, "shadow_selected");

    const cliMemory = withPersistencePolicy(cliSpec, {
      id: "PERSIST_CLI_MEMORY",
      kind: "memory",
      owner: "application",
      durability: "session",
      rehydration: { kind: "none" },
    });
    const cliMemoryResult = resolveProductDeliverySelectionV2({
      productSpec: cliMemory,
      requestedStackPackId: "node-cli",
    });
    assert.equal(cliMemoryResult.status, "rejected");
    if (cliMemoryResult.status === "rejected") {
      assert.equal(
        cliMemoryResult.diagnostics[0]?.code,
        "PRODUCT_DELIVERY_V2_PRODUCT_SEMANTICS_MISMATCH",
      );
    }

    const apiFile = withPersistencePolicy(apiSpec, {
      id: "PERSIST_API_FILE",
      kind: "file",
      owner: "server",
      durability: "durable",
      rehydration: { kind: "initialization" },
    });
    assert.equal(resolveProductDeliverySelectionV2({
      productSpec: apiFile,
      requestedStackPackId: "node-express-api",
    }).status, "rejected");

    const apiDatabase = withPersistencePolicy(apiSpec, {
      id: "PERSIST_API_DATABASE",
      kind: "database",
      owner: "server",
      durability: "durable",
      rehydration: { kind: "initialization" },
    }, "sqlite");
    assert.equal(resolveProductDeliverySelectionV2({
      productSpec: apiDatabase,
      requestedStackPackId: "node-express-api",
    }).status, "rejected");
  });

  it("rejects self-consistent profile/catalog forgeries against code-owned authority", () => {
    const catalog = clone(getProductDeliveryProfileCatalogV2()) as any;
    const cli = catalog.profiles[0];
    cli.delivery.allowedPersistenceKinds = ["memory"];
    cli.profileHash = hashProductDeliveryProfileV2(cli);
    assert.equal(ProductDeliveryProfileV2Schema.safeParse(cli).success, false);

    const api = clone(getProductDeliveryProfileCatalogV2().profiles[1]) as any;
    api.semanticSourceRules.ruleSetRef = "RULESET_NODE_EXPRESS_API_V1";
    api.profileHash = hashProductDeliveryProfileV2(api);
    assert.equal(ProductDeliveryProfileV2Schema.safeParse(api).success, false);

    const reordered = clone(getProductDeliveryProfileCatalogV2()) as any;
    reordered.profiles.reverse();
    reordered.catalogHash = hashProductDeliveryProfileCatalogV2(reordered);
    assert.equal(ProductDeliveryProfileCatalogV2Schema.safeParse(reordered).success, false);

    const duplicate = clone(getProductDeliveryProfileCatalogV2()) as any;
    duplicate.profiles = [clone(duplicate.profiles[0]), clone(duplicate.profiles[0])];
    duplicate.catalogHash = hashProductDeliveryProfileCatalogV2(duplicate);
    assert.equal(ProductDeliveryProfileCatalogV2Schema.safeParse(duplicate).success, false);

    const wrongLauncher = clone(getProductDeliveryProfileCatalogV2().profiles[0]) as any;
    wrongLauncher.runtime.launcherRef = "LAUNCH_NODE_EXPRESS_API_V2";
    wrongLauncher.profileHash = hashProductDeliveryProfileV2(wrongLauncher);
    assert.equal(ProductDeliveryProfileV2Schema.safeParse(wrongLauncher).success, false);

    const databaseClaim = clone(getProductDeliveryProfileCatalogV2().profiles[1]) as any;
    databaseClaim.delivery.allowedDatabases = ["postgres"];
    databaseClaim.profileHash = hashProductDeliveryProfileV2(databaseClaim);
    assert.equal(ProductDeliveryProfileV2Schema.safeParse(databaseClaim).success, false);
  });

  it("fresh-verifies exact selections and rejects mutation or stale ProductSpec authority", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const result = selected(productSpec, "node-cli");
    const verified = verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "node-cli",
      candidate: result.selection,
    });
    assert.deepEqual(verified, result.selection);
    assert.notEqual(verified, result.selection);
    assertRecursivelyFrozen(verified);

    const wrongValidProfile = selected(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).selection;
    assert.throws(() => verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "node-cli",
      candidate: wrongValidProfile,
    }), (error: unknown) => error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_AUTHORITY_MISMATCH");

    const forgedSpecHash = clone(result.selection) as any;
    forgedSpecHash.productSpecHash = "f".repeat(64);
    assert.equal(ProductDeliverySelectionV2Schema.safeParse(forgedSpecHash).success, true);
    assert.throws(() => verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "node-cli",
      candidate: forgedSpecHash,
    }), (error: unknown) => error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_AUTHORITY_MISMATCH");

    const mutatedProfile = clone(result.selection) as any;
    mutatedProfile.profileHash = "e".repeat(64);
    assert.throws(() => verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "node-cli",
      candidate: mutatedProfile,
    }), (error: unknown) => error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_INVALID");

    const wrongCatalog = clone(result.selection) as any;
    wrongCatalog.catalogHash = "d".repeat(64);
    assert.equal(ProductDeliverySelectionV2Schema.safeParse(wrongCatalog).success, false);

    const staleSpec = clone(productSpec) as any;
    staleSpec.product.name = "Changed CLI";
    assert.throws(() => verifyProductDeliverySelectionV2({
      productSpec: ProductSpecV2Schema.parse(staleSpec),
      requestedStackPackId: "node-cli",
      candidate: result.selection,
    }), (error: unknown) => error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_AUTHORITY_MISMATCH");
  });

  it("bounds public work and rejects proxies, accessors, cycles, sparse arrays, and oversized input", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    let proxyTrapCalls = 0;
    const proxy = new Proxy({ productSpec, requestedStackPackId: "node-cli" }, {
      get() {
        proxyTrapCalls += 1;
        throw new Error("proxy trap must not execute");
      },
    });
    assert.equal(resolveProductDeliverySelectionV2(proxy).status, "rejected");
    assert.equal(proxyTrapCalls, 0);

    let accessorCalls = 0;
    const accessorInput: Record<string, unknown> = { requestedStackPackId: "node-cli" };
    Object.defineProperty(accessorInput, "productSpec", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return productSpec;
      },
    });
    assert.equal(resolveProductDeliverySelectionV2(accessorInput).status, "rejected");
    assert.equal(accessorCalls, 0);

    const cyclic: any = { productSpec, requestedStackPackId: "node-cli" };
    cyclic.self = cyclic;
    assert.equal(resolveProductDeliverySelectionV2(cyclic).status, "rejected");

    const sparse: any[] = [];
    sparse.length = 2;
    sparse[1] = "node-cli";
    assert.equal(resolveProductDeliverySelectionV2({
      productSpec: sparse,
      requestedStackPackId: "node-cli",
    }).status, "rejected");

    assert.equal(resolveProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "x".repeat(4 * 1024 * 1024),
    }).status, "rejected");

    const exact = selected(productSpec, "node-cli").selection;
    const hostileCandidate = new Proxy(exact, {
      get() {
        throw new Error("candidate proxy trap must not execute");
      },
    });
    assert.throws(() => verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: "node-cli",
      candidate: hostileCandidate,
    }), (error: unknown) => error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_VERIFICATION_INPUT_INVALID");
  });

  it("does not expose a production activation or implicit selection API", () => {
    const catalogText = canonicalProductDeliveryProfileCatalogV2();
    assert.equal(catalogText.includes('"status":"active"'), false);
    assert.equal(catalogText.includes("fallback"), false);
    assert.equal(catalogText.includes("python-cli"), false);
    assert.equal(catalogText.includes("RULESET_NODE_EXPRESS_API_V1"), false);
    assert.equal(
      resolveProductDeliverySelectionV2(genuineNodeCliProductSpecV2()).status,
      "rejected",
    );
  });
});
