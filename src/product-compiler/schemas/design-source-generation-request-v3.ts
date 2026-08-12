import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import {
  DesignSourceGenerationAuthorityV1Schema,
  type DesignSourceGenerationAuthorityV1,
} from "./design-source-generation-authority-v1.js";

export const DESIGN_SOURCE_GENERATION_REQUEST_ARTIFACT_TYPE_V3 =
  "setfarm.design-source-generation-request.v3" as const;
export const DESIGN_SOURCE_GENERATION_DISPATCH_RECEIPT_ARTIFACT_TYPE_V3 =
  "setfarm.design-source-generation-dispatch-receipt.v3" as const;

export const DesignSourceGenerationRequestRefV3Schema = z.string()
  .regex(/^DSREQ_[A-F0-9]{64}$/);

export const DesignSourceGenerationStageIdV3Schema = z.string()
  .regex(/^DSGS_[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);

export function hashDesignSourceGenerationAuthorityBindingV3(
  value: DesignSourceGenerationAuthorityV1,
): string {
  return hashCanonicalJson(DesignSourceGenerationAuthorityV1Schema.parse(value));
}

export const DesignSourceGenerationAuthorityBindingV3Schema = z.object({
  authority: DesignSourceGenerationAuthorityV1Schema,
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.authorityHash
    !== hashDesignSourceGenerationAuthorityBindingV3(value.authority)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "DESIGN_REQUEST_V3_GENERATION_AUTHORITY_HASH_MISMATCH: authorityHash must bind provider, model, device, policies, release, and source identities",
    });
  }
});

export type DesignSourceGenerationAuthorityBindingV3 = z.infer<
  typeof DesignSourceGenerationAuthorityBindingV3Schema
>;

export const DesignSourceGenerationRetryIdentityV3Schema = z.object({
  ordinal: z.literal(1),
  retryAuthority: z.null(),
}).strict();

const DesignSourceGenerationRequestCoreV3Schema = z.object({
  schema: z.literal(DESIGN_SOURCE_GENERATION_REQUEST_ARTIFACT_TYPE_V3),
  generationTargetsPayloadHash: Sha256Schema,
  generationAuthorityHash: Sha256Schema,
  targetRef: GenerationTargetIdSchema,
  targetHash: Sha256Schema,
  requestScreenKey: z.string().min(1).max(500),
  stageId: DesignSourceGenerationStageIdV3Schema,
  retry: DesignSourceGenerationRetryIdentityV3Schema,
  promptHash: Sha256Schema,
}).strict();

export type DesignSourceGenerationRequestCoreV3 = z.infer<
  typeof DesignSourceGenerationRequestCoreV3Schema
>;

export function designSourceGenerationRequestRefV3(
  value: DesignSourceGenerationRequestCoreV3,
): string {
  return `DSREQ_${hashCanonicalJson({
    schema: "setfarm.design-source-generation-request-ref.v3",
    request: DesignSourceGenerationRequestCoreV3Schema.parse(value),
  }).toUpperCase()}`;
}

const DesignSourceGenerationRequestReceiptPayloadV3Schema =
  DesignSourceGenerationRequestCoreV3Schema.extend({
    requestRef: DesignSourceGenerationRequestRefV3Schema,
  }).strict();

export type DesignSourceGenerationRequestReceiptPayloadV3 = z.infer<
  typeof DesignSourceGenerationRequestReceiptPayloadV3Schema
>;

export function hashDesignSourceGenerationRequestReceiptV3(
  value: DesignSourceGenerationRequestReceiptPayloadV3,
): string {
  return hashCanonicalJson(
    DesignSourceGenerationRequestReceiptPayloadV3Schema.parse(value),
  );
}

export const DesignSourceGenerationRequestV3Schema =
  DesignSourceGenerationRequestReceiptPayloadV3Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const {
      requestRef: _requestRef,
      receiptHash: _receiptHash,
      ...core
    } = value;
    if (value.requestRef !== designSourceGenerationRequestRefV3(core)) {
      context.addIssue({
        code: "custom",
        path: ["requestRef"],
        message: "DESIGN_REQUEST_V3_REF_MISMATCH: requestRef must derive from the immutable request identity",
      });
    }
    const { receiptHash: _hash, ...payload } = value;
    if (value.receiptHash !== hashDesignSourceGenerationRequestReceiptV3(payload)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "DESIGN_REQUEST_V3_RECEIPT_HASH_MISMATCH: receiptHash must bind the exact canonical request receipt",
      });
    }
  });

export type DesignSourceGenerationRequestV3 = z.infer<
  typeof DesignSourceGenerationRequestV3Schema
>;

const DesignSourceGenerationDispatchReceiptPayloadV3Schema = z.object({
  schema: z.literal(DESIGN_SOURCE_GENERATION_DISPATCH_RECEIPT_ARTIFACT_TYPE_V3),
  requestRef: DesignSourceGenerationRequestRefV3Schema,
  requestReceiptHash: Sha256Schema,
  dispatchedGenerationAuthorityHash: Sha256Schema,
  externalOperationIdHash: Sha256Schema,
}).strict();

export type DesignSourceGenerationDispatchReceiptPayloadV3 = z.infer<
  typeof DesignSourceGenerationDispatchReceiptPayloadV3Schema
>;

export function hashDesignSourceGenerationDispatchReceiptV3(
  value: DesignSourceGenerationDispatchReceiptPayloadV3,
): string {
  return hashCanonicalJson(
    DesignSourceGenerationDispatchReceiptPayloadV3Schema.parse(value),
  );
}

export const DesignSourceGenerationDispatchReceiptV3Schema =
  DesignSourceGenerationDispatchReceiptPayloadV3Schema.extend({
    dispatchReceiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { dispatchReceiptHash: _dispatchReceiptHash, ...payload } = value;
    if (
      value.dispatchReceiptHash
      !== hashDesignSourceGenerationDispatchReceiptV3(payload)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dispatchReceiptHash"],
        message: "DESIGN_DISPATCH_V3_RECEIPT_HASH_MISMATCH: dispatchReceiptHash must bind the request, generation authority, and opaque external operation identity",
      });
    }
  });

export type DesignSourceGenerationDispatchReceiptV3 = z.infer<
  typeof DesignSourceGenerationDispatchReceiptV3Schema
>;
