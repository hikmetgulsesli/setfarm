import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V3_SCHEMA =
  "setfarm.node-toolchain-provisioner-cli-failure.v3" as const;
export const NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V3 = "3.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V3 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_CLI_V3" as const;

export const NodeToolchainProvisionerCliCommandRefV3Schema = z.enum([
  "invalid_invocation",
  "inspect",
  "plan_apply",
  "plan_rollback",
  "plan_apply_v3",
  "plan_rollback_v3",
  "apply",
  "apply_v3",
  "verify",
  "rollback",
  "rollback_v3",
]);

export type NodeToolchainProvisionerCliCommandRefV3 = z.infer<
  typeof NodeToolchainProvisionerCliCommandRefV3Schema
>;

export const NodeToolchainProvisionerCliFailureKindV3Schema = z.enum([
  "invocation_rejected",
  "command_rejected",
  "internal_failure",
]);

export type NodeToolchainProvisionerCliFailureKindV3 = z.infer<
  typeof NodeToolchainProvisionerCliFailureKindV3Schema
>;

const ErrorCodeV3Schema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9_]+$/);

const NodeToolchainProvisionerCliFailureIdentityV3Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V3_SCHEMA),
  failureVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V3),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V3),
  commandRef: NodeToolchainProvisionerCliCommandRefV3Schema,
  failureKind: NodeToolchainProvisionerCliFailureKindV3Schema,
  errorCode: ErrorCodeV3Schema,
  causeCodes: z.array(ErrorCodeV3Schema).min(1).max(8),
  exitCode: z.union([z.literal(1), z.literal(64), z.literal(70)]),
}).strict();

export type NodeToolchainProvisionerCliFailureHashPayloadV3 = z.infer<
  typeof NodeToolchainProvisionerCliFailureIdentityV3Schema
>;

export function hashNodeToolchainProvisionerCliFailureV3(
  value:
    | NodeToolchainProvisionerCliFailureHashPayloadV3
    | NodeToolchainProvisionerCliFailureV3,
): string {
  const failure = { ...value } as Record<string, unknown>;
  delete failure.failureHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-cli-failure-hash.v3",
    failure,
  });
}

export const NodeToolchainProvisionerCliFailureV3Schema =
  NodeToolchainProvisionerCliFailureIdentityV3Schema.extend({
    failureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedExitCode = value.failureKind === "invocation_rejected"
      ? 64
      : value.failureKind === "command_rejected"
        ? 1
        : 70;
    if (
      value.causeCodes[0] !== value.errorCode
      || new Set(value.causeCodes).size !== value.causeCodes.length
      || value.exitCode !== expectedExitCode
      || value.failureHash !== hashNodeToolchainProvisionerCliFailureV3(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Provisioner V3 CLI failure must preserve its exact ordered cause and exit identity",
      });
    }
  });

export type NodeToolchainProvisionerCliFailureV3 = z.infer<
  typeof NodeToolchainProvisionerCliFailureV3Schema
>;
