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
  type CliEncodedInvocationRequestV2,
} from "../../product-compiler/invocation-input-transport-v2.js";
import type {
  CliInvocationInputTransportV2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  CandidateRuntimeBundleAuthorityV2,
  CandidateRuntimeBundleErrorV2,
  CandidateRuntimeCliExecutionLeaseInternalV2,
  executeCandidateRuntimeCliLeaseInternalV2,
  issueCandidateRuntimeCliExecutionLeaseInternalV2,
  type CandidateRuntimeInvocationSourceAuthorityInternalV2,
} from "../candidate-runtime-bundle-v2.js";
import {
  NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
  NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_REF_V2,
  NODE_CLI_LAUNCHER_EXPORT_V2,
  NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCHER_REF_V2,
  NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2,
  NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2,
  NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA,
  hashNodeCliLaunchReceiptV2,
  parseNodeCliLaunchReceiptV2,
  type NodeCliLaunchReceiptHashPayloadV2,
  type NodeCliLaunchReceiptV2,
} from "../schemas/node-cli-launcher-v2.js";

const NODE_CLI_LAUNCH_INPUT_MAX_CANONICAL_BYTES_V2 = 9 * 1024 * 1024;
const EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type NodeCliLauncherErrorCodeV2 =
  | "NODE_CLI_LAUNCHER_V2_INPUT_INVALID"
  | "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED"
  | "NODE_CLI_LAUNCHER_V2_AUTHORITY_ALREADY_CONSUMED"
  | "NODE_CLI_LAUNCHER_V2_RUNTIME_REJECTED"
  | "NODE_CLI_LAUNCHER_V2_TRANSPORT_REJECTED"
  | "NODE_CLI_LAUNCHER_V2_IMPLEMENTATION_DRIFT"
  | "NODE_CLI_LAUNCHER_V2_RECEIPT_INVALID"
  | "NODE_CLI_LAUNCHER_V2_OBSERVATION_DESTROYED";

export class NodeCliLauncherErrorV2 extends Error {
  readonly code: NodeCliLauncherErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeCliLauncherErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeCliLauncherErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: NodeCliLauncherErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeCliLauncherErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: Buffer): string {
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
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
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
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
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
        "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactStringArray(
  value: unknown,
  label: string,
): readonly string[] {
  if (!Array.isArray(value) || isProxy(value) || value.length > 10_000) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
      `${label} must be one bounded non-proxy string array`,
    );
  }
  const expectedKeys = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length",
  ];
  if (
    Object.getPrototypeOf(value) !== Array.prototype
    || canonicalJsonStringify(
      Reflect.ownKeys(value).map(String).sort(),
    ) !== canonicalJsonStringify(expectedKeys.sort())
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
      `${label} must not carry extra, symbolic or inherited array state`,
    );
  }
  const copy: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor
      || !("value" in descriptor)
      || typeof descriptor.value !== "string"
      || descriptor.value.includes("\0")
      || Buffer.from(descriptor.value, "utf8").toString("utf8")
        !== descriptor.value
    ) {
      return fail(
        "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
        `${label}[${index}] must be one exact UTF-8 data token`,
      );
    }
    copy.push(descriptor.value);
  }
  return Object.freeze(copy);
}

type ExactEncodedCliRequestV2 = Readonly<{
  status: "encoded";
  kind: "cli_command";
  request: CliEncodedInvocationRequestV2;
  requestHash: string;
  canonicalBytes: string;
}>;

