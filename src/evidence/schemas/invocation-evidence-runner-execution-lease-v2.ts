import { z } from "zod";

import {
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from
  "../../execution/schemas/platform-release-common-v2.js";
import {
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
} from "./candidate-invocation-evidence-observation-v2.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_SOURCE_MODULE_LOCATOR_V2,
} from "./cli-process-runner-v2.js";
import {
  DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA,
} from "./evidence-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
} from "./http-service-runner-v2.js";

export const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_SCHEMA =
  "setfarm.invocation-evidence-runner-execution-lease-policy.v2" as const;
export const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_VERSION =
  PLATFORM_RELEASE_COMPONENT_VERSION_V2;

export const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2 =
  Object.freeze([
    "VERIFIED_PLATFORM_RELEASE_V2_UNISSUED",
    "CURRENT_ACTIVATED_PLATFORM_RELEASE_LEASE_V2_UNISSUED",
    "EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_UNISSUED",
    "CANDIDATE_LAUNCH_TARGET_V2_UNISSUED",
    "CANDIDATE_EXECUTION_LEASE_V2_UNISSUED",
    "EVIDENCE_ADAPTER_REGISTRY_V2_UNVERIFIED",
    "SEALED_RUNTIME_ALLOCATION_V2_UNISSUED",
    "DURABLE_EVIDENCE_PUBLICATION_CAS_V2_UNISSUED",
  ] as const);

const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_IDENTITY_V2 =
  Object.freeze({
    schema:
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_SCHEMA,
    version:
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_VERSION,
    readiness: "admission_boundary_only" as const,
    productionUse:
      "forbidden_until_verified_release_registry_and_publication_join" as const,
    blockers: INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2,
    acceptedRunners: Object.freeze([
      Object.freeze({
        runnerEntrypointRef:
          EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
        invocationKind: "cli_process" as const,
        moduleLocator:
          EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
        sourceModuleLocator:
          EVIDENCE_CLI_PROCESS_RUNNER_SOURCE_MODULE_LOCATOR_V2,
        requiredExport:
          EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
        abiRef: EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
        abiHash: EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
      }),
      Object.freeze({
        runnerEntrypointRef:
          EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
        invocationKind: "http_service" as const,
        moduleLocator:
          EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
        sourceModuleLocator:
          EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
        requiredExport:
          EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
        abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
        abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
      }),
    ] as const),
    authorityJoin: Object.freeze({
      releaseManifest:
        "fresh_verified_platform_release_v2_only" as const,
      activation:
        "current_acknowledged_non_draining_generation_lease_only" as const,
      transport:
        "verified_release_derived_executable_invocation_transport_binding_v2_only" as const,
      launchTarget:
        "fresh_verified_candidate_runtime_bundle_derived_target_v2_only" as const,
      candidate:
        "one_source_build_runtime_target_generation_chain_only" as const,
      adapter:
        "fresh_verified_release_derived_registry_v2_resolution_only" as const,
      runtime:
        "attempt_scoped_sealed_allocation_only" as const,
      publication:
        "bounded_capture_and_receipt_one_atomic_cas_batch_only" as const,
    }),
    lifecycle: Object.freeze({
      claim:
        "authenticate_exact_runner_pair_then_consume_before_first_await" as const,
      releaseRevalidation:
        "before_launch_and_inside_durable_publication_compare_and_set" as const,
      sourceRevalidation:
        "before_launch_and_before_durable_receipt_commit" as const,
      completion:
        "one_terminal_result_then_cleanup_and_lease_close" as const,
      replay: "forbidden" as const,
    }),
    resultAuthority: Object.freeze({
      schema: DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA,
      authorityState: "activated_release_bound" as const,
      productionUse:
        "permitted_current_activation_lease_only" as const,
      publicationState: "durable_cas_verified" as const,
      freeStandingOutcome: "forbidden" as const,
    }),
    preReleaseAuthority: Object.freeze({
      schema:
        CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
      contractHash:
        CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
      promotion: "forbidden_fresh_release_join_required" as const,
      productionReceipt: "forbidden" as const,
    }),
    callerAuthority: Object.freeze({
      executable: "forbidden" as const,
      environment: "forbidden" as const,
      mutablePath: "forbidden" as const,
      expectedValue: "forbidden" as const,
      callback: "forbidden" as const,
      runnerSelection: "forbidden" as const,
    }),
  });

const RunnerBindingV2Schema = z.object({
  runnerEntrypointRef: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  ]),
  invocationKind: z.enum(["cli_process", "http_service"]),
  moduleLocator: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
  ]),
  sourceModuleLocator: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_SOURCE_MODULE_LOCATOR_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
  ]),
  requiredExport: z.literal("runEvidenceAdapterV2"),
  abiRef: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  ]),
  abiHash: z.enum([
    EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
    EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  ]),
}).strict();

