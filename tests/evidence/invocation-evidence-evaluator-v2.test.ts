import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2,
  INVOCATION_EVIDENCE_PRODUCT_DECODER_CODES_V2,
  InvocationEvidenceEvaluationV2Schema,
  InvocationEvidenceEvaluatorErrorV2,
  evaluateInvocationEvidenceV2,
} from "../../src/evidence/invocation-evidence-evaluator-v2.js";
import {
  compileInvocationInputTransportSetV2,
  encodeInvocationRequestV2,
} from "../../src/product-compiler/invocation-input-transport-v2.js";
import {
  resolveProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  canonicalJsonBytes,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  deriveNodeProductTestCoverageSymbolRefV2,
} from "../../src/product-compiler/schemas/node-product-test-source-v2.js";
import {
  hashImplementationSourceMapEvidenceBindingV2,
} from "../../src/product-compiler/schemas/implementation-source-map-v2.js";
import {
  INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
  INVOCATION_EVIDENCE_CHECK_CONTRACT_V2,
  INVOCATION_EVIDENCE_CHECK_V2_SCHEMA,
  INVOCATION_EVIDENCE_CHECK_V2_VERSION,
  InvocationEvidenceCheckV2Schema,
  createInvocationEvidenceCheckV2,
  hashInvocationEvidenceCheckV2,
  type InvocationEvidenceCheckHashPayloadV2,
  type InvocationEvidenceCheckV2,
} from "../../src/product-compiler/schemas/invocation-evidence-check-v2.js";
import type {
  InvocationInputTransportV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "../product-compiler/fixtures/no-design-product-semantics-v2.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const STORY_ID = "STORY_INVOCATION_001";

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function cliFixture(
  predicateKind: "action_invocation" | "observable_outcome",
): Readonly<{
  check: InvocationEvidenceCheckV2;
  contract: InvocationInputTransportV2;
}> {
  const productSpec = genuineNodeCliProductSpecV2();
  const action = productSpec.actions[0]!;
  const predicate = productSpec.evidencePredicates.find((candidate) =>
    candidate.kind === predicateKind)!;
  const selected = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId: "node-cli",
  });
  assert.equal(selected.status, "shadow_selected");
  if (selected.status !== "shadow_selected") {
    throw new Error("Expected CLI delivery selection");
  }
  const compiled = compileInvocationInputTransportSetV2({
    productSpec,
    deliverySelection: selected.selection,
  });
  assert.equal(compiled.status, "shadow_compiled");
  if (compiled.status !== "shadow_compiled") {
    throw new Error("Expected CLI transport compilation");
  }
  const contract = compiled.contractSet.contracts[0]!;
  const encoded = encodeInvocationRequestV2({
    contract,
    inputValues: action.evidenceScenario.targetInputValues,
  });
  const coverageIdentity = {
    coverageKind: "evidence_relation" as const,
    realizationRef: "REAL_EVIDENCE_INVOCATION_001",
    realizationHash: HASH_A,
    intentRef: "INTENT_EVIDENCE_INVOCATION_001",
    intentHash: HASH_B,
    subjectKind: "evidence_predicate" as const,
    subjectRef: predicate.id,
    subjectHash: hashCanonicalJson(predicate),
    storyId: STORY_ID,
  };
  const testCoverageMember = {
    ...coverageIdentity,
    testRef: "TEST_INVOCATION_001",
    coverageSymbolRef:
      deriveNodeProductTestCoverageSymbolRefV2(coverageIdentity),
    sourceSpan: {
      markerLine: 1,
      startByte: 0,
      endByteExclusive: 1,
      markerHash: HASH_C,
    },
  };
  const bindingIdentity = {
    evidenceRef: predicate.id,
    realizationRef: coverageIdentity.realizationRef,
    realizationHash: coverageIdentity.realizationHash,
    testCoverageMember,
  };
  const sourceMapEvidenceBinding = {
    ...bindingIdentity,
    bindingHash:
      hashImplementationSourceMapEvidenceBindingV2(bindingIdentity),
  };
  const check = predicateKind === "action_invocation"
    ? {
        predicateKind: "action_invocation" as const,
        checkRef: "CHECK_ACTION_INVOCATION" as const,
        subjectRef: action.id,
        required: true as const,
        assertion: { operator: "passes" as const },
      }
    : {
        predicateKind: "observable_outcome" as const,
        checkRef: "CHECK_OBSERVABLE_OUTCOME" as const,
        subjectRef: action.observableEffects[0]!.id,
        required: true as const,
        predicateAssertion: { operator: "passes" as const },
        selector: action.observableEffects[0]!.selector as Extract<
          InvocationEvidenceCheckHashPayloadV2["check"],
          { predicateKind: "observable_outcome" }
        >["selector"],
        assertion: action.observableEffects[0]!.assertions[0]! as Extract<
          InvocationEvidenceCheckHashPayloadV2["check"],
          { predicateKind: "observable_outcome" }
        >["assertion"],
      };
  const identity: InvocationEvidenceCheckHashPayloadV2 = {
    schema: INVOCATION_EVIDENCE_CHECK_V2_SCHEMA,
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    contractHash: INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
    authority: {
      candidateSourceReceiptHash: HASH_A,
      semanticRevisionHash: HASH_B,
      implementationClosureHash: HASH_C,
      productSpecHash: contract.productSpecHash,
      productBuildPacketHash: HASH_A,
      productBuildPacketEnvelopeHash: HASH_B,
      sourceMapLeafHash: HASH_C,
      sourceMapLeafEnvelopeHash: HASH_A,
      sourceMapEvidenceBinding,
      transportSetHash: compiled.contractSetHash,
      transportMembershipHash: compiled.membershipHash,
      transportContractHash: contract.contractHash,
    },
    execution: {
      storyId: STORY_ID,
      sliceHash: HASH_B,
      predicateRef: predicate.id,
    },
    operation: {
      actionRef: action.id,
      invocationKind: "cli_command",
      targetInputValues: action.evidenceScenario.targetInputValues,
      targetInputValuesHash: hashCanonicalJson({
        schema: "setfarm.invocation-evidence-target-input-values.v2",
        actionRef: action.id,
        inputValues: action.evidenceScenario.targetInputValues,
      }),
      encodedRequestHash: encoded.requestHash,
    },
    check,
  };
  return Object.freeze({
    check: createInvocationEvidenceCheckV2(identity),
    contract,
  });
}

