import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  EvidenceIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "../../execution/schemas/execution-attempt-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
  platformReleaseUtf8TextV2,
} from "../../execution/schemas/platform-release-common-v2.js";

export const EVIDENCE_CAPTURE_REF_V2_SCHEMA =
  "setfarm.evidence-capture-ref.v2" as const;
export const EVIDENCE_OUTCOME_V2_SCHEMA =
  "setfarm.evidence-outcome.v2" as const;
export const EVIDENCE_RECEIPT_V2_SCHEMA =
  "setfarm.evidence-receipt.v2" as const;
export const EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA =
  "setfarm.evidence-receipt-abi-policy.v2" as const;
export const EVIDENCE_CAPTURE_REDACTION_POLICY_V2_SCHEMA =
  "setfarm.evidence-capture-redaction-policy.v2" as const;
export const EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2 =
  "REDACT_EVIDENCE_CAPTURE_V2" as const;
export const EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES = 256 * 1024;
export const EVIDENCE_CAPTURE_V2_MAX_BYTES = 16 * 1024 * 1024;
export const EVIDENCE_RECEIPT_V2_MAX_CAPTURES = 32;
export const EVIDENCE_RECEIPT_V2_MAX_DURATION_MS = 86_400_000;
export const EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2 = 30_000;
export const EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2 = 4 * 1024 * 1024;
export const EVIDENCE_RECEIPT_SCHEMA_REVISION_V2 = "2.0.0-r1" as const;
export const EVIDENCE_PROCESS_SIGNAL_NAMES_V2 = Object.freeze([
  "SIGABRT",
  "SIGALRM",
  "SIGBREAK",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINFO",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGLOST",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
] as const);

const ExactEvidenceProcessSignalCatalogV2Schema = z.array(
  z.enum(EVIDENCE_PROCESS_SIGNAL_NAMES_V2),
).length(EVIDENCE_PROCESS_SIGNAL_NAMES_V2.length).superRefine((value, context) => {
  if (value.some((signal, index) => signal !== EVIDENCE_PROCESS_SIGNAL_NAMES_V2[index])) {
    context.addIssue({
      code: "custom",
      message: "Evidence process signal catalog must equal exact code-owned order",
    });
  }
});

const EvidenceReceiptAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  receiptSchema: z.literal(EVIDENCE_RECEIPT_V2_SCHEMA),
  outcomeSchema: z.literal(EVIDENCE_OUTCOME_V2_SCHEMA),
  captureSchema: z.literal(EVIDENCE_CAPTURE_REF_V2_SCHEMA),
  maxCanonicalBytes: z.literal(EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES),
  maxCaptureBytes: z.literal(EVIDENCE_CAPTURE_V2_MAX_BYTES),
  maxCaptures: z.literal(EVIDENCE_RECEIPT_V2_MAX_CAPTURES),
  maxDurationMs: z.literal(EVIDENCE_RECEIPT_V2_MAX_DURATION_MS),
  schemaRevision: z.literal(EVIDENCE_RECEIPT_SCHEMA_REVISION_V2),
  httpRequestTimeoutMs: z.literal(EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2),
  httpResponseMaxBytes: z.literal(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2),
  checkKinds: z.tuple([
    z.literal("cli_process"),
    z.literal("command"),
    z.literal("http_service"),
  ]),
  outcomeOwnership: z.tuple([
    z.object({ status: z.literal("cancelled"), verdict: z.literal("inconclusive"), owner: z.literal("operator"), code: z.literal("EVIDENCE_EXECUTION_CANCELLED") }).strict(),
    z.object({ status: z.literal("external_dependency_failed"), verdict: z.literal("inconclusive"), owner: z.literal("external_dependency"), code: z.literal("EVIDENCE_EXTERNAL_DEPENDENCY_UNAVAILABLE") }).strict(),
    z.object({ status: z.literal("infrastructure_failed"), verdict: z.literal("inconclusive"), owner: z.literal("infrastructure"), code: z.literal("EVIDENCE_INFRASTRUCTURE_UNAVAILABLE") }).strict(),
    z.object({ status: z.literal("passed"), verdict: z.literal("pass"), owner: z.literal("none"), code: z.literal("EVIDENCE_CHECK_PASSED") }).strict(),
    z.object({ status: z.literal("platform_rejected"), verdict: z.literal("inconclusive"), owner: z.literal("platform_release"), code: z.literal("EVIDENCE_PLATFORM_AUTHORITY_REJECTED") }).strict(),
    z.object({ status: z.literal("product_failed"), verdict: z.literal("fail"), owner: z.literal("generated_product"), code: z.literal("EVIDENCE_PRODUCT_OBSERVATION_MISMATCH") }).strict(),
    z.object({ status: z.literal("source_rejected"), verdict: z.literal("fail"), owner: z.literal("generated_source"), code: z.literal("EVIDENCE_SOURCE_AUTHORITY_CHANGED") }).strict(),
  ]),
  lifecycleKinds: z.tuple([
    z.literal("cli_process"),
    z.literal("command_process"),
    z.literal("http_service"),
    z.literal("not_started"),
  ]),
  processTerminationKinds: z.tuple([
    z.literal("normal_exit"),
    z.literal("platform_terminated"),
    z.literal("process_lost"),
    z.literal("signal_exit"),
  ]),
  processSignalNames: ExactEvidenceProcessSignalCatalogV2Schema,
  runtimeSignalFallback: z.literal("typed_non_catalog_name_or_number_variants"),
  httpStartupKinds: z.tuple([
    z.literal("ready"),
    z.literal("readiness_failed"),
    z.literal("start_failed"),
  ]),
  httpRequestKinds: z.tuple([
    z.literal("attempted"),
    z.literal("not_attempted"),
  ]),
  httpConnectionErrorCodes: z.tuple([
    z.literal("ECONNREFUSED"),
    z.literal("ECONNRESET"),
    z.literal("EPIPE"),
  ]),
  httpObservationKinds: z.tuple([
    z.literal("connection_error"),
    z.literal("redirect_rejected"),
    z.literal("response"),
    z.literal("response_limit_exceeded"),
    z.literal("timeout"),
  ]),
  timestampEncoding: z.literal("utc_millisecond_exact"),
  invocationResponseBinding: z.literal("exact_outcome_hash"),
  captureClosure: z.literal("every_and_only_canonical_envelope_hashes"),
  mutableLocatorPolicy: z.literal("forbidden"),
  diagnosticProsePolicy: z.literal("forbidden_use_redacted_capture"),
  sourceDriftPolicy: z.literal("source_rejected_only"),
  httpPolicy: z.literal("exact_loopback_redirect_error_pass_2xx"),
  processPassPolicy: z.literal("normal_exit_required"),
  shapeSignatures: z.tuple([
    z.literal("receipt:schema,version,authorityState,productionUse,release,product,candidate,execution,sourceBefore,sourceAfter,startedAt,finishedAt,durationMs,invocationRequestHash,invocationResponseHash,lifecycle,outcome,captures,receiptHash"),
    z.literal("release:activationAcknowledgementHash,platformReleaseManifestHash,runtimePayloadHash,externalResolutionHash,environmentCapsuleHash,toolchainHash,launcherDefinitionHash,launcherModuleHash,runnerDefinitionHash,runnerModuleHash,receiptSchemaHash,adapterDefinitionHash,adapterCatalogHash"),
    z.literal("product:packetHash,buildTopologyHash,profileCatalogHash,profileId,profileHash,stackPackHash,transportContractHash,executableTransportBindingHash"),
    z.literal("candidate:buildReceiptHash,runtimeBundleHash,launchTargetHash"),
    z.literal("execution:runId,attemptId,storyId,sliceHash,predicateRef"),
    z.literal("sourceRevision:sha,treeHash"),
    z.literal("capture:schema,artifactEnvelopeHash,contentHash,byteLength,mediaType,encoding,redaction"),
    z.literal("capture.redaction:policyRef,policyHash,secretsRemoved,mutableLocatorStored"),
    z.literal("outcome:schema,version,checkKind,status,verdict,failureOwner,code,observedValueHash?,captureEnvelopeHashes,outcomeHash"),
    z.literal("lifecycle.process:kind,processIdentityHash,termination,lifecycleReceiptHash"),
    z.literal("process.normal_exit:status,exitCode"),
    z.literal("process.signal_exit:status,signal,coreDumped,observationReceiptHash"),
    z.literal("process.signal.known_posix:kind,name"),
    z.literal("process.signal.runtime_reported_name:kind,name"),
    z.literal("process.signal.runtime_reported_number:kind,signalNumber"),
    z.literal("process.platform_terminated:status,signal,terminationReceiptHash"),
    z.literal("process.process_lost:status,observationReceiptHash"),
    z.literal("lifecycle.http:kind,serviceIdentityHash,startup,request,cleanupReceiptHash,lifecycleReceiptHash"),
    z.literal("http.ready:status,privateListenerLeaseHash,readinessReceiptHash"),
    z.literal("http.start_failed:status,privateListenerLeaseHash,startFailureReceiptHash"),
    z.literal("http.readiness_failed:status,privateListenerLeaseHash,readinessFailureReceiptHash"),
    z.literal("http.not_attempted:status,requestCount"),
    z.literal("http.attempted:status,requestCount,redirectPolicy,originPolicy,timeoutMs,responseByteLimit,observation"),
    z.literal("http.response:status,httpStatus,bodyByteLength"),
    z.literal("http.timeout:status,timeoutMs,observationReceiptHash"),
    z.literal("http.connection_error:status,errorCode,observationReceiptHash"),
    z.literal("http.redirect_rejected:status,locationHash,observationReceiptHash"),
    z.literal("http.response_limit_exceeded:status,responseByteLimit,observedByteLength,observationReceiptHash"),
    z.literal("lifecycle.not_started:kind,intendedCheckKind,reasonOwner,lifecycleReceiptHash"),
  ]),
  crossFieldRelations: z.tuple([
    z.literal("receipt_schema_hash_equals_exact_abi_policy_hash"),
    z.literal("outcome_status_maps_exact_verdict_owner_and_code"),
    z.literal("completed_product_outcome_requires_observed_value_hash"),
    z.literal("outcome_hash_binds_exact_typed_outcome"),
    z.literal("duration_equals_exact_utc_interval"),
    z.literal("timestamps_round_trip_exact_utc_milliseconds"),
    z.literal("source_drift_requires_source_rejected"),
    z.literal("invocation_response_equals_outcome_hash"),
    z.literal("lifecycle_kind_equals_check_kind_or_typed_not_started"),
    z.literal("not_started_owner_equals_outcome_owner"),
    z.literal("http_nonready_startup_forbids_request_attempt"),
    z.literal("http_start_and_readiness_failures_bind_private_lease"),
    z.literal("http_timeout_equals_code_owned_request_timeout"),
    z.literal("http_pass_requires_one_bounded_2xx_response"),
    z.literal("http_ready_product_failure_requires_typed_observation"),
    z.literal("process_pass_requires_normal_exit"),
    z.literal("known_signal_names_require_known_posix_variant"),
    z.literal("capture_redaction_equals_code_owned_policy"),
    z.literal("captures_are_unique_and_canonically_sorted"),
    z.literal("captures_equal_every_and_only_outcome_envelope_hashes"),
    z.literal("receipt_hash_binds_exact_candidate_payload"),
  ]),
}).strict();

