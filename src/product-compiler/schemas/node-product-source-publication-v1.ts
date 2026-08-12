import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  NodeProductRuntimeSourceReceiptV2Schema,
} from "./node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
} from "./node-product-test-source-v2.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
} from "./semantic-realization-plan-v2.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
  BYTE_BUNDLE_RAW_MAX_BYTES_V1,
} from "./byte-bundle-v1.js";
import {
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA =
  "setfarm.node-product-source-publication-receipt.v1" as const;
export const NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_VERSION = "1.0.0" as const;
export const NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA =
  "setfarm.node-product-source-publication-receipt-set.v1" as const;
export const NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_MAX_CANONICAL_BYTES_V1 =
  4 * 1024 * 1024;

export const NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1 = Object.freeze([
  "NODE_PRODUCT_SOURCE_PUBLICATION_V1_INDEXED_PUBLICATION_UNVERIFIED",
  "NODE_PRODUCT_SOURCE_PUBLICATION_V1_PRIVATE_MATERIALIZATION_UNVERIFIED",
  "NODE_PRODUCT_SOURCE_PUBLICATION_V1_EVIDENCE_REGISTRY_UNVERIFIED",
  "NODE_PRODUCT_SOURCE_PUBLICATION_V1_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const NodeProductSourceRoleV1Schema = z.enum(["runtime", "test"]);
export type NodeProductSourceRoleV1 = z.infer<
  typeof NodeProductSourceRoleV1Schema
>;

const SourceReceiptSchemaV1 = z.enum([
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
]);

const ReceiptSetEntryV1Schema = z.object({
  sourceRole: NodeProductSourceRoleV1Schema,
  sourceReceiptSchema: SourceReceiptSchemaV1,
  sourceReceiptHash: Sha256Schema,
  entryCommitmentHash: Sha256Schema,
}).strict();

export type NodeProductSourcePublicationReceiptSetEntryV1 = z.infer<
  typeof ReceiptSetEntryV1Schema
>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function expectedSourceReceiptSchemaV1(
  role: NodeProductSourceRoleV1,
): typeof NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA
  | typeof NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA {
  return role === "runtime"
    ? NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA
    : NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA;
}

const ReceiptSetIdentityV1Schema = z.object({
  schema: z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA),
  entryCount: z.literal(2),
  entries: z.array(ReceiptSetEntryV1Schema).length(2),
}).strict();

export type NodeProductSourcePublicationReceiptSetIdentityV1 = z.infer<
  typeof ReceiptSetIdentityV1Schema
>;

export function hashNodeProductSourcePublicationReceiptSetV1(
  value:
    | NodeProductSourcePublicationReceiptSetIdentityV1
    | NodeProductSourcePublicationReceiptSetV1,
): string {
  const identity = ReceiptSetIdentityV1Schema.parse({
    schema: value.schema,
    entryCount: value.entryCount,
    entries: value.entries,
  });
  return hashCanonicalJson({
    schema: "setfarm.node-product-source-publication-receipt-set-hash.v1",
    receiptSet: identity,
  });
}

export const NodeProductSourcePublicationReceiptSetV1Schema =
  ReceiptSetIdentityV1Schema.extend({
    commitmentHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const roles = value.entries.map((entry) => entry.sourceRole);
    const canonical = [...roles].sort(compareUtf16);
    if (
      !hasUniqueStrings(roles)
      || canonical[0] !== "runtime"
      || canonical[1] !== "test"
      || roles.some((role, index) => role !== canonical[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Source publication receipt set must contain runtime then test exactly once",
      });
    }
    value.entries.forEach((entry, index) => {
      if (entry.sourceReceiptSchema !== expectedSourceReceiptSchemaV1(entry.sourceRole)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "sourceReceiptSchema"],
          message: "Source role and source receipt schema must agree",
        });
      }
    });
    if (value.commitmentHash !== hashNodeProductSourcePublicationReceiptSetV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["commitmentHash"],
        message: "Source publication receipt-set commitment hash mismatch",
      });
    }
  });

export type NodeProductSourcePublicationReceiptSetV1 = z.infer<
  typeof NodeProductSourcePublicationReceiptSetV1Schema
>;

const SourceIdentityV1Schema = z.object({
  pathRef: StableReferenceSchema,
  normalizedLocator: z.string().min(1).max(1_000),
  mediaType: z.literal("text/typescript"),
  encoding: z.literal("utf-8"),
  newline: z.literal("lf"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(BYTE_BUNDLE_RAW_MAX_BYTES_V1),
  lineCount: z.number().int().positive().max(1_000_000),
  sourceIdentityHash: Sha256Schema,
}).strict();

const SourceReceiptArtifactV1Schema = z.object({
  schema: SourceReceiptSchemaV1,
  logicalReceiptHash: Sha256Schema,
  receiptHash: Sha256Schema,
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_MAX_CANONICAL_BYTES_V1),
}).strict();

const SourceBundleV1Schema = z.object({
  artifactType: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().positive().max(BYTE_BUNDLE_RAW_MAX_BYTES_V1),
}).strict();

