import { z } from "zod";

import {
  InvocationEvidenceEvaluationV2Schema,
} from "../invocation-evidence-evaluator-v2.js";
import { hashCanonicalJson } from
  "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  INVOCATION_EVIDENCE_CHECK_V2_VERSION,
} from
  "../../product-compiler/schemas/invocation-evidence-check-v2.js";
import {
  EvidenceExecutionIdentityV2Schema,
} from "./evidence-receipt-v2.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from
  "../../execution/schemas/platform-release-common-v2.js";
import {
  NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
  NODE_CLI_LAUNCH_TIMEOUT_MS_V2,
} from "../../execution/schemas/node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
  NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2,
} from
  "../../execution/schemas/node-express-api-launcher-v2.js";

export const CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA =
  "setfarm.candidate-invocation-evidence-observation.v2" as const;
export const CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_CANONICAL_BYTES =
  256 * 1024;
export const CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_DURATION_MS =
  Math.max(
    NODE_CLI_LAUNCH_TIMEOUT_MS_V2 + 5_000,
    NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2 + 20_000,
  );

export const CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2 =
  Object.freeze([
    "PLATFORM_RELEASE_MANIFEST_V2_UNVERIFIED",
    "EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_UNISSUED",
    "CANDIDATE_LAUNCH_TARGET_V2_UNISSUED",
    "OPERATIONAL_INVOCATION_EVIDENCE_RUNNER_V2_UNVERIFIED",
    "EVIDENCE_ADAPTER_REGISTRY_V2_UNVERIFIED",
    "CURRENT_ACTIVATED_PLATFORM_RELEASE_LEASE_V2_UNISSUED",
    "DURABLE_EVIDENCE_PUBLICATION_V2_UNISSUED",
  ] as const);

export const CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_V2 =
  Object.freeze({
    schema:
      "setfarm.candidate-invocation-evidence-observation-contract.v2",
    version: INVOCATION_EVIDENCE_CHECK_V2_VERSION,
    observationSchema:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
    authorityState:
      "observed_unverified_release_candidate",
    productionUse:
      "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    invocationKinds: Object.freeze([
      "cli_process",
      "http_service",
    ] as const),
    sourceJoin: Object.freeze([
      "candidate_source_receipt",
      "semantic_revision",
      "implementation_closure",
      "source_materialization_receipt",
      "packet",
      "build_receipt",
      "build_topology",
      "runtime_bundle",
      "transport_set_membership",
      "encoded_request",
      "launcher_source_fence",
      "typed_evaluation",
    ] as const),
    executionLease: "branded_one_use",
    rawCapture:
      "private_copy_then_explicit_zeroization",
    callerExpectedValue: "forbidden",
    proseClassifier: "forbidden",
    releaseBlockers:
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2,
    maxCanonicalBytes:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_CANONICAL_BYTES,
    maxDurationMs:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_DURATION_MS,
    maxCliStdoutBytes: NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
    maxCliStderrBytes: NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
    maxHttpBodyBytes:
      NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
  } as const);

export const CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.candidate-invocation-evidence-observation-contract-hash.v2",
    contract:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_V2,
  });

const CandidateInvocationSourceAuthorityV2Schema = z.object({
  candidateSourceReceiptHash: Sha256Schema,
  semanticRevisionHash: Sha256Schema,
  implementationClosureHash: Sha256Schema,
  sourceMaterializationReceiptHash: Sha256Schema,
  packetHash: Sha256Schema,
}).strict();

const CandidateInvocationRuntimeAuthorityV2Schema = z.object({
  buildReceiptHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  runtimeBundleHash: Sha256Schema,
}).strict();

const CandidateInvocationTransportAuthorityV2Schema = z.object({
  contractHash: Sha256Schema,
  contractSetHash: Sha256Schema,
  contractMembershipHash: Sha256Schema,
  runtimeSourceLogicalReceiptHash: Sha256Schema,
  encodedRequestHash: Sha256Schema,
}).strict();

const CandidateInvocationCheckAuthorityV2Schema = z.object({
  checkHash: Sha256Schema,
  predicateKind: z.enum([
    "action_invocation",
    "observable_outcome",
  ]),
  checkRef: z.enum([
    "CHECK_ACTION_INVOCATION",
    "CHECK_OBSERVABLE_OUTCOME",
  ]),
  actionRef: z.string().min(1).max(160),
}).strict().superRefine((value, context) => {
  const exactPair =
    (
      value.predicateKind === "action_invocation"
      && value.checkRef === "CHECK_ACTION_INVOCATION"
    )
    || (
      value.predicateKind === "observable_outcome"
      && value.checkRef === "CHECK_OBSERVABLE_OUTCOME"
    );
  if (!exactPair) {
    context.addIssue({
      code: "custom",
      path: ["checkRef"],
      message: "Predicate kind must map to its exact invocation check",
    });
  }
});

const CandidateInvocationLauncherAuthorityV2Schema = z.object({
  launcherRef: z.enum([
    "LAUNCH_NODE_CLI_V2",
    "LAUNCH_NODE_EXPRESS_API_V2",
  ]),
  observationReceiptHash: Sha256Schema,
  sourceFenceBeforeHash: Sha256Schema,
  sourceFenceAfterHash: Sha256Schema,
}).strict();

const CandidateCliInvocationResponseIdentityV2Schema = z.object({
  kind: z.literal("cli_process_result"),
  exitCode: z.number().int().min(0).max(255),
  stdoutContentHash: Sha256Schema,
  stdoutByteLength: z.number().int().nonnegative()
    .max(NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2),
  stderrContentHash: Sha256Schema,
  stderrByteLength: z.number().int().nonnegative()
    .max(NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2),
}).strict();