export const EvidenceReceiptAbiPolicyCandidateV2Schema =
  EvidenceReceiptAbiPolicyIdentityV2Schema.extend({
    policyHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { policyHash: _policyHash, ...identity } = value;
    const expected = hashCanonicalJson({
      schema: "setfarm.evidence-receipt-abi-policy-payload.v2",
      policy: identity,
    });
    if (value.policyHash !== expected) {
      context.addIssue({
        code: "custom",
        path: ["policyHash"],
        message: "Evidence receipt ABI policy hash mismatch",
      });
    }
  });

export type EvidenceReceiptAbiPolicyCandidateV2 = z.infer<
  typeof EvidenceReceiptAbiPolicyCandidateV2Schema
>;

const EVIDENCE_RECEIPT_ABI_POLICY_IDENTITY_V2 = {
  schema: EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  receiptSchema: EVIDENCE_RECEIPT_V2_SCHEMA,
  outcomeSchema: EVIDENCE_OUTCOME_V2_SCHEMA,
  captureSchema: EVIDENCE_CAPTURE_REF_V2_SCHEMA,
  maxCanonicalBytes: EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES,
  maxCaptureBytes: EVIDENCE_CAPTURE_V2_MAX_BYTES,
  maxCaptures: EVIDENCE_RECEIPT_V2_MAX_CAPTURES,
  maxDurationMs: EVIDENCE_RECEIPT_V2_MAX_DURATION_MS,
  schemaRevision: EVIDENCE_RECEIPT_SCHEMA_REVISION_V2,
  httpRequestTimeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
  httpResponseMaxBytes: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
  checkKinds: ["cli_process", "command", "http_service"],
  outcomeOwnership: [
    { status: "cancelled", verdict: "inconclusive", owner: "operator", code: "EVIDENCE_EXECUTION_CANCELLED" },
    { status: "external_dependency_failed", verdict: "inconclusive", owner: "external_dependency", code: "EVIDENCE_EXTERNAL_DEPENDENCY_UNAVAILABLE" },
    { status: "infrastructure_failed", verdict: "inconclusive", owner: "infrastructure", code: "EVIDENCE_INFRASTRUCTURE_UNAVAILABLE" },
    { status: "passed", verdict: "pass", owner: "none", code: "EVIDENCE_CHECK_PASSED" },
    { status: "platform_rejected", verdict: "inconclusive", owner: "platform_release", code: "EVIDENCE_PLATFORM_AUTHORITY_REJECTED" },
    { status: "product_failed", verdict: "fail", owner: "generated_product", code: "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH" },
    { status: "source_rejected", verdict: "fail", owner: "generated_source", code: "EVIDENCE_SOURCE_AUTHORITY_CHANGED" },
  ],
  lifecycleKinds: ["cli_process", "command_process", "http_service", "not_started"],
  processTerminationKinds: [
    "normal_exit",
    "platform_terminated",
    "process_lost",
    "signal_exit",
  ],
  processSignalNames: [...EVIDENCE_PROCESS_SIGNAL_NAMES_V2],
  runtimeSignalFallback: "typed_non_catalog_name_or_number_variants",
  httpStartupKinds: ["ready", "readiness_failed", "start_failed"],
  httpRequestKinds: ["attempted", "not_attempted"],
  httpConnectionErrorCodes: ["ECONNREFUSED", "ECONNRESET", "EPIPE"],
  httpObservationKinds: [
    "connection_error",
    "redirect_rejected",
    "response",
    "response_limit_exceeded",
    "timeout",
  ],
  timestampEncoding: "utc_millisecond_exact",
  invocationResponseBinding: "exact_outcome_hash",
  captureClosure: "every_and_only_canonical_envelope_hashes",
  mutableLocatorPolicy: "forbidden",
  diagnosticProsePolicy: "forbidden_use_redacted_capture",
  sourceDriftPolicy: "source_rejected_only",
  httpPolicy: "exact_loopback_redirect_error_pass_2xx",
  processPassPolicy: "normal_exit_required",
  shapeSignatures: [
    "receipt:schema,version,authorityState,productionUse,release,product,candidate,execution,sourceBefore,sourceAfter,startedAt,finishedAt,durationMs,invocationRequestHash,invocationResponseHash,lifecycle,outcome,captures,receiptHash",
    "release:activationAcknowledgementHash,platformReleaseManifestHash,runtimePayloadHash,externalResolutionHash,environmentCapsuleHash,toolchainHash,launcherDefinitionHash,launcherModuleHash,runnerDefinitionHash,runnerModuleHash,receiptSchemaHash,adapterDefinitionHash,adapterCatalogHash",
    "product:packetHash,buildTopologyHash,profileCatalogHash,profileId,profileHash,stackPackHash,transportContractHash,executableTransportBindingHash",
    "candidate:buildReceiptHash,runtimeBundleHash,launchTargetHash",
    "execution:runId,attemptId,storyId,sliceHash,predicateRef",
    "sourceRevision:sha,treeHash",
    "capture:schema,artifactEnvelopeHash,contentHash,byteLength,mediaType,encoding,redaction",
    "capture.redaction:policyRef,policyHash,secretsRemoved,mutableLocatorStored",
    "outcome:schema,version,checkKind,status,verdict,failureOwner,code,observedValueHash?,captureEnvelopeHashes,outcomeHash",
    "lifecycle.process:kind,processIdentityHash,termination,lifecycleReceiptHash",
    "process.normal_exit:status,exitCode",
    "process.signal_exit:status,signal,coreDumped,observationReceiptHash",
    "process.signal.known_posix:kind,name",
    "process.signal.runtime_reported_name:kind,name",
    "process.signal.runtime_reported_number:kind,signalNumber",
    "process.platform_terminated:status,signal,terminationReceiptHash",
    "process.process_lost:status,observationReceiptHash",
    "lifecycle.http:kind,serviceIdentityHash,startup,request,cleanupReceiptHash,lifecycleReceiptHash",
    "http.ready:status,privateListenerLeaseHash,readinessReceiptHash",
    "http.start_failed:status,privateListenerLeaseHash,startFailureReceiptHash",
    "http.readiness_failed:status,privateListenerLeaseHash,readinessFailureReceiptHash",
    "http.not_attempted:status,requestCount",
    "http.attempted:status,requestCount,redirectPolicy,originPolicy,timeoutMs,responseByteLimit,observation",
    "http.response:status,httpStatus,bodyByteLength",
    "http.timeout:status,timeoutMs,observationReceiptHash",
    "http.connection_error:status,errorCode,observationReceiptHash",
    "http.redirect_rejected:status,locationHash,observationReceiptHash",
    "http.response_limit_exceeded:status,responseByteLimit,observedByteLength,observationReceiptHash",
    "lifecycle.not_started:kind,intendedCheckKind,reasonOwner,lifecycleReceiptHash",
  ],
  crossFieldRelations: [
    "receipt_schema_hash_equals_exact_abi_policy_hash",
    "outcome_status_maps_exact_verdict_owner_and_code",
    "completed_product_outcome_requires_observed_value_hash",
    "outcome_hash_binds_exact_typed_outcome",
    "duration_equals_exact_utc_interval",
    "timestamps_round_trip_exact_utc_milliseconds",
    "source_drift_requires_source_rejected",
    "invocation_response_equals_outcome_hash",
    "lifecycle_kind_equals_check_kind_or_typed_not_started",
    "not_started_owner_equals_outcome_owner",
    "http_nonready_startup_forbids_request_attempt",
    "http_start_and_readiness_failures_bind_private_lease",
    "http_timeout_equals_code_owned_request_timeout",
    "http_pass_requires_one_bounded_2xx_response",
    "http_ready_product_failure_requires_typed_observation",
    "process_pass_requires_normal_exit",
    "known_signal_names_require_known_posix_variant",
    "capture_redaction_equals_code_owned_policy",
    "captures_are_unique_and_canonically_sorted",
    "captures_equal_every_and_only_outcome_envelope_hashes",
    "receipt_hash_binds_exact_candidate_payload",
  ],
} as const;

