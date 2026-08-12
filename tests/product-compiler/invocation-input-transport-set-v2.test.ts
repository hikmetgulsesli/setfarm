import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../../src/product-compiler/bounded-canonical-json.js";
import {
  InvocationInputTransportSetVerificationErrorV2,
  compileInvocationInputTransportSetV2,
  verifyInvocationInputTransportSetV2,
} from "../../src/product-compiler/invocation-input-transport-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  hashInvocationInputTransportV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2,
  InvocationInputTransportSetV2Schema,
  hashInvocationInputTransportMembershipV2,
  hashInvocationInputTransportSetV2,
  type InvocationInputTransportSetV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-set-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const CLI_MEMBERSHIP_HASH_GOLDEN_V2 =
  "ff8e9953f63c615bf8febb4c1344455aed7647b2841bca66ff0b2d8e2bb1a050";
const API_MEMBERSHIP_HASH_GOLDEN_V2 =
  "5e034e47ddf18ba0fa0795621cdbadd7e479e9d29cebb75368f1906000abaf16";
const CLI_SET_HASH_GOLDEN_V2 =
  "ce74a0f95170f934da9ee4390e56e94aa20923e1b1a6eb71f79f267b2ad285c3";
const API_SET_HASH_GOLDEN_V2 =
  "d57b9e8420d1142f92a5d3999f443048cd0f426b0ed012101c58890211b649d5";

