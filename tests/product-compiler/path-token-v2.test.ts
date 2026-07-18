import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PathClosureVerificationErrorV2,
  PathTokenVerificationErrorV2,
  compileNodeExecutionPathTokenSetV2,
  getCodeOwnedPathTokenContractV2,
  validateNodeExecutionPathClosureCandidateV2,
  verifyNodeExecutionPathTokenSetV2,
} from "../../src/product-compiler/path-token-v2.js";
import {
  resolveNodeExecutionLayoutV2,
} from "../../src/product-compiler/node-execution-layout-catalog-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA,
  PATH_CONSUMER_BINDING_V2_SCHEMA,
  PATH_ROOT_BINDING_V2_SCHEMA,
  PATH_TOKEN_CONTRACT_HASH_V2,
  PATH_TOKEN_CONTRACT_V2,
  PATH_TOKEN_SET_BLOCKER_CODES_V2,
  PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2,
  PATH_TOKEN_V2_SCHEMA,
  NodeExecutionPathTokenSetV2Schema,
  asciiCaseFoldPathV2,
  hashNodeExecutionPathTokenSetV2,
  hashPathConsumerBindingV2,
  hashPathConsumerMembershipV2,
  hashPathRootBindingV2,
  hashPathRootMembershipV2,
  hashPathTokenBindingV2,
  hashPathTokenMembershipV2,
  hashPathTokenOriginV2,
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  isPathContainedByRootV2,
  portablePathIssuesV2,
  type NodeExecutionPathTokenSetV2,
} from "../../src/product-compiler/schemas/path-token-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const CONTRACT_HASH_GOLDEN_V2 =
  "7721d9bd64f6d989d9ec84a5ed9ff457a53cae09ed9c56a927431729ce8efca6";
const CLI_TOKEN_SET_HASH_GOLDEN_V2 =
  "adf99e6f3520e303f16d7076c9ed948ea8c5f4ffa6530e36b3fbe1c52cb58758";
const API_TOKEN_SET_HASH_GOLDEN_V2 =
  "ff6439cd6c6889aac82f6ce5786b8ca1cb7cd798bdb32a1c2a62884f9b55c1e6";
const ROOT_MEMBERSHIP_HASH_GOLDEN_V2 =
  "4dce3320599b0ceb5ef7eecbb4029e0c642f8161f530fe5eed399797f830fab1";
const CLI_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2 =
  "081a13276f8eb78d160e67d7eed08ad3da04f8ca3d3db38a69dd3f10c2cdc803";
const API_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2 =
  "5928e8a5aed6f23471d6f01524dc45b8f0badf6ed19e68e95a549df028649492";
const CLI_CONSUMER_MEMBERSHIP_HASH_GOLDEN_V2 =
  "a89328558c85678f8219b20ff032cec23838a0eb3a582d075e4fef9a956e4340";
const API_CONSUMER_MEMBERSHIP_HASH_GOLDEN_V2 =
  "d2eaf249a5607fcd4d0ed44ef0fba86c540aea87ba9d933c6ab3e1e5a94ca744";

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
  const result = compileNodeExecutionPathTokenSetV2({
    productSpec,
    deliverySelection,
  });
  assert.equal(result.status, "shadow_compiled");
  if (result.status !== "shadow_compiled") throw new Error("Expected compilation");
  return { productSpec, deliverySelection, tokenSet: result.value };
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertRecursivelyFrozen(child);
}