const EVIDENCE_RECEIPT_ABI_POLICY_V2 = deepFreezePlatformReleaseJsonV2(
  EvidenceReceiptAbiPolicyCandidateV2Schema.parse({
    ...EVIDENCE_RECEIPT_ABI_POLICY_IDENTITY_V2,
    policyHash: hashCanonicalJson({
      schema: "setfarm.evidence-receipt-abi-policy-payload.v2",
      policy: EVIDENCE_RECEIPT_ABI_POLICY_IDENTITY_V2,
    }),
  }),
);

export function getEvidenceReceiptAbiPolicyV2(): EvidenceReceiptAbiPolicyCandidateV2 {
  return deepFreezePlatformReleaseJsonV2(structuredClone(EVIDENCE_RECEIPT_ABI_POLICY_V2));
}

export function evidenceReceiptAbiPolicyHashV2(): string {
  return EVIDENCE_RECEIPT_ABI_POLICY_V2.policyHash;
}

const EvidenceCaptureRedactionPolicyIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_CAPTURE_REDACTION_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  policyRef: z.literal(EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2),
  forbiddenHeaderNames: z.tuple([
    z.literal("authorization"),
    z.literal("cookie"),
    z.literal("proxy-authorization"),
    z.literal("set-cookie"),
    z.literal("x-api-key"),
  ]),
  secretValuePolicy: z.literal("remove_exact_secret_authority_values"),
  unknownCredentialPolicy: z.literal("reject_capture"),
  mutableLocatorPolicy: z.literal("forbidden"),
  maxCaptureBytes: z.literal(EVIDENCE_CAPTURE_V2_MAX_BYTES),
}).strict();

export const EvidenceCaptureRedactionPolicyV2Schema =
  EvidenceCaptureRedactionPolicyIdentityV2Schema.extend({
    policyHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { policyHash: _policyHash, ...identity } = value;
    const expected = hashCanonicalJson({
      schema: "setfarm.evidence-capture-redaction-policy-payload.v2",
      policy: identity,
    });
    if (value.policyHash !== expected) {
      context.addIssue({
        code: "custom",
        path: ["policyHash"],
        message: "Evidence capture redaction policy hash mismatch",
      });
    }
  });

