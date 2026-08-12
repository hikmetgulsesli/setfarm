import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema, StableReferenceSchema } from "./common-v1.js";
import {
  DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
} from "./deep-byte-bundle-verification-receipt-v2.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
} from "./semantic-realization-plan-v2.js";
import {
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA,
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
  NodeProductSourceRoleV1Schema,
} from "./node-product-source-publication-v1.js";
import {
  SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
} from "./semantic-artifact-cas-verification-receipt-v1.js";
import {
  BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
} from "./node-scaffold-private-materialization-v2.js";

export const NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA =
  "setfarm.node-product-source-materialization-receipt.v1" as const;
export const NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_VERSION =
  "1.0.0" as const;
export const NODE_PRODUCT_SOURCE_MATERIALIZER_AUTHORITY_REF_V1 =
  "AUTH_NODE_PRODUCT_SOURCE_PRIVATE_MATERIALIZER_V1" as const;

export const NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1 =
  Object.freeze([
    "NODE_PRODUCT_SOURCE_MATERIALIZATION_V1_BUILD_EXECUTION_UNVERIFIED",
    "NODE_PRODUCT_SOURCE_MATERIALIZATION_V1_TEST_EXECUTION_UNVERIFIED",
    "NODE_PRODUCT_SOURCE_MATERIALIZATION_V1_EVIDENCE_REGISTRY_UNVERIFIED",
    "NODE_PRODUCT_SOURCE_MATERIALIZATION_V1_RELEASE_MANIFEST_UNVERIFIED",
  ] as const);

export const NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_V1 = Object.freeze({
  schema: "setfarm.node-product-source-private-materializer-contract.v1" as const,
  contractVersion: "1.0.0" as const,
  authorityRef: NODE_PRODUCT_SOURCE_MATERIALIZER_AUTHORITY_REF_V1,
  publicationVerification:
    "fresh-source-pair-reproduction-before-preclaimed-write-v1" as const,
  artifactRead:
    "exact-postgres-index-and-cas-envelope-plus-byte-bundle-v1" as const,
  targetOwnership:
    "authenticated-private-stage-code-owned-relative-targets-only-v1" as const,
  writePolicy:
    "exclusive-no-follow-descriptor-fsync-readonly-fresh-read-v1" as const,
  failurePolicy: "destroy-authenticated-owned-attempt-no-adoption-v1" as const,
  pathDisclosure: "forbidden" as const,
});

export const NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1 =
  hashCanonicalJson(NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_V1);

const ProfileIdV1Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);

const SourceReceiptSchemaV1 = z.enum([
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
]);

const SourceEntryV1Schema = z.object({
  sourceRole: NodeProductSourceRoleV1Schema,
  sourceReceipt: z.object({
    schema: SourceReceiptSchemaV1,
    logicalReceiptHash: Sha256Schema,
    receiptHash: Sha256Schema,
    artifactHash: Sha256Schema,
    artifactByteLength: z.number().int().positive().max(4 * 1024 * 1024),
    casVerificationReceiptSchema: z.literal(
      SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
    ),
    casVerificationReceiptHash: Sha256Schema,
  }).strict(),
  publicationReceipt: z.object({
    schema: z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA),
    receiptHash: Sha256Schema,
    entryCommitmentHash: Sha256Schema,
    receiptSetCommitmentHash: Sha256Schema,
    fileTreeManifestHash: Sha256Schema,
    logicalBuildHash: Sha256Schema,
    buildTopologyManifestHash: Sha256Schema,
    artifactHash: Sha256Schema,
    artifactByteLength: z.number().int().positive().max(4 * 1024 * 1024),
    casVerificationReceiptSchema: z.literal(
      SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
    ),
    casVerificationReceiptHash: Sha256Schema,
  }).strict(),
  source: z.object({
    pathRef: StableReferenceSchema,
    normalizedLocator: z.enum([
      "src/cli.ts",
      "src/app.ts",
      "src/cli.setfarm.test.ts",
      "src/app.setfarm.test.ts",
    ]),
    contentHash: Sha256Schema,
    byteLength: z.number().int().positive().max(16 * 1024 * 1024),
    sourceIdentityHash: Sha256Schema,
    mode: z.literal("0444"),
    physicalIdentityHash: Sha256Schema,
  }).strict(),
  bundle: z.object({
    envelopeHash: Sha256Schema,
    envelopeByteLength: z.number().int().positive().max(4 * 1024 * 1024),
    rawHash: Sha256Schema,
    rawByteLength: z.number().int().positive().max(16 * 1024 * 1024),
    deepVerificationReceiptSchema: z.literal(
      DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
    ),
    deepVerificationReceiptHash: Sha256Schema,
    consumerBindingHash: Sha256Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  const expectedSchema = value.sourceRole === "runtime"
    ? NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA
    : NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA;
  if (value.sourceReceipt.schema !== expectedSchema) {
    context.addIssue({
      code: "custom",
      path: ["sourceReceipt", "schema"],
      message: "Materialized source role and source receipt schema must agree",
    });
  }
  if (
    value.source.contentHash !== value.bundle.rawHash
    || value.source.byteLength !== value.bundle.rawByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: ["bundle"],
      message: "Materialized source and authenticated ByteBundle must be identical",
    });
  }
});

export type NodeProductSourceMaterializationEntryV1 = z.infer<
  typeof SourceEntryV1Schema
