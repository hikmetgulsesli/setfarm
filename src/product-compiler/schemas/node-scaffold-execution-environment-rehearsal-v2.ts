import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
} from "./host-node-toolchain-receipt-v2.js";
import {
  EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
} from "./node-scaffold-execution-environment-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA,
} from "./node-toolchain-provisioning-v2.js";

export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA =
  "setfarm.node-scaffold-execution-environment-rehearsal-receipt.v2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_V2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2 = "2.0.0" as const;

const ReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_VERSION_V2),
  authorityRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REHEARSAL_AUTHORITY_REF_V2),
  status: z.literal("rehearsal_passed"),
  admissionScope: z.literal("test_fixture"),
  architecture: z.enum(["arm64", "x64"]),
  officialSource: z.object({
    manifestHash: Sha256Schema,
    artifactHash: Sha256Schema,
    verificationReceiptHash: Sha256Schema,
    archiveSha256: Sha256Schema,
    archiveByteLength: z.number().int().positive().max(1024 * 1024 * 1024),
  }).strict(),
  provisioning: z.object({
    receiptSchema: z.literal(NODE_TOOLCHAIN_PROVISIONING_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    treeHash: Sha256Schema,
    targetRef: z.enum([
      "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
    ]),
  }).strict(),
  hostToolchain: z.object({
    receiptSchema: z.literal(HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    nodeVersion: z.literal("22.23.1"),
    modulesAbi: z.literal("127"),
    napiVersion: z.literal("10"),
    npmVersion: z.literal("10.9.8"),
    nodeIdentityHash: Sha256Schema,
    npmClosureHash: Sha256Schema,
  }).strict(),
  environment: z.object({
    receiptSchema: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    effectiveConfigReceiptSchema: z.literal(EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA),
    effectiveConfigReceiptHash: Sha256Schema,
    effectiveConfigHash: Sha256Schema,
    environmentHash: Sha256Schema,
    revalidationReceiptHash: Sha256Schema,
    registry: z.literal("https://registry.npmjs.org"),
    projectNpmrcEvidence: z.literal("pending_file_tree_join"),
  }).strict(),
  finalState: z.object({
    environmentRoot: z.literal("absent_after_authenticated_destroy"),
    rehearsalRoot: z.literal("removed_exactly"),
    productionToolchainRoot: z.literal("untouched"),
  }).strict(),
}).strict();

export type NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2 = z.infer<
  typeof ReceiptIdentityV2Schema
>;

export function hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2(
  value:
    | NodeScaffoldExecutionEnvironmentRehearsalReceiptHashPayloadV2
    | NodeScaffoldExecutionEnvironmentRehearsalReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-execution-environment-rehearsal-receipt-hash.v2",
    receipt: payload,
  });
}

export const NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema =
  ReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.environment.revalidationReceiptHash !== value.environment.receiptHash) {
      context.addIssue({
        code: "custom",
        path: ["environment", "revalidationReceiptHash"],
        message: "Rehearsal revalidation must reproduce the exact environment receipt",
      });
    }
    if (
      (value.architecture === "arm64" && !value.provisioning.targetRef.endsWith("ARM64_V2"))
      || (value.architecture === "x64" && !value.provisioning.targetRef.endsWith("X64_V2"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["provisioning", "targetRef"],
        message: "Rehearsal target must match its exact architecture",
      });
    }
    if (value.receiptHash !== hashNodeScaffoldExecutionEnvironmentRehearsalReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Environment rehearsal receipt hash must bind every proof",
      });
    }
  });

export type NodeScaffoldExecutionEnvironmentRehearsalReceiptV2 = z.infer<
  typeof NodeScaffoldExecutionEnvironmentRehearsalReceiptV2Schema
>;