const CandidateHttpInvocationResponseIdentityV2Schema = z.object({
  kind: z.literal("http_response"),
  statusCode: z.number().int().min(100).max(599),
  bodyContentHash: Sha256Schema,
  bodyByteLength: z.number().int().nonnegative()
    .max(NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2),
}).strict();

export const CandidateInvocationResponseIdentityV2Schema =
  z.discriminatedUnion("kind", [
    CandidateCliInvocationResponseIdentityV2Schema,
    CandidateHttpInvocationResponseIdentityV2Schema,
  ]);

const CandidateInvocationEvidenceObservationIdentityV2Schema = z.object({
  schema: z.literal(
    CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
  ),
  version: z.literal(INVOCATION_EVIDENCE_CHECK_V2_VERSION),
  contractHash: z.literal(
    CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
  ),
  authorityState: z.literal(
    "observed_unverified_release_candidate",
  ),
  productionUse: z.literal(
    "forbidden_until_verified_release_join",
  ),
  admissionScope: z.literal("test_fixture"),
  releaseBlockers: z.tuple([
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[0]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[1]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[2]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[3]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[4]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[5]),
    z.literal(CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[6]),
  ]),
  invocationKind: z.enum(["cli_process", "http_service"]),
  execution: EvidenceExecutionIdentityV2Schema,
  sourceAuthority: CandidateInvocationSourceAuthorityV2Schema,
  runtimeAuthority: CandidateInvocationRuntimeAuthorityV2Schema,
  transportAuthority: CandidateInvocationTransportAuthorityV2Schema,
  checkAuthority: CandidateInvocationCheckAuthorityV2Schema,
  launcherAuthority: CandidateInvocationLauncherAuthorityV2Schema,
  response: CandidateInvocationResponseIdentityV2Schema,
  evaluation: InvocationEvidenceEvaluationV2Schema,
  startedAt: z.string().datetime({
    offset: false,
    local: false,
    precision: 3,
  }).refine(
    (value) =>
      !Number.isNaN(Date.parse(value))
      && new Date(Date.parse(value)).toISOString() === value,
    "Expected exact round-tripping UTC milliseconds",
  ),
  finishedAt: z.string().datetime({
    offset: false,
    local: false,
    precision: 3,
  }).refine(
    (value) =>
      !Number.isNaN(Date.parse(value))
      && new Date(Date.parse(value)).toISOString() === value,
    "Expected exact round-tripping UTC milliseconds",
  ),
  durationMs: z.number().int().nonnegative().max(
    CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_DURATION_MS,
  ),
}).strict().superRefine((value, context) => {
  const cli =
    value.invocationKind === "cli_process"
    && value.launcherAuthority.launcherRef === "LAUNCH_NODE_CLI_V2"
    && value.response.kind === "cli_process_result";
  const http =
    value.invocationKind === "http_service"
    && value.launcherAuthority.launcherRef
      === "LAUNCH_NODE_EXPRESS_API_V2"
    && value.response.kind === "http_response";
  if (!cli && !http) {
    context.addIssue({
      code: "custom",
      path: ["invocationKind"],
      message: "Invocation kind, launcher and response must form one exact profile",
    });
  }
  if (
    value.launcherAuthority.sourceFenceBeforeHash
      !== value.launcherAuthority.sourceFenceAfterHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["launcherAuthority", "sourceFenceAfterHash"],
      message: "Candidate invocation observation cannot cross source drift",
    });
  }
  if (
    value.transportAuthority.contractHash
      !== value.evaluation.transportContractHash
    || value.transportAuthority.encodedRequestHash
      !== value.evaluation.encodedRequestHash
    || value.checkAuthority.checkHash !== value.evaluation.checkHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["evaluation"],
      message: "Evaluation must bind the exact check, transport and request",
    });
  }
  const started = Date.parse(value.startedAt);
  const finished = Date.parse(value.finishedAt);
  if (finished < started || finished - started !== value.durationMs) {
    context.addIssue({
      code: "custom",
      path: ["durationMs"],
      message: "Observation duration must equal its exact UTC interval",
    });
  }
});

export type CandidateInvocationEvidenceObservationHashPayloadV2 =
  z.infer<typeof CandidateInvocationEvidenceObservationIdentityV2Schema>;

export function hashCandidateInvocationEvidenceObservationV2(
  value:
    | CandidateInvocationEvidenceObservationHashPayloadV2
    | CandidateInvocationEvidenceObservationV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.observationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.candidate-invocation-evidence-observation-hash.v2",
    observation: payload,
  });
}

export const CandidateInvocationEvidenceObservationV2Schema =
  CandidateInvocationEvidenceObservationIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Candidate invocation evidence observation exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.observationHash
        !== hashCandidateInvocationEvidenceObservationV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Observation hash must bind the exact candidate invocation evidence",
      });
    }
  });

export type CandidateInvocationEvidenceObservationV2 =
  z.infer<typeof CandidateInvocationEvidenceObservationV2Schema>;

export function createCandidateInvocationEvidenceObservationV2(
  input: CandidateInvocationEvidenceObservationHashPayloadV2,
): CandidateInvocationEvidenceObservationV2 {
  return parseCandidateInvocationEvidenceObservationV2({
    ...input,
    observationHash:
      hashCandidateInvocationEvidenceObservationV2(input),
  });
}

export function parseCandidateInvocationEvidenceObservationV2(
  input: unknown,
): CandidateInvocationEvidenceObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    CandidateInvocationEvidenceObservationV2Schema.parse(snapshot),
  );
}