function rehashTokenSet(candidate: any): void {
  for (const root of candidate.roots) {
    root.prefixByteLength = Buffer.byteLength(root.normalizedPrefix, "utf8");
    root.segmentCount = root.normalizedPrefix === ""
      ? 0
      : root.normalizedPrefix.split("/").length;
    root.pathIdentityHash = hashPortablePathIdentityV2(
      root.physicalSpace,
      root.normalizedPrefix,
    );
    root.caseFoldPathIdentityHash = hashPortablePathCaseFoldIdentityV2(
      root.physicalSpace,
      root.normalizedPrefix,
    );
    const { bindingHash: _bindingHash, ...identity } = root;
    root.bindingHash = hashPathRootBindingV2(identity);
  }
  for (const token of candidate.tokens) {
    token.pathToken = hashPathTokenOriginV2(token.origin);
    token.locatorByteLength = Buffer.byteLength(token.normalizedLocator, "utf8");
    token.segmentCount = token.normalizedLocator.split("/").length;
    token.pathIdentityHash = hashPortablePathIdentityV2(
      token.physicalSpace,
      token.normalizedLocator,
    );
    token.caseFoldPathIdentityHash = hashPortablePathCaseFoldIdentityV2(
      token.physicalSpace,
      token.normalizedLocator,
    );
    const { bindingHash: _bindingHash, ...identity } = token;
    token.bindingHash = hashPathTokenBindingV2(identity);
  }
  const roots = new Map(candidate.roots.map((root: any) => [root.rootRef, root]));
  const tokens = new Map(
    candidate.tokens.map((token: any) => [token.origin.slotRef, token]),
  );
  for (const consumer of candidate.consumerBindings) {
    if (consumer.target.kind === "root") {
      const root: any = roots.get(consumer.target.rootRef);
      if (root) consumer.target.rootBindingHash = root.bindingHash;
    } else {
      const token: any = tokens.get(consumer.target.slotRef);
      if (token) {
        consumer.target.pathToken = token.pathToken;
        consumer.target.tokenBindingHash = token.bindingHash;
      }
    }
    const { bindingHash: _bindingHash, ...identity } = consumer;
    consumer.bindingHash = hashPathConsumerBindingV2(identity);
  }
  candidate.rootCount = candidate.roots.length;
  candidate.tokenCount = candidate.tokens.length;
  candidate.consumerBindingCount = candidate.consumerBindings.length;
  candidate.rootMembershipHash = hashPathRootMembershipV2(candidate.roots);
  candidate.tokenMembershipHash = hashPathTokenMembershipV2(candidate.tokens);
  candidate.consumerMembershipHash = hashPathConsumerMembershipV2(
    candidate.consumerBindings,
  );
  candidate.tokenSetHash = hashNodeExecutionPathTokenSetV2(candidate);
}

function assertClosureError(
  action: () => unknown,
  code: PathClosureVerificationErrorV2["code"],
): void {
  assert.throws(action, (error: unknown) =>
    error instanceof PathClosureVerificationErrorV2 && error.code === code);
}

function assertVerificationError(
  action: () => unknown,
  code: PathTokenVerificationErrorV2["code"],
): void {
  assert.throws(action, (error: unknown) =>
    error instanceof PathTokenVerificationErrorV2 && error.code === code);
}