function exactEncodedCliRequestV2(
  value: unknown,
  contractHash: string,
): ExactEncodedCliRequestV2 {
  const outer = exactDataRecord(
    value,
    ["status", "kind", "request", "requestHash", "canonicalBytes"],
    "Encoded CLI request",
  );
  const requestValue = exactDataRecord(
    outer.request,
    ["subcommandTokens", "argvSuffix", "stdinBytes"],
    "Encoded CLI transport request",
  );
  const subcommandTokens = exactStringArray(
    requestValue.subcommandTokens,
    "Encoded CLI transport subcommandTokens",
  );
  const argvSuffix = exactStringArray(
    requestValue.argvSuffix,
    "Encoded CLI transport argvSuffix",
  );
  const stdinBytes = requestValue.stdinBytes;
  if (
    stdinBytes !== null
    && (
      typeof stdinBytes !== "string"
      || Buffer.from(stdinBytes, "utf8").toString("utf8") !== stdinBytes
      || Buffer.byteLength(stdinBytes, "utf8")
        > NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2
    )
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
      "Encoded CLI transport stdinBytes must be null or bounded exact UTF-8",
    );
  }
  const request: CliEncodedInvocationRequestV2 = Object.freeze({
    subcommandTokens,
    argvSuffix,
    stdinBytes,
  });
  const argvByteLength = [...subcommandTokens, ...argvSuffix].reduce(
    (total, token) => total + Buffer.byteLength(token, "utf8") + 1,
    0,
  );
  if (
    outer.status !== "encoded"
    || outer.kind !== "cli_command"
    || typeof outer.requestHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(outer.requestHash)
    || typeof outer.canonicalBytes !== "string"
    || argvByteLength > NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2
    || outer.canonicalBytes !== canonicalJsonStringify(request)
    || outer.requestHash
      !== hashEncodedInvocationRequestV2(contractHash, request)
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_TRANSPORT_REJECTED",
      "Encoded CLI request does not reproduce from its authoritative transport",
    );
  }
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: NODE_CLI_LAUNCH_INPUT_MAX_CANONICAL_BYTES_V2,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
      "Encoded CLI request exceeds its canonical input bound",
      error,
    );
  }
  return Object.freeze({
    status: "encoded" as const,
    kind: "cli_command" as const,
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
  if (!absolutePath.endsWith(`/${NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2}`)) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
      "Test launcher is not executing its declared TypeScript source module",
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
      "NODE_CLI_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
      "Test launcher source is not one stable regular file",
    );
  }
  const contentHash = sha256(bytes);
  bytes.fill(0);
  return Object.freeze({
    contentHash,
    physicalIdentityHash: hashCanonicalJson({
      schema: "setfarm.node-cli-launcher-source-physical-file.v2",
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

type NodeCliLaunchAuthorityStateV2 = Readonly<{
  runtimeLease: CandidateRuntimeCliExecutionLeaseInternalV2;
  contract: Readonly<CliInvocationInputTransportV2>;
  issued: Awaited<ReturnType<
    typeof issueCandidateRuntimeCliExecutionLeaseInternalV2
  >>;
  launcherModule: ExactLauncherModuleV2;
  lifecycle: { status: "ready" | "claimed" | "consumed" };
}>;

const nodeCliLaunchAuthorityConstructorCapabilityV2 = Object.freeze({});
const nodeCliLaunchAuthorityStateV2 = new WeakMap<
  object,
  NodeCliLaunchAuthorityStateV2
>();

export class NodeCliLaunchAuthorityV2 {
  readonly runtimeBundleHash: string;
  readonly actionRef: string;
  readonly transportContractHash: string;
  readonly productionUse: "forbidden_until_verified_release_join";

  constructor(capability: object, state: NodeCliLaunchAuthorityStateV2) {
    if (capability !== nodeCliLaunchAuthorityConstructorCapabilityV2) {
      throw new NodeCliLauncherErrorV2(
        "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
        "Node CLI launch authority constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.issued.runtimeBundleHash;
    this.actionRef = state.contract.actionRef;
    this.transportContractHash = state.contract.contractHash;
    this.productionUse = "forbidden_until_verified_release_join";
    nodeCliLaunchAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticLaunchAuthorityV2(
  authority: NodeCliLaunchAuthorityV2,
): NodeCliLaunchAuthorityStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority) !== NodeCliLaunchAuthorityV2.prototype
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node CLI launch requires one authentic authority",
    );
  }
  const state = nodeCliLaunchAuthorityStateV2.get(authority);
  if (!state) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node CLI launch requires one authentic authority",
    );
  }
  return state;
}

export type IssuedNodeCliLaunchAuthorityV2 = Readonly<{
  status: "issued_test_fixture_authority";
  productionUse: "forbidden_until_verified_release_join";
  authority: NodeCliLaunchAuthorityV2;
  transportContract: Readonly<CliInvocationInputTransportV2>;
  sourceAuthority:
    CandidateRuntimeInvocationSourceAuthorityInternalV2;
}>;

export async function issueNodeCliLaunchAuthorityV2ForTest(
  input: unknown,
): Promise<IssuedNodeCliLaunchAuthorityV2> {
  const values = exactDataRecord(
    input,
    ["runtimeAuthority", "expectedBundleHash", "actionRef"],
    "Node CLI test authority input",
  );
  if (
    isProxy(values.runtimeAuthority)
    || !(values.runtimeAuthority instanceof CandidateRuntimeBundleAuthorityV2)
    || typeof values.expectedBundleHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.expectedBundleHash)
    || typeof values.actionRef !== "string"
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
      "Node CLI test authority input fields are invalid",
    );
  }
  try {
    const issued = await issueCandidateRuntimeCliExecutionLeaseInternalV2(
      values.runtimeAuthority,
      values.expectedBundleHash,
      "test_fixture",
      values.actionRef,
    );
    const launcherModule = captureExactLauncherModuleV2();
    const lifecycle: NodeCliLaunchAuthorityStateV2["lifecycle"] = {
      status: "ready",
    };
    const state: NodeCliLaunchAuthorityStateV2 = Object.freeze({
      runtimeLease: issued.lease,
      contract: issued.transportContract,
      issued,
      launcherModule,
      lifecycle,
    });
    const authority = new NodeCliLaunchAuthorityV2(
      nodeCliLaunchAuthorityConstructorCapabilityV2,
      state,
    );
    return Object.freeze({
      status: "issued_test_fixture_authority" as const,
      productionUse: "forbidden_until_verified_release_join" as const,
      authority,
      transportContract: defensiveJsonCopy(issued.transportContract),
      sourceAuthority: issued.sourceAuthority,
    });
  } catch (error) {
    if (error instanceof NodeCliLauncherErrorV2) throw error;
    return fail(
      "NODE_CLI_LAUNCHER_V2_RUNTIME_REJECTED",
      "Candidate runtime rejected Node CLI launch authority",
      error,
    );
  }
}

