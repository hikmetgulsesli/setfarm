import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
} from "../product-compiler/canonical-json.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
} from "./schemas/cli-process-runner-v2.js";
import {
  type EvidenceReceiptV2,
} from "./schemas/evidence-receipt-v2.js";
import {
  parseDurableEvidenceExecutionResultV2,
  type DurableEvidenceExecutionResultV2,
} from "./schemas/evidence-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
} from "./schemas/http-service-runner-v2.js";

export type InvocationEvidenceRunnerExecutionErrorCodeV2 =
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_ALREADY_CONSUMED"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RUNNER_MISMATCH"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RELEASE_STALE"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_EXECUTION_REJECTED"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RESULT_INVALID"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RESULT_AUTHORITY_MISMATCH"
  | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_CLEANUP_REJECTED";

export class InvocationEvidenceRunnerExecutionErrorV2 extends Error {
  readonly code: InvocationEvidenceRunnerExecutionErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: InvocationEvidenceRunnerExecutionErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "InvocationEvidenceRunnerExecutionErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: InvocationEvidenceRunnerExecutionErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new InvocationEvidenceRunnerExecutionErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

type InvocationRunnerEntrypointRefV2 =
  | typeof EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2
  | typeof EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2;

type InvocationRunnerKindV2 = "cli_process" | "http_service";

type ActivatedReleaseBindingV2 = Extract<
  EvidenceReceiptV2["release"],
  { kind: "activated_release" }
>;

type InvocationOperationBindingV2 = Extract<
  EvidenceReceiptV2["operation"],
  { kind: InvocationRunnerKindV2 }
>;

type WithoutLauncherObservationReceiptV2<T> =
  T extends { launcherObservationReceiptHash: string }
    ? Omit<T, "launcherObservationReceiptHash">
    : never;

type ExpectedInvocationOperationAuthorityV2 = Readonly<
  WithoutLauncherObservationReceiptV2<InvocationOperationBindingV2>
>;

type InvocationEvidenceRunnerExecutionLeaseStateV2 = Readonly<{
  runnerEntrypointRef: InvocationRunnerEntrypointRefV2;
  invocationKind: InvocationRunnerKindV2;
  releaseBinding: ActivatedReleaseBindingV2;
  productBinding: EvidenceReceiptV2["product"];
  candidateBinding: EvidenceReceiptV2["candidate"];
  executionBinding: EvidenceReceiptV2["execution"];
  operationBinding: ExpectedInvocationOperationAuthorityV2;
  /**
   * These functions are deliberately module-private state. No public caller
   * can supply them. A future verified-release/Registry authority join must
   * add the sole issuer in this module before any state can enter this map.
   */
  revalidateCurrentActivationInternalV2: () => Promise<void>;
  executeAndPublishInternalV2:
    () => Promise<DurableEvidenceExecutionResultV2>;
  closeInternalV2: () => Promise<void>;
  lifecycle: {
    status: "ready" | "claimed" | "consumed";
  };
}>;

const invocationEvidenceRunnerExecutionLeaseConstructorCapabilityV2 =
  Object.freeze({});
const invocationEvidenceRunnerExecutionLeaseStateV2 = new WeakMap<
  object,
  InvocationEvidenceRunnerExecutionLeaseStateV2
>();

/**
 * Opaque operational lease admission handle.
 *
 * This module intentionally exports no issuer. Real instances become possible
 * only when the verified PlatformReleaseV2, current activation generation,
 * RegistryV2 adapter, executable transport, candidate launch target, sealed
 * runtime allocation, and durable publication CAS have one authentic join.
 */
export class ActivatedInvocationEvidenceRunnerExecutionLeaseV2 {
  readonly runnerEntrypointRef: InvocationRunnerEntrypointRefV2;
  readonly invocationKind: InvocationRunnerKindV2;
  readonly productionUse:
    "permitted_current_activation_lease_only";

  constructor(
    capability: object,
    state: InvocationEvidenceRunnerExecutionLeaseStateV2,
  ) {
    if (
      capability
        !== invocationEvidenceRunnerExecutionLeaseConstructorCapabilityV2
    ) {
      throw new InvocationEvidenceRunnerExecutionErrorV2(
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
        "Invocation evidence runner lease constructor capability is unavailable",
      );
    }
    this.runnerEntrypointRef = state.runnerEntrypointRef;
    this.invocationKind = state.invocationKind;
    this.productionUse =
      "permitted_current_activation_lease_only";
    invocationEvidenceRunnerExecutionLeaseStateV2.set(this, state);
    Object.freeze(this);
  }
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
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID",
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
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID",
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
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
  }
  return input as Readonly<Record<string, unknown>>;
}

function authenticLeaseStateV2(
  lease: unknown,
): InvocationEvidenceRunnerExecutionLeaseStateV2 {
  if (
    typeof lease !== "object"
    || lease === null
    || isProxy(lease)
    || Object.getPrototypeOf(lease)
      !== ActivatedInvocationEvidenceRunnerExecutionLeaseV2.prototype
  ) {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      "Invocation evidence execution requires one authentic activated-release lease",
    );
  }
  const state =
    invocationEvidenceRunnerExecutionLeaseStateV2.get(lease);
  if (!state) {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      "Invocation evidence execution requires one authentic activated-release lease",
    );
  }
  return state;
}