const InvocationEvidenceRunnerExecutionLeasePolicyIdentityV2Schema =
  z.object({
    schema: z.literal(
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_SCHEMA,
    ),
    version: z.literal(
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2_VERSION,
    ),
    readiness: z.literal("admission_boundary_only"),
    productionUse: z.literal(
      "forbidden_until_verified_release_registry_and_publication_join",
    ),
    blockers: z.tuple([
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[0],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[1],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[2],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[3],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[4],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[5],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[6],
      ),
      z.literal(
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2[7],
      ),
    ]),
    acceptedRunners: z.tuple([
      RunnerBindingV2Schema.extend({
        runnerEntrypointRef: z.literal(
          EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
        ),
        invocationKind: z.literal("cli_process"),
        moduleLocator: z.literal(
          EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
        ),
        sourceModuleLocator: z.literal(
          EVIDENCE_CLI_PROCESS_RUNNER_SOURCE_MODULE_LOCATOR_V2,
        ),
        abiRef: z.literal(EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2),
        abiHash: z.literal(EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2),
      }).strict(),
      RunnerBindingV2Schema.extend({
        runnerEntrypointRef: z.literal(
          EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
        ),
        invocationKind: z.literal("http_service"),
        moduleLocator: z.literal(
          EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
        ),
        sourceModuleLocator: z.literal(
          EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
        ),
        abiRef: z.literal(
          EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
        ),
        abiHash: z.literal(
          EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
        ),
      }).strict(),
    ]),
    authorityJoin: z.object({
      releaseManifest: z.literal(
        "fresh_verified_platform_release_v2_only",
      ),
      activation: z.literal(
        "current_acknowledged_non_draining_generation_lease_only",
      ),
      transport: z.literal(
        "verified_release_derived_executable_invocation_transport_binding_v2_only",
      ),
      launchTarget: z.literal(
        "fresh_verified_candidate_runtime_bundle_derived_target_v2_only",
      ),
      candidate: z.literal(
        "one_source_build_runtime_target_generation_chain_only",
      ),
      adapter: z.literal(
        "fresh_verified_release_derived_registry_v2_resolution_only",
      ),
      runtime: z.literal(
        "attempt_scoped_sealed_allocation_only",
      ),
      publication: z.literal(
        "bounded_capture_and_receipt_one_atomic_cas_batch_only",
      ),
    }).strict(),
    lifecycle: z.object({
      claim: z.literal(
        "authenticate_exact_runner_pair_then_consume_before_first_await",
      ),
      releaseRevalidation: z.literal(
        "before_launch_and_inside_durable_publication_compare_and_set",
      ),
      sourceRevalidation: z.literal(
        "before_launch_and_before_durable_receipt_commit",
      ),
      completion: z.literal(
        "one_terminal_result_then_cleanup_and_lease_close",
      ),
      replay: z.literal("forbidden"),
    }).strict(),
    resultAuthority: z.object({
      schema: z.literal(
        DURABLE_EVIDENCE_EXECUTION_RESULT_V2_SCHEMA,
      ),
      authorityState: z.literal("activated_release_bound"),
      productionUse: z.literal(
        "permitted_current_activation_lease_only",
      ),
      publicationState: z.literal("durable_cas_verified"),
      freeStandingOutcome: z.literal("forbidden"),
    }).strict(),
    preReleaseAuthority: z.object({
      schema: z.literal(
        CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
      ),
      contractHash: z.literal(
        CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
      ),
      promotion: z.literal(
        "forbidden_fresh_release_join_required",
      ),
      productionReceipt: z.literal("forbidden"),
    }).strict(),
    callerAuthority: z.object({
      executable: z.literal("forbidden"),
      environment: z.literal("forbidden"),
      mutablePath: z.literal("forbidden"),
      expectedValue: z.literal("forbidden"),
      callback: z.literal("forbidden"),
      runnerSelection: z.literal("forbidden"),
    }).strict(),
  }).strict();

export type InvocationEvidenceRunnerExecutionLeasePolicyHashPayloadV2 =
  z.infer<
    typeof InvocationEvidenceRunnerExecutionLeasePolicyIdentityV2Schema
  >;

export function hashInvocationEvidenceRunnerExecutionLeasePolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contractHash;
  return hashCanonicalJson({
    schema:
      "setfarm.invocation-evidence-runner-execution-lease-policy-hash.v2",
    policy: payload,
  });
}

export const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2 =
  hashInvocationEvidenceRunnerExecutionLeasePolicyV2(
    INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_IDENTITY_V2,
  );

export const InvocationEvidenceRunnerExecutionLeasePolicyV2Schema =
  InvocationEvidenceRunnerExecutionLeasePolicyIdentityV2Schema.extend({
    contractHash: z.literal(
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    ),
  }).strict().superRefine((value, context) => {
    if (
      value.contractHash
        !== hashInvocationEvidenceRunnerExecutionLeasePolicyV2(value)
      || JSON.stringify(value) !== JSON.stringify({
        ...INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_IDENTITY_V2,
        contractHash:
          INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      })
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Invocation runner execution lease policy must equal exact code-owned admission authority",
      });
    }
  });

export type InvocationEvidenceRunnerExecutionLeasePolicyV2 =
  z.infer<
    typeof InvocationEvidenceRunnerExecutionLeasePolicyV2Schema
  >;

const INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    InvocationEvidenceRunnerExecutionLeasePolicyV2Schema.parse({
      ...INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_IDENTITY_V2,
      contractHash:
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    }),
  );

export function getInvocationEvidenceRunnerExecutionLeasePolicyV2():
  InvocationEvidenceRunnerExecutionLeasePolicyV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_POLICY_V2,
    ),
  );
}