export type EvidenceCaptureRedactionPolicyV2 = z.infer<
  typeof EvidenceCaptureRedactionPolicyV2Schema
>;

const EVIDENCE_CAPTURE_REDACTION_POLICY_IDENTITY_V2 = {
  schema: EVIDENCE_CAPTURE_REDACTION_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  policyRef: EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
  forbiddenHeaderNames: [
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
  ],
  secretValuePolicy: "remove_exact_secret_authority_values",
  unknownCredentialPolicy: "reject_capture",
  mutableLocatorPolicy: "forbidden",
  maxCaptureBytes: EVIDENCE_CAPTURE_V2_MAX_BYTES,
} as const;

const EVIDENCE_CAPTURE_REDACTION_POLICY_V2 = deepFreezePlatformReleaseJsonV2(
  EvidenceCaptureRedactionPolicyV2Schema.parse({
    ...EVIDENCE_CAPTURE_REDACTION_POLICY_IDENTITY_V2,
    policyHash: hashCanonicalJson({
      schema: "setfarm.evidence-capture-redaction-policy-payload.v2",
      policy: EVIDENCE_CAPTURE_REDACTION_POLICY_IDENTITY_V2,
    }),
  }),
);

export function getEvidenceCaptureRedactionPolicyV2(): EvidenceCaptureRedactionPolicyV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(EVIDENCE_CAPTURE_REDACTION_POLICY_V2),
  );
}

export function evidenceCaptureRedactionPolicyHashV2(): string {
  return EVIDENCE_CAPTURE_REDACTION_POLICY_V2.policyHash;
}

const RunIdentityV2Schema = platformReleaseUtf8TextV2(1, 500);
const AttemptIdentityV2Schema = z.string()
  .min(20)
  .max(180)
  .regex(/^ATT_[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/u);
const ExactUtcMillisecondTimestampV2Schema = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "Expected one exact UTC millisecond timestamp",
  )
  .refine((value) => {
    const milliseconds = Date.parse(value);
    return !Number.isNaN(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  }, {
    message: "Expected a valid, round-tripping UTC timestamp",
  });

const CaptureMediaTypeV2Schema = z.enum([
  "application/json",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "text/html",
  "text/plain",
]);

export const EvidenceCaptureRefV2Schema = z.object({
  schema: z.literal(EVIDENCE_CAPTURE_REF_V2_SCHEMA),
  artifactEnvelopeHash: Sha256Schema,
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative().max(EVIDENCE_CAPTURE_V2_MAX_BYTES),
  mediaType: CaptureMediaTypeV2Schema,
  encoding: z.literal("identity"),
  redaction: z.object({
    policyRef: z.literal(EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2),
    policyHash: Sha256Schema.refine(
      (value) => value === EVIDENCE_CAPTURE_REDACTION_POLICY_V2.policyHash,
      "Capture redaction policy must equal the code-owned V2 policy",
    ),
    secretsRemoved: z.literal(true),
    mutableLocatorStored: z.literal(false),
  }).strict(),
}).strict();

export type EvidenceCaptureRefV2 = z.infer<typeof EvidenceCaptureRefV2Schema>;

const EvidenceCheckKindV2Schema = z.enum([
  "command",
  "cli_process",
  "http_service",
]);

const EvidenceOutcomeCommonV2Shape = {
  schema: z.literal(EVIDENCE_OUTCOME_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  checkKind: EvidenceCheckKindV2Schema,
  observedValueHash: Sha256Schema.optional(),
  captureEnvelopeHashes: z.array(Sha256Schema)
    .min(1)
    .max(EVIDENCE_RECEIPT_V2_MAX_CAPTURES)
    .refine(hasUniqueStrings, {
      message: "Outcome capture envelope hashes must be unique",
    })
    .refine((values) => values.every((value, index) => index === 0 || values[index - 1]! < value), {
      message: "Outcome capture envelope hashes must be canonically sorted",
    }),
};

const PassedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("passed"),
  verdict: z.literal("pass"),
  failureOwner: z.literal("none"),
  code: z.literal("EVIDENCE_CHECK_PASSED"),
}).strict();

const ProductFailedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("product_failed"),
  verdict: z.literal("fail"),
  failureOwner: z.literal("generated_product"),
  code: z.literal("EVIDENCE_PRODUCT_OBSERVATION_MISMATCH"),
}).strict();

const SourceRejectedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("source_rejected"),
  verdict: z.literal("fail"),
  failureOwner: z.literal("generated_source"),
  code: z.literal("EVIDENCE_SOURCE_AUTHORITY_CHANGED"),
}).strict();

const PlatformRejectedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("platform_rejected"),
  verdict: z.literal("inconclusive"),
  failureOwner: z.literal("platform_release"),
  code: z.literal("EVIDENCE_PLATFORM_AUTHORITY_REJECTED"),
}).strict();

const InfrastructureFailedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("infrastructure_failed"),
  verdict: z.literal("inconclusive"),
  failureOwner: z.literal("infrastructure"),
  code: z.literal("EVIDENCE_INFRASTRUCTURE_UNAVAILABLE"),
}).strict();

const ExternalDependencyFailedEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("external_dependency_failed"),
  verdict: z.literal("inconclusive"),
  failureOwner: z.literal("external_dependency"),
  code: z.literal("EVIDENCE_EXTERNAL_DEPENDENCY_UNAVAILABLE"),
}).strict();

