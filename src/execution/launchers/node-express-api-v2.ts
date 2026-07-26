import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../../product-compiler/bounded-canonical-json.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  hashEncodedInvocationRequestV2,
  type HttpEncodedInvocationRequestV2,
} from "../../product-compiler/invocation-input-transport-v2.js";
import type {
  HttpInvocationInputTransportV2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  CandidateRuntimeApiExecutionLeaseInternalV2,
  CandidateRuntimeBundleAuthorityV2,
  CandidateRuntimeBundleErrorV2,
  executeCandidateRuntimeApiLeaseInternalV2,
  issueCandidateRuntimeApiExecutionLeaseInternalV2,
} from "../candidate-runtime-bundle-v2.js";
import {
  NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA,
  NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2,
  NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2,
  hashNodeExpressApiLaunchReceiptV2,
  parseNodeExpressApiLaunchReceiptV2,
  type NodeExpressApiLaunchReceiptHashPayloadV2,
  type NodeExpressApiLaunchReceiptV2,
} from "../schemas/node-express-api-launcher-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
} from "../schemas/exclusive-socket-lease-v2.js";

const NODE_EXPRESS_API_LAUNCH_INPUT_MAX_CANONICAL_BYTES_V2 =
  9 * 1024 * 1024;
const EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type NodeExpressApiLauncherErrorCodeV2 =
  | "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID"
  | "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED"
  | "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_ALREADY_CONSUMED"
  | "NODE_EXPRESS_API_LAUNCHER_V2_RUNTIME_REJECTED"
  | "NODE_EXPRESS_API_LAUNCHER_V2_TRANSPORT_REJECTED"
  | "NODE_EXPRESS_API_LAUNCHER_V2_IMPLEMENTATION_DRIFT"
  | "NODE_EXPRESS_API_LAUNCHER_V2_RECEIPT_INVALID"
  | "NODE_EXPRESS_API_LAUNCHER_V2_OBSERVATION_DESTROYED";

export class NodeExpressApiLauncherErrorV2 extends Error {
  readonly code: NodeExpressApiLauncherErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeExpressApiLauncherErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeExpressApiLauncherErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: NodeExpressApiLauncherErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeExpressApiLauncherErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function defensiveJsonCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const pending: object[] = [];
  if (copy !== null && typeof copy === "object") pending.push(copy);
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object") pending.push(child);
    }
    Object.freeze(current);
  }
  return copy;
}

function exactDataRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isProxy(value)
    || (
      Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null
    )
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      `${label} must be one exact non-proxy data record`,
    );
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string")
    || canonicalJsonStringify([...ownKeys].sort())
      !== canonicalJsonStringify([...keys].sort())
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      `${label} fields must equal [${keys.join(", ")}]`,
    );
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor
      || !("value" in descriptor)
      || !descriptor.enumerable
    ) {
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactFixedHeadersV2(
  value: unknown,
  hasBody: boolean,
): HttpEncodedInvocationRequestV2["fixedHeaders"] {
  if (
    !Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API fixedHeaders must be one non-proxy data array",
    );
  }
  const expected = hasBody
    ? [
        { name: "accept", value: "application/json" },
        { name: "content-type", value: "application/json" },
      ] as const
    : [{ name: "accept", value: "application/json" }] as const;
  const expectedArrayKeys = [
    ...expected.map((_, index) => String(index)),
    "length",
  ];
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string")
    || canonicalJsonStringify([...ownKeys].sort())
      !== canonicalJsonStringify(expectedArrayKeys.sort())
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API fixedHeaders must contain only its exact dense elements",
    );
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !lengthDescriptor
    || !("value" in lengthDescriptor)
    || lengthDescriptor.value !== expected.length
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API fixedHeaders length must be one exact data property",
    );
  }
  const headers = expected.map((_, index) => {
    const entryDescriptor = Object.getOwnPropertyDescriptor(
      value,
      String(index),
    );
    if (
      !entryDescriptor
      || !("value" in entryDescriptor)
      || !entryDescriptor.enumerable
    ) {
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
        `Encoded API fixedHeaders[${index}] must be one enumerable data property`,
      );
    }
    const record = exactDataRecord(
      entryDescriptor.value,
      ["name", "value"],
      `Encoded API fixedHeaders[${index}]`,
    );
    return Object.freeze({
      name: record.name,
      value: record.value,
    });
  });
  if (canonicalJsonStringify(headers) !== canonicalJsonStringify(expected)) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_TRANSPORT_REJECTED",
      "Encoded API fixed headers differ from the authoritative transport",
    );
  }
  return Object.freeze(headers) as HttpEncodedInvocationRequestV2["fixedHeaders"];
}