function exactResultAuthorityV2(
  result: DurableEvidenceExecutionResultV2,
  state: InvocationEvidenceRunnerExecutionLeaseStateV2,
): boolean {
  const receipt = result.receipt;
  if (
    result.authorityState !== "activated_release_bound"
    || result.productionUse
      !== "permitted_current_activation_lease_only"
    || result.publication.state !== "durable_cas_verified"
    || result.runnerEntrypointRef !== state.runnerEntrypointRef
    || receipt.authorityState !== "activated_release_bound"
    || receipt.productionUse
      !== "permitted_current_activation_lease_only"
    || receipt.release.kind !== "activated_release"
    || receipt.operation.kind !== state.invocationKind
    || receipt.operation.runnerEntrypointRef
      !== state.runnerEntrypointRef
  ) {
    return false;
  }
  const observedOperation = {
    ...receipt.operation,
  } as Record<string, unknown>;
  delete observedOperation.launcherObservationReceiptHash;
  return canonicalJsonStringify(receipt.release)
      === canonicalJsonStringify(state.releaseBinding)
    && canonicalJsonStringify(receipt.product)
      === canonicalJsonStringify(state.productBinding)
    && canonicalJsonStringify(receipt.candidate)
      === canonicalJsonStringify(state.candidateBinding)
    && canonicalJsonStringify(receipt.execution)
      === canonicalJsonStringify(state.executionBinding)
    && canonicalJsonStringify(observedOperation)
      === canonicalJsonStringify(state.operationBinding);
}

async function revalidateCurrentActivationV2(
  state: InvocationEvidenceRunnerExecutionLeaseStateV2,
  phase: "before_execution" | "after_durable_publication",
): Promise<void> {
  try {
    await state.revalidateCurrentActivationInternalV2();
  } catch (error) {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RELEASE_STALE",
      `Current activated platform release became unavailable ${phase}`,
      error,
    );
  }
}

async function executeForRunnerV2(
  input: unknown,
  expectedRunnerEntrypointRef: InvocationRunnerEntrypointRefV2,
  expectedInvocationKind: InvocationRunnerKindV2,
): Promise<DurableEvidenceExecutionResultV2> {
  const values = exactDataRecord(
    input,
    ["lease"],
    "Invocation evidence runner input",
  );
  const state = authenticLeaseStateV2(values.lease);
  if (
    state.runnerEntrypointRef !== expectedRunnerEntrypointRef
    || state.invocationKind !== expectedInvocationKind
    || state.operationBinding.runnerEntrypointRef
      !== expectedRunnerEntrypointRef
    || state.operationBinding.kind !== expectedInvocationKind
  ) {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RUNNER_MISMATCH",
      "Activated execution lease does not belong to this exact runner module",
    );
  }
  if (state.lifecycle.status !== "ready") {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_ALREADY_CONSUMED",
      "Invocation evidence runner execution lease is one-use",
    );
  }
  state.lifecycle.status = "claimed";

  let result: DurableEvidenceExecutionResultV2 | undefined;
  let failure: unknown;
  try {
    await revalidateCurrentActivationV2(
      state,
      "before_execution",
    );
    let candidate: DurableEvidenceExecutionResultV2;
    try {
      candidate = await state.executeAndPublishInternalV2();
    } catch (error) {
      return fail(
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_EXECUTION_REJECTED",
        "Activated invocation runner execution or durable publication failed",
        error,
      );
    }
    try {
      result = parseDurableEvidenceExecutionResultV2(candidate);
    } catch (error) {
      return fail(
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RESULT_INVALID",
        "Invocation runner did not return one valid durable evidence result",
        error,
      );
    }
    if (!exactResultAuthorityV2(result, state)) {
      return fail(
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RESULT_AUTHORITY_MISMATCH",
        "Durable result differs from the exact release, adapter, candidate, transport, target, or execution lease",
      );
    }
    await revalidateCurrentActivationV2(
      state,
      "after_durable_publication",
    );
  } catch (error) {
    failure = error;
  }

  try {
    await state.closeInternalV2();
  } catch (cleanupError) {
    failure = new InvocationEvidenceRunnerExecutionErrorV2(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_CLEANUP_REJECTED",
      "Invocation evidence runner could not close its claimed execution lease",
      {
        cause: failure === undefined
          ? cleanupError
          : new AggregateError([failure, cleanupError]),
      },
    );
  } finally {
    state.lifecycle.status = "consumed";
  }

  if (failure !== undefined) throw failure;
  if (!result) {
    return fail(
      "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_RESULT_INVALID",
      "Invocation evidence runner completed without one durable result",
    );
  }
  return result;
}

export async function executeCliInvocationEvidenceRunnerLeaseInternalV2(
  input: unknown,
): Promise<DurableEvidenceExecutionResultV2> {
  return executeForRunnerV2(
    input,
    EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
    "cli_process",
  );
}

export async function executeHttpInvocationEvidenceRunnerLeaseInternalV2(
  input: unknown,
): Promise<DurableEvidenceExecutionResultV2> {
  return executeForRunnerV2(
    input,
    EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
    "http_service",
  );
}
