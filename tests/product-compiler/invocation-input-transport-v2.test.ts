import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InvocationInputTransportVerificationErrorV2,
  InvocationRequestEncodingErrorV2,
  InvocationResponseDecodingErrorV2,
  compileInvocationInputTransportV2,
  decodeInvocationResponseV2,
  encodeInvocationRequestV2,
  hashInvocationTransportActionInvocationIntentV2,
  verifyInvocationInputTransportV2,
} from "../../src/product-compiler/invocation-input-transport-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  InvocationInputTransportV2Schema,
  InvocationTransportCodecCatalogV2Schema,
  getInvocationTransportCodecCatalogV2,
  hashInvocationInputTransportV2,
  hashInvocationTransportCodecCatalogV2,
  invocationTransportCodecCatalogHashV2,
  type InvocationInputTransportV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";

const CODEC_CATALOG_HASH_GOLDEN_V2 =
  "e562c1ea0b5d90330f2e0d8fe6455b6f427dfed4646e1d78f447a2a46a9658ed";
const GENUINE_CLI_INTENT_HASH_GOLDEN_V2 =
  "112ea06f483d79413ab207949355bf3ebd692895cfe563791f9c9158bebc226b";
const GENUINE_CLI_CONTRACT_HASH_GOLDEN_V2 =
  "b0e62c5d848b7af5438485245399264aef4c2086c1549e64501c4782c6e7d1d8";
const GENUINE_API_INTENT_HASH_GOLDEN_V2 =
  "837c12e5260123a6e11b259ae01590f25944f98fceeaf8b159ae91f1fcb4a14a";
const GENUINE_API_CONTRACT_HASH_GOLDEN_V2 =
  "1f6aa49bef28e39be6e8bf137fe085177b3019e1fb03e890d7571500808f39aa";

function deliverySelection(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
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
  if (result.status !== "shadow_selected") throw new Error("Expected shadow selection");
  return result.selection;
}

function compiled(
  productSpec: ProductSpecV2,
  selection: ProductDeliverySelectionV2,
  actionRef: string,
): InvocationInputTransportV2 {
  const result = compileInvocationInputTransportV2({
    productSpec,
    deliverySelection: selection,
    actionRef,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected compiled transport");
  return result.contract;
}

function cliAuthority() {
  const productSpec = genuineNodeCliProductSpecV2();
  const selection = deliverySelection(productSpec, "node-cli");
  const contract = compiled(productSpec, selection, "ACT_ADD_TASK");
  assert.equal(contract.kind, "cli_command");
  if (contract.kind !== "cli_command") throw new Error("Expected CLI transport");
  return { productSpec, selection, contract };
}

function apiAuthority() {
  const productSpec = genuineNodeExpressApiProductSpecV2();
  const selection = deliverySelection(productSpec, "node-express-api");
  const contract = compiled(productSpec, selection, "ACT_CREATE_TASK");
  assert.equal(contract.kind, "http_request");
  if (contract.kind !== "http_request") throw new Error("Expected HTTP transport");
  return { productSpec, selection, contract };
}

function rehashed<T extends InvocationInputTransportV2>(value: T): T {
  const candidate = structuredClone(value);
  candidate.contractHash = hashInvocationInputTransportV2(candidate);
  return InvocationInputTransportV2Schema.parse(candidate) as T;
}

function assertEncodingError(
  operation: () => unknown,
  code: InvocationRequestEncodingErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof InvocationRequestEncodingErrorV2 && error.code === code,
  );
}

function assertDecodingError(
  operation: () => unknown,
  code: InvocationResponseDecodingErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof InvocationResponseDecodingErrorV2 && error.code === code,
  );
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function allKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((child) => allKeys(child, output));
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    output.add(key);
    allKeys(child, output);
  }
  return output;
}

