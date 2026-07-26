import { z } from "zod";

import { hashCanonicalJson } from
  "../../product-compiler/canonical-json.js";
import {
  INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
  INVOCATION_EVIDENCE_CHECK_V2_SCHEMA,
  INVOCATION_EVIDENCE_CHECK_V2_VERSION,
} from
  "../../product-compiler/schemas/invocation-evidence-check-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
} from
  "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
} from
  "../../execution/schemas/exclusive-socket-lease-v2.js";
import {
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
  NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2,
} from
  "../../execution/schemas/node-express-api-launcher-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from
  "../../execution/schemas/platform-release-common-v2.js";
import {
  EVIDENCE_CAPTURE_V2_MAX_BYTES,
  EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
  EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
  EVIDENCE_RECEIPT_V2_SCHEMA,
  evidenceCaptureRedactionPolicyHashV2,
  evidenceReceiptAbiPolicyHashV2,
} from "./evidence-receipt-v2.js";
import {
  INVOCATION_EVIDENCE_EVALUATOR_EXPORT_V2,
  INVOCATION_EVIDENCE_EVALUATOR_MODULE_LOCATOR_V2,
  INVOCATION_EVIDENCE_EVALUATOR_SOURCE_MODULE_LOCATOR_V2,
} from "../invocation-evidence-evaluator-v2.js";

export const EVIDENCE_HTTP_SERVICE_RUNNER_ABI_POLICY_V2_SCHEMA =
  "setfarm.evidence-http-service-runner-abi-policy.v2" as const;
export const EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2 =
  "ENTRY_EVIDENCE_HTTP_SERVICE_V2" as const;
export const EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2 =
  "EVIDENCE_HTTP_SERVICE_RUNNER_ABI_V2" as const;
export const EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2 =
  "dist/evidence/runners/http-service-v2.js" as const;
export const EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2 =
  "src/evidence/runners/http-service-v2.ts" as const;
export const EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2 =
  "runEvidenceAdapterV2" as const;

if (
  EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2
    !== NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2
  || EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2
    !== NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2
) {
  throw new Error(
    "HTTP evidence receipt and launcher bounds must be identical",
  );
}

const EVIDENCE_HTTP_SERVICE_RUNNER_ABI_IDENTITY_V2 = Object.freeze({
  schema: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  runnerEntrypointRef:
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  moduleLocator: EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
  sourceModuleLocator:
    EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
  requiredExport: EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  invocationKind: "http_service" as const,
  profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
  stackPackId: "node-express-api" as const,
  launcher: Object.freeze({
    launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
    moduleLocator: NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
    sourceModuleLocator:
      NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
    requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
    abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
    abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
    socketLifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  }),
  checkAuthority: Object.freeze({
    schema: INVOCATION_EVIDENCE_CHECK_V2_SCHEMA,
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    contractHash: INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
    predicateKinds: Object.freeze([
      "action_invocation",
      "observable_outcome",
    ] as const),
    checkRefs: Object.freeze([
      "CHECK_ACTION_INVOCATION",
      "CHECK_OBSERVABLE_OUTCOME",
    ] as const),
    issuer:
      "fresh_verified_candidate_source_closure_only" as const,
    callerExpectedValue: "forbidden" as const,
  }),
  transportAuthority: Object.freeze({
    schema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
    kind: "http_request" as const,
    executableBinding:
      "verified_platform_release_derived_only" as const,
    launchTarget:
      "fresh_candidate_runtime_bundle_derived_only" as const,
  }),
  evaluator: Object.freeze({
    moduleLocator: INVOCATION_EVIDENCE_EVALUATOR_MODULE_LOCATOR_V2,
    sourceModuleLocator:
      INVOCATION_EVIDENCE_EVALUATOR_SOURCE_MODULE_LOCATOR_V2,
    requiredExport: INVOCATION_EVIDENCE_EVALUATOR_EXPORT_V2,
    classifier:
      "typed_decoder_enum_and_exact_product_semantics_only" as const,
    proseClassifier: "forbidden" as const,
  }),
  receipt: Object.freeze({
    schema: EVIDENCE_RECEIPT_V2_SCHEMA,
    abiPolicyHash: evidenceReceiptAbiPolicyHashV2(),
    redactionPolicyHash: evidenceCaptureRedactionPolicyHashV2(),
  }),
  servicePolicy: Object.freeze({
    requestTimeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
    responseByteLimit: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
    maxCaptureBytes: EVIDENCE_CAPTURE_V2_MAX_BYTES,
    requestCount: 1 as const,
    redirectPolicy: "error" as const,
    originPolicy: "exact_loopback_origin" as const,
    lifecycle:
      "exclusive_held_socket_readiness_one_request_cleanup_and_rebind" as const,
  }),
  sourceFencePolicy:
    "fresh_candidate_source_runtime_bundle_and_launch_target_before_after" as const,
  executionLeasePolicy:
    "one_use_candidate_socket_and_current_activation_generation_bound" as const,
  releaseRevalidation:
    "before_socket_handoff_and_in_atomic_publication_compare_and_set" as const,
  publicationPolicy:
    "bounded_redacted_captures_and_receipt_one_atomic_cas_batch" as const,
  resultAuthority:
    "durable_evidence_receipt_only_never_launcher_or_agent_claim" as const,
  productionAdmission:
    "current_activated_platform_release_registry_adapter_and_candidate_execution_lease_required" as const,
  schemaOnlyAdmission:
    "forbidden_until_real_runner_export_and_verified_release_join" as const,
});

const EvidenceHttpServiceRunnerAbiIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_HTTP_SERVICE_RUNNER_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  runnerEntrypointRef: z.literal(
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  ),
  moduleLocator: z.literal(
    EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
  ),
  sourceModuleLocator: z.literal(
    EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2,
  ),
  requiredExport: z.literal(EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2),
  abiRef: z.literal(EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2),
  invocationKind: z.literal("http_service"),
  profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
  stackPackId: z.literal("node-express-api"),
  launcher: z.object({
    launcherRef: z.literal(NODE_EXPRESS_API_LAUNCHER_REF_V2),
    moduleLocator: z.literal(
      NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
    ),
    sourceModuleLocator: z.literal(
      NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
    ),
    requiredExport: z.literal(NODE_EXPRESS_API_LAUNCHER_EXPORT_V2),
    abiRef: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2),
    abiHash: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2),
    socketLifecycleAbiHash: z.literal(
      EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    ),
  }).strict(),
  checkAuthority: z.object({
    schema: z.literal(INVOCATION_EVIDENCE_CHECK_V2_SCHEMA),
    version: z.literal(INVOCATION_EVIDENCE_CHECK_V2_VERSION),
    contractHash: z.literal(
      INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
    ),
    predicateKinds: z.tuple([
      z.literal("action_invocation"),
      z.literal("observable_outcome"),
    ]),
    checkRefs: z.tuple([
      z.literal("CHECK_ACTION_INVOCATION"),
      z.literal("CHECK_OBSERVABLE_OUTCOME"),
    ]),
    issuer: z.literal(
      "fresh_verified_candidate_source_closure_only",
    ),
    callerExpectedValue: z.literal("forbidden"),
  }).strict(),
  transportAuthority: z.object({
    schema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
    kind: z.literal("http_request"),
    executableBinding: z.literal(
      "verified_platform_release_derived_only",
    ),
    launchTarget: z.literal(
      "fresh_candidate_runtime_bundle_derived_only",
    ),
  }).strict(),
  evaluator: z.object({
    moduleLocator: z.literal(
      INVOCATION_EVIDENCE_EVALUATOR_MODULE_LOCATOR_V2,
    ),
    sourceModuleLocator: z.literal(
      INVOCATION_EVIDENCE_EVALUATOR_SOURCE_MODULE_LOCATOR_V2,
    ),
    requiredExport: z.literal(
      INVOCATION_EVIDENCE_EVALUATOR_EXPORT_V2,
    ),
    classifier: z.literal(
      "typed_decoder_enum_and_exact_product_semantics_only",
    ),
    proseClassifier: z.literal("forbidden"),
  }).strict(),
  receipt: z.object({
    schema: z.literal(EVIDENCE_RECEIPT_V2_SCHEMA),
    abiPolicyHash: z.literal(evidenceReceiptAbiPolicyHashV2()),
    redactionPolicyHash: z.literal(
      evidenceCaptureRedactionPolicyHashV2(),
    ),
  }).strict(),
  servicePolicy: z.object({
    requestTimeoutMs: z.literal(EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2),
    responseByteLimit: z.literal(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2),
    maxCaptureBytes: z.literal(EVIDENCE_CAPTURE_V2_MAX_BYTES),
    requestCount: z.literal(1),
    redirectPolicy: z.literal("error"),
    originPolicy: z.literal("exact_loopback_origin"),
    lifecycle: z.literal(
      "exclusive_held_socket_readiness_one_request_cleanup_and_rebind",
    ),
  }).strict(),
  sourceFencePolicy: z.literal(
    "fresh_candidate_source_runtime_bundle_and_launch_target_before_after",
  ),
  executionLeasePolicy: z.literal(
    "one_use_candidate_socket_and_current_activation_generation_bound",
  ),
  releaseRevalidation: z.literal(
    "before_socket_handoff_and_in_atomic_publication_compare_and_set",
  ),
  publicationPolicy: z.literal(
    "bounded_redacted_captures_and_receipt_one_atomic_cas_batch",
  ),
  resultAuthority: z.literal(
    "durable_evidence_receipt_only_never_launcher_or_agent_claim",
  ),
  productionAdmission: z.literal(
    "current_activated_platform_release_registry_adapter_and_candidate_execution_lease_required",
  ),
  schemaOnlyAdmission: z.literal(
    "forbidden_until_real_runner_export_and_verified_release_join",
  ),
}).strict();