describe("PathTokenV2 portable lexical contract", () => {
  it("pins one recursively immutable, domain-hashed lexical contract", () => {
    assert.equal(PATH_TOKEN_CONTRACT_HASH_V2, CONTRACT_HASH_GOLDEN_V2);
    assert.equal(getCodeOwnedPathTokenContractV2(), PATH_TOKEN_CONTRACT_V2);
    assert.equal(PATH_TOKEN_CONTRACT_V2.contractVersion, "2.0.0");
    assert.equal(PATH_TOKEN_CONTRACT_V2.originKind, "node_execution_path_slot");
    assert.deepEqual(PATH_TOKEN_CONTRACT_V2.originFields, [
      "pathTokenContractVersion",
      "pathTokenContractHash",
      "slotSetHash",
      "slotRef",
    ]);
    assert.equal(PATH_TOKEN_CONTRACT_V2.locatorSemantics,
      "full_logical_locator_relative_to_physical_space");
    assert.equal(PATH_TOKEN_CONTRACT_V2.rootSemantics,
      "segment_boundary_containment_not_join_base");
    assert.equal(PATH_TOKEN_CONTRACT_V2.segmentAlphabet,
      "[A-Za-z0-9._@+-]+");
    assert.equal(PATH_TOKEN_CONTRACT_V2.percentEncoding,
      "forbidden_never_decoded");
    assert.equal(PATH_TOKEN_CONTRACT_V2.filesystemRealization,
      "not_authorized_by_path_token");
    assertRecursivelyFrozen(PATH_TOKEN_CONTRACT_V2);
  });

  it("accepts exact portable relative paths without normalization", () => {
    const accepted = [
      "package.json",
      "src/app.ts",
      "candidate-bundle/application/app.js",
      ".env",
      "a..b/file.ts",
      "@scope/pkg+core/file-name_1.0.ts",
      "COM0",
      "COM10",
      "LPT0",
      "CONSOLE",
      "NULLED",
    ];
    for (const locator of accepted) {
      assert.deepEqual(portablePathIssuesV2(locator, { allowEmpty: false }), []);
    }
    assert.equal(asciiCaseFoldPathV2("SRC/Foo.TS"), "src/foo.ts");
  });

  it("rejects absolute, traversal, encoding, device, Unicode, and ambiguous paths", () => {
    const rejected = [
      "",
      "/etc/passwd",
      "//server/share",
      "C:/x",
      "C:\\x",
      "C:x",
      "\\\\server\\share",
      "\\\\?\\C:\\x",
      "src\\app.ts",
      "src//app.ts",
      "src/app.ts/",
      ".",
      "..",
      "a/./b",
      "a/../b",
      "foo.",
      "dir./x",
      "...",
      "foo ",
      "dir /x",
      "a:b",
      "file.txt:stream",
      "CON",
      "con.txt",
      "NUL.tar.gz",
      "dir/COM1.json",
      "lpt9.log",
      "COM¹",
      "café.ts",
      "café.ts",
      "／etc",
      "．．/x",
      "a\u200Db",
      "a\0b",
      "a\tb",
      "a\nb",
      "%2e%2e/x",
      "a%2fb",
      "%5c",
      "name with space.ts",
      "name(paren).ts",
    ];
    for (const locator of rejected) {
      assert.notDeepEqual(
        portablePathIssuesV2(locator, { allowEmpty: false }),
        [],
        locator,
      );
    }
    assert.deepEqual(portablePathIssuesV2("", { allowEmpty: true }), []);
  });

  it("enforces exact byte, segment-byte, and segment-count boundaries", () => {
    assert.deepEqual(portablePathIssuesV2("a".repeat(255), { allowEmpty: false }), []);
    assert.notDeepEqual(portablePathIssuesV2("a".repeat(256), { allowEmpty: false }), []);
    assert.deepEqual(
      portablePathIssuesV2(Array.from({ length: 64 }, () => "a").join("/"), {
        allowEmpty: false,
      }),
      [],
    );
    assert.notDeepEqual(
      portablePathIssuesV2(Array.from({ length: 65 }, () => "a").join("/"), {
        allowEmpty: false,
      }),
      [],
    );
    const exact1024 = [255, 255, 255, 254, 1]
      .map((length) => "a".repeat(length)).join("/");
    const tooLarge = [255, 255, 255, 255, 1]
      .map((length) => "a".repeat(length)).join("/");
    assert.equal(Buffer.byteLength(exact1024), 1_024);
    assert.equal(Buffer.byteLength(tooLarge), 1_025);
    assert.deepEqual(portablePathIssuesV2(exact1024, { allowEmpty: false }), []);
    assert.notDeepEqual(portablePathIssuesV2(tooLarge, { allowEmpty: false }), []);
  });

  it("uses strict segment-boundary containment and never joins the root twice", () => {
    assert.equal(isPathContainedByRootV2("src/app.ts", "src", false), true);
    assert.equal(isPathContainedByRootV2("src2/app.ts", "src", false), false);
    assert.equal(isPathContainedByRootV2("src", "src", false), false);
    assert.equal(isPathContainedByRootV2("src", "src", true), true);
    assert.equal(isPathContainedByRootV2("src/app.ts", "", false), true);
  });
});