const CancelledEvidenceOutcomeV2Schema = z.object({
  ...EvidenceOutcomeCommonV2Shape,
  status: z.literal("cancelled"),
  verdict: z.literal("inconclusive"),
  failureOwner: z.literal("operator"),
  code: z.literal("EVIDENCE_EXECUTION_CANCELLED"),
}).strict();

const EvidenceOutcomeIdentityV2Schema = z.discriminatedUnion("status", [
  PassedEvidenceOutcomeV2Schema,
  ProductFailedEvidenceOutcomeV2Schema,
  SourceRejectedEvidenceOutcomeV2Schema,
  PlatformRejectedEvidenceOutcomeV2Schema,
  InfrastructureFailedEvidenceOutcomeV2Schema,
  ExternalDependencyFailedEvidenceOutcomeV2Schema,
  CancelledEvidenceOutcomeV2Schema,
]).superRefine((value, context) => {
  if (
    (value.status === "passed" || value.status === "product_failed")
    && value.observedValueHash === undefined
  ) {
    context.addIssue({
      code: "custom",
      path: ["observedValueHash"],
      message: "A completed product check must bind its exact observed value",
    });
  }
});

export function hashEvidenceOutcomeV2(
  value: z.input<typeof EvidenceOutcomeIdentityV2Schema>
    | (z.input<typeof EvidenceOutcomeIdentityV2Schema> & Readonly<{ outcomeHash: string }>),
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.outcomeHash;
  return hashCanonicalJson({
    schema: "setfarm.evidence-outcome-payload.v2",
    outcome: EvidenceOutcomeIdentityV2Schema.parse(candidate),
  });
}

export const EvidenceOutcomeCandidateV2Schema = z.object({
  schema: z.literal(EVIDENCE_OUTCOME_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  checkKind: EvidenceCheckKindV2Schema,
  status: z.enum([
    "passed",
    "product_failed",
    "source_rejected",
    "platform_rejected",
    "infrastructure_failed",
    "external_dependency_failed",
    "cancelled",
  ]),
  verdict: z.enum(["pass", "fail", "inconclusive"]),
  failureOwner: z.enum([
    "none",
    "generated_product",
    "generated_source",
    "platform_release",
    "infrastructure",
    "external_dependency",
    "operator",
  ]),
  code: z.enum([
    "EVIDENCE_CHECK_PASSED",
    "EVIDENCE_EXECUTION_CANCELLED",
    "EVIDENCE_EXTERNAL_DEPENDENCY_UNAVAILABLE",
    "EVIDENCE_INFRASTRUCTURE_UNAVAILABLE",
    "EVIDENCE_PLATFORM_AUTHORITY_REJECTED",
    "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH",
    "EVIDENCE_SOURCE_AUTHORITY_CHANGED",
  ]),
  observedValueHash: Sha256Schema.optional(),
  captureEnvelopeHashes: z.array(Sha256Schema)
    .min(1)
    .max(EVIDENCE_RECEIPT_V2_MAX_CAPTURES),
  outcomeHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { outcomeHash: _outcomeHash, ...identity } = value;
  const parsed = EvidenceOutcomeIdentityV2Schema.safeParse(identity);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
    return;
  }
  if (value.outcomeHash !== hashEvidenceOutcomeV2(parsed.data)) {
    context.addIssue({
      code: "custom",
      path: ["outcomeHash"],
      message: "Evidence outcome hash must bind the exact typed outcome",
    });
  }
});

export type EvidenceOutcomeCandidateV2 = z.infer<
  typeof EvidenceOutcomeCandidateV2Schema
>;

export function createEvidenceOutcomeCandidateV2(
  input: z.input<typeof EvidenceOutcomeIdentityV2Schema>,
): EvidenceOutcomeCandidateV2 {
  const outcome = EvidenceOutcomeIdentityV2Schema.parse(input);
  return deepFreezePlatformReleaseJsonV2(EvidenceOutcomeCandidateV2Schema.parse({
    ...outcome,
    outcomeHash: hashEvidenceOutcomeV2(outcome),
  }));
}

const ProcessTerminationV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("normal_exit"),
    exitCode: z.number().int().min(0).max(255),
  }).strict(),
  z.object({
    status: z.literal("signal_exit"),
    signal: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("known_posix"),
        name: z.enum(EVIDENCE_PROCESS_SIGNAL_NAMES_V2),
      }).strict(),
      z.object({
        kind: z.literal("runtime_reported_name"),
        name: z.string()
          .min(4)
          .max(64)
          .regex(/^SIG[A-Z0-9]+(?:\+[0-9]+)?$/u)
          .refine(
            (value) => !(EVIDENCE_PROCESS_SIGNAL_NAMES_V2 as readonly string[]).includes(value),
            "Known signals must use the canonical known_posix variant",
          ),
      }).strict(),
      z.object({
        kind: z.literal("runtime_reported_number"),
        signalNumber: z.number().int().positive().max(255),
      }).strict(),
    ]),
    coreDumped: z.boolean(),
    observationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("platform_terminated"),
    signal: z.enum(["SIGKILL", "SIGTERM"]),
    terminationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("process_lost"),
    observationReceiptHash: Sha256Schema,
  }).strict(),
]);

