import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1,
} from "../artifact-closure.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
  BYTE_BUNDLE_MAX_CHUNKS_V1,
  BYTE_BUNDLE_RAW_MAX_BYTES_V1,
  BYTE_CHUNK_RAW_MAX_BYTES_V1,
  ByteChunkRefV1Schema,
} from "./byte-bundle-v1.js";
import { Sha256Schema } from "./common-v1.js";

export const DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA =
  "setfarm.deep-byte-bundle-verification-receipt.v2" as const;
export const DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_VERSION_V2 = "2.0.0" as const;
export const DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_REF_V2 =
  "DEEP_BYTE_BUNDLE_CAS_VERIFIER_V2" as const;
export const DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_VERSION_V2 = "2.0.0" as const;

const BoundedAuthoritySchemaRefV2 = z.string().min(1).max(200);
const BoundedSubjectRefV2 = z.string().min(1).max(500);

const DeepByteBundleConsumerBindingIdentityV2Schema = z.object({
  authoritySchema: BoundedAuthoritySchemaRefV2,
  authorityHash: Sha256Schema,
  subjectRef: BoundedSubjectRefV2,
  subjectHash: Sha256Schema,
}).strict();

export type DeepByteBundleConsumerBindingHashPayloadV2 = z.infer<
  typeof DeepByteBundleConsumerBindingIdentityV2Schema
>;

export function hashDeepByteBundleConsumerBindingV2(
  value: DeepByteBundleConsumerBindingHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.deep-byte-bundle-consumer-binding-hash.v2",
    binding: {
      authoritySchema: value.authoritySchema,
      authorityHash: value.authorityHash,
      subjectRef: value.subjectRef,
      subjectHash: value.subjectHash,
    },
  });
}

export const DeepByteBundleConsumerBindingV2Schema =
  DeepByteBundleConsumerBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash === hashDeepByteBundleConsumerBindingV2(value)) return;
    context.addIssue({
      code: "custom",
      path: ["bindingHash"],
      message: "Deep ByteBundle consumer binding hash must bind its exact authority and subject",
    });
  });

export type DeepByteBundleConsumerBindingV2 = z.infer<
  typeof DeepByteBundleConsumerBindingV2Schema
>;

export const DeepByteBundleExpectedRefV2Schema = z.object({
  artifactType: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().min(1)
    .max(BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().min(1).max(BYTE_BUNDLE_RAW_MAX_BYTES_V1),
}).strict();

export type DeepByteBundleExpectedRefV2 = z.infer<
  typeof DeepByteBundleExpectedRefV2Schema
>;

const DeepByteBundleReceiptIdentityV2Schema = z.object({
  schema: z.literal(DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_VERSION_V2),
  status: z.literal("verified"),
  verifier: z.object({
    contractRef: z.literal(DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_REF_V2),
    contractVersion: z.literal(DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_VERSION_V2),
    closureRegistrySchema: z.literal(ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1),
    casReadAuthority: z.literal("hybrid-postgres-filesystem-v1"),
    indexReadAuthority: z.literal("semantic-artifacts-postgres-v1"),
  }).strict(),
  binding: DeepByteBundleConsumerBindingV2Schema,
  bundle: DeepByteBundleExpectedRefV2Schema,
  chunkCount: z.number().int().min(1).max(BYTE_BUNDLE_MAX_CHUNKS_V1),
  chunks: z.array(ByteChunkRefV1Schema).min(1).max(BYTE_BUNDLE_MAX_CHUNKS_V1),
  closureMemberCount: z.number().int().min(2).max(BYTE_BUNDLE_MAX_CHUNKS_V1 + 1),
  closureEvidenceHash: Sha256Schema,
}).strict();

export type DeepByteBundleVerificationReceiptHashPayloadV2 = z.infer<
  typeof DeepByteBundleReceiptIdentityV2Schema
>;

export function hashDeepByteBundleVerificationReceiptV2(
  value:
    | DeepByteBundleVerificationReceiptHashPayloadV2
    | DeepByteBundleVerificationReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.deep-byte-bundle-verification-receipt-hash.v2",
    receipt: payload,
  });
}

export const DeepByteBundleVerificationReceiptV2Schema =
  DeepByteBundleReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.chunkCount !== value.chunks.length) {
      context.addIssue({
        code: "custom",
        path: ["chunkCount"],
        message: "Deep ByteBundle receipt chunk count must equal its exact chunk list",
      });
    }
    const expectedClosureMembers = new Set(
      value.chunks.map((chunk) => chunk.chunkEnvelopeHash),
    ).size + 1;
    if (value.closureMemberCount !== expectedClosureMembers) {
      context.addIssue({
        code: "custom",
        path: ["closureMemberCount"],
        message: "Deep ByteBundle receipt closure member count must equal its unique chunk closure plus root",
      });
    }
    let projectedRawByteLength = 0;
    value.chunks.forEach((chunk, index) => {
      if (chunk.ordinal !== index) {
        context.addIssue({
          code: "custom",
          path: ["chunks", index, "ordinal"],
          message: "Deep ByteBundle receipt chunks must use canonical contiguous ordinals",
        });
      }
      const expectedLength = index < value.chunks.length - 1
        ? BYTE_CHUNK_RAW_MAX_BYTES_V1
        : value.bundle.rawByteLength - (index * BYTE_CHUNK_RAW_MAX_BYTES_V1);
      if (chunk.rawByteLength !== expectedLength) {
        context.addIssue({
          code: "custom",
          path: ["chunks", index, "rawByteLength"],
          message: "Deep ByteBundle receipt chunk partition differs from ByteBundleV1",
        });
      }
      projectedRawByteLength += chunk.rawByteLength;
    });
    if (projectedRawByteLength !== value.bundle.rawByteLength) {
      context.addIssue({
        code: "custom",
        path: ["bundle", "rawByteLength"],
        message: "Deep ByteBundle receipt chunk lengths do not reconstruct the bundle length",
      });
    }
    if (value.receiptHash !== hashDeepByteBundleVerificationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Deep ByteBundle verification receipt hash must bind the exact receipt",
      });
    }
  });

export type DeepByteBundleVerificationReceiptV2 = z.infer<
  typeof DeepByteBundleVerificationReceiptV2Schema
>;