describe("Node execution PathTokenV2 compiler and authority", () => {
  it("derives exact CLI/API roots, tokens, consumers, and version goldens", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    assert.equal(cli.schema, NODE_EXECUTION_PATH_TOKEN_SET_V2_SCHEMA);
    assert.equal(cli.tokenSetVersion, "2.1.0");
    assert.equal(api.tokenSetVersion, "2.1.0");
    assert.equal(cli.sourceAuthority.slotContractVersion, "2.1.0");
    assert.equal(api.sourceAuthority.slotContractVersion, "2.1.0");
    assert.equal(cli.readiness.status, "shadow");
    assert.equal(cli.readiness.productionUse, "forbidden");
    assert.deepEqual(cli.readiness.blockerCodes, PATH_TOKEN_SET_BLOCKER_CODES_V2);
    assert.deepEqual({ roots: cli.rootCount, tokens: cli.tokenCount, consumers: cli.consumerBindingCount },
      { roots: 4, tokens: 7, consumers: 22 });
    assert.deepEqual({ roots: api.rootCount, tokens: api.tokenCount, consumers: api.consumerBindingCount },
      { roots: 4, tokens: 8, consumers: 24 });
    assert.deepEqual(
      cli.tokens.map((token) => ({
        locator: token.normalizedLocator,
        disposition: token.disposition,
      })),
      [
        { locator: "dist/cli.js", disposition: "planned" },
        { locator: "candidate-bundle/application/cli.js", disposition: "planned" },
        { locator: "src/index.ts", disposition: "reject_only" },
        { locator: "src/cli.ts", disposition: "planned" },
        { locator: "package.json", disposition: "planned" },
        { locator: "package-lock.json", disposition: "planned" },
        { locator: "tsconfig.json", disposition: "planned" },
      ],
    );
    assert.deepEqual(
      api.tokens.filter((token) => token.disposition === "reject_only")
        .map((token) => token.normalizedLocator),
      ["server.ts", "src/server.ts"],
    );
    assert.equal(cli.rootMembershipHash, ROOT_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(api.rootMembershipHash, ROOT_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(cli.tokenMembershipHash, CLI_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(api.tokenMembershipHash, API_TOKEN_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(cli.consumerMembershipHash, CLI_CONSUMER_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(api.consumerMembershipHash, API_CONSUMER_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(cli.tokenSetHash, CLI_TOKEN_SET_HASH_GOLDEN_V2);
    assert.equal(api.tokenSetHash, API_TOKEN_SET_HASH_GOLDEN_V2);
    assert.equal(cli.tokenSetHash, hashNodeExecutionPathTokenSetV2(cli));
    assert.equal(api.tokenSetHash, hashNodeExecutionPathTokenSetV2(api));
    const staleSetVersion = structuredClone(cli) as any;
    staleSetVersion.tokenSetVersion = "2.0.0";
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(staleSetVersion).success, false);
    const staleSlotVersion = structuredClone(cli) as any;
    staleSlotVersion.sourceAuthority.slotContractVersion = "2.0.0";
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(staleSlotVersion).success, false);
    assertRecursivelyFrozen(cli);
    assertRecursivelyFrozen(api);
  });

  it("binds token identity only to contract version/hash, slot-set hash, and slotRef", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    for (const token of cli.tokens) {
      assert.deepEqual(Object.keys(token.origin), [
        "pathTokenContractVersion",
        "pathTokenContractHash",
        "slotSetHash",
        "slotRef",
      ]);
      assert.equal(token.pathToken, hashPathTokenOriginV2(token.origin));
      assert.equal("layoutHash" in token.origin, false);
      assert.equal("productSpecHash" in token.origin, false);
      assert.equal("deliverySelectionHash" in token.origin, false);
    }
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    const cliPackage = cli.tokens.find((token) =>
      token.origin.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2")!;
    const apiPackage = api.tokens.find((token) =>
      token.origin.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2")!;
    assert.equal(cliPackage.normalizedLocator, apiPackage.normalizedLocator);
    assert.notEqual(cliPackage.origin.slotSetHash, apiPackage.origin.slotSetHash);
    assert.notEqual(cliPackage.pathToken, apiPackage.pathToken);
  });

  it("publishes every-and-only typed consumer bindings including historical rejection", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    const api = compiled(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    ).tokenSet;
    for (const set of [cli, api]) {
      assert.equal(
        set.consumerBindings.every((consumer, index) =>
          index === 0
          || set.consumerBindings[index - 1]!.consumerRef < consumer.consumerRef),
        true,
      );
      assert.equal(
        set.consumerBindings.every((consumer) =>
          consumer.bindingHash === hashPathConsumerBindingV2((() => {
            const { bindingHash: _bindingHash, ...identity } = consumer;
            return identity;
          })())),
        true,
      );
      const historical = set.consumerBindings.filter((consumer) =>
        consumer.consumerRole === "historical_entrypoint_rejection");
      assert.equal(historical.length, set === cli ? 1 : 2);
      assert.equal(historical.every((consumer) =>
        consumer.target.kind === "slot"
        && consumer.target.requiredDisposition === "reject_only"), true);
      assert.equal(set.consumerBindings.some((consumer) =>
        consumer.consumerRef.startsWith("/legacyInstallerObservation")), false);
      const dependencyLock = set.consumerBindings.find((consumer) =>
        consumer.consumerRef
          === "/dependencyContract/packageLockJsonPathSlotRef");
      assert.ok(dependencyLock);
      assert.equal(dependencyLock.consumerRole, "dependency_lock_manifest");
      assert.equal(dependencyLock.target.kind, "slot");
      if (dependencyLock.target.kind !== "slot") {
        throw new Error("Expected dependency-lock slot consumer binding");
      }
      assert.equal(
        dependencyLock.target.slotRef,
        "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
      );
      assert.equal(dependencyLock.target.requiredNamespace, "repository_config");
      assert.equal(dependencyLock.target.requiredDisposition, "planned");
    }
    assert.equal(api.consumerBindings.some((consumer) =>
      consumer.consumerRef === "/runtimeTarget/modulePathSlotRef"
      && consumer.target.kind === "slot"
      && consumer.target.requiredDisposition === "planned"), true);
    const apiRepositoryRoot = api.roots.find((root) =>
      root.rootRef === "PATH_ROOT_NODE_REPOSITORY_V2");
    const apiSourceRoot = api.roots.find((root) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2");
    const apiHistoricalAtRepository = api.consumerBindings.find((consumer) =>
      consumer.consumerRef
        === "/pathSlots/historicalRejectedEntrypoints/0/underRootRef");
    const apiHistoricalAtSource = api.consumerBindings.find((consumer) =>
      consumer.consumerRef
        === "/pathSlots/historicalRejectedEntrypoints/1/underRootRef");
    assert.equal(apiHistoricalAtRepository?.target.kind, "root");
    assert.equal(apiHistoricalAtSource?.target.kind, "root");
    if (
      apiHistoricalAtRepository?.target.kind !== "root"
      || apiHistoricalAtSource?.target.kind !== "root"
    ) throw new Error("Expected historical root consumer bindings");
    assert.equal(apiHistoricalAtRepository.target.rootRef, apiRepositoryRoot?.rootRef);
    assert.equal(apiHistoricalAtRepository.target.requiredPhysicalSpace, "repository");
    assert.equal(apiHistoricalAtSource.target.rootRef, apiSourceRoot?.rootRef);
    assert.equal(apiHistoricalAtSource.target.requiredPhysicalSpace, "repository");
  });

  it("freshly verifies genuine CLI/API sets and rejects cross-profile authority", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const api = compiled(genuineNodeExpressApiProductSpecV2(), "node-express-api");
    const verifiedCli = verifyNodeExecutionPathTokenSetV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      candidate: cli.tokenSet,
    });
    assert.equal(verifiedCli.status, "verified_shadow");
    assert.equal(verifiedCli.value.tokenSetHash, CLI_TOKEN_SET_HASH_GOLDEN_V2);
    assertVerificationError(
      () => verifyNodeExecutionPathTokenSetV2({
        productSpec: api.productSpec,
        deliverySelection: api.deliverySelection,
        candidate: cli.tokenSet,
      }),
      "PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects caller-supplied path authority and stale/cross ProductSpec selection", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    assert.equal(compileNodeExecutionPathTokenSetV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      locator: "src/injected.ts",
    }).status, "rejected");
    assert.equal(compileNodeExecutionPathTokenSetV2({
      productSpec: genuineNodeExpressApiProductSpecV2(),
      deliverySelection: cli.deliverySelection,
    }).status, "rejected");
  });

  it("rejects schema-valid, self-rehashed changed and incomplete sets", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const changed = structuredClone(cli.tokenSet) as any;
    const source = changed.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2");
    source.normalizedLocator = "src/command.ts";
    rehashTokenSet(changed);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(changed).success, true);
    assertVerificationError(
      () => verifyNodeExecutionPathTokenSetV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: changed,
      }),
      "PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const incomplete = structuredClone(cli.tokenSet) as any;
    incomplete.tokens = incomplete.tokens.filter((token: any) =>
      token.origin.slotRef !== "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2");
    incomplete.consumerBindings = incomplete.consumerBindings.filter((consumer: any) =>
      consumer.consumerRef
        !== "/pathSlots/historicalRejectedEntrypoints/0/underRootRef"
      && !(
        consumer.target.kind === "slot"
        && consumer.target.slotRef === "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2"
      ));
    rehashTokenSet(incomplete);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(incomplete).success, true);
    assertVerificationError(
      () => verifyNodeExecutionPathTokenSetV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: incomplete,
      }),
      "PATH_TOKEN_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects reordered, detached-hash, role, and invented active forgeries locally", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    for (const field of ["roots", "tokens", "consumerBindings"] as const) {
      const candidate = structuredClone(cli) as any;
      candidate[field].reverse();
      rehashTokenSet(candidate);
      assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(candidate).success, false);
    }
    const detached = structuredClone(cli) as any;
    detached.consumerMembershipHash = "0".repeat(64);
    detached.tokenSetHash = hashNodeExecutionPathTokenSetV2(detached);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(detached).success, false);

    const role = structuredClone(cli) as any;
    role.consumerBindings.find((consumer: any) =>
      consumer.target.kind === "root").consumerRole = "compiler_package_manifest";
    rehashTokenSet(role);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(role).success, false);

    const active = structuredClone(cli) as any;
    active.readiness.status = "active";
    rehashTokenSet(active);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(active).success, false);
  });

  it("verifies the fresh layout closure and excludes legacy prose observations", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    const layout = resolveNodeExecutionLayoutV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
    });
    assert.equal(layout.status, "shadow_resolved");
    if (layout.status !== "shadow_resolved") throw new Error("Expected layout");
    assert.deepEqual(validateNodeExecutionPathClosureCandidateV2(layout.layout), {
      status: "locally_validated_shadow_closure",
      authority: "none",
      productionUse: "forbidden",
      slotSetHash: cli.tokenSet.sourceAuthority.slotSetHash,
      rootCount: 4,
      slotCount: 7,
      plannedSlotCount: 6,
      rejectOnlySlotCount: 1,
      consumerCount: 22,
    });
    const serialized = JSON.stringify(cli.tokenSet);
    assert.equal(serialized.includes("legacyInstallerObservation"), false);
    assert.equal(serialized.includes("compatibility_unmigrated"), false);
  });
});