function cliResponse(
  value: unknown,
): Readonly<{
  kind: "cli_process_result";
  exitCode: number;
  stdoutBytes: Buffer;
  stderrBytes: Buffer;
}> {
  return {
    kind: "cli_process_result",
    exitCode: 0,
    stdoutBytes: canonicalJsonBytes({ task: value }),
    stderrBytes: Buffer.alloc(0),
  };
}

describe("InvocationEvidenceCheckV2 source-derived semantic contract", () => {
  it("seals exact scenario, SourceMap binding, predicate, and expected value", () => {
    const { check } = cliFixture("observable_outcome");
    assert.equal(
      INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
      "f46110fb5aee7a09e50f11e859cdb7205e72d78c850726a4973ba1dd11b0f377",
    );
    assert.equal(
      canonicalJsonBytes(INVOCATION_EVIDENCE_CHECK_CONTRACT_V2).byteLength,
      878,
    );
    assert.equal(InvocationEvidenceCheckV2Schema.safeParse(check).success, true);
    assert.equal(
      check.checkHash,
      hashInvocationEvidenceCheckV2(check),
    );
    assert.equal(
      check.operation.targetInputValues.title,
      "Ship Setfarm",
    );
    assert.equal(check.check.predicateKind, "observable_outcome");
    if (check.check.predicateKind !== "observable_outcome") {
      throw new Error("Expected observable check");
    }
    assert.equal(check.check.selector.pointer, "/title");
    assert.equal(check.check.assertion.expected, "Ship Setfarm");
    assert.equal(
      check.execution.predicateRef,
      check.authority.sourceMapEvidenceBinding.evidenceRef,
    );
    assertDeepFrozen(check);
  });

  it("rejects extra caller expectation and cross-predicate SourceMap drift", () => {
    const { check } = cliFixture("action_invocation");
    const extraExpectation = structuredClone(check) as any;
    extraExpectation.check.expected = "caller prose";
    extraExpectation.checkHash =
      hashInvocationEvidenceCheckV2(extraExpectation);
    assert.equal(
      InvocationEvidenceCheckV2Schema.safeParse(extraExpectation).success,
      false,
    );

    const crossPredicate = structuredClone(check) as any;
    crossPredicate.execution.predicateRef = "EVID_CALLER_FORGED";
    crossPredicate.checkHash = hashInvocationEvidenceCheckV2(crossPredicate);
    assert.equal(
      InvocationEvidenceCheckV2Schema.safeParse(crossPredicate).success,
      false,
    );
  });
});