type NodeCliLaunchObservationStateV2 = Readonly<{
  receipt: NodeCliLaunchReceiptV2;
  stdout: Buffer;
  stderr: Buffer;
  lifecycle: { status: "ready" | "destroyed" };
}>;

const nodeCliObservationConstructorCapabilityV2 = Object.freeze({});
const nodeCliObservationStateV2 = new WeakMap<
  object,
  NodeCliLaunchObservationStateV2
>();

export class NodeCliLaunchObservationV2 {
  readonly receiptHash: string;
  readonly runtimeBundleHash: string;
  readonly actionRef: string;
  readonly productionUse: "forbidden_until_verified_release_join";

  constructor(capability: object, state: NodeCliLaunchObservationStateV2) {
    if (capability !== nodeCliObservationConstructorCapabilityV2) {
      throw new NodeCliLauncherErrorV2(
        "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
        "Node CLI observation constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    this.runtimeBundleHash = state.receipt.candidate.runtimeBundleHash;
    this.actionRef = state.receipt.transport.actionRef;
    this.productionUse = "forbidden_until_verified_release_join";
    nodeCliObservationStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticObservationStateV2(
  observation: NodeCliLaunchObservationV2,
): NodeCliLaunchObservationStateV2 {
  if (
    typeof observation !== "object"
    || observation === null
    || isProxy(observation)
    || Object.getPrototypeOf(observation)
      !== NodeCliLaunchObservationV2.prototype
  ) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node CLI capture access requires one authentic observation",
    );
  }
  const state = nodeCliObservationStateV2.get(observation);
  if (!state) {
    return fail(
      "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
      "Node CLI capture access requires one authentic observation",
    );
  }
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_CLI_LAUNCHER_V2_OBSERVATION_DESTROYED",
      "Node CLI observation capture has already been destroyed",
    );
  }
  return state;
}

export function copyNodeCliLaunchCaptureBytesV2ForTest(
  observation: NodeCliLaunchObservationV2,
): Readonly<{ stdout: Buffer; stderr: Buffer }> {
  const state = authenticObservationStateV2(observation);
  return Object.freeze({
    stdout: Buffer.from(state.stdout),
    stderr: Buffer.from(state.stderr),
  });
}

export function destroyNodeCliLaunchObservationV2(
  observation: NodeCliLaunchObservationV2,
): void {
  const state = authenticObservationStateV2(observation);
  state.stdout.fill(0);
  state.stderr.fill(0);
  state.lifecycle.status = "destroyed";
}

export type NodeCliLaunchResultV2 = Readonly<{
  status: "observed_unverified_release_candidate";
  productionUse: "forbidden_until_verified_release_join";
  receipt: NodeCliLaunchReceiptV2;
  observation: NodeCliLaunchObservationV2;
}>;

