import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  decodeInvocationResponseV2,
  encodeInvocationRequestV2,
  InvocationRequestEncodingErrorV2,
  InvocationResponseDecodingErrorV2,
  type InvocationResponseDecodingErrorCodeV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import {
  InvocationInputTransportV2Schema,
  type InvocationInputTransportV2,
} from "../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  INVOCATION_EVIDENCE_CHECK_V2_VERSION,
  InvocationEvidenceCheckV2Schema,
  recursivelyFreezeInvocationEvidenceCheckV2,
  type InvocationEvidenceCheckV2,
} from "../product-compiler/schemas/invocation-evidence-check-v2.js";
import { Sha256Schema } from
  "../product-compiler/schemas/common-v1.js";

export const INVOCATION_EVIDENCE_EVALUATION_V2_SCHEMA =
  "setfarm.invocation-evidence-evaluation.v2" as const;
export const INVOCATION_EVIDENCE_EVALUATOR_MODULE_LOCATOR_V2 =
  "dist/evidence/invocation-evidence-evaluator-v2.js" as const;
export const INVOCATION_EVIDENCE_EVALUATOR_SOURCE_MODULE_LOCATOR_V2 =
  "src/evidence/invocation-evidence-evaluator-v2.ts" as const;
export const INVOCATION_EVIDENCE_EVALUATOR_EXPORT_V2 =
  "evaluateInvocationEvidenceV2" as const;

export const INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2 = Object.freeze([
  "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_CONTRACT_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_KIND_MISMATCH",
  "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
] as const satisfies readonly InvocationResponseDecodingErrorCodeV2[]);

export const INVOCATION_EVIDENCE_PRODUCT_DECODER_CODES_V2 = Object.freeze([
  "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_TOO_LARGE",
  "INVOCATION_TRANSPORT_V2_DECODER_UTF8_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_JSON_DUPLICATE_KEY",
  "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
  "INVOCATION_TRANSPORT_V2_DECODER_JSON_NUMBER_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN",
  "INVOCATION_TRANSPORT_V2_DECODER_POINTER_MISSING",
  "INVOCATION_TRANSPORT_V2_DECODER_ERROR_SHAPE_INVALID",
  "INVOCATION_TRANSPORT_V2_DECODER_ERROR_CODE_MISMATCH",
] as const satisfies readonly InvocationResponseDecodingErrorCodeV2[]);

const DecoderErrorCodeV2Schema = z.enum([
  ...INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2,
  ...INVOCATION_EVIDENCE_PRODUCT_DECODER_CODES_V2,
]);

const EvaluationReasonV2Schema = z.enum([
  "INVOCATION_EVIDENCE_ACTION_INVOCATION_PASSED",
  "INVOCATION_EVIDENCE_DECLARED_PRODUCT_FAILURE",
  "INVOCATION_EVIDENCE_OBSERVABLE_OUTCOME_PASSED",
  "INVOCATION_EVIDENCE_OBSERVABLE_POINTER_MISSING",
  "INVOCATION_EVIDENCE_OBSERVABLE_VALUE_MISMATCH",
  "INVOCATION_EVIDENCE_PLATFORM_CHECK_CONTRACT_MISMATCH",
  "INVOCATION_EVIDENCE_PLATFORM_DECODER_REJECTED",
  "INVOCATION_EVIDENCE_PLATFORM_REQUEST_REPRODUCTION_REJECTED",
  "INVOCATION_EVIDENCE_PRODUCT_DECODER_REJECTED",
]);

