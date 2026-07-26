import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
} from "../product-compiler/canonical-json.js";
import {
  encodeInvocationRequestV2,
  type EncodedInvocationRequestResultV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import {
  type InvocationInputTransportV2,
} from "../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  type InvocationEvidenceCheckV2,
} from
  "../product-compiler/schemas/invocation-evidence-check-v2.js";
import {
  CandidateRuntimeBundleAuthorityV2,
  verifyCandidateRuntimeBundleV2ForTest,
  type CandidateRuntimeInvocationSourceAuthorityInternalV2,
} from "../execution/candidate-runtime-bundle-v2.js";
import {
  VerifiedCandidateSourceAuthorityV1,
  acquireVerifiedCandidateSourceInvocationEvidenceInternalV1,
  revalidateVerifiedCandidateSourceAuthorityV1,
} from "../execution/candidate-source-v1.js";
import {
  NodeCliLaunchAuthorityV2,
  copyNodeCliLaunchCaptureBytesV2ForTest,
  destroyNodeCliLaunchObservationV2,
  issueNodeCliLaunchAuthorityV2ForTest,
  launchNodeCliV2,
  type NodeCliLaunchResultV2,
} from "../execution/launchers/node-cli-v2.js";
import {
  NodeExpressApiLaunchAuthorityV2,
  copyNodeExpressApiLaunchResponseBytesV2ForTest,
  destroyNodeExpressApiLaunchObservationV2,
  issueNodeExpressApiLaunchAuthorityV2ForTest,
  launchNodeExpressApiV2,
  type NodeExpressApiLaunchResultV2,
} from "../execution/launchers/node-express-api-v2.js";
import {
  EvidenceExecutionIdentityV2Schema,
  type EvidenceExecutionIdentityV2,
} from "./schemas/evidence-receipt-v2.js";
import {
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
  CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2,
  CandidateInvocationEvidenceObservationV2Schema,
  createCandidateInvocationEvidenceObservationV2,
  type CandidateInvocationEvidenceObservationHashPayloadV2,
  type CandidateInvocationEvidenceObservationV2,
} from
  "./schemas/candidate-invocation-evidence-observation-v2.js";
import {
  evaluateInvocationEvidenceV2,
  type InvocationEvidenceEvaluationV2,
} from "./invocation-evidence-evaluator-v2.js";

export type CandidateInvocationEvidenceErrorCodeV2 =
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_ALREADY_CONSUMED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_RUNTIME_MISMATCH"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_CHANGED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_RUNTIME_CHANGED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_REQUEST_REJECTED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_LAUNCH_REJECTED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_LIFECYCLE_UNSUPPORTED"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_OBSERVATION_INVALID"
  | "CANDIDATE_INVOCATION_EVIDENCE_V2_CAPTURE_DESTROYED";

export class CandidateInvocationEvidenceErrorV2 extends Error {
  readonly code: CandidateInvocationEvidenceErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: CandidateInvocationEvidenceErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "CandidateInvocationEvidenceErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: CandidateInvocationEvidenceErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new CandidateInvocationEvidenceErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || (
      Object.getPrototypeOf(input) !== Object.prototype
      && Object.getPrototypeOf(input) !== null
    )
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID",
      `${label} must be one exact non-proxy data record`,
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== "string")
    || canonicalJsonStringify(keys.map(String).sort())
      !== canonicalJsonStringify([...expectedKeys].sort())
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID",
      `${label} fields must equal [${expectedKeys.join(", ")}]`,
    );
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      !descriptor
      || !("value" in descriptor)
      || !descriptor.enumerable
    ) {
      return fail(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
  }
  return input as Readonly<Record<string, unknown>>;
}

type CandidateInvocationSourceRuntimeAuthorityV2 =
  CandidateRuntimeInvocationSourceAuthorityInternalV2;

type CandidateInvocationEvidenceExecutionStateCommonV2 = Readonly<{
  candidateSourceAuthority: VerifiedCandidateSourceAuthorityV1;
  runtimeAuthority: CandidateRuntimeBundleAuthorityV2;
  expectedBundleHash: string;
  execution: EvidenceExecutionIdentityV2;
  check: Readonly<InvocationEvidenceCheckV2>;
  transportContract: Readonly<InvocationInputTransportV2>;
  sourceRuntimeAuthority:
    CandidateInvocationSourceRuntimeAuthorityV2;
  lifecycle: {
    status: "ready" | "claimed" | "consumed";
  };
}>;