export async function launchNodeCliV2(
  input: unknown,
): Promise<NodeCliLaunchResultV2> {
  const values = exactDataRecord(
    input,
    ["authority", "encodedRequest"],
    "Node CLI launch input",
  );
  const authority = values.authority as NodeCliLaunchAuthorityV2;
  const state = authenticLaunchAuthorityV2(authority);
  if (state.lifecycle.status !== "ready") {
    return fail(
      "NODE_CLI_LAUNCHER_V2_AUTHORITY_ALREADY_CONSUMED",
      "Node CLI launch authority is one-use",
    );
  }
  state.lifecycle.status = "claimed";
  let runtimeResult: Awaited<ReturnType<
    typeof executeCandidateRuntimeCliLeaseInternalV2
  >> | undefined;
  try {
    const encoded = exactEncodedCliRequestV2(
      values.encodedRequest,
      state.contract.contractHash,
    );
    const launcherBefore = captureExactLauncherModuleV2();
    if (
      canonicalJsonStringify(launcherBefore)
        !== canonicalJsonStringify(state.launcherModule)
    ) {
      return fail(
        "NODE_CLI_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
        "Node CLI launcher source changed after authority issuance",
      );
    }
    runtimeResult = await executeCandidateRuntimeCliLeaseInternalV2(
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
      || runtimeResult.transportContract.contractHash
        !== state.contract.contractHash
      || runtimeResult.transportSetHash !== state.issued.transportSetHash
      || runtimeResult.transportMembershipHash
        !== state.issued.transportMembershipHash
      || runtimeResult.runtimeSourceLogicalReceiptHash
        !== state.issued.runtimeSourceLogicalReceiptHash
    ) {
      return fail(
        "NODE_CLI_LAUNCHER_V2_IMPLEMENTATION_DRIFT",
        "Node CLI launcher, runtime bundle or transport changed across execution",
      );
    }
    const process = runtimeResult.process;
    const receiptIdentity: NodeCliLaunchReceiptHashPayloadV2 = {
      schema: NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      launcher: {
        launcherRef: NODE_CLI_LAUNCHER_REF_V2,
        releaseModuleLocator: NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
        requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
        abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
        abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
        observedImplementation: {
          scope: "test_fixture_typescript_source",
          moduleLocator: NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
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
        moduleLocator: NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
        moduleContentHash: runtimeResult.moduleContentHash,
        moduleByteLength: runtimeResult.moduleByteLength,
        moduleMode: runtimeResult.moduleMode,
        modulePhysicalIdentityHash:
          runtimeResult.modulePhysicalIdentityHash,
      },
      transport: {
        actionRef: state.contract.actionRef,
        contractHash: state.contract.contractHash,
        contractSetHash: runtimeResult.transportSetHash,
        contractMembershipHash: runtimeResult.transportMembershipHash,
        runtimeSourceLogicalReceiptHash:
          runtimeResult.runtimeSourceLogicalReceiptHash,
        requestHash: encoded.requestHash,
        argvTokenCount: process.argvTokenCount,
        argvByteLength: process.argvByteLength,
        stdinContentHash: process.stdinContentHash,
        stdinByteLength: process.stdinByteLength,
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
        bootstrapSourceHash: NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
        normalizedEnvironmentHash: process.normalizedEnvironmentHash,
        environmentInstanceHash: process.environmentInstanceHash,
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
      startedAt: process.startedAt,
      finishedAt: process.finishedAt,
      durationMs: process.durationMs,
      process: {
        pid: process.pid,
        termination: process.termination,
        stdout: {
          contentHash: sha256(process.stdout),
          byteLength: process.stdout.byteLength,
        },
        stderr: {
          contentHash: process.stderr.byteLength === 0
            ? EMPTY_SHA256_V2
            : sha256(process.stderr),
          byteLength: process.stderr.byteLength,
        },
      },
    };
    let receipt: NodeCliLaunchReceiptV2;
    try {
      receipt = parseNodeCliLaunchReceiptV2({
        ...receiptIdentity,
        receiptHash: hashNodeCliLaunchReceiptV2(receiptIdentity),
      });
    } catch (error) {
      return fail(
        "NODE_CLI_LAUNCHER_V2_RECEIPT_INVALID",
        "Node CLI process observation did not produce one canonical receipt",
        error,
      );
    }
    const stdout = Buffer.from(process.stdout);
    const stderr = Buffer.from(process.stderr);
    process.stdout.fill(0);
    process.stderr.fill(0);
    const lifecycle: NodeCliLaunchObservationStateV2["lifecycle"] = {
      status: "ready",
    };
    const observationState: NodeCliLaunchObservationStateV2 = Object.freeze({
      receipt,
      stdout,
      stderr,
      lifecycle,
    });
    const observation = new NodeCliLaunchObservationV2(
      nodeCliObservationConstructorCapabilityV2,
      observationState,
    );
    return Object.freeze({
      status: "observed_unverified_release_candidate" as const,
      productionUse: "forbidden_until_verified_release_join" as const,
      receipt,
      observation,
    });
  } catch (error) {
    runtimeResult?.process.stdout.fill(0);
    runtimeResult?.process.stderr.fill(0);
    if (error instanceof NodeCliLauncherErrorV2) throw error;
    if (error instanceof CandidateRuntimeBundleErrorV2) {
      return fail(
        "NODE_CLI_LAUNCHER_V2_RUNTIME_REJECTED",
        `Candidate runtime rejected Node CLI launch as ${error.code}`,
        error,
      );
    }
    return fail(
      "NODE_CLI_LAUNCHER_V2_RUNTIME_REJECTED",
      "Node CLI launch failed at one authenticated runtime boundary",
      error,
    );
  } finally {
    state.lifecycle.status = "consumed";
  }
}