function selectionFor(
  productSpec: ProductSpecV2,
  stackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId: stackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function compiledSet(
  productSpec: ProductSpecV2,
  stackPackId: "node-cli" | "node-express-api",
) {
  const deliverySelection = selectionFor(productSpec, stackPackId);
  const result = compileInvocationInputTransportSetV2({
    productSpec,
    deliverySelection,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected transport set");
  return { productSpec, deliverySelection, result, contractSet: result.contractSet };
}

function rehashSet(candidate: InvocationInputTransportSetV2): InvocationInputTransportSetV2 {
  candidate.membershipHash = hashInvocationInputTransportMembershipV2(
    candidate.contracts,
  );
  candidate.contractSetHash = hashInvocationInputTransportSetV2(candidate);
  return candidate;
}

function highCardinalityApiProductSpecV2(): ProductSpecV2 {
  const value: any = structuredClone(genuineNodeExpressApiProductSpecV2());
  const enumValues = Array.from(
    { length: 500 },
    (_, index) => `V${String(index).padStart(3, "0")}`,
  );
  const entityFields = Array.from({ length: 300 }, (_, index) => {
    const suffix = String(index).padStart(3, "0");
    return {
      id: `FIELD_CHOICE_${suffix}`,
      name: `Choice${suffix}`,
      valueType: "enum",
      required: true,
      enumValues: [...enumValues],
    };
  });
  value.entities.push({
    id: "ENTITY_OPTIONS",
    name: "Options",
    fields: entityFields,
  });
  const action = value.actions[0];
  entityFields.forEach((entityField: any, index: number) => {
    const suffix = String(index).padStart(3, "0");
    const fieldName = `choice${suffix}`;
    action.input.fields.push({
      name: fieldName,
      valueType: "enum",
      required: true,
      entityFieldRef: entityField.id,
    });
    action.invocationInterface.fieldBindings.push({
      fieldName,
      optionalPresence: "not_applicable",
      channel: {
        kind: "json_body_pointer",
        pointer: `/${fieldName}`,
        containerPolicy: "object_intermediates",
      },
    });
    action.evidenceScenario.targetInputValues[fieldName] = enumValues[0];
  });
  action.input.fields.sort((left: any, right: any) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  action.invocationInterface.fieldBindings.sort((left: any, right: any) =>
    left.fieldName < right.fieldName ? -1 : left.fieldName > right.fieldName ? 1 : 0);
  value.traceability.bindings.push({
    semanticKind: "entity",
    semanticRef: "ENTITY_OPTIONS",
    requirementRefs: [...value.traceability.bindings[0].requirementRefs],
  });
  return value as ProductSpecV2;
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function assertVerificationError(
  operation: () => unknown,
  code: InvocationInputTransportSetVerificationErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof InvocationInputTransportSetVerificationErrorV2
      && error.code === code,
  );
}

describe("InvocationInputTransportSetV2 artifact authority", () => {
  it("compiles exact CLI and API sets as strict bounded shadow artifacts", () => {
    const cli = compiledSet(genuineNodeCliProductSpecV2(), "node-cli");
    const api = compiledSet(genuineNodeExpressApiProductSpecV2(), "node-express-api");
    assert.equal(cli.contractSet.schema, "setfarm.invocation-input-transport-set.v2");
    assert.equal(cli.contractSet.readiness, "shadow");
    assert.equal(cli.contractSet.productionUse, "forbidden");
    assert.equal(cli.contractSet.contractCount, 1);
    assert.equal(api.contractSet.contractCount, 1);
    assert.equal(
      cli.contractSet.membershipHash,
      CLI_MEMBERSHIP_HASH_GOLDEN_V2,
    );
    assert.equal(
      api.contractSet.membershipHash,
      API_MEMBERSHIP_HASH_GOLDEN_V2,
    );
    assert.equal(cli.contractSet.contractSetHash, CLI_SET_HASH_GOLDEN_V2);
    assert.equal(api.contractSet.contractSetHash, API_SET_HASH_GOLDEN_V2);
    assert.equal(
      Buffer.byteLength(cli.result.canonicalBytes, "utf8")
        <= INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2,
      true,
    );
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(cli.contractSet).success, true);
    assertDeepFrozen(cli.result);
    assertDeepFrozen(api.result);
  });

  it("fresh-verifies exact authority and rejects a self-consistent bilateral forgery", () => {
    const authority = compiledSet(genuineNodeCliProductSpecV2(), "node-cli");
    const verified = verifyInvocationInputTransportSetV2({
      productSpec: authority.productSpec,
      deliverySelection: authority.deliverySelection,
      candidate: authority.contractSet,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.membershipHash, CLI_MEMBERSHIP_HASH_GOLDEN_V2);
    assert.equal(verified.contractSetHash, CLI_SET_HASH_GOLDEN_V2);
    assertDeepFrozen(verified);

    const forged = structuredClone(authority.contractSet);
    forged.contracts[0]!.actionInvocationIntentHash = "0".repeat(64);
    forged.contracts[0]!.contractHash = hashInvocationInputTransportV2(
      forged.contracts[0]!,
    );
    rehashSet(forged);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(forged).success, true);
    assertVerificationError(
      () => verifyInvocationInputTransportSetV2({
        productSpec: authority.productSpec,
        deliverySelection: authority.deliverySelection,
        candidate: forged,
      }),
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("fresh-verifies every-and-only membership for a genuine two-action product", () => {
    const authority = compiledSet(
      twoStoryNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    assert.equal(authority.contractSet.contractCount, 2);
    assert.deepEqual(
      authority.contractSet.contracts.map((contract) => contract.actionRef),
      ["ACT_CREATE_NOTE", "ACT_CREATE_TASK"],
    );
    const verified = verifyInvocationInputTransportSetV2({
      productSpec: authority.productSpec,
      deliverySelection: authority.deliverySelection,
      candidate: authority.contractSet,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.contractSetHash, authority.contractSet.contractSetHash);

    const missing = structuredClone(authority.contractSet);
    missing.contracts.splice(0, 1);
    missing.contractCount = missing.contracts.length;
    rehashSet(missing);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(missing).success, true);
    assertVerificationError(
      () => verifyInvocationInputTransportSetV2({
        productSpec: authority.productSpec,
        deliverySelection: authority.deliverySelection,
        candidate: missing,
      }),
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const reordered = structuredClone(authority.contractSet);
    reordered.contracts.reverse();
    rehashSet(reordered);
    assert.equal(
      InvocationInputTransportSetV2Schema.safeParse(reordered).success,
      false,
    );
  });

  it("keeps compiler-admitted high-cardinality authority verifier-admitted", () => {
    const productSpec = highCardinalityApiProductSpecV2();
    const authority = compiledSet(productSpec, "node-express-api");
    const verificationInput = {
      productSpec,
      deliverySelection: authority.deliverySelection,
      candidate: authority.contractSet,
    };
    assert.throws(
      () => canonicalJsonBytesBounded(verificationInput, {
        maxBytes: 16 * 1024 * 1024,
        ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
      }),
      (error: unknown) =>
        error instanceof CanonicalJsonLimitError
        && error.code === "CANONICAL_JSON_MAX_NODES_EXCEEDED",
    );
    const verified = verifyInvocationInputTransportSetV2(verificationInput);
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.contractSetHash, authority.contractSet.contractSetHash);
  });

  it("rejects extra, duplicate, reordered, cross-selection and active-label forgeries", () => {
    const cli = compiledSet(genuineNodeCliProductSpecV2(), "node-cli");
    const api = compiledSet(genuineNodeExpressApiProductSpecV2(), "node-express-api");

    const extra = structuredClone(cli.contractSet);
    const extraContract = structuredClone(extra.contracts[0]!);
    extraContract.actionRef = "ACT_SECOND_TASK";
    extraContract.actionInvocationIntentHash = "1".repeat(64);
    extraContract.fields.forEach((field) => {
      field.actionInputRef = `ACT_SECOND_TASK.${field.fieldName}`;
    });
    extraContract.contractHash = hashInvocationInputTransportV2(extraContract);
    extra.contracts.push(extraContract);
    extra.contracts.sort((left, right) => left.actionRef < right.actionRef ? -1 : 1);
    extra.contractCount = extra.contracts.length;
    rehashSet(extra);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(extra).success, true);
    assertVerificationError(
      () => verifyInvocationInputTransportSetV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: extra,
      }),
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const reordered = structuredClone(extra);
    reordered.contracts.reverse();
    rehashSet(reordered);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(reordered).success, false);

    const duplicate = structuredClone(cli.contractSet);
    duplicate.contracts.push(structuredClone(duplicate.contracts[0]!));
    duplicate.contractCount = duplicate.contracts.length;
    rehashSet(duplicate);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(duplicate).success, false);

    const crossSelection = structuredClone(cli.contractSet);
    crossSelection.deliverySelectionHash = api.contractSet.deliverySelectionHash;
    rehashSet(crossSelection);
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(crossSelection).success, false);

    const active = structuredClone(cli.contractSet) as any;
    active.readiness = "active";
    assert.equal(InvocationInputTransportSetV2Schema.safeParse(active).success, false);

    const injected = compileInvocationInputTransportSetV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      contracts: cli.contractSet.contracts,
    });
    assert.equal(injected.status, "rejected");
  });

  it("bounds hostile compiler and verifier inputs without invoking proxy traps", () => {
    const oversizedArtifact = InvocationInputTransportSetV2Schema.safeParse({
      padding: "x".repeat(
        INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2,
      ),
    });
    assert.equal(oversizedArtifact.success, false);
    if (!oversizedArtifact.success) {
      assert.match(oversizedArtifact.error.issues[0]!.message, /bounded work/u);
    }

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
    assert.equal(compileInvocationInputTransportSetV2(proxy).status, "rejected");
    assert.equal(trapCount, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileInvocationInputTransportSetV2(cycle).status, "rejected");

    const sparse: any = [];
    sparse[1] = genuineNodeCliProductSpecV2().actions[0];
    const productSpec = genuineNodeCliProductSpecV2();
    assert.equal(compileInvocationInputTransportSetV2({
      productSpec: { ...productSpec, actions: sparse },
      deliverySelection: selectionFor(productSpec, "node-cli"),
    }).status, "rejected");

    const authority = compiledSet(productSpec, "node-cli");
    assertVerificationError(
      () => verifyInvocationInputTransportSetV2({
        productSpec,
        deliverySelection: authority.deliverySelection,
        candidate: proxy,
      }),
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_INPUT_INVALID",
    );
    assert.equal(trapCount, 0);
  });
});