const ProcessLifecycleBindingV2Schema = z.object({
  kind: z.enum(["command_process", "cli_process"]),
  processIdentityHash: Sha256Schema,
  termination: ProcessTerminationV2Schema,
  lifecycleReceiptHash: Sha256Schema,
}).strict();

const HttpObservationV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("response"),
    httpStatus: z.number().int().min(100).max(599),
    bodyByteLength: z.number().int().nonnegative().max(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2),
  }).strict(),
  z.object({
    status: z.literal("timeout"),
    timeoutMs: z.literal(EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2),
    observationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("connection_error"),
    errorCode: z.enum(["ECONNREFUSED", "ECONNRESET", "EPIPE"]),
    observationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("redirect_rejected"),
    locationHash: Sha256Schema,
    observationReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("response_limit_exceeded"),
    responseByteLimit: z.literal(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2),
    observedByteLength: z.literal(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2 + 1),
    observationReceiptHash: Sha256Schema,
  }).strict(),
]);

const HttpServiceStartupV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    privateListenerLeaseHash: Sha256Schema,
    readinessReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("start_failed"),
    privateListenerLeaseHash: Sha256Schema,
    startFailureReceiptHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("readiness_failed"),
    privateListenerLeaseHash: Sha256Schema,
    readinessFailureReceiptHash: Sha256Schema,
  }).strict(),
]);

const HttpRequestLifecycleV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("not_attempted"),
    requestCount: z.literal(0),
  }).strict(),
  z.object({
    status: z.literal("attempted"),
    requestCount: z.literal(1),
    redirectPolicy: z.literal("error"),
    originPolicy: z.literal("exact_loopback_origin"),
    timeoutMs: z.literal(EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2),
    responseByteLimit: z.literal(EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2),
    observation: HttpObservationV2Schema,
  }).strict(),
]);

const HttpServiceLifecycleBindingV2Schema = z.object({
  kind: z.literal("http_service"),
  serviceIdentityHash: Sha256Schema,
  startup: HttpServiceStartupV2Schema,
  request: HttpRequestLifecycleV2Schema,
  cleanupReceiptHash: Sha256Schema,
  lifecycleReceiptHash: Sha256Schema,
}).strict();

const NotStartedLifecycleBindingV2Schema = z.object({
  kind: z.literal("not_started"),
  intendedCheckKind: EvidenceCheckKindV2Schema,
  reasonOwner: z.enum([
    "generated_source",
    "platform_release",
    "infrastructure",
    "external_dependency",
    "operator",
  ]),
  lifecycleReceiptHash: Sha256Schema,
}).strict();

export const EvidenceLifecycleBindingV2Schema = z.discriminatedUnion("kind", [
  ProcessLifecycleBindingV2Schema,
  HttpServiceLifecycleBindingV2Schema,
  NotStartedLifecycleBindingV2Schema,
]);