type CandidateCliInvocationEvidenceExecutionStateV2 =
  CandidateInvocationEvidenceExecutionStateCommonV2
  & Readonly<{
    kind: "cli_process";
    launchAuthority: NodeCliLaunchAuthorityV2;
  }>;

type CandidateHttpInvocationEvidenceExecutionStateV2 =
  CandidateInvocationEvidenceExecutionStateCommonV2
  & Readonly<{
    kind: "http_service";
    launchAuthority: NodeExpressApiLaunchAuthorityV2;
  }>;

type CandidateInvocationEvidenceExecutionStateV2 =
  | CandidateCliInvocationEvidenceExecutionStateV2
  | CandidateHttpInvocationEvidenceExecutionStateV2;

const candidateInvocationEvidenceConstructorCapabilityV2 =
  Object.freeze({});
const candidateInvocationEvidenceExecutionStateV2 = new WeakMap<
  object,
  CandidateInvocationEvidenceExecutionStateV2
>();

/**
 * One-use pre-release authority. It proves that the check and launcher were
 * derived from the same freshly verified candidate source/runtime chain. It
 * deliberately carries no verified-release, executable-binding, launch-target,
 * registry, publication, or production-use authority.
 */
export class CandidateInvocationEvidenceExecutionAuthorityV2 {
  readonly runtimeBundleHash: string;
  readonly candidateSourceReceiptHash: string;
  readonly checkHash: string;
  readonly invocationKind: "cli_process" | "http_service";
  readonly productionUse:
    "forbidden_until_verified_release_join";

  constructor(
    capability: object,
    state: CandidateInvocationEvidenceExecutionStateV2,
  ) {
    if (
      capability
        !== candidateInvocationEvidenceConstructorCapabilityV2
    ) {
      throw new CandidateInvocationEvidenceErrorV2(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate invocation evidence constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.expectedBundleHash;
    this.candidateSourceReceiptHash =
      state.check.authority.candidateSourceReceiptHash;
    this.checkHash = state.check.checkHash;
    this.invocationKind = state.kind;
    this.productionUse =
      "forbidden_until_verified_release_join";
    candidateInvocationEvidenceExecutionStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticExecutionStateV2(
  authority: CandidateInvocationEvidenceExecutionAuthorityV2,
): CandidateInvocationEvidenceExecutionStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority)
      !== CandidateInvocationEvidenceExecutionAuthorityV2.prototype
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate invocation evidence execution requires one authentic authority",
    );
  }
  const state =
    candidateInvocationEvidenceExecutionStateV2.get(authority);
  if (!state) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate invocation evidence execution requires one authentic authority",
    );
  }
  return state;
}

function sourceRuntimeJoinIsExactV2(
  check: InvocationEvidenceCheckV2,
  transportContract: InvocationInputTransportV2,
  sourceRuntime: CandidateInvocationSourceRuntimeAuthorityV2,
): boolean {
  return check.operation.invocationKind === transportContract.kind
    && check.authority.candidateSourceReceiptHash
      === sourceRuntime.candidateSourceReceiptHash
    && check.authority.semanticRevisionHash
      === sourceRuntime.semanticRevisionHash
    && check.authority.implementationClosureHash
      === sourceRuntime.implementationClosureHash
    && check.authority.productBuildPacketHash
      === sourceRuntime.packetHash
    && check.authority.transportContractHash
      === transportContract.contractHash
    && check.authority.transportSetHash
      === sourceRuntime.transportSetHash
    && check.authority.transportMembershipHash
      === sourceRuntime.transportMembershipHash
    && check.operation.actionRef === transportContract.actionRef;
}

function exactTransportJoinV2(
  sourceContract: InvocationInputTransportV2,
  launcherContract: InvocationInputTransportV2,
): boolean {
  return canonicalJsonStringify(sourceContract)
    === canonicalJsonStringify(launcherContract);
}

export type IssuedCandidateInvocationEvidenceExecutionAuthorityV2 =
  Readonly<{
    status: "issued_pre_release_test_authority";
    productionUse:
      "forbidden_until_verified_release_join";
    authority: CandidateInvocationEvidenceExecutionAuthorityV2;
  }>;

