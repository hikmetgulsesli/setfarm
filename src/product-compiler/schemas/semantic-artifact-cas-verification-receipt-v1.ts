import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA =
  "setfarm.semantic-artifact-cas-verification-receipt.v1" as const;
export const SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_VERSION =
  "1.0.0" as const;
export const SEMANTIC_ARTIFACT_CAS_VERIFIER_CONTRACT_REF_V1 =
  "SEMANTIC_ARTIFACT_HYBRID_CAS_VERIFIER_V1" as const;
export const SEMANTIC_ARTIFACT_CAS_VERIFIER_CONTRACT_VERSION_V1 =
  "1.0.0" as const;

const SemanticArtifactCasExpectedIdentityV1Schema = z.object({
  artifactType: z.string().min(1).max(200),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive().max(4 * 1024 * 1024),
  payloadHash: Sha256Schema,
  producerHash: Sha256Schema,
}).strict();

export type SemanticArtifactCasExpectedIdentityV1 = z.infer<
  typeof SemanticArtifactCasExpectedIdentityV1Schema
>;

const ReceiptIdentityV1Schema = z.object({
  schema: z.literal(SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA),
  receiptVersion: z.literal(
    SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_VERSION,
  ),
  status: z.literal("verified"),
  verifier: z.object({
    contractRef: z.literal(SEMANTIC_ARTIFACT_CAS_VERIFIER_CONTRACT_REF_V1),
    contractVersion: z.literal(
      SEMANTIC_ARTIFACT_CAS_VERIFIER_CONTRACT_VERSION_V1,
    ),
    casReadAuthority: z.literal("hybrid-postgres-filesystem-v1"),
    indexReadAuthority: z.literal("semantic-artifacts-postgres-v1"),
    comparison: z.literal("exact-canonical-envelope-bytes-v1"),
  }).strict(),
  expected: SemanticArtifactCasExpectedIdentityV1Schema,
}).strict();

export type SemanticArtifactCasVerificationReceiptHashPayloadV1 = z.infer<
  typeof ReceiptIdentityV1Schema
>;

export function hashSemanticArtifactCasVerificationReceiptV1(
  value:
    | SemanticArtifactCasVerificationReceiptHashPayloadV1
    | SemanticArtifactCasVerificationReceiptV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.semantic-artifact-cas-verification-receipt-hash.v1",
    receipt: ReceiptIdentityV1Schema.parse(payload),
  });
}

export const SemanticArtifactCasVerificationReceiptV1Schema =
  ReceiptIdentityV1Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.receiptHash
      !== hashSemanticArtifactCasVerificationReceiptV1(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message:
          "Semantic artifact CAS verification receipt hash must bind the exact receipt",
      });
    }
  });

export type SemanticArtifactCasVerificationReceiptV1 = z.infer<
  typeof SemanticArtifactCasVerificationReceiptV1Schema
>;
