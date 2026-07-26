import { createHash } from "node:crypto";

import type {
  HttpEncodedInvocationRequestV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import {
  acquireExclusiveSocketLeaseInternalV2,
  closeExclusiveSocketNodeExpressApiInternalV2,
  destroyExclusiveSocketLeaseInternalV2,
  handoffExclusiveSocketLeaseV2ToNodeExpressApiInternalV2,
  observeExclusiveSocketNodeExpressApiReadinessInternalV2,
  requestExclusiveSocketNodeExpressApiInternalV2,
} from "./exclusive-socket-lease-v2.js";
import {
  acquireNetworkSandboxLaunchContextInternalV2,
} from "./network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "./schemas/network-isolation-negative-probe-v2.js";
import {
  NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2,
  NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
} from "./schemas/node-express-api-launcher-v2.js";
import {
  SocketLaunchBindingV2Schema,
  hashSocketLaunchBindingV2,
  type ExclusiveSocketLeaseReceiptV2,
  type ServiceReadinessReceiptV2,
  type SocketCleanupReceiptV2,
  type SocketHandoffAcknowledgementV2,
  type SocketLaunchBindingV2,
} from "./schemas/exclusive-socket-lease-v2.js";

export type PrivateNodeExpressApiProcessErrorCodeV2 =
  | "NODE_EXPRESS_API_PROCESS_V2_INPUT_INVALID"
  | "NODE_EXPRESS_API_PROCESS_V2_HOST_DRIFT"
  | "NODE_EXPRESS_API_PROCESS_V2_LIFECYCLE_FAILED"
  | "NODE_EXPRESS_API_PROCESS_V2_RESPONSE_INVALID"
  | "NODE_EXPRESS_API_PROCESS_V2_CLEANUP_FAILED";

export class PrivateNodeExpressApiProcessErrorV2 extends Error {
  readonly code: PrivateNodeExpressApiProcessErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PrivateNodeExpressApiProcessErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PrivateNodeExpressApiProcessErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: PrivateNodeExpressApiProcessErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PrivateNodeExpressApiProcessErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function codeOwnedLaunchBindingV2(
  moduleContentHash: string,
): SocketLaunchBindingV2 {
  const identity = {
    launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
    launcherModuleHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
    applicationModuleLocator:
      NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
    applicationModuleHash: moduleContentHash,
    applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
    handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  };
  return Object.freeze(SocketLaunchBindingV2Schema.parse({
    ...identity,
    bindingHash: hashSocketLaunchBindingV2(identity),
  }));
}

export type PrivateNodeExpressApiProcessResultV2 = Readonly<{
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  launchBinding: SocketLaunchBindingV2;
  lease: ExclusiveSocketLeaseReceiptV2;
  acknowledgement: SocketHandoffAcknowledgementV2;
  readiness: ServiceReadinessReceiptV2;
  cleanup: SocketCleanupReceiptV2;
  request: Readonly<{
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    requestCount: 1;
    childCommittedRequestCount: 1;
    redirectCount: 0;
    statusCode: number;
    contentType: "application/json; charset=utf-8";
    responseContentHash: string;
    responseByteLength: number;
    childProcessIdentityHash: string;
  }>;
  responseBody: Buffer;
  environmentInstanceHash: string;
  normalizedEnvironmentHash:
    typeof NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2;
  sandboxExecutableContentHash: string;
  sandboxExecutablePhysicalIdentityHash: string;
  sandboxProfileHash: string;
}>;

/**
 * @internal Executes one authenticated HTTP request through one held socket and
 * always settles every child, descriptor, scratch and response-byte owner.
 */
export async function executePrivateNodeExpressApiProcessV2(
  input: Readonly<{
    bundleRoot: string;
    modulePath: string;
    moduleContentHash: string;
    nodeExecutablePath: string;
    request: HttpEncodedInvocationRequestV2;
  }>,
): Promise<PrivateNodeExpressApiProcessResultV2> {
  if (
    typeof input.moduleContentHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(input.moduleContentHash)
  ) {
    return fail(
      "NODE_EXPRESS_API_PROCESS_V2_INPUT_INVALID",
      "Node Express API process requires one exact module content hash",
    );
  }
  const started = Date.now();
  const launchBinding = codeOwnedLaunchBindingV2(input.moduleContentHash);
  const sandboxBefore =
    await acquireNetworkSandboxLaunchContextInternalV2();
  const acquired = await acquireExclusiveSocketLeaseInternalV2();
  let responseBody: Buffer | undefined;
  let primaryFailure: unknown;
  try {
    const handoff =
      await handoffExclusiveSocketLeaseV2ToNodeExpressApiInternalV2(
        acquired.lease,
        {
          bundleRoot: input.bundleRoot,
          modulePath: input.modulePath,
          moduleContentHash: input.moduleContentHash,
          nodeExecutablePath: input.nodeExecutablePath,
          sandboxExecutablePath: sandboxBefore.sandboxExecutablePath,
          sandboxExecutableContentHash:
            sandboxBefore.sandboxExecutableContentHash,
          sandboxExecutablePhysicalIdentityHash:
            sandboxBefore.sandboxExecutablePhysicalIdentityHash,
          sandboxProfile: sandboxBefore.sandboxProfile,
          sandboxProfileHash: sandboxBefore.sandboxProfileHash,
          bootstrapSource: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2,
          bootstrapSourceHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
          launchBinding,
        },
      );
    const readiness =
      await observeExclusiveSocketNodeExpressApiReadinessInternalV2(
        acquired.lease,
      );
    const request = await requestExclusiveSocketNodeExpressApiInternalV2(
      acquired.lease,
      input.request,
    );
    responseBody = request.body;
    const cleanup = await closeExclusiveSocketNodeExpressApiInternalV2(
      acquired.lease,
    );
    const sandboxAfter =
      await acquireNetworkSandboxLaunchContextInternalV2();
    if (
      sandboxAfter.sandboxExecutableContentHash
        !== sandboxBefore.sandboxExecutableContentHash
      || sandboxAfter.sandboxExecutablePhysicalIdentityHash
        !== sandboxBefore.sandboxExecutablePhysicalIdentityHash
      || sandboxAfter.sandboxProfileHash !== sandboxBefore.sandboxProfileHash
    ) {
      responseBody.fill(0);
      return fail(
        "NODE_EXPRESS_API_PROCESS_V2_HOST_DRIFT",
        "Network sandbox authority changed across API execution",
      );
    }
    if (
      handoff.leaseReceipt.leaseHash !== acquired.receipt.leaseHash
      || handoff.acknowledgement.launchBinding.bindingHash
        !== launchBinding.bindingHash
      || readiness.receipt.acknowledgementHash
        !== handoff.acknowledgement.acknowledgementHash
      || cleanup.receipt.readinessHash !== readiness.receipt.readinessHash
      || request.childProcessIdentityHash
        !== handoff.acknowledgement.childProcessIdentityHash
      || handoff.normalizedEnvironmentHash
        !== NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2
    ) {
      responseBody.fill(0);
      return fail(
        "NODE_EXPRESS_API_PROCESS_V2_LIFECYCLE_FAILED",
        "Node Express API process observations do not form one lifecycle",
      );
    }
    if (
      request.contentType !== "application/json; charset=utf-8"
      || request.body.byteLength > 1_048_576
    ) {
      responseBody.fill(0);
      return fail(
        "NODE_EXPRESS_API_PROCESS_V2_RESPONSE_INVALID",
        "Node Express API response does not match its exact JSON byte ABI",
      );
    }
    const finished = Date.now();
    return Object.freeze({
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      launchBinding,
      lease: acquired.receipt,
      acknowledgement: handoff.acknowledgement,
      readiness: readiness.receipt,
      cleanup: cleanup.receipt,
      request: Object.freeze({
        startedAt: request.startedAt,
        finishedAt: request.finishedAt,
        durationMs: request.durationMs,
        requestCount: request.requestCount,
        // The authenticated cleanup acknowledgement cannot succeed unless the
        // child observed exactly one application request.
        childCommittedRequestCount: 1 as const,
        redirectCount: request.redirectCount,
        statusCode: request.statusCode,
        contentType: request.contentType,
        responseContentHash: sha256(request.body),
        responseByteLength: request.body.byteLength,
        childProcessIdentityHash: request.childProcessIdentityHash,
      }),
      responseBody,
      environmentInstanceHash: handoff.environmentInstanceHash,
      normalizedEnvironmentHash: handoff.normalizedEnvironmentHash,
      sandboxExecutableContentHash:
        sandboxBefore.sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        sandboxBefore.sandboxExecutablePhysicalIdentityHash,
      sandboxProfileHash: sandboxBefore.sandboxProfileHash,
    });
  } catch (error) {
    primaryFailure = error;
    responseBody?.fill(0);
    if (
      error instanceof PrivateNodeExpressApiProcessErrorV2
      || (
        error !== null
        && typeof error === "object"
        && "code" in error
        && typeof error.code === "string"
        && (
          error.code.startsWith("NETWORK_ISOLATION_V2_")
          || error.code.startsWith("EXCLUSIVE_SOCKET_V2_")
        )
      )
    ) {
      throw error;
    }
    return fail(
      "NODE_EXPRESS_API_PROCESS_V2_LIFECYCLE_FAILED",
      "Private Node Express API execution failed at one typed platform boundary",
      error,
    );
  } finally {
    try {
      await destroyExclusiveSocketLeaseInternalV2(acquired.lease);
    } catch (cleanupError) {
      responseBody?.fill(0);
      throw new PrivateNodeExpressApiProcessErrorV2(
        "NODE_EXPRESS_API_PROCESS_V2_CLEANUP_FAILED",
        "Private Node Express API execution could not destroy every owned resource",
        { cause: { primaryFailure, cleanupError } },
      );
    }
  }
}