/**
 * @internal Test-only bridge. The explicit forbidden marker is not an
 * executable transport binding and cannot be promoted into EvidenceReceiptV2.
 */
export async function issueCandidateInvocationEvidenceExecutionAuthorityV2ForTest(
  input: unknown,
): Promise<IssuedCandidateInvocationEvidenceExecutionAuthorityV2> {
  const values = exactDataRecord(
    input,
    [
      "candidateSourceAuthority",
      "execution",
      "expectedBundleHash",
      "runtimeAuthority",
    ],
    "Candidate invocation evidence issuance input",
  );
  if (
    isProxy(values.candidateSourceAuthority)
    || !(values.candidateSourceAuthority
      instanceof VerifiedCandidateSourceAuthorityV1)
    || isProxy(values.runtimeAuthority)
    || !(values.runtimeAuthority
      instanceof CandidateRuntimeBundleAuthorityV2)
    || typeof values.expectedBundleHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.expectedBundleHash)
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID",
      "Candidate invocation evidence requires authentic source/runtime authorities and one bundle hash",
    );
  }
  let execution: EvidenceExecutionIdentityV2;
  try {
    execution = EvidenceExecutionIdentityV2Schema.parse(
      values.execution,
    );
  } catch (error) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_INPUT_INVALID",
      "Candidate invocation execution identity is invalid",
      error,
    );
  }
  const candidateSourceAuthority = (
    values.candidateSourceAuthority
  ) as VerifiedCandidateSourceAuthorityV1;
  const runtimeAuthority =
    values.runtimeAuthority as CandidateRuntimeBundleAuthorityV2;
  const expectedBundleHash = values.expectedBundleHash as string;
  try {
    const invocation =
      await acquireVerifiedCandidateSourceInvocationEvidenceInternalV1(
        candidateSourceAuthority,
        {
          storyId: execution.storyId,
          sliceHash: execution.sliceHash,
          predicateRef: execution.predicateRef,
        },
      );
    const sourceBefore =
      await revalidateVerifiedCandidateSourceAuthorityV1(
        candidateSourceAuthority,
      );
    if (
      sourceBefore.receiptHash
        !== invocation.check.authority.candidateSourceReceiptHash
      || sourceBefore.semanticRevisionHash
        !== invocation.check.authority.semanticRevisionHash
      || sourceBefore.implementationClosureHash
        !== invocation.check.authority.implementationClosureHash
    ) {
      return fail(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_CHANGED",
        "Candidate source changed while deriving invocation evidence",
      );
    }
    if (
      runtimeAuthority.bundleHash !== expectedBundleHash
      || runtimeAuthority.candidateSourceReceiptHash
        !== invocation.check.authority.candidateSourceReceiptHash
      || runtimeAuthority.semanticRevisionHash
        !== invocation.check.authority.semanticRevisionHash
      || runtimeAuthority.implementationClosureHash
        !== invocation.check.authority.implementationClosureHash
      || runtimeAuthority.packetHash
        !== invocation.check.authority.productBuildPacketHash
    ) {
      return fail(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_RUNTIME_MISMATCH",
        "Candidate source check differs from the immutable runtime authority projection",
      );
    }

    let state: CandidateInvocationEvidenceExecutionStateV2;
    if (invocation.transportContract.kind === "cli_command") {
      const issued = await issueNodeCliLaunchAuthorityV2ForTest({
        runtimeAuthority,
        expectedBundleHash,
        actionRef: invocation.check.operation.actionRef,
      });
      if (
        !exactTransportJoinV2(
          invocation.transportContract,
          issued.transportContract,
        )
        || !sourceRuntimeJoinIsExactV2(
          invocation.check,
          issued.transportContract,
          issued.sourceAuthority,
        )
      ) {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_RUNTIME_MISMATCH",
          "Candidate source check and CLI runtime do not form one exact authority chain",
        );
      }
      state = Object.freeze({
        kind: "cli_process" as const,
        candidateSourceAuthority,
        runtimeAuthority,
        expectedBundleHash,
        execution,
        check: invocation.check,
        transportContract: invocation.transportContract,
        sourceRuntimeAuthority: issued.sourceAuthority,
        launchAuthority: issued.authority,
        lifecycle: {
          status: "ready" as const,
        },
      });
    } else {
      const issued =
        await issueNodeExpressApiLaunchAuthorityV2ForTest({
          runtimeAuthority,
          expectedBundleHash,
          actionRef: invocation.check.operation.actionRef,
        });
      if (
        !exactTransportJoinV2(
          invocation.transportContract,
          issued.transportContract,
        )
        || !sourceRuntimeJoinIsExactV2(
          invocation.check,
          issued.transportContract,
          issued.sourceAuthority,
        )
      ) {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_RUNTIME_MISMATCH",
          "Candidate source check and API runtime do not form one exact authority chain",
        );
      }
      state = Object.freeze({
        kind: "http_service" as const,
        candidateSourceAuthority,
        runtimeAuthority,
        expectedBundleHash,
        execution,
        check: invocation.check,
        transportContract: invocation.transportContract,
        sourceRuntimeAuthority: issued.sourceAuthority,
        launchAuthority: issued.authority,
        lifecycle: {
          status: "ready" as const,
        },
      });
    }
    const authority =
      new CandidateInvocationEvidenceExecutionAuthorityV2(
        candidateInvocationEvidenceConstructorCapabilityV2,
        state,
      );
    return Object.freeze({
      status: "issued_pre_release_test_authority" as const,
      productionUse:
        "forbidden_until_verified_release_join" as const,
      authority,
    });
  } catch (error) {
    if (error instanceof CandidateInvocationEvidenceErrorV2) {
      throw error;
    }
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_RUNTIME_MISMATCH",
      "Candidate source/runtime invocation evidence issuance failed at one authenticated boundary",
      error,
    );
  }
}