describe("PathTokenV2 root, slot, collision, and consumer artifact closure", () => {
  const base = () => structuredClone(
    compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet,
  ) as any;
  const locallyValid = (candidate: any): boolean => {
    rehashTokenSet(candidate);
    return NodeExecutionPathTokenSetV2Schema.safeParse(candidate).success;
  };

  it("accepts the same locator in a different physical space", () => {
    const separateSpace = base();
    separateSpace.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2")
      .normalizedLocator = "Foo/a.json";
    separateSpace.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2")
      .normalizedLocator = "foo/b.json";
    assert.equal(locallyValid(separateSpace), true);
  });

  it("rejects missing, cyclic, cross-space, colliding, and non-deepest roots", () => {
    const missing = base();
    missing.roots.find((root: any) => root.rootRef === "PATH_ROOT_NODE_SOURCE_V2")
      .parentRootRef = "PATH_ROOT_MISSING_V2";
    assert.equal(locallyValid(missing), false);

    const cycle = base();
    const source = cycle.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2");
    const output = cycle.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_BUILD_OUTPUT_V2");
    source.parentRootRef = output.rootRef;
    output.parentRootRef = source.rootRef;
    assert.equal(locallyValid(cycle), false);

    const crossSpace = base();
    crossSpace.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2").parentRootRef =
        "PATH_ROOT_CANDIDATE_RUNTIME_V2";
    assert.equal(locallyValid(crossSpace), false);

    const caseCollision = base();
    caseCollision.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2").normalizedPrefix = "DIST";
    assert.equal(locallyValid(caseCollision), false);

    const caseOnlyAncestry = base();
    caseOnlyAncestry.roots.push({
      schema: PATH_ROOT_BINDING_V2_SCHEMA,
      rootRef: "PATH_ROOT_NODE_CASE_ONLY_CHILD_V2",
      physicalSpace: "repository",
      parentRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
      normalizedPrefix: "SRC/deep",
      prefixByteLength: 0,
      segmentCount: 0,
      pathIdentityHash: "0".repeat(64),
      caseFoldPathIdentityHash: "0".repeat(64),
      bindingHash: "0".repeat(64),
    });
    caseOnlyAncestry.roots.sort((left: any, right: any) =>
      left.rootRef < right.rootRef ? -1 : 1);
    assert.equal(locallyValid(caseOnlyAncestry), false);

    const nonDeepest = base();
    nonDeepest.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2").normalizedPrefix = "src/deep";
    nonDeepest.roots.push({
      schema: PATH_ROOT_BINDING_V2_SCHEMA,
      rootRef: "PATH_ROOT_NODE_SOURCE_PARENT_V2",
      physicalSpace: "repository",
      parentRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
      normalizedPrefix: "src",
      prefixByteLength: 0,
      segmentCount: 0,
      pathIdentityHash: "0".repeat(64),
      caseFoldPathIdentityHash: "0".repeat(64),
      bindingHash: "0".repeat(64),
    });
    nonDeepest.roots.sort((left: any, right: any) =>
      left.rootRef < right.rootRef ? -1 : 1);
    assert.equal(locallyValid(nonDeepest), false);
  });

  it("rejects boundary escapes, missing roots, exact/case collisions, and file ancestors", () => {
    const boundary = base();
    boundary.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2")
      .normalizedLocator = "src2/cli.ts";
    assert.equal(locallyValid(boundary), false);

    const missing = base();
    missing.tokens[0].underRootRef = "PATH_ROOT_MISSING_V2";
    assert.equal(locallyValid(missing), false);

    const exact = base();
    const source = exact.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2");
    source.normalizedLocator = "package.json";
    source.underRootRef = "PATH_ROOT_NODE_REPOSITORY_V2";
    assert.equal(locallyValid(exact), false);

    const folded = base();
    const foldedSource = folded.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2");
    foldedSource.normalizedLocator = "PACKAGE.JSON";
    foldedSource.underRootRef = "PATH_ROOT_NODE_REPOSITORY_V2";
    assert.equal(locallyValid(folded), false);

    const ancestor = base();
    ancestor.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2")
      .normalizedLocator = "src";
    assert.equal(locallyValid(ancestor), false);

    const caseOnlyRootAncestry = base();
    caseOnlyRootAncestry.roots.find((root: any) =>
      root.rootRef === "PATH_ROOT_NODE_SOURCE_V2").normalizedPrefix = "SRC";
    const caseSource = caseOnlyRootAncestry.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2");
    caseSource.underRootRef = "PATH_ROOT_NODE_REPOSITORY_V2";
    assert.equal(locallyValid(caseOnlyRootAncestry), false);

    const directoryCaseCollision = base();
    directoryCaseCollision.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2")
      .normalizedLocator = "Foo/a.json";
    directoryCaseCollision.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_TSCONFIG_JSON_V2")
      .normalizedLocator = "foo/b.json";
    assert.equal(locallyValid(directoryCaseCollision), false);
  });

  it("rejects role/disposition mismatch, missing targets, and orphan tokens", () => {
    const disposition = base();
    disposition.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2")
      .disposition = "reject_only";
    assert.equal(locallyValid(disposition), false);

    const missing = base();
    const firstSlotConsumer = missing.consumerBindings.find((consumer: any) =>
      consumer.target.kind === "slot");
    firstSlotConsumer.target.slotRef = "PATH_SLOT_MISSING_V2";
    assert.equal(locallyValid(missing), false);

    const forgedRole = base();
    const canonical = forgedRole.consumerBindings.find((consumer: any) =>
      consumer.consumerRole === "canonical_entrypoint");
    const historical = forgedRole.tokens.find((token: any) =>
      token.disposition === "reject_only");
    canonical.target.slotRef = historical.origin.slotRef;
    canonical.target.requiredNamespace = historical.namespace;
    canonical.target.requiredDisposition = "reject_only";
    assert.equal(locallyValid(forgedRole), false);

    const rootRoleSwap = base();
    const sourceRootConsumer = rootRoleSwap.consumerBindings.find(
      (consumer: any) => consumer.consumerRole === "compiler_source_root",
    );
    sourceRootConsumer.target.rootRef = "PATH_ROOT_NODE_BUILD_OUTPUT_V2";
    assert.equal(locallyValid(rootRoleSwap), false);

    const namespaceSpaceSwap = base();
    const sourceToken = namespaceSpaceSwap.tokens.find((token: any) =>
      token.origin.slotRef === "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2");
    sourceToken.namespace = "candidate_application";
    for (const consumer of namespaceSpaceSwap.consumerBindings) {
      if (
        consumer.target.kind === "slot"
        && consumer.target.slotRef === sourceToken.origin.slotRef
      ) consumer.target.requiredNamespace = "candidate_application";
    }
    assert.equal(locallyValid(namespaceSpaceSwap), false);

    const orphan = base();
    orphan.consumerBindings = orphan.consumerBindings.filter((consumer: any) => !(
      consumer.target.kind === "slot"
      && consumer.target.slotRef === "PATH_SLOT_NODE_PACKAGE_JSON_V2"
    ));
    assert.equal(locallyValid(orphan), false);
  });
});