export const NodeProductSourcePublicationEntryAuthorityV1Schema = z.object({
  sourceRole: NodeProductSourceRoleV1Schema,
  productSpecPayloadHash: Sha256Schema,
  deliverySelectionHash: Sha256Schema,
  runtimeBehavior: z.object({
    proposalHash: Sha256Schema,
    contractHash: Sha256Schema,
    evaluatorContractHash: Sha256Schema,
  }).strict(),
  semanticRealizationPlanHash: Sha256Schema,
  fileTreeManifestHash: Sha256Schema,
  buildTopology: z.object({
    logicalBuildHash: Sha256Schema,
    manifestHash: Sha256Schema,
  }).strict(),
  sourceSet: z.object({
    runtimeLogicalReceiptHash: Sha256Schema,
    runtimeReceiptHash: Sha256Schema,
    testLogicalReceiptHash: Sha256Schema,
    testReceiptHash: Sha256Schema,
  }).strict(),
  source: SourceIdentityV1Schema,
  sourceReceiptArtifact: SourceReceiptArtifactV1Schema,
  sourceBundle: SourceBundleV1Schema,
}).strict().superRefine((value, context) => {
  const expectedSchema = expectedSourceReceiptSchemaV1(value.sourceRole);
  if (value.sourceReceiptArtifact.schema !== expectedSchema) {
    context.addIssue({
      code: "custom",
      path: ["sourceReceiptArtifact", "schema"],
      message: "Publication role and source receipt artifact schema must agree",
    });
  }
  const logicalHash = value.sourceRole === "runtime"
    ? value.sourceSet.runtimeLogicalReceiptHash
    : value.sourceSet.testLogicalReceiptHash;
  const receiptHash = value.sourceRole === "runtime"
    ? value.sourceSet.runtimeReceiptHash
    : value.sourceSet.testReceiptHash;
  if (
    value.sourceReceiptArtifact.logicalReceiptHash !== logicalHash
    || value.sourceReceiptArtifact.receiptHash !== receiptHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceReceiptArtifact"],
      message: "Source receipt artifact must equal its exact paired source-set identity",
    });
  }
  if (
    value.source.contentHash !== value.sourceBundle.rawHash
    || value.source.byteLength !== value.sourceBundle.rawByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceBundle"],
      message: "Source ByteBundle must bind the exact generated source raw identity",
    });
  }
});

export type NodeProductSourcePublicationEntryAuthorityV1 = z.infer<
  typeof NodeProductSourcePublicationEntryAuthorityV1Schema
>;

export function hashNodeProductSourcePublicationEntryCommitmentV1(
  value: NodeProductSourcePublicationEntryAuthorityV1,
): string {
  const parsed = NodeProductSourcePublicationEntryAuthorityV1Schema.parse(value);
  return hashCanonicalJson({
    schema: "setfarm.node-product-source-publication-entry-commitment.v1",
    authority: parsed,
  });
}

export function nodeProductSourcePublicationReceiptRefV1(
  entryCommitmentHash: string,
): string {
  return `NPSRC_${Sha256Schema.parse(entryCommitmentHash).toUpperCase()}`;
}

const ReceiptHashPayloadV1Schema = z.object({
  schema: z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA),
  receiptVersion: z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_VERSION),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionConsumption: z.literal("forbidden"),
    blockerCodes: z.tuple([
      z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[0]),
      z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[1]),
      z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[2]),
      z.literal(NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[3]),
    ]),
  }).strict(),
  receiptRef: StableReferenceSchema,
  entryCommitmentHash: Sha256Schema,
  receiptSet: NodeProductSourcePublicationReceiptSetV1Schema,
  authority: NodeProductSourcePublicationEntryAuthorityV1Schema,
}).strict();

export type NodeProductSourcePublicationReceiptHashPayloadV1 = z.infer<
  typeof ReceiptHashPayloadV1Schema
>;

export function hashNodeProductSourcePublicationReceiptV1(
  value:
    | NodeProductSourcePublicationReceiptHashPayloadV1
    | NodeProductSourcePublicationReceiptV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-product-source-publication-receipt-hash.v1",
    receipt: ReceiptHashPayloadV1Schema.parse(payload),
  });
}

export const NodeProductSourcePublicationReceiptV1Schema =
  ReceiptHashPayloadV1Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.entryCommitmentHash
        !== hashNodeProductSourcePublicationEntryCommitmentV1(value.authority)
      || value.receiptRef
        !== nodeProductSourcePublicationReceiptRefV1(value.entryCommitmentHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryCommitmentHash"],
        message: "Source publication receipt ref and entry commitment must reproduce",
      });
    }
    const setEntry = value.receiptSet.entries.find((entry) =>
      entry.sourceRole === value.authority.sourceRole);
    if (
      !setEntry
      || setEntry.entryCommitmentHash !== value.entryCommitmentHash
      || setEntry.sourceReceiptSchema !== value.authority.sourceReceiptArtifact.schema
      || setEntry.sourceReceiptHash !== value.authority.sourceReceiptArtifact.receiptHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptSet"],
        message: "Receipt set must bind the exact publication entry and source receipt",
      });
    }
    if (value.receiptHash !== hashNodeProductSourcePublicationReceiptV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Source publication receipt hash mismatch",
      });
    }
  });

export type NodeProductSourcePublicationReceiptV1 = z.infer<
  typeof NodeProductSourcePublicationReceiptV1Schema
>;

export function parseNodeProductSourceReceiptV2(
  role: NodeProductSourceRoleV1,
  value: unknown,
) {
  return role === "runtime"
    ? NodeProductRuntimeSourceReceiptV2Schema.parse(value)
    : NodeProductTestSourceReceiptV2Schema.parse(value);
}
