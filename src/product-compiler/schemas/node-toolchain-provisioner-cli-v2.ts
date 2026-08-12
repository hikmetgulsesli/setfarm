import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";

export const NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-cli-failure.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_CLI_V2" as const;

export const NodeToolchainProvisionerCliCommandRefV2Schema = z.enum([
  "invalid_invocation",
  "inspect",
  "plan_apply",
  "plan_rollback",
  "apply",
  "verify",
  "rollback",
]);

export type NodeToolchainProvisionerCliCommandRefV2 = z.infer<
  typeof NodeToolchainProvisionerCliCommandRefV2Schema
>;

export const NodeToolchainProvisionerCliFailureKindV2Schema = z.enum([
  "invocation_rejected",
  "command_rejected",
  "internal_failure",
]);

export type NodeToolchainProvisionerCliFailureKindV2 = z.infer<
  typeof NodeToolchainProvisionerCliFailureKindV2Schema
>;

const ErrorCodeV2Schema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9_]+$/);

const NodeToolchainProvisionerCliFailureIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V2_SCHEMA),
  failureVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V2),
  commandRef: NodeToolchainProvisionerCliCommandRefV2Schema,
  failureKind: NodeToolchainProvisionerCliFailureKindV2Schema,
  errorCode: ErrorCodeV2Schema,
  causeCodes: z.array(ErrorCodeV2Schema).min(1).max(8),
  exitCode: z.union([z.literal(1), z.literal(64), z.literal(70)]),
}).strict();

export type NodeToolchainProvisionerCliFailureHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerCliFailureIdentityV2Schema
>;

export function hashNodeToolchainProvisionerCliFailureV2(
  value:
    | NodeToolchainProvisionerCliFailureHashPayloadV2
    | NodeToolchainProvisionerCliFailureV2,
): string {
  const failure = { ...value } as Record<string, unknown>;
  delete failure.failureHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-cli-failure-hash.v2",
    failure,
  });
}

export const NodeToolchainProvisionerCliFailureV2Schema =
  NodeToolchainProvisionerCliFailureIdentityV2Schema.safeExtend({
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
      || value.failureHash !== hashNodeToolchainProvisionerCliFailureV2(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Provisioner CLI failure must preserve its exact ordered cause and exit identity",
      });
    }
  });

export type NodeToolchainProvisionerCliFailureV2 = z.infer<
  typeof NodeToolchainProvisionerCliFailureV2Schema
>;