const EvaluationIdentityV2Schema = z.object({
  schema: z.literal(INVOCATION_EVIDENCE_EVALUATION_V2_SCHEMA),
  version: z.literal(INVOCATION_EVIDENCE_CHECK_V2_VERSION),
  checkHash: Sha256Schema,
  transportContractHash: Sha256Schema,
  encodedRequestHash: Sha256Schema,
  status: z.enum(["passed", "product_failed", "platform_rejected"]),
  verdict: z.enum(["pass", "fail", "inconclusive"]),
  failureOwner: z.enum(["none", "generated_product", "platform_release"]),
  outcomeCode: z.enum([
    "EVIDENCE_CHECK_PASSED",
    "EVIDENCE_PLATFORM_AUTHORITY_REJECTED",
    "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH",
  ]),
  reasonCode: EvaluationReasonV2Schema,
  decoderErrorCode: DecoderErrorCodeV2Schema.optional(),
  observedValueHash: Sha256Schema.optional(),
}).strict().superRefine((value, context) => {
  const validOutcome =
    (
      value.status === "passed"
      && value.verdict === "pass"
      && value.failureOwner === "none"
      && value.outcomeCode === "EVIDENCE_CHECK_PASSED"
      && value.observedValueHash !== undefined
    )
    || (
      value.status === "product_failed"
      && value.verdict === "fail"
      && value.failureOwner === "generated_product"
      && value.outcomeCode === "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH"
      && value.observedValueHash !== undefined
    )
    || (
      value.status === "platform_rejected"
      && value.verdict === "inconclusive"
      && value.failureOwner === "platform_release"
      && value.outcomeCode === "EVIDENCE_PLATFORM_AUTHORITY_REJECTED"
    );
  if (!validOutcome) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Invocation evaluation status must map to one exact evidence outcome",
    });
  }
  const decoderReason = value.reasonCode
    === "INVOCATION_EVIDENCE_PLATFORM_DECODER_REJECTED"
    || value.reasonCode
      === "INVOCATION_EVIDENCE_PRODUCT_DECODER_REJECTED";
  if (decoderReason !== (value.decoderErrorCode !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["decoderErrorCode"],
      message: "Decoder reason and exact decoder code must appear together",
    });
  }
  if (
    value.reasonCode === "INVOCATION_EVIDENCE_PLATFORM_DECODER_REJECTED"
    && value.decoderErrorCode !== undefined
    && !(INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2 as readonly string[])
      .includes(value.decoderErrorCode)
  ) {
    context.addIssue({
      code: "custom",
      path: ["decoderErrorCode"],
      message: "Platform decoder rejection requires a platform-owned decoder code",
    });
  }
  if (
    value.reasonCode === "INVOCATION_EVIDENCE_PRODUCT_DECODER_REJECTED"
    && value.decoderErrorCode !== undefined
    && !(INVOCATION_EVIDENCE_PRODUCT_DECODER_CODES_V2 as readonly string[])
      .includes(value.decoderErrorCode)
  ) {
    context.addIssue({
      code: "custom",
      path: ["decoderErrorCode"],
      message: "Product decoder rejection requires a product-owned decoder code",
    });
  }
});

export type InvocationEvidenceEvaluationHashPayloadV2 = z.infer<
  typeof EvaluationIdentityV2Schema
>;

export function hashInvocationEvidenceEvaluationV2(
  value:
    | InvocationEvidenceEvaluationHashPayloadV2
    | InvocationEvidenceEvaluationV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.evaluationHash;
  return hashCanonicalJson({
    schema: "setfarm.invocation-evidence-evaluation-hash.v2",
    evaluation: payload,
  });
}

export const InvocationEvidenceEvaluationV2Schema =
  EvaluationIdentityV2Schema.extend({
    evaluationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.evaluationHash !== hashInvocationEvidenceEvaluationV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evaluationHash"],
        message: "Invocation evaluation hash must bind the exact typed result",
      });
    }
  });

export type InvocationEvidenceEvaluationV2 = z.infer<
  typeof InvocationEvidenceEvaluationV2Schema
>;

export type InvocationEvidenceEvaluatorErrorCodeV2 =
  | "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID"
  | "INVOCATION_EVIDENCE_EVALUATOR_V2_CHECK_INVALID"
  | "INVOCATION_EVIDENCE_EVALUATOR_V2_CONTRACT_INVALID"
  | "INVOCATION_EVIDENCE_EVALUATOR_V2_UNEXPECTED_FAILURE";

export class InvocationEvidenceEvaluatorErrorV2 extends Error {
  readonly code: InvocationEvidenceEvaluatorErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: InvocationEvidenceEvaluatorErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "InvocationEvidenceEvaluatorErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function evaluation(
  value: InvocationEvidenceEvaluationHashPayloadV2,
): InvocationEvidenceEvaluationV2 {
  return recursivelyFreezeInvocationEvidenceCheckV2(
    InvocationEvidenceEvaluationV2Schema.parse({
      ...value,
      evaluationHash: hashInvocationEvidenceEvaluationV2(value),
    }),
  );
}

function observedValueHash(
  kind: string,
  value: unknown,
): string {
  return hashCanonicalJson({
    schema: "setfarm.invocation-evidence-observed-value.v2",
    kind,
    value,
  });
}