type CandidateInvocationEvidenceCaptureStateV2 =
  | {
    kind: "cli_process_result";
    stdout: Buffer;
    stderr: Buffer;
    status: "ready" | "destroyed";
  }
  | {
    kind: "http_response";
    body: Buffer;
    status: "ready" | "destroyed";
  };

const candidateInvocationEvidenceCaptureConstructorCapabilityV2 =
  Object.freeze({});
const candidateInvocationEvidenceCaptureStateV2 = new WeakMap<
  object,
  CandidateInvocationEvidenceCaptureStateV2
>();

export class CandidateInvocationEvidenceCaptureV2 {
  readonly observationHash: string;
  readonly responseKind:
    "cli_process_result" | "http_response";
  readonly productionUse:
    "forbidden_until_verified_release_join";

  constructor(
    capability: object,
    observationHash: string,
    state: CandidateInvocationEvidenceCaptureStateV2,
  ) {
    if (
      capability
        !== candidateInvocationEvidenceCaptureConstructorCapabilityV2
    ) {
      throw new CandidateInvocationEvidenceErrorV2(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate invocation capture constructor capability is unavailable",
      );
    }
    this.observationHash = observationHash;
    this.responseKind = state.kind;
    this.productionUse =
      "forbidden_until_verified_release_join";
    candidateInvocationEvidenceCaptureStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticCaptureStateV2(
  capture: CandidateInvocationEvidenceCaptureV2,
): CandidateInvocationEvidenceCaptureStateV2 {
  if (
    typeof capture !== "object"
    || capture === null
    || isProxy(capture)
    || Object.getPrototypeOf(capture)
      !== CandidateInvocationEvidenceCaptureV2.prototype
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate invocation capture access requires one authentic handle",
    );
  }
  const state = candidateInvocationEvidenceCaptureStateV2.get(capture);
  if (!state) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate invocation capture access requires one authentic handle",
    );
  }
  if (state.status === "destroyed") {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_CAPTURE_DESTROYED",
      "Candidate invocation capture has already been destroyed",
    );
  }
  return state;
}

export function copyCandidateInvocationEvidenceCaptureV2ForTest(
  capture: CandidateInvocationEvidenceCaptureV2,
):
  | Readonly<{
    kind: "cli_process_result";
    stdout: Buffer;
    stderr: Buffer;
  }>
  | Readonly<{
    kind: "http_response";
    body: Buffer;
  }> {
  const state = authenticCaptureStateV2(capture);
  if (state.kind === "cli_process_result") {
    return Object.freeze({
      kind: state.kind,
      stdout: Buffer.from(state.stdout),
      stderr: Buffer.from(state.stderr),
    });
  }
  return Object.freeze({
    kind: state.kind,
    body: Buffer.from(state.body),
  });
}