type ExactEncodedApiRequestV2 = Readonly<{
  status: "encoded";
  kind: "http_request";
  request: HttpEncodedInvocationRequestV2;
  requestHash: string;
  canonicalBytes: string;
}>;

function exactEncodedApiRequestV2(
  value: unknown,
  contractHash: string,
): ExactEncodedApiRequestV2 {
  const outer = exactDataRecord(
    value,
    ["status", "kind", "request", "requestHash", "canonicalBytes"],
    "Encoded API request",
  );
  const requestValue = exactDataRecord(
    outer.request,
    [
      "method",
      "pathAndQuery",
      "fixedHeaders",
      "bodyBytes",
      "redirectPolicy",
    ],
    "Encoded API transport request",
  );
  const bodyBytes = requestValue.bodyBytes;
  if (
    bodyBytes !== null
    && (
      typeof bodyBytes !== "string"
      || Buffer.from(bodyBytes, "utf8").toString("utf8") !== bodyBytes
      || Buffer.byteLength(bodyBytes, "utf8")
        > NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2
    )
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API bodyBytes must be null or bounded exact UTF-8",
    );
  }
  const method = requestValue.method;
  const pathAndQuery = requestValue.pathAndQuery;
  if (
    !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(method))
    || typeof pathAndQuery !== "string"
    || !pathAndQuery.startsWith("/")
    || pathAndQuery.includes("\0")
    || pathAndQuery.includes("\r")
    || pathAndQuery.includes("\n")
    || pathAndQuery.includes("#")
    || pathAndQuery.includes("://")
    || Buffer.from(pathAndQuery, "utf8").toString("utf8") !== pathAndQuery
    || Buffer.byteLength(pathAndQuery, "utf8")
      > NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API method and path must be one bounded relative request",
    );
  }
  const fixedHeaders = exactFixedHeadersV2(
    requestValue.fixedHeaders,
    bodyBytes !== null,
  );
  if (requestValue.redirectPolicy !== "error") {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_TRANSPORT_REJECTED",
      "Encoded API redirect policy must remain error",
    );
  }
  const request: HttpEncodedInvocationRequestV2 = Object.freeze({
    method: method as HttpEncodedInvocationRequestV2["method"],
    pathAndQuery,
    fixedHeaders,
    bodyBytes: bodyBytes as string | null,
    redirectPolicy: "error",
  });
  if (
    outer.status !== "encoded"
    || outer.kind !== "http_request"
    || typeof outer.requestHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(outer.requestHash)
    || typeof outer.canonicalBytes !== "string"
    || outer.canonicalBytes !== canonicalJsonStringify(request)
    || outer.requestHash
      !== hashEncodedInvocationRequestV2(contractHash, request)
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_TRANSPORT_REJECTED",
      "Encoded API request does not reproduce from its authoritative transport",
    );
  }
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: NODE_EXPRESS_API_LAUNCH_INPUT_MAX_CANONICAL_BYTES_V2,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Encoded API request exceeds its canonical input bound",
      error,
    );
  }
  return Object.freeze({
    status: "encoded" as const,
    kind: "http_request" as const,
    request,
    requestHash: outer.requestHash,
    canonicalBytes: outer.canonicalBytes,
  });
}

type ExactLauncherModuleV2 = Readonly<{
  contentHash: string;
  physicalIdentityHash: string;
}>;

