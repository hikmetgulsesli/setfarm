import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../../execution/schemas/network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../../execution/schemas/platform-release-common-v2.js";

export const EVIDENCE_COMMAND_RUNNER_ABI_POLICY_V2_SCHEMA =
  "setfarm.evidence-command-runner-abi-policy.v2" as const;
export const EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2 =
  "ENTRY_EVIDENCE_COMMAND_V2" as const;
export const EVIDENCE_COMMAND_RUNNER_ABI_REF_V2 =
  "EVIDENCE_COMMAND_RUNNER_ABI_V2" as const;
export const EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2 =
  "dist/evidence/runners/command-v2.js" as const;
export const EVIDENCE_COMMAND_RUNNER_SOURCE_MODULE_LOCATOR_V2 =
  "src/evidence/runners/command-v2.ts" as const;
export const EVIDENCE_COMMAND_RUNNER_EXPORT_V2 =
  "runEvidenceAdapterV2" as const;
export const EVIDENCE_COMMAND_REF_V2 =
  "CMD_NODE_PRODUCT_TEST_V3" as const;
export const EVIDENCE_COMMAND_RUNNER_ABI_SOURCE_REF_V2 =
  "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2" as const;
export const EVIDENCE_COMMAND_TIMEOUT_MS_V2 = 30_000 as const;
export const EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2 = 1_048_576 as const;
export const EVIDENCE_COMMAND_MAX_TEST_FILE_BYTES_V2 =
  32 * 1024 * 1024;

const EVIDENCE_COMMAND_RUNNER_ABI_IDENTITY_V2 = Object.freeze({
  schema: EVIDENCE_COMMAND_RUNNER_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  runnerEntrypointRef: EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  moduleLocator: EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
  requiredExport: EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
  abiRef: EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
  invocationKind: "command" as const,
  checkRef: "CHECK_TEST_PASS" as const,
  commandRef: EVIDENCE_COMMAND_REF_V2,
  buildTopologyRunnerAbi: EVIDENCE_COMMAND_RUNNER_ABI_SOURCE_REF_V2,
  profileIds: Object.freeze([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ] as const),
  testMemberMapping: Object.freeze([
    Object.freeze({
      buildLocator: "dist/cli.setfarm.test.js" as const,
      runtimeLocator:
        "candidate-bundle/application/cli.setfarm.test.js" as const,
    }),
    Object.freeze({
      buildLocator: "dist/app.setfarm.test.js" as const,
      runtimeLocator:
        "candidate-bundle/application/app.setfarm.test.js" as const,
    }),
  ] as const),
  directNodeArgvPolicy:
    "authenticated_node_then_test_flag_then_exact_sealed_test_member" as const,
  resultProtocol:
    "node_test_tap_v13_exact_terminal_summary_and_exit_status" as const,
  minimumTestCount: 1 as const,
  zeroTestReceipt: "forbidden" as const,
  stdin: "closed" as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  processGroupPolicy:
    "isolated_group_killed_on_every_terminal_path" as const,
  cwdPolicy: "candidate_bundle_root" as const,
  networkPolicy: "macos_sandbox_exec_loopback_only_v2" as const,
  normalizedEnvironmentHash:
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  timeoutMs: EVIDENCE_COMMAND_TIMEOUT_MS_V2,
  maxStdoutBytes: EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2,
  maxStderrBytes: EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2,
  maxTestFileBytes: EVIDENCE_COMMAND_MAX_TEST_FILE_BYTES_V2,
  capturePolicy:
    "bounded_redacted_private_bytes_then_atomic_cas_receipt_batch" as const,
  sourceFencePolicy:
    "fresh_runtime_bundle_build_topology_and_exact_test_member_before_after" as const,
  resultAuthority:
    "generated_test_observation_only_never_build_or_acceptance_authority" as const,
  buildReceiptPolicy:
    "candidate_build_receipt_is_joined_and_never_duplicated" as const,
  productionAdmission:
    "current_activated_platform_release_and_candidate_execution_lease_required" as const,
  testFixtureAdmission:
    "authentic_test_runtime_bundle_shadow_receipt_only" as const,
});

const EvidenceCommandRunnerAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_COMMAND_RUNNER_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  runnerEntrypointRef: z.literal(
    EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  ),
  moduleLocator: z.literal(EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2),
  requiredExport: z.literal(EVIDENCE_COMMAND_RUNNER_EXPORT_V2),
  abiRef: z.literal(EVIDENCE_COMMAND_RUNNER_ABI_REF_V2),
  invocationKind: z.literal("command"),
  checkRef: z.literal("CHECK_TEST_PASS"),
  commandRef: z.literal(EVIDENCE_COMMAND_REF_V2),
  buildTopologyRunnerAbi: z.literal(
    EVIDENCE_COMMAND_RUNNER_ABI_SOURCE_REF_V2,
  ),
  profileIds: z.tuple([
    z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
    z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
  ]),
  testMemberMapping: z.tuple([
    z.object({
      buildLocator: z.literal("dist/cli.setfarm.test.js"),
      runtimeLocator: z.literal(
        "candidate-bundle/application/cli.setfarm.test.js",
      ),
    }).strict(),
    z.object({
      buildLocator: z.literal("dist/app.setfarm.test.js"),
      runtimeLocator: z.literal(
        "candidate-bundle/application/app.setfarm.test.js",
      ),
    }).strict(),
  ]),
  directNodeArgvPolicy: z.literal(
    "authenticated_node_then_test_flag_then_exact_sealed_test_member",
  ),
  resultProtocol: z.literal(
    "node_test_tap_v13_exact_terminal_summary_and_exit_status",
  ),
  minimumTestCount: z.literal(1),
  zeroTestReceipt: z.literal("forbidden"),
  stdin: z.literal("closed"),
  shell: z.literal("forbidden"),
  ambientEnvironment: z.literal("forbidden"),
  processGroupPolicy: z.literal(
    "isolated_group_killed_on_every_terminal_path",
  ),
  cwdPolicy: z.literal("candidate_bundle_root"),
  networkPolicy: z.literal("macos_sandbox_exec_loopback_only_v2"),
  normalizedEnvironmentHash: z.literal(
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  ),
  timeoutMs: z.literal(EVIDENCE_COMMAND_TIMEOUT_MS_V2),
  maxStdoutBytes: z.literal(EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2),
  maxStderrBytes: z.literal(EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2),
  maxTestFileBytes: z.literal(EVIDENCE_COMMAND_MAX_TEST_FILE_BYTES_V2),
  capturePolicy: z.literal(
    "bounded_redacted_private_bytes_then_atomic_cas_receipt_batch",
  ),
  sourceFencePolicy: z.literal(
    "fresh_runtime_bundle_build_topology_and_exact_test_member_before_after",
  ),
  resultAuthority: z.literal(
    "generated_test_observation_only_never_build_or_acceptance_authority",
  ),
  buildReceiptPolicy: z.literal(
    "candidate_build_receipt_is_joined_and_never_duplicated",
  ),
  productionAdmission: z.literal(
    "current_activated_platform_release_and_candidate_execution_lease_required",
  ),
  testFixtureAdmission: z.literal(
    "authentic_test_runtime_bundle_shadow_receipt_only",
  ),
}).strict();

export type EvidenceCommandRunnerAbiPolicyHashPayloadV2 = z.infer<
  typeof EvidenceCommandRunnerAbiPolicyIdentityV2Schema
>;

export function hashEvidenceCommandRunnerAbiPolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const policy = { ...value } as Record<string, unknown>;
  delete policy.abiHash;
  return hashCanonicalJson({
    schema: "setfarm.evidence-command-runner-abi-policy-hash.v2",
    policy,
  });
}

export const EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2 =
  hashEvidenceCommandRunnerAbiPolicyV2(
    EVIDENCE_COMMAND_RUNNER_ABI_IDENTITY_V2,
  );

export const EvidenceCommandRunnerAbiPolicyV2Schema =
  EvidenceCommandRunnerAbiPolicyIdentityV2Schema.extend({
    abiHash: z.literal(EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2),
  }).strict().superRefine((value, context) => {
    if (
      value.abiHash !== hashEvidenceCommandRunnerAbiPolicyV2(value)
      || JSON.stringify(value) !== JSON.stringify({
        ...EVIDENCE_COMMAND_RUNNER_ABI_IDENTITY_V2,
        abiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Evidence command runner ABI must equal exact code-owned policy",
      });
    }
  });

export type EvidenceCommandRunnerAbiPolicyV2 = z.infer<
  typeof EvidenceCommandRunnerAbiPolicyV2Schema
>;

const EVIDENCE_COMMAND_RUNNER_ABI_V2 =
  deepFreezePlatformReleaseJsonV2(
    EvidenceCommandRunnerAbiPolicyV2Schema.parse({
      ...EVIDENCE_COMMAND_RUNNER_ABI_IDENTITY_V2,
      abiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
    }),
  );

export function getEvidenceCommandRunnerAbiPolicyV2():
  EvidenceCommandRunnerAbiPolicyV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(EVIDENCE_COMMAND_RUNNER_ABI_V2),
  );
}