export function destroyCandidateInvocationEvidenceCaptureV2(
  capture: CandidateInvocationEvidenceCaptureV2,
): void {
  const state = authenticCaptureStateV2(capture);
  if (state.kind === "cli_process_result") {
    state.stdout.fill(0);
    state.stderr.fill(0);
  } else {
    state.body.fill(0);
  }
  state.status = "destroyed";
}

export type CandidateInvocationEvidenceExecutionResultV2 =
  Readonly<{
    status: "observed_unverified_release_candidate";
    productionUse:
      "forbidden_until_verified_release_join";
    observation: CandidateInvocationEvidenceObservationV2;
    capture: CandidateInvocationEvidenceCaptureV2;
  }>;

function encodedRequestForStateV2(
  state: CandidateInvocationEvidenceExecutionStateV2,
): EncodedInvocationRequestResultV2 {
  const encoded = encodeInvocationRequestV2({
    contract: state.transportContract,
    inputValues: state.check.operation.targetInputValues,
  });
  if (
    encoded.requestHash
      !== state.check.operation.encodedRequestHash
    || (
      state.kind === "cli_process"
      && encoded.kind !== "cli_command"
    )
    || (
      state.kind === "http_service"
      && encoded.kind !== "http_request"
    )
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_REQUEST_REJECTED",
      "Candidate invocation request does not reproduce the sealed check",
    );
  }
  return encoded;
}

async function revalidateSourceAndRuntimeV2(
  state: CandidateInvocationEvidenceExecutionStateV2,
): Promise<void> {
  const source =
    await revalidateVerifiedCandidateSourceAuthorityV1(
      state.candidateSourceAuthority,
    );
  if (
    source.receiptHash
      !== state.sourceRuntimeAuthority.candidateSourceReceiptHash
    || source.semanticRevisionHash
      !== state.sourceRuntimeAuthority.semanticRevisionHash
    || source.implementationClosureHash
      !== state.sourceRuntimeAuthority.implementationClosureHash
  ) {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_SOURCE_CHANGED",
      "Candidate source authority changed across invocation execution",
    );
  }
  try {
    const runtime = await verifyCandidateRuntimeBundleV2ForTest({
      runtimeAuthority: state.runtimeAuthority,
      expectedBundleHash: state.expectedBundleHash,
    });
    if (
      runtime.bundle.bundleHash !== state.expectedBundleHash
      || runtime.bundle.buildReceiptHash
        !== state.sourceRuntimeAuthority.buildReceiptHash
      || runtime.bundle.sourceAuthority.candidateSourceReceiptHash
        !== state.sourceRuntimeAuthority.candidateSourceReceiptHash
      || runtime.bundle.sourceAuthority.semanticRevisionHash
        !== state.sourceRuntimeAuthority.semanticRevisionHash
    ) {
      return fail(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_RUNTIME_CHANGED",
        "Candidate runtime bundle changed across invocation execution",
      );
    }
  } catch (error) {
    if (error instanceof CandidateInvocationEvidenceErrorV2) {
      throw error;
    }
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_RUNTIME_CHANGED",
      "Candidate runtime verification failed across invocation execution",
      error,
    );
  }
}