const EvidenceReceiptIdentityV2Schema = z.object({
  schema: z.literal(EVIDENCE_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_unverified"),
  productionUse: z.literal("forbidden"),
  release: z.object({
    activationAcknowledgementHash: Sha256Schema,
    platformReleaseManifestHash: Sha256Schema,
    runtimePayloadHash: Sha256Schema,
    externalResolutionHash: Sha256Schema,
    environmentCapsuleHash: Sha256Schema,
    toolchainHash: Sha256Schema,
    launcherDefinitionHash: Sha256Schema,
    launcherModuleHash: Sha256Schema,
    runnerDefinitionHash: Sha256Schema,
    runnerModuleHash: Sha256Schema,
    receiptSchemaHash: Sha256Schema.refine(
      (value) => value === EVIDENCE_RECEIPT_ABI_POLICY_V2.policyHash,
      "Receipt schema hash must equal the code-owned EvidenceReceiptV2 ABI policy",
    ),
    adapterDefinitionHash: Sha256Schema,
    adapterCatalogHash: Sha256Schema,
  }).strict(),
  product: z.object({
    packetHash: Sha256Schema,
    buildTopologyHash: Sha256Schema,
    profileCatalogHash: Sha256Schema,
    profileId: StableReferenceSchema,
    profileHash: Sha256Schema,
    stackPackHash: Sha256Schema,
    transportContractHash: Sha256Schema,
    executableTransportBindingHash: Sha256Schema,
  }).strict(),
  candidate: z.object({
    buildReceiptHash: Sha256Schema,
    runtimeBundleHash: Sha256Schema,
    launchTargetHash: Sha256Schema,
  }).strict(),
  execution: z.object({
    runId: RunIdentityV2Schema,
    attemptId: AttemptIdentityV2Schema,
    storyId: StoryIdSchema,
    sliceHash: Sha256Schema,
    predicateRef: EvidenceIdSchema,
  }).strict(),
  sourceBefore: SourceRevisionV1Schema,
  sourceAfter: SourceRevisionV1Schema,
  startedAt: ExactUtcMillisecondTimestampV2Schema,
  finishedAt: ExactUtcMillisecondTimestampV2Schema,
  durationMs: z.number().int().nonnegative().max(EVIDENCE_RECEIPT_V2_MAX_DURATION_MS),
  invocationRequestHash: Sha256Schema,
  invocationResponseHash: Sha256Schema,
  lifecycle: EvidenceLifecycleBindingV2Schema,
  outcome: EvidenceOutcomeCandidateV2Schema,
  captures: z.array(EvidenceCaptureRefV2Schema)
    .min(1)
    .max(EVIDENCE_RECEIPT_V2_MAX_CAPTURES),
}).strict().superRefine((value, context) => {
  const started = Date.parse(value.startedAt);
  const finished = Date.parse(value.finishedAt);
  if (finished < started || finished - started !== value.durationMs) {
    context.addIssue({
      code: "custom",
      path: ["durationMs"],
      message: "Evidence receipt duration must exactly equal its UTC timestamp interval",
    });
  }

  const sourceChanged = value.sourceBefore.sha !== value.sourceAfter.sha
    || value.sourceBefore.treeHash !== value.sourceAfter.treeHash;
  if (sourceChanged && value.outcome.status !== "source_rejected") {
    context.addIssue({
      code: "custom",
      path: ["sourceAfter"],
      message: "Source drift can only produce a typed source_rejected outcome",
    });
  }

  if (value.invocationResponseHash !== value.outcome.outcomeHash) {
    context.addIssue({
      code: "custom",
      path: ["invocationResponseHash"],
      message: "Invocation response hash must equal the exact typed outcome hash",
    });
  }

  const expectedLifecycleKind = value.outcome.checkKind === "http_service"
    ? "http_service"
    : value.outcome.checkKind === "cli_process"
      ? "cli_process"
      : "command_process";
  if (value.lifecycle.kind === "not_started") {
    if (
      value.lifecycle.intendedCheckKind !== value.outcome.checkKind
      || value.lifecycle.reasonOwner !== value.outcome.failureOwner
      || value.outcome.status === "passed"
      || value.outcome.status === "product_failed"
    ) {
      context.addIssue({
        code: "custom",
        path: ["lifecycle"],
        message: "A not-started lifecycle must bind the exact non-product failure owner and intended check",
      });
    }
  } else if (value.lifecycle.kind !== expectedLifecycleKind) {
    context.addIssue({
      code: "custom",
      path: ["lifecycle", "kind"],
      message: "Evidence lifecycle must exactly match the outcome check kind",
    });
  }
  if (
    value.lifecycle.kind === "http_service"
    && value.lifecycle.startup.status !== "ready"
    && value.lifecycle.request.status !== "not_attempted"
  ) {
    context.addIssue({
      code: "custom",
      path: ["lifecycle", "request"],
      message: "An HTTP request cannot be attempted before exact service readiness",
    });
  }
  if (
    value.lifecycle.kind === "http_service"
    && value.outcome.status === "passed"
    && (
      value.lifecycle.startup.status !== "ready"
      || value.lifecycle.request.status !== "attempted"
      || value.lifecycle.request.observation.status !== "response"
      || value.lifecycle.request.observation.httpStatus < 200
      || value.lifecycle.request.observation.httpStatus > 299
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["lifecycle", "observation"],
      message: "A passing HTTP outcome requires one exact 2xx response",
    });
  }
  if (
    value.lifecycle.kind === "http_service"
    && value.outcome.status === "product_failed"
    && value.lifecycle.startup.status === "ready"
    && value.lifecycle.request.status !== "attempted"
  ) {
    context.addIssue({
      code: "custom",
      path: ["lifecycle", "request"],
      message: "A ready product-failed HTTP check must bind one typed request observation",
    });
  }
  if (
    (value.lifecycle.kind === "command_process" || value.lifecycle.kind === "cli_process")
    && value.outcome.status === "passed"
    && value.lifecycle.termination.status !== "normal_exit"
  ) {
    context.addIssue({
      code: "custom",
      path: ["lifecycle", "termination"],
      message: "A passing process outcome requires a normal exit",
    });
  }

  const captureHashes = value.captures.map((capture) => capture.artifactEnvelopeHash);
  const sortedCaptureHashes = [...captureHashes].sort();
  if (
    !hasUniqueStrings(captureHashes)
    || captureHashes.some((hash, index) => hash !== sortedCaptureHashes[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["captures"],
      message: "Evidence capture refs must be unique and canonically sorted by envelope hash",
    });
  }
  if (
    captureHashes.length !== value.outcome.captureEnvelopeHashes.length
    || captureHashes.some((hash, index) => hash !== value.outcome.captureEnvelopeHashes[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["outcome", "captureEnvelopeHashes"],
      message: "Outcome capture hashes must equal every-and-only receipt capture ref",
    });
  }
});

export type EvidenceReceiptHashPayloadV2 = z.infer<
  typeof EvidenceReceiptIdentityV2Schema
>;

export function hashEvidenceReceiptV2(
  value: EvidenceReceiptHashPayloadV2 | EvidenceReceiptCandidateV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.evidence-receipt-payload.v2",
    receipt: payload,
  });
}

export const EvidenceReceiptCandidateV2Schema = EvidenceReceiptIdentityV2Schema.extend({
  receiptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    value,
    EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES,
  )) {
    context.addIssue({
      code: "custom",
      message: `Evidence receipt exceeds ${EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES} canonical bytes`,
    });
    return;
  }
  if (value.receiptHash !== hashEvidenceReceiptV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["receiptHash"],
      message: "Evidence receipt hash must bind the exact candidate receipt",
    });
  }
});

export type EvidenceReceiptCandidateV2 = z.infer<
  typeof EvidenceReceiptCandidateV2Schema
>;

export function parseEvidenceReceiptCandidateV2(
  input: unknown,
): EvidenceReceiptCandidateV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    EvidenceReceiptCandidateV2Schema.parse(snapshot),
  );
}