describe("InvocationInputTransportV2 code-owned schema", () => {
  it("exposes one deterministic, recursively frozen codec catalog", () => {
    const first = getInvocationTransportCodecCatalogV2();
    const second = getInvocationTransportCodecCatalogV2();
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.equal(first.valueCodecs.length, 6);
    assert.equal(first.channelCodecs.length, 6);
    assert.equal(first.responseDecoders.length, 4);
    assert.equal(first.catalogHash, CODEC_CATALOG_HASH_GOLDEN_V2);
    assert.equal(first.catalogHash, invocationTransportCodecCatalogHashV2());
    assert.equal(first.catalogHash, hashInvocationTransportCodecCatalogV2(first));
    assertDeepFrozen(first);

    const forged = structuredClone(first);
    forged.channelCodecs[0]!.representation = "canonical_json_utf8";
    forged.catalogHash = hashInvocationTransportCodecCatalogV2(forged);
    assert.equal(InvocationTransportCodecCatalogV2Schema.safeParse(forged).success, false);
    assert.notDeepEqual(forged, first);
  });

  it("compiles the genuine CLI fixture as an action-level shadow contract", () => {
    const { productSpec, selection, contract } = cliAuthority();
    const action = productSpec.actions.find((candidate) => candidate.id === contract.actionRef)!;
    assert.equal(contract.schema, "setfarm.invocation-input-transport.v2");
    assert.equal(contract.contractVersion, 2);
    assert.equal(contract.readiness, "shadow");
    assert.equal(contract.productionUse, "forbidden");
    assert.equal(contract.productSpecHash, selection.productSpecHash);
    assert.equal(
      contract.actionInvocationIntentHash,
      hashInvocationTransportActionInvocationIntentV2(action.invocationInterface),
    );
    assert.equal(contract.actionInvocationIntentHash, GENUINE_CLI_INTENT_HASH_GOLDEN_V2);
    assert.equal(contract.profileBinding.profileId, "PROFILE_NODE_CLI_STATELESS_EXACT_V2");
    assert.equal(contract.stackPackBinding.stackPackId, "node-cli");
    assert.equal(contract.runtimeBinding.invocationKind, "cli_process");
    assert.equal(contract.runtimeBinding.launcherRef, "LAUNCH_NODE_CLI_V2");
    assert.equal(contract.codecCatalogBinding.catalogHash, invocationTransportCodecCatalogHashV2());
    assert.deepEqual(contract.evidenceCapabilityPolicyBinding, selection.evidenceCapabilities);
    assert.deepEqual(contract.semanticSourceRuleBinding, selection.semanticSourceRules);
    assert.deepEqual(contract.subcommandTokens, ["add"]);
    assert.deepEqual(contract.fields.map((field) => field.fieldName), ["title"]);
    assert.deepEqual(contract.fields[0]!.channel, {
      kind: "argv_flag",
      flag: "--title",
      style: "separate",
    });
    assert.equal(contract.result.responseByteLimit, 1_048_576);
    assert.deepEqual({
      successDecoderRef: contract.result.successDecoderRef,
      failureDecoderRef: contract.result.failureDecoderRef,
      utf8Decoding: contract.result.utf8Decoding,
      jsonGrammar: contract.result.jsonGrammar,
      duplicateObjectKeys: contract.result.duplicateObjectKeys,
      numberPolicy: contract.result.numberPolicy,
      stringPolicy: contract.result.stringPolicy,
      maxDepth: contract.result.maxDepth,
      maxNodes: contract.result.maxNodes,
      maxContainerEntries: contract.result.maxContainerEntries,
    }, {
      successDecoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
      failureDecoderRef: "DECODE_CLI_STDERR_FAILURE_JSON_V2",
      utf8Decoding: "fatal_exact_roundtrip",
      jsonGrammar: "strict_single_value",
      duplicateObjectKeys: "reject_decoded_equivalent",
      numberPolicy: "finite_only",
      stringPolicy: "reject_nul_and_ill_formed_unicode",
      maxDepth: 64,
      maxNodes: 100_000,
      maxContainerEntries: 10_000,
    });
    assert.equal(contract.contractHash, hashInvocationInputTransportV2(contract));
    assert.equal(contract.contractHash, GENUINE_CLI_CONTRACT_HASH_GOLDEN_V2);
    assert.deepEqual(InvocationInputTransportV2Schema.parse(contract), contract);
    assertDeepFrozen(contract);
  });

  it("compiles the genuine API fixture with exact route/body/result authority", () => {
    const { selection, contract } = apiAuthority();
    assert.equal(contract.profileBinding.profileId, "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2");
    assert.equal(contract.stackPackBinding.stackPackId, "node-express-api");
    assert.equal(contract.runtimeBinding.invocationKind, "http_service");
    assert.equal(contract.runtimeBinding.launcherRef, "LAUNCH_NODE_EXPRESS_API_V2");
    assert.equal(contract.deliverySelectionHash.length, 64);
    assert.equal(contract.profileBinding.profileHash, selection.profileHash);
    assert.equal(contract.actionInvocationIntentHash, GENUINE_API_INTENT_HASH_GOLDEN_V2);
    assert.equal(contract.method, "POST");
    assert.equal(contract.routeRef, "ROUTE_TASKS");
    assert.equal(contract.routeTemplate, "/tasks/:project");
    assert.equal(contract.redirectPolicy, "error");
    assert.deepEqual(contract.fixedHeaders, [
      { name: "accept", value: "application/json" },
      { name: "content-type", value: "application/json" },
    ]);
    assert.deepEqual(
      contract.fields.map((field) => [field.fieldName, field.channel.kind]),
      [["project", "path_parameter"], ["title", "json_body_pointer"]],
    );
    assert.deepEqual(contract.result.successStatusCodes, [201]);
    assert.equal(contract.result.responseByteLimit, 1_048_576);
    assert.equal(contract.result.successDecoderRef, "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2");
    assert.equal(contract.result.failureDecoderRef, "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2");
    assert.equal(contract.contractHash, GENUINE_API_CONTRACT_HASH_GOLDEN_V2);
  });

  it("compiles two independent CLI commands and two API routes from fresh ProductSpec selections", () => {
    const cliContracts = [
      ["task", "create"],
      ["work", "enqueue"],
    ].map((subcommandTokens) => {
      const candidate = structuredClone(genuineNodeCliProductSpecV2());
      const invocation = candidate.actions[0]!.invocationInterface;
      assert.equal(invocation.kind, "cli_command");
      if (invocation.kind !== "cli_command") throw new Error("Expected CLI intent");
      invocation.subcommandTokens = subcommandTokens;
      const productSpec = ProductSpecV2Schema.parse(candidate);
      const selection = deliverySelection(productSpec, "node-cli");
      const contract = compiled(productSpec, selection, "ACT_ADD_TASK");
      assert.equal(contract.kind, "cli_command");
      if (contract.kind !== "cli_command") throw new Error("Expected CLI transport");
      assert.deepEqual(contract.subcommandTokens, subcommandTokens);
      return { contract, selection };
    });
    assert.equal(new Set(cliContracts.map(({ contract }) => contract.contractHash)).size, 2);
    assert.equal(new Set(cliContracts.map(({ selection }) => selection.productSpecHash)).size, 2);

    const apiContracts = [
      "/projects/:project/tasks",
      "/workspaces/:project/queue",
    ].map((routeTemplate) => {
      const candidate = structuredClone(genuineNodeExpressApiProductSpecV2());
      candidate.routes[0]!.path = routeTemplate;
      const productSpec = ProductSpecV2Schema.parse(candidate);
      const selection = deliverySelection(productSpec, "node-express-api");
      const contract = compiled(productSpec, selection, "ACT_CREATE_TASK");
      assert.equal(contract.kind, "http_request");
      if (contract.kind !== "http_request") throw new Error("Expected HTTP transport");
      assert.equal(contract.routeTemplate, routeTemplate);
      return { contract, selection };
    });
    assert.equal(new Set(apiContracts.map(({ contract }) => contract.contractHash)).size, 2);
    assert.equal(new Set(apiContracts.map(({ selection }) => selection.productSpecHash)).size, 2);
  });

  it("rejects any caller-authored execution field at the exact compiler boundary", () => {
    const { productSpec, selection } = cliAuthority();
    const result = compileInvocationInputTransportV2({
      productSpec,
      deliverySelection: selection,
      actionRef: "ACT_ADD_TASK",
      executable: "/usr/bin/node",
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(result.diagnostics[0]!.code, "INVOCATION_TRANSPORT_V2_INPUT_INVALID");
  });

  it("fresh-verifies exact authority and rejects a self-consistent forged invocation-intent hash", () => {
    const { productSpec, selection, contract } = cliAuthority();
    const verified = verifyInvocationInputTransportV2({
      productSpec,
      deliverySelection: selection,
      actionRef: "ACT_ADD_TASK",
      candidate: contract,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.contractHash, contract.contractHash);
    assertDeepFrozen(verified);

    const forged = structuredClone(contract);
    forged.actionInvocationIntentHash = "0".repeat(64);
    const schemaValidForgery = rehashed(forged);
    assert.throws(
      () => verifyInvocationInputTransportV2({
        productSpec,
        deliverySelection: selection,
        actionRef: "ACT_ADD_TASK",
        candidate: schemaValidForgery,
      }),
      (error: unknown) =>
        error instanceof InvocationInputTransportVerificationErrorV2
        && error.code === "INVOCATION_TRANSPORT_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects NUL and ill-formed Unicode pointers after a self-consistent rehash", () => {
    const { productSpec, selection, contract } = cliAuthority();
    for (const pointer of ["/task/\0hidden", "/task/\ud800", "/task/\udc00"]) {
      const candidate = structuredClone(contract);
      candidate.result.valuePointer = pointer;
      candidate.contractHash = hashInvocationInputTransportV2(candidate);
      assert.equal(InvocationInputTransportV2Schema.safeParse(candidate).success, false);
      assert.throws(
        () => verifyInvocationInputTransportV2({
          productSpec,
          deliverySelection: selection,
          actionRef: "ACT_ADD_TASK",
          candidate,
        }),
        (error: unknown) =>
          error instanceof InvocationInputTransportVerificationErrorV2
          && error.code === "INVOCATION_TRANSPORT_V2_VERIFICATION_CANDIDATE_INVALID",
      );

      const invalidProductSpec = structuredClone(productSpec);
      const invocation = invalidProductSpec.actions[0]!.invocationInterface;
      assert.equal(invocation.kind, "cli_command");
      if (invocation.kind !== "cli_command") throw new Error("Expected CLI intent");
      invocation.result.valuePointer = pointer;
      const invalidSelection = deliverySelection(invalidProductSpec, "node-cli");
      const compilation = compileInvocationInputTransportV2({
        productSpec: invalidProductSpec,
        deliverySelection: invalidSelection,
        actionRef: "ACT_ADD_TASK",
      });
      assert.equal(compilation.status, "rejected");
      if (compilation.status !== "rejected") throw new Error("Expected rejection");
      assert.equal(
        compilation.diagnostics[0]!.code,
        "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
      );
    }
  });

  it("fresh-rejects an invalid or non-authoritative delivery selection", () => {
    const { productSpec, selection } = cliAuthority();
    const extra = { ...structuredClone(selection), callerClaim: true };
    const invalid = compileInvocationInputTransportV2({
      productSpec,
      deliverySelection: extra,
      actionRef: "ACT_ADD_TASK",
    });
    assert.equal(invalid.status, "rejected");
    if (invalid.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(
      invalid.diagnostics[0]!.code,
      "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_INVALID",
    );

    const otherSpec = genuineNodeCliProductSpecV2();
    otherSpec.product.name = "Other exact product";
    const mismatch = compileInvocationInputTransportV2({
      productSpec: otherSpec,
      deliverySelection: selection,
      actionRef: "ACT_ADD_TASK",
    });
    assert.equal(mismatch.status, "rejected");
    if (mismatch.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(
      mismatch.diagnostics[0]!.code,
      "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH",
    );
  });

  it("returns the explicit profile-unsupported code for optional and temporal inputs", () => {
    const { productSpec, selection } = cliAuthority();
    for (const mutation of [
      { required: false },
      { valueType: "date" },
      { valueType: "datetime" },
    ]) {
      const candidate = structuredClone(productSpec) as ProductSpecV2;
      Object.assign(candidate.actions[0]!.input.fields[0]!, mutation);
      const result = compileInvocationInputTransportV2({
        productSpec: candidate,
        deliverySelection: selection,
        actionRef: "ACT_ADD_TASK",
      });
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") throw new Error("Expected rejection");
      assert.equal(
        result.diagnostics[0]!.code,
        "INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE",
      );
    }
  });

  it("rejects rendered-control invocation instead of laundering DOM transport", () => {
    const productSpec = buildContainedGameProductSpecV2();
    const result = compileInvocationInputTransportV2({
      productSpec,
      deliverySelection: cliAuthority().selection,
      actionRef: "ACT_START_GAME",
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(
      result.diagnostics[0]!.code,
      "INVOCATION_TRANSPORT_V2_INVOCATION_INTERFACE_UNSUPPORTED",
    );
  });

  it("rejects a forged header channel at ProductSpec authority", () => {
    const { productSpec, selection } = apiAuthority();
    const forged = structuredClone(productSpec) as unknown as {
      actions: Array<{ invocationInterface: { fieldBindings: Array<{ channel: unknown }> } }>;
    };
    forged.actions[0]!.invocationInterface.fieldBindings[1]!.channel = {
      kind: "header",
      name: "x-title",
    };
    const result = compileInvocationInputTransportV2({
      productSpec: forged,
      deliverySelection: selection,
      actionRef: "ACT_CREATE_TASK",
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(result.diagnostics[0]!.code, "INVOCATION_TRANSPORT_V2_PRODUCT_SPEC_INVALID");
  });

  it("does not invoke traps for hostile Proxy inputs", () => {
    let trapCount = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        throw new Error("trap must not execute");
      },
    });
    const compilation = compileInvocationInputTransportV2(hostile);
    assert.equal(compilation.status, "rejected");
    assert.equal(trapCount, 0);
    assertEncodingError(
      () => encodeInvocationRequestV2(hostile),
      "INVOCATION_TRANSPORT_V2_ENCODER_INPUT_INVALID",
    );
    assert.equal(trapCount, 0);
  });
});

describe("InvocationInputTransportV2 pure request encoder", () => {
  it("differentially encodes the genuine CLI and API evidence requests", () => {
    const cli = cliAuthority();
    const cliRequest = encodeInvocationRequestV2({
      contract: cli.contract,
      inputValues: { title: "Ship Setfarm" },
    });
    assert.equal(cliRequest.kind, "cli_command");
    assert.deepEqual(cliRequest.request, {
      subcommandTokens: ["add"],
      argvSuffix: ["--title", "Ship Setfarm"],
      stdinBytes: null,
    });

    const api = apiAuthority();
    const apiRequest = encodeInvocationRequestV2({
      contract: api.contract,
      inputValues: { project: "setfarm", title: "Bind contracts" },
    });
    assert.equal(apiRequest.kind, "http_request");
    assert.deepEqual(apiRequest.request, {
      method: "POST",
      pathAndQuery: "/tasks/setfarm",
      fixedHeaders: [
        { name: "accept", value: "application/json" },
        { name: "content-type", value: "application/json" },
      ],
      bodyBytes: "{\"title\":\"Bind contracts\"}",
      redirectPolicy: "error",
    });
    assert.equal(apiRequest.requestHash.length, 64);
    assertDeepFrozen(apiRequest);
  });

  it("enforces every-and-only input field closure", () => {
    const { contract } = apiAuthority();
    for (const inputValues of [
      { project: "setfarm" },
      { project: "setfarm", title: "x", unknown: true },
      { project: "setfarm", Title: "x" },
    ]) {
      assertEncodingError(
        () => encodeInvocationRequestV2({ contract, inputValues }),
        "INVOCATION_TRANSPORT_V2_INPUT_FIELD_CLOSURE_MISMATCH",
      );
    }
  });

  it("keeps number/boolean semantics typed while deterministically serializing argv text", () => {
    const { contract } = cliAuthority();
    for (const valueCase of [
      {
        valueType: "number" as const,
        valueCodecRef: "VALUE_NUMBER_FINITE_CANONICAL_JSON_V2" as const,
        value: -12.5,
        token: "-12.5",
        wrong: "-12.5",
      },
      {
        valueType: "boolean" as const,
        valueCodecRef: "VALUE_BOOLEAN_CANONICAL_JSON_V2" as const,
        value: true,
        token: "true",
        wrong: "true",
      },
    ]) {
      const candidate = structuredClone(contract);
      Object.assign(candidate.fields[0]!, {
        valueType: valueCase.valueType,
        valueCodecRef: valueCase.valueCodecRef,
      });
      const typedContract = rehashed(candidate);
      const encoded = encodeInvocationRequestV2({
        contract: typedContract,
        inputValues: { title: valueCase.value },
      });
      assert.equal(encoded.kind, "cli_command");
      assert.deepEqual(encoded.request.argvSuffix, ["--title", valueCase.token]);
      assertEncodingError(
        () => encodeInvocationRequestV2({
          contract: typedContract,
          inputValues: { title: valueCase.wrong },
        }),
        "INVOCATION_TRANSPORT_V2_INPUT_VALUE_INVALID",
      );
    }
  });

  it("serializes canonical object/array JSON into argv without caller codecs", () => {
    const { contract } = cliAuthority();
    const cases = [
      {
        valueType: "object" as const,
        valueCodecRef: "VALUE_OBJECT_CANONICAL_JSON_V2" as const,
        value: { z: 1, a: true },
        token: "{\"a\":true,\"z\":1}",
      },
      {
        valueType: "array" as const,
        valueCodecRef: "VALUE_ARRAY_CANONICAL_JSON_V2" as const,
        value: [2, { b: false, a: null }],
        token: "[2,{\"a\":null,\"b\":false}]",
      },
    ];
    for (const valueCase of cases) {
      const candidate = structuredClone(contract);
      Object.assign(candidate.fields[0]!, {
        valueType: valueCase.valueType,
        valueCodecRef: valueCase.valueCodecRef,
      });
      const typedContract = rehashed(candidate);
      const encoded = encodeInvocationRequestV2({
        contract: typedContract,
        inputValues: { title: valueCase.value },
      });
      assert.equal(encoded.kind, "cli_command");
      assert.deepEqual(encoded.request.argvSuffix, ["--title", valueCase.token]);
    }
  });

  it("enforces exact enum authority without string coercion", () => {
    const { contract } = cliAuthority();
    const candidate = structuredClone(contract);
    Object.assign(candidate.fields[0]!, {
      valueType: "enum" as const,
      valueCodecRef: "VALUE_ENUM_EXACT_V2" as const,
      entityFieldRef: "FIELD_TASK_STATUS",
      enumValues: ["ready", "running"],
    });
    const enumContract = rehashed(candidate);
    const encoded = encodeInvocationRequestV2({
      contract: enumContract,
      inputValues: { title: "running" },
    });
    assert.equal(encoded.kind, "cli_command");
    assert.deepEqual(encoded.request.argvSuffix, ["--title", "running"]);
    for (const value of ["RUNNING", 1, true]) {
      assertEncodingError(
        () => encodeInvocationRequestV2({
          contract: enumContract,
          inputValues: { title: value },
        }),
        "INVOCATION_TRANSPORT_V2_INPUT_VALUE_INVALID",
      );
    }
  });

  it("builds canonical stdin JSON with object intermediates", () => {
    const { contract } = cliAuthority();
    const candidate = structuredClone(contract);
    Object.assign(candidate.fields[0]!, {
      channel: {
        kind: "stdin_json_pointer" as const,
        pointer: "/task/title",
        containerPolicy: "object_intermediates" as const,
      },
      channelCodecRef: "CHANNEL_CLI_STDIN_CANONICAL_JSON_V2" as const,
    });
    const stdinContract = rehashed(candidate);
    const encoded = encodeInvocationRequestV2({
      contract: stdinContract,
      inputValues: { title: "Ship" },
    });
    assert.equal(encoded.kind, "cli_command");
    assert.deepEqual(encoded.request.argvSuffix, []);
    assert.equal(encoded.request.stdinBytes, "{\"task\":{\"title\":\"Ship\"}}");
  });

  it("uses canonical RFC3986 path/query encoding and canonical query order", () => {
    const { contract } = apiAuthority();
    const candidate = structuredClone(contract);
    const title = candidate.fields.find((field) => field.fieldName === "title")!;
    Object.assign(title, {
      channel: { kind: "query_parameter" as const, name: "z" },
      channelCodecRef: "CHANNEL_HTTP_QUERY_RFC3986_V2" as const,
    });
    candidate.fields.push({
      ...structuredClone(title),
      actionInputRef: `${candidate.actionRef}.zeta`,
      fieldName: "zeta",
      channel: { kind: "query_parameter" as const, name: "a" },
    });
    candidate.fixedHeaders = [{ name: "accept", value: "application/json" }];
    const queryContract = rehashed(candidate);
    const encoded = encodeInvocationRequestV2({
      contract: queryContract,
      inputValues: {
        project: "a/b !*é",
        title: "last/x",
        zeta: "first !*é",
      },
    });
    assert.equal(encoded.kind, "http_request");
    assert.equal(
      encoded.request.pathAndQuery,
      "/tasks/a%2Fb%20%21%2A%C3%A9?a=first%20%21%2A%C3%A9&z=last%2Fx",
    );
    assert.equal(encoded.request.bodyBytes, null);
    assert.equal(encoded.request.redirectPolicy, "error");
  });

  it("rejects NUL and ill-formed UTF-16 in external text channels", () => {
    const { contract } = cliAuthority();
    for (const title of ["before\0after", "\ud800"]) {
      assertEncodingError(
        () => encodeInvocationRequestV2({ contract, inputValues: { title } }),
        "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID",
      );
    }
  });

  it("rejects duplicate HTTP channel ownership even after a self-consistent rehash", () => {
    const { contract } = apiAuthority();
    const candidate = structuredClone(contract);
    const title = candidate.fields.find((field) => field.fieldName === "title")!;
    Object.assign(title, {
      channel: { kind: "query_parameter" as const, name: "q" },
      channelCodecRef: "CHANNEL_HTTP_QUERY_RFC3986_V2" as const,
    });
    candidate.fields.push({
      ...structuredClone(title),
      actionInputRef: `${candidate.actionRef}.zeta`,
      fieldName: "zeta",
    });
    candidate.fixedHeaders = [{ name: "accept", value: "application/json" }];
    candidate.contractHash = hashInvocationInputTransportV2(candidate);
    assert.equal(InvocationInputTransportV2Schema.safeParse(candidate).success, false);
  });

  it("rejects an unsafe or absolute route even after a self-consistent rehash", () => {
    const { contract } = apiAuthority();
    for (const routeTemplate of ["https://example.invalid/tasks/:project", "//host/tasks/:project", "/tasks/%2f/:project"]) {
      const candidate = structuredClone(contract);
      candidate.routeTemplate = routeTemplate;
      candidate.contractHash = hashInvocationInputTransportV2(candidate);
      assert.equal(InvocationInputTransportV2Schema.safeParse(candidate).success, false);
    }
  });

  it("returns no executable, cwd, environment, base URL, port, runner, or release field", () => {
    const cli = encodeInvocationRequestV2({
      contract: cliAuthority().contract,
      inputValues: { title: "Ship" },
    });
    const api = encodeInvocationRequestV2({
      contract: apiAuthority().contract,
      inputValues: { project: "setfarm", title: "Ship" },
    });
    const forbidden = new Set([
      "executable",
      "command",
      "cwd",
      "env",
      "environment",
      "baseUrl",
      "origin",
      "port",
      "runnerRef",
      "releaseRef",
    ]);
    for (const result of [cli, api]) {
      for (const key of allKeys(result.request)) assert.equal(forbidden.has(key), false, key);
    }
  });
});

describe("InvocationInputTransportV2 pure bounded response decoder", () => {
  it("decodes successful CLI Uint8Array and HTTP Buffer bodies through exact value pointers", () => {
    const cli = cliAuthority();
    const cliResult = decodeInvocationResponseV2({
      contract: cli.contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: new TextEncoder().encode('{"task":{"title":"Ship Setfarm"}}'),
        stderrBytes: new Uint8Array(),
      },
    });
    assert.deepEqual(cliResult, {
      status: "decoded_success",
      kind: "cli_command",
      exitCode: 0,
      decoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
      value: { title: "Ship Setfarm" },
    });
    assertDeepFrozen(cliResult);

    const api = apiAuthority();
    const apiResult = decodeInvocationResponseV2({
      contract: api.contract,
      response: {
        kind: "http_response",
        statusCode: 201,
        bodyBytes: Buffer.from('{"task":{"title":"Bind contracts"}}'),
      },
    });
    assert.deepEqual(apiResult, {
      status: "decoded_success",
      kind: "http_request",
      statusCode: 201,
      decoderRef: "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2",
      value: { title: "Bind contracts" },
    });
    assertDeepFrozen(apiResult);
  });

  it("selects declared CLI stderr and HTTP failure cases with exact error shapes", () => {
    const cliResult = decodeInvocationResponseV2({
      contract: cliAuthority().contract,
      response: {
        kind: "cli_process_result",
        exitCode: 2,
        stdoutBytes: Buffer.alloc(0),
        stderrBytes: Buffer.from(
          '{"error":{"code":"INPUT_VALIDATION_FAILED","message":"title required"}}',
        ),
      },
    });
    assert.deepEqual(cliResult, {
      status: "decoded_failure",
      kind: "cli_command",
      exitCode: 2,
      decoderRef: "DECODE_CLI_STDERR_FAILURE_JSON_V2",
      failureKind: "input_validation",
      errorCode: "INPUT_VALIDATION_FAILED",
      message: "title required",
    });

    const apiResult = decodeInvocationResponseV2({
      contract: apiAuthority().contract,
      response: {
        kind: "http_response",
        statusCode: 400,
        bodyBytes: Buffer.from(
          '{"error":{"code":"INPUT_VALIDATION_FAILED","message":"bad request"}}',
        ),
      },
    });
    assert.deepEqual(apiResult, {
      status: "decoded_failure",
      kind: "http_request",
      statusCode: 400,
      decoderRef: "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2",
      failureKind: "input_validation",
      errorCode: "INPUT_VALIDATION_FAILED",
      message: "bad request",
    });
  });

  it("touches only the exact CLI byte channel selected by the declared exit code", () => {
    let trapCount = 0;
    const hostileUnselected = new Proxy(new Uint8Array(), {
      get() {
        trapCount += 1;
        throw new Error("unselected channel must remain untouched");
      },
    });
    const success = decodeInvocationResponseV2({
      contract: cliAuthority().contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from('{"task":{"ok":true}}'),
        stderrBytes: hostileUnselected,
      },
    });
    assert.equal(success.status, "decoded_success");
    const failure = decodeInvocationResponseV2({
      contract: cliAuthority().contract,
      response: {
        kind: "cli_process_result",
        exitCode: 2,
        stdoutBytes: hostileUnselected,
        stderrBytes: Buffer.from(
          '{"error":{"code":"INPUT_VALIDATION_FAILED","message":"bad"}}',
        ),
      },
    });
    assert.equal(failure.status, "decoded_failure");
    assert.equal(trapCount, 0);
  });

  it("rejects invalid UTF-8, shared memory, typed-array proxies, and responses above 1 MiB", () => {
    const contract = cliAuthority().contract;
    const decodeStdout = (stdoutBytes: unknown) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes,
        stderrBytes: Buffer.alloc(0),
      },
    });
    assertDecodingError(
      () => decodeStdout(Buffer.from([0xc3, 0x28])),
      "INVOCATION_TRANSPORT_V2_DECODER_UTF8_INVALID",
    );
    assertDecodingError(
      () => decodeStdout(Buffer.alloc(1_048_577, 0x20)),
      "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_TOO_LARGE",
    );
    assertDecodingError(
      () => decodeStdout(new Uint8Array(new SharedArrayBuffer(16))),
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
    );

    let trapCount = 0;
    const hostileBytes = new Proxy(new Uint8Array([0x7b, 0x7d]), {
      get() {
        trapCount += 1;
        throw new Error("decoder must not invoke byte traps");
      },
    });
    assertDecodingError(
      () => decodeStdout(hostileBytes),
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
    );
    assert.equal(trapCount, 0);
  });

  it("rejects intrinsic byte shadows, detached storage, and resizable storage without invoking accessors", () => {
    const contract = cliAuthority().contract;
    const decodeStdout = (stdoutBytes: unknown) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes,
        stderrBytes: Buffer.alloc(0),
      },
    });
    let accessorCalls = 0;
    for (const property of ["buffer", "byteLength", "byteOffset", "length"] as const) {
      const shadowed = new Uint8Array([0x7b, 0x7d]);
      Object.defineProperty(shadowed, property, {
        get() {
          accessorCalls += 1;
          throw new Error("intrinsic shadow must not execute");
        },
        enumerable: false,
        configurable: true,
      });
      assertDecodingError(
        () => decodeStdout(shadowed),
        "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      );
    }
    assert.equal(accessorCalls, 0);

    const detachedBacking = new ArrayBuffer(2);
    const detached = new Uint8Array(detachedBacking);
    structuredClone(detachedBacking, { transfer: [detachedBacking] });
    assertDecodingError(
      () => decodeStdout(detached),
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
    );

    const resizableBacking = new ArrayBuffer(16, { maxByteLength: 32 });
    const resizable = new Uint8Array(resizableBacking, 0, 2);
    assert.equal(resizableBacking.resizable, true);
    assertDecodingError(
      () => decodeStdout(resizable),
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
    );
  });

  it("rejects decoded-equivalent duplicate keys and strict JSON grammar violations", () => {
    const contract = cliAuthority().contract;
    const decodeText = (text: string) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from(text),
        stderrBytes: Buffer.alloc(0),
      },
    });
    assertDecodingError(
      () => decodeText('{"task":{"ok":true},"\\u0074ask":{"ok":false}}'),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_DUPLICATE_KEY",
    );
    assertDecodingError(
      () => decodeText('{"task":{}} true'),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
    );
    assertDecodingError(
      () => decodeText('{"task":1e999}'),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_NUMBER_INVALID",
    );
    for (const text of ['{"task":"\\u0000"}', '{"task":"\\ud800"}']) {
      assertDecodingError(
        () => decodeText(text),
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
      );
    }
  });

  it("enforces exact depth, node, and per-container entry limits", () => {
    const candidate = structuredClone(cliAuthority().contract);
    candidate.result.valuePointer = "";
    const contract = rehashed(candidate);
    const decodeText = (text: string) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from(text),
        stderrBytes: Buffer.alloc(0),
      },
    });
    const atDepthLimit = `${"[".repeat(64)}0${"]".repeat(64)}`;
    assert.doesNotThrow(() => decodeText(atDepthLimit));
    const tooDeep = `${"[".repeat(65)}0${"]".repeat(65)}`;
    assertDecodingError(
      () => decodeText(tooDeep),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
    );
    const tooManyItems = `[${Array.from({ length: 10_001 }, () => "0").join(",")}]`;
    assertDecodingError(
      () => decodeText(tooManyItems),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
    );
    const tenValues = "[0,0,0,0,0,0,0,0,0,0]";
    const tooManyNodes = `{${Array.from(
      { length: 10_000 },
      (_, index) => `"${index}":${tenValues}`,
    ).join(",")}}`;
    assert.ok(Buffer.byteLength(tooManyNodes) < 1_048_576);
    assertDecodingError(
      () => decodeText(tooManyNodes),
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
    );
  });

  it("traverses arrays only through canonical numeric JSON Pointer segments", () => {
    const base = cliAuthority().contract;
    const contractForPointer = (pointer: string) => {
      const candidate = structuredClone(base);
      candidate.result.valuePointer = pointer;
      return rehashed(candidate);
    };
    const decodeAtPointer = (pointer: string) => decodeInvocationResponseV2({
      contract: contractForPointer(pointer),
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from('{"task":["first","second"]}'),
        stderrBytes: Buffer.alloc(0),
      },
    });

    assert.deepEqual(decodeAtPointer("/task/0"), {
      status: "decoded_success",
      kind: "cli_command",
      exitCode: 0,
      decoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
      value: "first",
    });
    for (const pointer of ["/task/length", "/task/property", "/task/01"]) {
      assertDecodingError(
        () => decodeAtPointer(pointer),
        "INVOCATION_TRANSPORT_V2_DECODER_POINTER_MISSING",
      );
    }
  });

  it("rejects unknown exit/status protocol codes before accepting response prose", () => {
    assertDecodingError(
      () => decodeInvocationResponseV2({
        contract: cliAuthority().contract,
        response: {
          kind: "cli_process_result",
          exitCode: 3,
          stdoutBytes: Buffer.alloc(1_048_577),
          stderrBytes: Buffer.alloc(1_048_577),
        },
      }),
      "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN",
    );
    assertDecodingError(
      () => decodeInvocationResponseV2({
        contract: apiAuthority().contract,
        response: {
          kind: "http_response",
          statusCode: 418,
          bodyBytes: Buffer.alloc(1_048_577),
        },
      }),
      "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN",
    );
  });

  it("rejects missing pointers, non-string error shapes, and declared error-code drift", () => {
    const contract = cliAuthority().contract;
    const decodeSuccess = (text: string) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from(text),
        stderrBytes: Buffer.alloc(0),
      },
    });
    const decodeFailure = (text: string) => decodeInvocationResponseV2({
      contract,
      response: {
        kind: "cli_process_result",
        exitCode: 2,
        stdoutBytes: Buffer.alloc(0),
        stderrBytes: Buffer.from(text),
      },
    });
    assertDecodingError(
      () => decodeSuccess('{"wrong":{}}'),
      "INVOCATION_TRANSPORT_V2_DECODER_POINTER_MISSING",
    );
    for (const text of [
      '{"error":{"code":123,"message":"bad"}}',
      '{"error":{"code":"INPUT_VALIDATION_FAILED","message":123}}',
    ]) {
      assertDecodingError(
        () => decodeFailure(text),
        "INVOCATION_TRANSPORT_V2_DECODER_ERROR_SHAPE_INVALID",
      );
    }
    assertDecodingError(
      () => decodeFailure('{"error":{"code":"OTHER_ERROR","message":"bad"}}'),
      "INVOCATION_TRANSPORT_V2_DECODER_ERROR_CODE_MISMATCH",
    );
  });

  it("returns decoded data only, never runner, release, process, or network authority", () => {
    const result = decodeInvocationResponseV2({
      contract: apiAuthority().contract,
      response: {
        kind: "http_response",
        statusCode: 201,
        bodyBytes: Buffer.from('{"task":{"ok":true}}'),
      },
    });
    const forbidden = new Set([
      "executable",
      "cwd",
      "env",
      "origin",
      "port",
      "runnerRef",
      "releaseRef",
      "bodyBytes",
      "stdoutBytes",
      "stderrBytes",
    ]);
    for (const key of allKeys(result)) assert.equal(forbidden.has(key), false, key);
  });
});