function observationIdentityV2(
  state: CandidateInvocationEvidenceExecutionStateV2,
  launcher:
    | NodeCliLaunchResultV2["receipt"]
    | NodeExpressApiLaunchResultV2["receipt"],
  evaluation: InvocationEvidenceEvaluationV2,
  response:
    CandidateInvocationEvidenceObservationHashPayloadV2["response"],
): CandidateInvocationEvidenceObservationHashPayloadV2 {
  return {
    schema: CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_V2_SCHEMA,
    version: "2.0.0",
    contractHash:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
    authorityState:
      "observed_unverified_release_candidate",
    productionUse:
      "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    releaseBlockers: [
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[0],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[1],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[2],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[3],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[4],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[5],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[6],
    ],
    invocationKind: state.kind,
    execution: state.execution,
    sourceAuthority: {
      candidateSourceReceiptHash:
        state.sourceRuntimeAuthority.candidateSourceReceiptHash,
      semanticRevisionHash:
        state.sourceRuntimeAuthority.semanticRevisionHash,
      implementationClosureHash:
        state.sourceRuntimeAuthority.implementationClosureHash,
      sourceMaterializationReceiptHash:
        state.sourceRuntimeAuthority.sourceMaterializationReceiptHash,
      packetHash: state.sourceRuntimeAuthority.packetHash,
    },
    runtimeAuthority: {
      buildReceiptHash:
        state.sourceRuntimeAuthority.buildReceiptHash,
      buildTopologyHash:
        state.sourceRuntimeAuthority.buildTopologyHash,
      runtimeBundleHash:
        state.sourceRuntimeAuthority.runtimeBundleHash,
    },
    transportAuthority: {
      contractHash: state.transportContract.contractHash,
      contractSetHash:
        state.sourceRuntimeAuthority.transportSetHash,
      contractMembershipHash:
        state.sourceRuntimeAuthority.transportMembershipHash,
      runtimeSourceLogicalReceiptHash:
        state.sourceRuntimeAuthority.runtimeSourceLogicalReceiptHash,
      encodedRequestHash:
        state.check.operation.encodedRequestHash,
    },
    checkAuthority: {
      checkHash: state.check.checkHash,
      predicateKind: state.check.check.predicateKind,
      checkRef: state.check.check.checkRef,
      actionRef: state.check.operation.actionRef,
    },
    launcherAuthority: {
      launcherRef: launcher.launcher.launcherRef,
      observationReceiptHash: launcher.receiptHash,
      sourceFenceBeforeHash:
        launcher.execution.sourceFenceBeforeHash,
      sourceFenceAfterHash:
        launcher.execution.sourceFenceAfterHash,
    },
    response,
    evaluation,
    startedAt: launcher.startedAt,
    finishedAt: launcher.finishedAt,
    durationMs: launcher.durationMs,
  };
}