function captureExactLauncherModuleV2(): ExactLauncherModuleV2 {
  const absolutePath = realpathSync(fileURLToPath(import.meta.url));
  if (
    !absolutePath.endsWith(
      `/${NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2}`,
    )
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
      "Test API launcher is not executing its declared TypeScript source module",
    );
  }
  const before = lstatSync(absolutePath);
  const bytes = readFileSync(absolutePath);
  const after = lstatSync(absolutePath);
  const identityBefore = [
    before.dev,
    before.ino,
    before.uid,
    before.gid,
    before.mode & 0o7777,
    before.size,
    before.mtimeMs,
    before.ctimeMs,
    before.nlink,
  ];
  const identityAfter = [
    after.dev,
    after.ino,
    after.uid,
    after.gid,
    after.mode & 0o7777,
    after.size,
    after.mtimeMs,
    after.ctimeMs,
    after.nlink,
  ];
  if (
    !before.isFile()
    || before.nlink !== 1
    || canonicalJsonStringify(identityBefore)
      !== canonicalJsonStringify(identityAfter)
    || bytes.byteLength !== after.size
  ) {
    bytes.fill(0);
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
      "Test API launcher source is not one stable regular file",
    );
  }
  const contentHash = sha256(bytes);
  bytes.fill(0);
  return Object.freeze({
    contentHash,
    physicalIdentityHash: hashCanonicalJson({
      schema: "setfarm.node-express-api-launcher-source-physical-file.v2",
      device: after.dev,
      inode: after.ino,
      ownerUid: after.uid,
      ownerGid: after.gid,
      mode: after.mode & 0o7777,
      byteLength: after.size,
      modifiedMs: after.mtimeMs,
      changedMs: after.ctimeMs,
      linkCount: after.nlink,
      contentHash,
    }),
  });
}

type NodeExpressApiLaunchAuthorityStateV2 = Readonly<{
  runtimeLease: CandidateRuntimeApiExecutionLeaseInternalV2;
  contract: Readonly<HttpInvocationInputTransportV2>;
  issued: Awaited<ReturnType<
    typeof issueCandidateRuntimeApiExecutionLeaseInternalV2
  >>;
  launcherModule: ExactLauncherModuleV2;
  lifecycle: { status: "ready" | "claimed" | "consumed" };
}>;

const nodeExpressApiLaunchAuthorityConstructorCapabilityV2 =
  Object.freeze({});
const nodeExpressApiLaunchAuthorityStateV2 = new WeakMap<
  object,
  NodeExpressApiLaunchAuthorityStateV2
>();

export class NodeExpressApiLaunchAuthorityV2 {
  readonly runtimeBundleHash: string;
  readonly actionRef: string;
  readonly transportContractHash: string;
  readonly productionUse: "forbidden_until_verified_release_join";

  constructor(
    capability: object,
    state: NodeExpressApiLaunchAuthorityStateV2,
  ) {
    if (
      capability !== nodeExpressApiLaunchAuthorityConstructorCapabilityV2
    ) {
      throw new NodeExpressApiLauncherErrorV2(
        "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
        "Node Express API launch authority constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.issued.runtimeBundleHash;
    this.actionRef = state.contract.actionRef;
    this.transportContractHash = state.contract.contractHash;
    this.productionUse = "forbidden_until_verified_release_join";
    nodeExpressApiLaunchAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticLaunchAuthorityV2(
  authority: NodeExpressApiLaunchAuthorityV2,
): NodeExpressApiLaunchAuthorityStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority)
      !== NodeExpressApiLaunchAuthorityV2.prototype
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node Express API launch requires one authentic authority",
    );
  }
  const state = nodeExpressApiLaunchAuthorityStateV2.get(authority);
  if (!state) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node Express API launch requires one authentic authority",
    );
  }
  return state;
}

export type IssuedNodeExpressApiLaunchAuthorityV2 = Readonly<{
  status: "issued_test_fixture_authority";
  productionUse: "forbidden_until_verified_release_join";
  authority: NodeExpressApiLaunchAuthorityV2;
  transportContract: Readonly<HttpInvocationInputTransportV2>;
}>;