describe("PathTokenV2 bounded hostile inputs", () => {
  it("rejects proxy, cycle, accessor, and oversized inputs without invoking getters", () => {
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
    assert.equal(compileNodeExecutionPathTokenSetV2(proxy).status, "rejected");
    assert.equal(trapCount, 0);
    assertClosureError(
      () => validateNodeExecutionPathClosureCandidateV2(proxy),
      "PATH_TOKEN_V2_CLOSURE_INPUT_INVALID",
    );
    assert.equal(trapCount, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileNodeExecutionPathTokenSetV2(cycle).status, "rejected");

    let accessorCalls = 0;
    const accessor: any = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return genuineNodeCliProductSpecV2();
      },
    });
    assert.equal(compileNodeExecutionPathTokenSetV2(accessor).status, "rejected");
    assert.equal(accessorCalls, 0);

    assert.equal(compileNodeExecutionPathTokenSetV2({
      padding: "x".repeat(8 * 1024 * 1024),
    }).status, "rejected");
    const oversized = NodeExecutionPathTokenSetV2Schema.safeParse({
      padding: "x".repeat(PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2),
    });
    assert.equal(oversized.success, false);
    if (!oversized.success) assert.match(oversized.error.issues[0]!.message, /bounded work/u);

    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli");
    assertVerificationError(
      () => verifyNodeExecutionPathTokenSetV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: proxy,
      }),
      "PATH_TOKEN_V2_VERIFICATION_INPUT_INVALID",
    );
    assert.equal(trapCount, 0);
  });

  it("keeps strict artifact component schemas domain-separated", () => {
    const cli = compiled(genuineNodeCliProductSpecV2(), "node-cli").tokenSet;
    assert.equal(cli.roots.every((root) => root.schema === PATH_ROOT_BINDING_V2_SCHEMA), true);
    assert.equal(cli.tokens.every((token) => token.schema === PATH_TOKEN_V2_SCHEMA), true);
    assert.equal(cli.consumerBindings.every((consumer) =>
      consumer.schema === PATH_CONSUMER_BINDING_V2_SCHEMA), true);
    const crossDomain = structuredClone(cli) as any;
    crossDomain.tokens[0].bindingHash = crossDomain.roots[0].bindingHash;
    crossDomain.tokenSetHash = hashNodeExecutionPathTokenSetV2(crossDomain);
    assert.equal(NodeExecutionPathTokenSetV2Schema.safeParse(crossDomain).success, false);
  });
});
