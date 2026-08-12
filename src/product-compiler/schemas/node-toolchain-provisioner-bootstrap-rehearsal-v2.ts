import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-rehearsal-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_V2" as const;

const CommandEvidenceV2Schema = z.object({
  sequence: z.number().int().min(1).max(8),
  commandRef: z.enum([
    "inspect_initial",
    "plan_apply",
    "apply",
    "verify",
    "plan_rollback",
    "rollback",
    "rollback_replay",
    "inspect_final",
  ]),
  artifactSchema: z.enum([
    "setfarm.node-toolchain-provisioner-inspection.v2",
    "setfarm.node-toolchain-provisioner-plan.v2",
    "setfarm.node-toolchain-provisioner-operation-receipt.v2",
  ]),
  artifactHash: Sha256Schema,
  exitCode: z.literal(0),
}).strict();

const NodeToolchainProvisionerBootstrapRehearsalReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_REHEARSAL_AUTHORITY_REF_V2),
  status: z.literal("rehearsal_passed"),
  admissionScope: z.literal("test_fixture"),
  architecture: z.enum(["arm64", "x64"]),
  officialSource: z.object({
    manifestHash: Sha256Schema,
    artifactHash: Sha256Schema,
    verificationReceiptHash: Sha256Schema,
    archiveSha256: Sha256Schema,
    archiveByteLength: z.number().int().positive(),
  }).strict(),
  bootstrap: z.object({
    bundleAuthorityReceiptHash: Sha256Schema,
    manifestHash: Sha256Schema,
    installationReceiptHash: Sha256Schema,
    rollbackReceiptHash: Sha256Schema,
  }).strict(),
  runtime: z.object({
    nodeVersion: z.literal("22.23.1"),
    modulesAbi: z.literal("127"),
    napiVersion: z.literal("10"),
    npmVersion: z.literal("10.9.8"),
    processAdmission: z.literal("installed_launcher_exact_runtime_bundle_environment_v2"),
  }).strict(),
  commands: z.tuple([
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
    CommandEvidenceV2Schema,
  ]),
  finalState: z.object({
    provisionerClassification: z.literal("target_absent"),
    provisionerInspectionHash: Sha256Schema,
    bootstrapRoot: z.literal("absent_after_authenticated_rollback"),
    rehearsalRoot: z.literal("removed_exactly"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapRehearsalReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRehearsalReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapRehearsalReceiptV2(
  value:
    | NodeToolchainProvisionerBootstrapRehearsalReceiptHashPayloadV2
    | NodeToolchainProvisionerBootstrapRehearsalReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-rehearsal-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerBootstrapRehearsalReceiptV2Schema =
  NodeToolchainProvisionerBootstrapRehearsalReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedCommands = [
      "inspect_initial",
      "plan_apply",
      "apply",
      "verify",
      "plan_rollback",
      "rollback",
      "rollback_replay",
      "inspect_final",
    ] as const;
    if (
      value.commands.some((command, index) =>
        command.sequence !== index + 1 || command.commandRef !== expectedCommands[index])
      || value.officialSource.archiveSha256.length !== 64
      || value.receiptHash !== hashNodeToolchainProvisionerBootstrapRehearsalReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap rehearsal receipt must bind the exact ordered CLI proof and cleanup state",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapRehearsalReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapRehearsalReceiptV2Schema
>;