export async function issueNodeExpressApiLaunchAuthorityV2ForTest(
  input: unknown,
): Promise<IssuedNodeExpressApiLaunchAuthorityV2> {
  const values = exactDataRecord(
    input,
    ["runtimeAuthority", "expectedBundleHash", "actionRef"],
    "Node Express API test authority input",
  );
  if (
    isProxy(values.runtimeAuthority)
    || !(values.runtimeAuthority instanceof CandidateRuntimeBundleAuthorityV2)
    || typeof values.expectedBundleHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.expectedBundleHash)
    || typeof values.actionRef !== "string"
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
      "Node Express API test authority input fields are invalid",
    );
  }
  try {
    const issued = await issueCandidateRuntimeApiExecutionLeaseInternalV2(
      values.runtimeAuthority,
      values.expectedBundleHash,
      "test_fixture",
      values.actionRef,
    );
    const launcherModule = captureExactLauncherModuleV2();
    const lifecycle: NodeExpressApiLaunchAuthorityStateV2["lifecycle"] = {
      status: "ready",
    };
    const state: NodeExpressApiLaunchAuthorityStateV2 = Object.freeze({
      runtimeLease: issued.lease,
      contract: issued.transportContract,
      issued,
      launcherModule,
      lifecycle,
    });
    const authority = new NodeExpressApiLaunchAuthorityV2(
      nodeExpressApiLaunchAuthorityConstructorCapabilityV2,
      state,
    );
    return Object.freeze({
      status: "issued_test_fixture_authority" as const,
      productionUse: "forbidden_until_verified_release_join" as const,
      authority,
      transportContract: defensiveJsonCopy(issued.transportContract),
    });
  } catch (error) {
    if (error instanceof NodeExpressApiLauncherErrorV2) throw error;
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_RUNTIME_REJECTED",
      "Candidate runtime rejected Node Express API launch authority",
      error,
    );
  }
}

type NodeExpressApiLaunchObservationStateV2 = Readonly<{
  receipt: NodeExpressApiLaunchReceiptV2;
  responseBody: Buffer;
  lifecycle: { status: "ready" | "destroyed" };
}>;

const nodeExpressApiObservationConstructorCapabilityV2 = Object.freeze({});
const nodeExpressApiObservationStateV2 = new WeakMap<
  object,
  NodeExpressApiLaunchObservationStateV2
>();

export class NodeExpressApiLaunchObservationV2 {
  readonly receiptHash: string;
  readonly runtimeBundleHash: string;
  readonly actionRef: string;
  readonly productionUse: "forbidden_until_verified_release_join";

  constructor(
    capability: object,
    state: NodeExpressApiLaunchObservationStateV2,
  ) {
    if (capability !== nodeExpressApiObservationConstructorCapabilityV2) {
      throw new NodeExpressApiLauncherErrorV2(
        "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
        "Node Express API observation constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.runtimeBundleHash = state.receipt.candidate.runtimeBundleHash;
    this.actionRef = state.receipt.transport.actionRef;
    this.productionUse = "forbidden_until_verified_release_join";
    nodeExpressApiObservationStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticObservationStateV2(
  observation: NodeExpressApiLaunchObservationV2,
): NodeExpressApiLaunchObservationStateV2 {
  if (
    typeof observation !== "object"
    || observation === null
    || isProxy(observation)
    || Object.getPrototypeOf(observation)
      !== NodeExpressApiLaunchObservationV2.prototype
  ) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node Express API capture access requires one authentic observation",
    );
  }
  const state = nodeExpressApiObservationStateV2.get(observation);
  if (!state) {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node Express API capture access requires one authentic observation",
    );
  }
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_OBSERVATION_DESTROYED",
      "Node Express API observation capture has already been destroyed",
    );
  }
  return state;
}

export function copyNodeExpressApiLaunchResponseBytesV2ForTest(
  observation: NodeExpressApiLaunchObservationV2,
): Buffer {
  return Buffer.from(authenticObservationStateV2(observation).responseBody);
}

export function destroyNodeExpressApiLaunchObservationV2(
  observation: NodeExpressApiLaunchObservationV2,
): void {
  const state = authenticObservationStateV2(observation);
  state.responseBody.fill(0);
  state.lifecycle.status = "destroyed";
}

export type NodeExpressApiLaunchResultV2 = Readonly<{
  status: "observed_unverified_release_candidate";
  productionUse: "forbidden_until_verified_release_join";
  receipt: NodeExpressApiLaunchReceiptV2;
  observation: NodeExpressApiLaunchObservationV2;
}>;