function passed(
  check: InvocationEvidenceCheckV2,
  reasonCode:
    | "INVOCATION_EVIDENCE_ACTION_INVOCATION_PASSED"
    | "INVOCATION_EVIDENCE_OBSERVABLE_OUTCOME_PASSED",
  observed: unknown,
): InvocationEvidenceEvaluationV2 {
  return evaluation({
    schema: INVOCATION_EVIDENCE_EVALUATION_V2_SCHEMA,
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    checkHash: check.checkHash,
    transportContractHash: check.authority.transportContractHash,
    encodedRequestHash: check.operation.encodedRequestHash,
    status: "passed",
    verdict: "pass",
    failureOwner: "none",
    outcomeCode: "EVIDENCE_CHECK_PASSED",
    reasonCode,
    observedValueHash: observedValueHash(reasonCode, observed),
  });
}

function productFailed(
  check: InvocationEvidenceCheckV2,
  reasonCode:
    | "INVOCATION_EVIDENCE_DECLARED_PRODUCT_FAILURE"
    | "INVOCATION_EVIDENCE_OBSERVABLE_POINTER_MISSING"
    | "INVOCATION_EVIDENCE_OBSERVABLE_VALUE_MISMATCH"
    | "INVOCATION_EVIDENCE_PRODUCT_DECODER_REJECTED",
  observed: unknown,
  decoderErrorCode?: InvocationResponseDecodingErrorCodeV2,
): InvocationEvidenceEvaluationV2 {
  return evaluation({
    schema: INVOCATION_EVIDENCE_EVALUATION_V2_SCHEMA,
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    checkHash: check.checkHash,
    transportContractHash: check.authority.transportContractHash,
    encodedRequestHash: check.operation.encodedRequestHash,
    status: "product_failed",
    verdict: "fail",
    failureOwner: "generated_product",
    outcomeCode: "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH",
    reasonCode,
    ...(decoderErrorCode === undefined ? {} : { decoderErrorCode }),
    observedValueHash: observedValueHash(reasonCode, observed),
  });
}

function platformRejected(
  check: InvocationEvidenceCheckV2,
  reasonCode:
    | "INVOCATION_EVIDENCE_PLATFORM_CHECK_CONTRACT_MISMATCH"
    | "INVOCATION_EVIDENCE_PLATFORM_DECODER_REJECTED"
    | "INVOCATION_EVIDENCE_PLATFORM_REQUEST_REPRODUCTION_REJECTED",
  decoderErrorCode?: InvocationResponseDecodingErrorCodeV2,
): InvocationEvidenceEvaluationV2 {
  return evaluation({
    schema: INVOCATION_EVIDENCE_EVALUATION_V2_SCHEMA,
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    checkHash: check.checkHash,
    transportContractHash: check.authority.transportContractHash,
    encodedRequestHash: check.operation.encodedRequestHash,
    status: "platform_rejected",
    verdict: "inconclusive",
    failureOwner: "platform_release",
    outcomeCode: "EVIDENCE_PLATFORM_AUTHORITY_REJECTED",
    reasonCode,
    ...(decoderErrorCode === undefined ? {} : { decoderErrorCode }),
  });
}

function jsonPointerSegments(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function valueAtJsonPointer(
  root: unknown,
  pointer: string,
): Readonly<{ found: boolean; value?: unknown }> {
  if (pointer === "") return Object.freeze({ found: true, value: root });
  let current = root;
  for (const segment of jsonPointerSegments(pointer)) {
    if (current === null || typeof current !== "object") {
      return Object.freeze({ found: false });
    }
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(segment)) {
        return Object.freeze({ found: false });
      }
      const index = Number(segment);
      if (
        !Number.isSafeInteger(index)
        || index >= current.length
        || !Object.hasOwn(current, segment)
      ) {
        return Object.freeze({ found: false });
      }
    } else if (!Object.hasOwn(current, segment)) {
      return Object.freeze({ found: false });
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return Object.freeze({ found: true, value: current });
}

function parseCheck(input: unknown): InvocationEvidenceCheckV2 {
  try {
    return InvocationEvidenceCheckV2Schema.parse(input);
  } catch (error) {
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_CHECK_INVALID",
      "Invocation evidence evaluation requires one valid bounded check",
      { cause: error },
    );
  }
}

function exactEvaluatorInput(input: unknown): Readonly<{
  check: unknown;
  transportContract: unknown;
  response: unknown;
}> {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID",
      "Invocation evidence evaluator input must be one exact plain data record",
    );
  }
  const expectedKeys = [
    "check",
    "response",
    "transportContract",
  ];
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== "string")
    || canonicalJsonStringify(keys.map(String).sort())
      !== canonicalJsonStringify(expectedKeys)
  ) {
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID",
      "Invocation evidence evaluator fields must equal check, response and transportContract",
    );
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      !descriptor
      || !("value" in descriptor)
      || !descriptor.enumerable
    ) {
      throw new InvocationEvidenceEvaluatorErrorV2(
        "INVOCATION_EVIDENCE_EVALUATOR_V2_INPUT_INVALID",
        `Invocation evidence evaluator ${key} must be one enumerable data property`,
      );
    }
  }
  return input as Readonly<{
    check: unknown;
    transportContract: unknown;
    response: unknown;
  }>;
}