export type EvidenceHttpServiceRunnerAbiPolicyHashPayloadV2 = z.infer<
  typeof EvidenceHttpServiceRunnerAbiIdentityV2Schema
>;

export function hashEvidenceHttpServiceRunnerAbiPolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.abiHash;
  return hashCanonicalJson({
    schema: "setfarm.evidence-http-service-runner-abi-policy-hash.v2",
    policy: payload,
  });
}

export const EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2 =
  hashEvidenceHttpServiceRunnerAbiPolicyV2(
    EVIDENCE_HTTP_SERVICE_RUNNER_ABI_IDENTITY_V2,
  );

export const EvidenceHttpServiceRunnerAbiPolicyV2Schema =
  EvidenceHttpServiceRunnerAbiIdentityV2Schema.extend({
    abiHash: z.literal(EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2),
  }).strict().superRefine((value, context) => {
    if (
      value.abiHash !== hashEvidenceHttpServiceRunnerAbiPolicyV2(value)
      || JSON.stringify(value) !== JSON.stringify({
        ...EVIDENCE_HTTP_SERVICE_RUNNER_ABI_IDENTITY_V2,
        abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "HTTP evidence runner ABI must equal exact code-owned policy",
      });
    }
  });

export type EvidenceHttpServiceRunnerAbiPolicyV2 = z.infer<
  typeof EvidenceHttpServiceRunnerAbiPolicyV2Schema
>;

const EVIDENCE_HTTP_SERVICE_RUNNER_ABI_V2 =
  deepFreezePlatformReleaseJsonV2(
    EvidenceHttpServiceRunnerAbiPolicyV2Schema.parse({
      ...EVIDENCE_HTTP_SERVICE_RUNNER_ABI_IDENTITY_V2,
      abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
    }),
  );

export function getEvidenceHttpServiceRunnerAbiPolicyV2():
  EvidenceHttpServiceRunnerAbiPolicyV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(EVIDENCE_HTTP_SERVICE_RUNNER_ABI_V2),
  );
}