>;

export function hashNodeProductSourceMaterializationMembershipV1(
  sources: readonly NodeProductSourceMaterializationEntryV1[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-source-materialization-membership.v1",
    sources: sources.map((source) => ({
      sourceRole: source.sourceRole,
      sourceReceipt: source.sourceReceipt,
      publicationReceipt: source.publicationReceipt,
      source: source.source,
      bundle: source.bundle,
    })),
  });
}

const ReceiptIdentityV1Schema = z.object({
  schema: z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA),
  receiptVersion: z.literal(
    NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_VERSION,
  ),
  authorityRef: z.literal(NODE_PRODUCT_SOURCE_MATERIALIZER_AUTHORITY_REF_V1),
  materializerContractHash: z.literal(
    NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1,
  ),
  status: z.literal("sources_materialized_verified"),
  admissionScope: z.enum(["production_host", "test_fixture"]),
  productionUse: z.literal(
    "forbidden_until_build_test_evidence_registry_and_release_manifest",
  ),
  readiness: z.object({
    blockerCodes: z.tuple([
      z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[0]),
      z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[1]),
      z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[2]),
      z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[3]),
    ]),
  }).strict(),
  profileId: ProfileIdV1Schema,
  privateAttempt: z.object({
    rootIdentityHash: Sha256Schema,
    sourceDirectoryMode: z.literal("0700"),
    sourceFileMode: z.literal("0444"),
    pathDisclosure: z.literal("forbidden"),
    failureCleanup: z.literal("authenticated_owned_attempt_only_v1"),
  }).strict(),
  scaffold: z.object({
    baseReceiptSchema: z.literal(SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA),
    baseReceiptHash: Sha256Schema,
    dependencyReceiptSchema: z.literal(
      BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    ),
    dependencyReceiptHash: Sha256Schema,
    dependencyIdentityHash: Sha256Schema,
  }).strict(),
  publication: z.object({
    receiptSetSchema: z.literal(
      NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA,
    ),
    receiptSetCommitmentHash: Sha256Schema,
    publicationReceiptCount: z.literal(2),
    verificationDisposition: z.literal(
      "fresh-reproduced-every-and-only-runtime-test-pair",
    ),
  }).strict(),
  buildTopology: z.object({
    fileTreeManifestHash: Sha256Schema,
    logicalBuildHash: Sha256Schema,
    manifestHash: Sha256Schema,
  }).strict(),
  sourceDirectory: z.object({
    memberCount: z.literal(2),
    memberNames: z.array(z.string().min(1).max(255)).length(2),
    membershipHash: Sha256Schema,
    physicalIdentityHash: Sha256Schema,
  }).strict(),
  sourceCount: z.literal(2),
  sources: z.array(SourceEntryV1Schema).length(2),
}).strict();

export type NodeProductSourceMaterializationReceiptHashPayloadV1 = z.infer<
  typeof ReceiptIdentityV1Schema
>;

export function hashNodeProductSourceMaterializationReceiptV1(
  value:
    | NodeProductSourceMaterializationReceiptHashPayloadV1
    | NodeProductSourceMaterializationReceiptV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-source-materialization-receipt-hash.v1",
    receipt: ReceiptIdentityV1Schema.parse(payload),
  });
}

export const NodeProductSourceMaterializationReceiptV1Schema =
  ReceiptIdentityV1Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expected = value.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? {
          runtime: "src/cli.ts",
          test: "src/cli.setfarm.test.ts",
          names: ["cli.setfarm.test.ts", "cli.ts"],
        }
      : {
          runtime: "src/app.ts",
          test: "src/app.setfarm.test.ts",
          names: ["app.setfarm.test.ts", "app.ts"],
        };
    const roles = value.sources.map((source) => source.sourceRole);
    if (roles[0] !== "runtime" || roles[1] !== "test") {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Materialized sources must contain runtime then test exactly once",
      });
    }
    if (
      value.sources[0]?.source.normalizedLocator !== expected.runtime
      || value.sources[1]?.source.normalizedLocator !== expected.test
      || value.sourceDirectory.memberNames.some((name, index) =>
        name !== expected.names[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceDirectory"],
        message: "Materialized source membership must equal the exact profile targets",
      });
    }
    if (value.sources.some((source) =>
      source.publicationReceipt.receiptSetCommitmentHash
        !== value.publication.receiptSetCommitmentHash
      || source.publicationReceipt.fileTreeManifestHash
        !== value.buildTopology.fileTreeManifestHash
      || source.publicationReceipt.logicalBuildHash
        !== value.buildTopology.logicalBuildHash
      || source.publicationReceipt.buildTopologyManifestHash
        !== value.buildTopology.manifestHash)) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message:
          "Both source publications must join the exact receipt set, FileTree and BuildTopology",
      });
    }
    if (
      value.sourceDirectory.membershipHash
      !== hashNodeProductSourceMaterializationMembershipV1(value.sources)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceDirectory", "membershipHash"],
        message: "Materialized source membership hash must bind both exact sources",
      });
    }
    if (
      value.receiptHash !== hashNodeProductSourceMaterializationReceiptV1(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Source materialization receipt hash must bind the exact receipt",
      });
    }
  });

export type NodeProductSourceMaterializationReceiptV1 = z.infer<
  typeof NodeProductSourceMaterializationReceiptV1Schema
>;