function parseContract(input: unknown): InvocationInputTransportV2 {
  try {
    return InvocationInputTransportV2Schema.parse(input);
  } catch (error) {
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_CONTRACT_INVALID",
      "Invocation evidence evaluation requires one valid transport contract",
      { cause: error },
    );
  }
}

/**
 * Pure semantic evaluator. It performs no process, socket, filesystem,
 * publication, release, or activation operation. Operational runners may call
 * it only after their private release/candidate execution lease has supplied
 * the authentic check, contract, and bounded response bytes.
 */
export function evaluateInvocationEvidenceV2(
  input: unknown,
): InvocationEvidenceEvaluationV2 {
  const values = exactEvaluatorInput(input);
  const check = parseCheck(values.check);
  const contract = parseContract(values.transportContract);
  if (
    contract.contractHash !== check.authority.transportContractHash
    || contract.productSpecHash !== check.authority.productSpecHash
    || contract.actionRef !== check.operation.actionRef
    || contract.kind !== check.operation.invocationKind
  ) {
    return platformRejected(
      check,
      "INVOCATION_EVIDENCE_PLATFORM_CHECK_CONTRACT_MISMATCH",
    );
  }

  try {
    const encoded = encodeInvocationRequestV2({
      contract,
      inputValues: check.operation.targetInputValues,
    });
    if (
      encoded.kind !== check.operation.invocationKind
      || encoded.requestHash !== check.operation.encodedRequestHash
    ) {
      return platformRejected(
        check,
        "INVOCATION_EVIDENCE_PLATFORM_REQUEST_REPRODUCTION_REJECTED",
      );
    }
  } catch (error) {
    if (error instanceof InvocationRequestEncodingErrorV2) {
      return platformRejected(
        check,
        "INVOCATION_EVIDENCE_PLATFORM_REQUEST_REPRODUCTION_REJECTED",
      );
    }
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_UNEXPECTED_FAILURE",
      "Invocation request reproduction failed unexpectedly",
      { cause: error },
    );
  }

  try {
    const decoded = decodeInvocationResponseV2({
      contract,
      response: values.response,
    });
    if (decoded.status === "decoded_failure") {
      return productFailed(
        check,
        "INVOCATION_EVIDENCE_DECLARED_PRODUCT_FAILURE",
        decoded,
      );
    }
    if (check.check.predicateKind === "action_invocation") {
      return passed(
        check,
        "INVOCATION_EVIDENCE_ACTION_INVOCATION_PASSED",
        decoded,
      );
    }
    const selected = valueAtJsonPointer(
      decoded.value,
      check.check.selector.pointer,
    );
    if (!selected.found) {
      return productFailed(
        check,
        "INVOCATION_EVIDENCE_OBSERVABLE_POINTER_MISSING",
        {
          pointer: check.check.selector.pointer,
          found: false,
        },
      );
    }
    if (
      canonicalJsonStringify(selected.value)
        !== canonicalJsonStringify(check.check.assertion.expected)
    ) {
      return productFailed(
        check,
        "INVOCATION_EVIDENCE_OBSERVABLE_VALUE_MISMATCH",
        {
          pointer: check.check.selector.pointer,
          found: true,
          value: selected.value,
        },
      );
    }
    return passed(
      check,
      "INVOCATION_EVIDENCE_OBSERVABLE_OUTCOME_PASSED",
      {
        pointer: check.check.selector.pointer,
        value: selected.value,
      },
    );
  } catch (error) {
    if (error instanceof InvocationResponseDecodingErrorV2) {
      if (
        (INVOCATION_EVIDENCE_PLATFORM_DECODER_CODES_V2 as readonly string[])
          .includes(error.code)
      ) {
        return platformRejected(
          check,
          "INVOCATION_EVIDENCE_PLATFORM_DECODER_REJECTED",
          error.code,
        );
      }
      return productFailed(
        check,
        "INVOCATION_EVIDENCE_PRODUCT_DECODER_REJECTED",
        { decoderErrorCode: error.code },
        error.code,
      );
    }
    throw new InvocationEvidenceEvaluatorErrorV2(
      "INVOCATION_EVIDENCE_EVALUATOR_V2_UNEXPECTED_FAILURE",
      "Invocation response evaluation failed unexpectedly",
      { cause: error },
    );
  }
}