export async function launchNodeExpressApiV2(
  input: unknown,
): Promise<NodeExpressApiLaunchResultV2> {
  const values = exactDataRecord(
    input,
    ["authority", "encodedRequest"],
    "Node Express API launch input",
  );
  const authority = values.authority as NodeExpressApiLaunchAuthorityV2;
  const state = authenticLaunchAuthorityV2(authority);
  if (state.lifecycle.status !== "ready") {
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_ALREADY_CONSUMED",
      "Node Express API launch authority is one-use",
    );
  }
  state.lifecycle.status = "claimed";
  let runtimeResult: Awaited<ReturnType<
    typeof executeCandidateRuntimeApiLeaseInternalV2
  >> | undefined;
  try {
    const encoded = exactEncodedApiRequestV2(
      values.encodedRequest,
      state.contract.contractHash,
    );
    const launcherBefore = captureExactLauncherModuleV2();
    if (
      canonicalJsonStringify(launcherBefore)
        !== canonicalJsonStringify(state.launcherModule)
    ) {
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
        "Node Express API launcher source changed after authority issuance",
      );
    }
    runtimeResult = await executeCandidateRuntimeApiLeaseInternalV2(
      state.runtimeLease,
      encoded.request,
    );
    const launcherAfter = captureExactLauncherModuleV2();
    if (
      canonicalJsonStringify(launcherAfter)
        !== canonicalJsonStringify(launcherBefore)
      || runtimeResult.runtimeBundleHash !== state.issued.runtimeBundleHash
      || runtimeResult.runtimeBundleClosureHash
        !== state.issued.runtimeBundleClosureHash
      || runtimeResult.buildReceiptHash !== state.issued.buildReceiptHash
      || runtimeResult.applicationTreeHash
        !== state.issued.applicationTreeHash
      || runtimeResult.materializationHash
        !== state.issued.materializationHash
      || runtimeResult.moduleContentHash !== state.issued.moduleContentHash
      || runtimeResult.modulePhysicalIdentityHash
        !== state.issued.modulePhysicalIdentityHash
      || runtimeResult.applicationExport !== state.issued.applicationExport
      || runtimeResult.transportContract.contractHash
        !== state.contract.contractHash
      || runtimeResult.transportSetHash !== state.issued.transportSetHash
      || runtimeResult.transportMembershipHash
        !== state.issued.transportMembershipHash
      || runtimeResult.runtimeSourceLogicalReceiptHash
        !== state.issued.runtimeSourceLogicalReceiptHash
    ) {
      runtimeResult.process.responseBody.fill(0);
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
        "Node Express API launcher, runtime bundle or transport changed across execution",
      );
    }
    const process = runtimeResult.process;
    const requestBody = encoded.request.bodyBytes === null
      ? Buffer.alloc(0)
      : Buffer.from(encoded.request.bodyBytes, "utf8");
    const receiptIdentity: NodeExpressApiLaunchReceiptHashPayloadV2 = {
      schema: NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      launcher: {
        launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
        releaseModuleLocator:
          NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
        requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
        abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
        abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
        handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
        observedImplementation: {
          scope: "test_fixture_typescript_source",
          moduleLocator:
            NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
          moduleContentHash: launcherBefore.contentHash,
          modulePhysicalIdentityHash: launcherBefore.physicalIdentityHash,
        },
      },
      candidate: {
        runtimeBundleHash: runtimeResult.runtimeBundleHash,
        runtimeBundleClosureHash: runtimeResult.runtimeBundleClosureHash,
        buildReceiptHash: runtimeResult.buildReceiptHash,
        applicationTreeHash: runtimeResult.applicationTreeHash,
        materializationHash: runtimeResult.materializationHash,
        moduleLocator: NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
        moduleContentHash: runtimeResult.moduleContentHash,
        moduleByteLength: runtimeResult.moduleByteLength,
        moduleMode: runtimeResult.moduleMode,
        modulePhysicalIdentityHash:
          runtimeResult.modulePhysicalIdentityHash,
        applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
      },
      transport: {
        actionRef: state.contract.actionRef,
        contractHash: state.contract.contractHash,
        contractSetHash: runtimeResult.transportSetHash,
        contractMembershipHash: runtimeResult.transportMembershipHash,
        runtimeSourceLogicalReceiptHash:
          runtimeResult.runtimeSourceLogicalReceiptHash,
        requestHash: encoded.requestHash,
        method: encoded.request.method,
        pathAndQueryHash: sha256(encoded.request.pathAndQuery),
        pathAndQueryByteLength:
          Buffer.byteLength(encoded.request.pathAndQuery, "utf8"),
        fixedHeadersHash: hashCanonicalJson({
          schema: "setfarm.node-express-api-fixed-headers.v2",
          fixedHeaders: encoded.request.fixedHeaders,
        }),
        bodyContentHash: requestBody.byteLength === 0
          ? EMPTY_SHA256_V2
          : sha256(requestBody),
        bodyByteLength: requestBody.byteLength,
        redirectPolicy: encoded.request.redirectPolicy,
      },
      execution: {
        hostToolchainReceiptHash: runtimeResult.hostToolchainReceiptHash,
        nodeIdentityHash: runtimeResult.nodeIdentityHash,
        nodeExecutableContentHash: runtimeResult.nodeExecutableContentHash,
        sandboxExecutableContentHash:
          process.sandboxExecutableContentHash,
        sandboxExecutablePhysicalIdentityHash:
          process.sandboxExecutablePhysicalIdentityHash,
        sandboxProfileHash: process.sandboxProfileHash,
        bootstrapSourceHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
        normalizedEnvironmentHash: process.normalizedEnvironmentHash,
        environmentInstanceHash: process.environmentInstanceHash,
        socketLifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
        shell: "forbidden",
        ambientEnvironment: "forbidden",
        nodeOptionTokens: ["-e"],
        candidateVisibleExecArgv: [],
        childUmask: "0077",
        processGroupPolicy:
          "isolated_group_killed_on_every_terminal_path",
        cwdPolicy: "candidate_bundle_root",
        sourceFenceBeforeHash: runtimeResult.sourceFenceBeforeHash,
        sourceFenceAfterHash: runtimeResult.sourceFenceAfterHash,
      },
      socket: {
        lease: process.lease,
        acknowledgement: process.acknowledgement,
        readiness: process.readiness,
        cleanup: process.cleanup,
      },
      request: process.request,
      startedAt: process.startedAt,
      finishedAt: process.finishedAt,
      durationMs: process.durationMs,
    };
    requestBody.fill(0);
    let receipt: NodeExpressApiLaunchReceiptV2;
    try {
      receipt = parseNodeExpressApiLaunchReceiptV2({
        ...receiptIdentity,
        receiptHash: hashNodeExpressApiLaunchReceiptV2(receiptIdentity),
      });
    } catch (error) {
      process.responseBody.fill(0);
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_RECEIPT_INVALID",
        "Node Express API service observation did not produce one canonical receipt",
        error,
      );
    }
    const responseBody = Buffer.from(process.responseBody);
    process.responseBody.fill(0);
    const lifecycle: NodeExpressApiLaunchObservationStateV2["lifecycle"] = {
      status: "ready",
    };
    const observationState: NodeExpressApiLaunchObservationStateV2 =
      Object.freeze({
        receipt,
        responseBody,
        lifecycle,
      });
    const observation = new NodeExpressApiLaunchObservationV2(
      nodeExpressApiObservationConstructorCapabilityV2,
      observationState,
    );
    return Object.freeze({
      status: "observed_unverified_release_candidate" as const,
      productionUse: "forbidden_until_verified_release_join" as const,
      receipt,
      observation,
    });
  } catch (error) {
    runtimeResult?.process.responseBody.fill(0);
    if (error instanceof NodeExpressApiLauncherErrorV2) throw error;
    if (error instanceof CandidateRuntimeBundleErrorV2) {
      return fail(
        "NODE_EXPRESS_API_LAUNCHER_V2_RUNTIME_REJECTED",
        `Candidate runtime rejected Node Express API launch as ${error.code}`,
        error,
      );
    }
    return fail(
      "NODE_EXPRESS_API_LAUNCHER_V2_RUNTIME_REJECTED",
      "Node Express API launch failed at one authenticated runtime boundary",
      error,
    );
  } finally {
    state.lifecycle.status = "consumed";
  }
}