export async function runCandidateInvocationEvidenceV2ForTest(
  input: unknown,
): Promise<CandidateInvocationEvidenceExecutionResultV2> {
  const values = exactDataRecord(
    input,
    ["authority"],
    "Candidate invocation evidence execution input",
  );
  const state = authenticExecutionStateV2(
    values.authority as CandidateInvocationEvidenceExecutionAuthorityV2,
  );
  if (state.lifecycle.status !== "ready") {
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_ALREADY_CONSUMED",
      "Candidate invocation evidence authority is one-use",
    );
  }
  state.lifecycle.status = "claimed";
  let cliLaunch: NodeCliLaunchResultV2 | undefined;
  let httpLaunch: NodeExpressApiLaunchResultV2 | undefined;
  let cliBytes:
    Readonly<{ stdout: Buffer; stderr: Buffer }>
    | undefined;
  let httpBytes: Buffer | undefined;
  let launcherObservationDestroyed = false;
  try {
    await revalidateSourceAndRuntimeV2(state);
    const encoded = encodedRequestForStateV2(state);
    let evaluation: InvocationEvidenceEvaluationV2;
    let response:
      CandidateInvocationEvidenceObservationHashPayloadV2["response"];
    let captureState: CandidateInvocationEvidenceCaptureStateV2;
    let launcherReceipt:
      | NodeCliLaunchResultV2["receipt"]
      | NodeExpressApiLaunchResultV2["receipt"];

    if (state.kind === "cli_process") {
      if (encoded.kind !== "cli_command") {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_REQUEST_REJECTED",
          "CLI execution received a non-CLI encoded request",
        );
      }
      cliLaunch = await launchNodeCliV2({
        authority: state.launchAuthority,
        encodedRequest: encoded,
      });
      const termination = cliLaunch.receipt.process.termination;
      if (
        termination.status !== "exited"
        || termination.exitCode === null
      ) {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_LIFECYCLE_UNSUPPORTED",
          "Pre-release CLI observation cannot yet classify a non-normal process lifecycle",
        );
      }
      cliBytes = copyNodeCliLaunchCaptureBytesV2ForTest(
        cliLaunch.observation,
      );
      evaluation = evaluateInvocationEvidenceV2({
        check: state.check,
        transportContract: state.transportContract,
        response: {
          kind: "cli_process_result",
          exitCode: termination.exitCode,
          stdoutBytes: cliBytes.stdout,
          stderrBytes: cliBytes.stderr,
        },
      });
      response = {
        kind: "cli_process_result",
        exitCode: termination.exitCode,
        stdoutContentHash: sha256(cliBytes.stdout),
        stdoutByteLength: cliBytes.stdout.byteLength,
        stderrContentHash: sha256(cliBytes.stderr),
        stderrByteLength: cliBytes.stderr.byteLength,
      };
      captureState = {
        kind: "cli_process_result",
        stdout: cliBytes.stdout,
        stderr: cliBytes.stderr,
        status: "ready",
      };
      launcherReceipt = cliLaunch.receipt;
      destroyNodeCliLaunchObservationV2(cliLaunch.observation);
      launcherObservationDestroyed = true;
    } else {
      if (encoded.kind !== "http_request") {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_REQUEST_REJECTED",
          "HTTP execution received a non-HTTP encoded request",
        );
      }
      httpLaunch = await launchNodeExpressApiV2({
        authority: state.launchAuthority,
        encodedRequest: encoded,
      });
      httpBytes =
        copyNodeExpressApiLaunchResponseBytesV2ForTest(
          httpLaunch.observation,
        );
      evaluation = evaluateInvocationEvidenceV2({
        check: state.check,
        transportContract: state.transportContract,
        response: {
          kind: "http_response",
          statusCode: httpLaunch.receipt.request.statusCode,
          bodyBytes: httpBytes,
        },
      });
      response = {
        kind: "http_response",
        statusCode: httpLaunch.receipt.request.statusCode,
        bodyContentHash: sha256(httpBytes),
        bodyByteLength: httpBytes.byteLength,
      };
      captureState = {
        kind: "http_response",
        body: httpBytes,
        status: "ready",
      };
      launcherReceipt = httpLaunch.receipt;
      destroyNodeExpressApiLaunchObservationV2(
        httpLaunch.observation,
      );
      launcherObservationDestroyed = true;
    }
    await revalidateSourceAndRuntimeV2(state);
    let observation: CandidateInvocationEvidenceObservationV2;
    try {
      observation =
        createCandidateInvocationEvidenceObservationV2(
          observationIdentityV2(
            state,
            launcherReceipt,
            evaluation,
            response,
          ),
        );
      if (
        !CandidateInvocationEvidenceObservationV2Schema.safeParse(
          observation,
        ).success
      ) {
        return fail(
          "CANDIDATE_INVOCATION_EVIDENCE_V2_OBSERVATION_INVALID",
          "Candidate invocation evidence observation did not round-trip",
        );
      }
    } catch (error) {
      return fail(
        "CANDIDATE_INVOCATION_EVIDENCE_V2_OBSERVATION_INVALID",
        "Candidate invocation evidence did not produce one canonical observation",
        error,
      );
    }
    const capture = new CandidateInvocationEvidenceCaptureV2(
      candidateInvocationEvidenceCaptureConstructorCapabilityV2,
      observation.observationHash,
      captureState,
    );
    cliBytes = undefined;
    httpBytes = undefined;
    return Object.freeze({
      status:
        "observed_unverified_release_candidate" as const,
      productionUse:
        "forbidden_until_verified_release_join" as const,
      observation,
      capture,
    });
  } catch (error) {
    if (error instanceof CandidateInvocationEvidenceErrorV2) {
      throw error;
    }
    return fail(
      "CANDIDATE_INVOCATION_EVIDENCE_V2_LAUNCH_REJECTED",
      "Candidate invocation evidence launch failed at one authenticated boundary",
      error,
    );
  } finally {
    if (!launcherObservationDestroyed) {
      try {
        if (cliLaunch) {
          destroyNodeCliLaunchObservationV2(cliLaunch.observation);
        }
        if (httpLaunch) {
          destroyNodeExpressApiLaunchObservationV2(
            httpLaunch.observation,
          );
        }
      } catch {
        // Preserve the primary typed failure while still attempting zeroization.
      }
    }
    cliBytes?.stdout.fill(0);
    cliBytes?.stderr.fill(0);
    httpBytes?.fill(0);
    state.lifecycle.status = "consumed";
  }
}