describe("pure invocation evidence evaluator V2", () => {
  it("passes exact action invocation and exact observable output", () => {
    for (const predicateKind of [
      "action_invocation",
      "observable_outcome",
    ] as const) {
      const fixture = cliFixture(predicateKind);
      const result = evaluateInvocationEvidenceV2({
        check: fixture.check,
        transportContract: fixture.contract,
        response: cliResponse({ title: "Ship Setfarm" }),
      });
      assert.equal(
        InvocationEvidenceEvaluationV2Schema.safeParse(result).success,
        true,
      );
      assert.equal(result.status, "passed");
      assert.equal(result.failureOwner, "none");
      assert.equal(result.outcomeCode, "EVIDENCE_CHECK_PASSED");
      assert.ok(result.observedValueHash);
      assertDeepFrozen(result);
    }
  });

  it("classifies observable mismatch and missing pointer as generated product", () => {
    const fixture = cliFixture("observable_outcome");
    const mismatch = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: fixture.contract,
      response: cliResponse({ title: "Wrong value" }),
    });
    assert.equal(mismatch.status, "product_failed");
    assert.equal(
      mismatch.reasonCode,
      "INVOCATION_EVIDENCE_OBSERVABLE_VALUE_MISMATCH",
    );
    assert.equal(mismatch.failureOwner, "generated_product");

    const missing = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: fixture.contract,
      response: cliResponse({ project: "setfarm" }),
    });
    assert.equal(missing.status, "product_failed");
    assert.equal(
      missing.reasonCode,
      "INVOCATION_EVIDENCE_OBSERVABLE_POINTER_MISSING",
    );
  });

  it("classifies declared failure and malformed candidate protocol without prose regex", () => {
    const fixture = cliFixture("action_invocation");
    const declaredFailure = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: fixture.contract,
      response: {
        kind: "cli_process_result",
        exitCode: 1,
        stdoutBytes: Buffer.alloc(0),
        stderrBytes: canonicalJsonBytes({
          error: {
            code: "ACTION_FAILED",
            message: "candidate-owned message",
          },
        }),
      },
    });
    assert.equal(declaredFailure.status, "product_failed");
    assert.equal(
      declaredFailure.reasonCode,
      "INVOCATION_EVIDENCE_DECLARED_PRODUCT_FAILURE",
    );

    const malformed = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: fixture.contract,
      response: {
        kind: "cli_process_result",
        exitCode: 0,
        stdoutBytes: Buffer.from("{invalid", "utf8"),
        stderrBytes: Buffer.alloc(0),
      },
    });
    assert.equal(malformed.status, "product_failed");
    assert.equal(
      malformed.decoderErrorCode,
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
    );
    assert.ok(
      (INVOCATION_EVIDENCE_PRODUCT_DECODER_CODES_V2 as readonly string[])
        .includes(malformed.decoderErrorCode!),
    );
  });

  it("classifies runner response-shape defects as platform release failures", () => {
    const fixture = cliFixture("action_invocation");
    const result = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: fixture.contract,
      response: {
        kind: "http_response",
        exitCode: 0,
        stdoutBytes: canonicalJsonBytes({
          task: { title: "Ship Setfarm" },
        }),
        stderrBytes: Buffer.alloc(0),
      },
    });
    assert.equal(result.status, "platform_rejected");
    assert.equal(result.failureOwner, "platform_release");
    assert.equal(
      result.decoderErrorCode,
      "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_KIND_MISMATCH",
    );
    assert.ok(
      (INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2 as readonly string[])
        .includes(result.decoderErrorCode!),
    );
  });

  it("rejects request reproduction or transport substitution as platform authority drift", () => {
    const fixture = cliFixture("action_invocation");
    const requestDrift = structuredClone(fixture.check) as any;
    requestDrift.operation.encodedRequestHash = HASH_C;
    requestDrift.checkHash = hashInvocationEvidenceCheckV2(requestDrift);
    const requestResult = evaluateInvocationEvidenceV2({
      check: requestDrift,
      transportContract: fixture.contract,
      response: cliResponse({ title: "Ship Setfarm" }),
    });
    assert.equal(requestResult.status, "platform_rejected");
    assert.equal(
      requestResult.reasonCode,
      "INVOCATION_EVIDENCE_PLATFORM_REQUEST_REPRODUCTION_REJECTED",
    );

    const apiSpec = genuineNodeExpressApiProductSpecV2();
    const apiSelection = resolveProductDeliverySelectionV2({
      productSpec: apiSpec,
      requestedStackPackId: "node-express-api",
    });
    assert.equal(apiSelection.status, "shadow_selected");
    if (apiSelection.status !== "shadow_selected") {
      throw new Error("Expected API delivery selection");
    }
    const apiCompiled = compileInvocationInputTransportSetV2({
      productSpec: apiSpec,
      deliverySelection: apiSelection.selection,
    });
    assert.equal(apiCompiled.status, "shadow_compiled");
    if (apiCompiled.status !== "shadow_compiled") {
      throw new Error("Expected API transport compilation");
    }
    const contractResult = evaluateInvocationEvidenceV2({
      check: fixture.check,
      transportContract: apiCompiled.contractSet.contracts[0],
      response: cliResponse({ title: "Ship Setfarm" }),
    });
    assert.equal(contractResult.status, "platform_rejected");
    assert.equal(
      contractResult.reasonCode,
      "INVOCATION_EVIDENCE_PLATFORM_CHECK_CONTRACT_MISMATCH",
    );
  });

  it("throws typed errors before evaluation when check or contract has no valid identity", () => {
    const fixture = cliFixture("action_invocation");
    let proxyTrapCount = 0;
    assert.throws(
      () => evaluateInvocationEvidenceV2(new Proxy({}, {
        get() {
          proxyTrapCount += 1;
          throw new Error("proxy trap must remain inert");
        },
      })),
      (error: unknown) => error instanceof InvocationEvidenceEvaluatorErrorV2
        && error.code === "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID",
    );
    assert.equal(proxyTrapCount, 0);
    const accessorInput = {
      transportContract: fixture.contract,
      response: cliResponse({ title: "Ship Setfarm" }),
    } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "check", {
      enumerable: true,
      get() {
        throw new Error("accessor must remain inert");
      },
    });
    assert.throws(
      () => evaluateInvocationEvidenceV2(accessorInput),
      (error: unknown) => error instanceof InvocationEvidenceEvaluatorErrorV2
        && error.code === "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID",
    );
    assert.throws(
      () => evaluateInvocationEvidenceV2({
        check: { ...fixture.check, checkHash: HASH_A },
        transportContract: fixture.contract,
        response: cliResponse({ title: "Ship Setfarm" }),
      }),
      (error: unknown) => error instanceof InvocationEvidenceEvaluatorErrorV2
        && error.code === "INVOCATION_EVIDENCE_EVALUATOR_V2_CHECK_INVALID",
    );
    assert.throws(
      () => evaluateInvocationEvidenceV2({
        check: fixture.check,
        transportContract: { ...fixture.contract, contractHash: HASH_A },
        response: cliResponse({ title: "Ship Setfarm" }),
      }),
      (error: unknown) => error instanceof InvocationEvidenceEvaluatorErrorV2
        && error.code === "INVOCATION_EVIDENCE_EVALUATOR_V2_CONTRACT_INVALID",
    );
  });
});
