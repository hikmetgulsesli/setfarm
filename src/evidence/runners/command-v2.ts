import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import {
  ContentAddressedArtifactStore,
} from "../../product-compiler/artifact-store.js";
import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  getProductDeliveryProfileCatalogV2,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import {
  CandidateRuntimeBundleAuthorityV2,
  CandidateRuntimeBundleErrorV2,
  CandidateRuntimeCommandExecutionLeaseInternalV2,
  executeCandidateRuntimeCommandLeaseInternalV2,
  issueCandidateRuntimeCommandExecutionLeaseInternalV2,
} from "../../execution/candidate-runtime-bundle-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from "../../execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  publishCandidateEvidenceV2ForTest,
} from "../durable-evidence-publication-v2.js";
import {
  getEvidenceAdapterDefinitionCatalogV2,
} from "../schemas/evidence-adapter-definition-catalog-v2.js";
import {
  EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_SOURCE_MODULE_LOCATOR_V2,
} from "../schemas/command-runner-v2.js";
import {
  EVIDENCE_PROCESS_SIGNAL_NAMES_V2,
  EVIDENCE_RECEIPT_V2_SCHEMA,
  EvidenceExecutionIdentityV2Schema,
  createEvidenceOutcomeCandidateV2,
  evidenceReceiptAbiPolicyHashV2,
  hashEvidenceReceiptV2,
  parseEvidenceReceiptCandidateV2,
  type EvidenceExecutionIdentityV2,
  type EvidenceReceiptHashPayloadV2,
} from "../schemas/evidence-receipt-v2.js";
import type {
  DurableEvidenceExecutionResultV2,
} from "../schemas/evidence-runner-v2.js";

export type CommandEvidenceRunnerErrorCodeV2 =
  | "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID"
  | "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED"
  | "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_ALREADY_CONSUMED"
  | "EVIDENCE_COMMAND_RUNNER_V2_RUNTIME_REJECTED"
  | "EVIDENCE_COMMAND_RUNNER_V2_IMPLEMENTATION_DRIFT"
  | "EVIDENCE_COMMAND_RUNNER_V2_RECEIPT_INVALID"
  | "EVIDENCE_COMMAND_RUNNER_V2_PUBLICATION_REJECTED";

export class CommandEvidenceRunnerErrorV2 extends Error {
  readonly code: CommandEvidenceRunnerErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: CommandEvidenceRunnerErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "CommandEvidenceRunnerErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: CommandEvidenceRunnerErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new CommandEvidenceRunnerErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
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
      "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
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
      "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
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
        "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
  }
  return input as Readonly<Record<string, unknown>>;
}

type ExactRunnerModuleV2 = Readonly<{
  contentHash: string;
  physicalIdentityHash: string;
}>;

function captureExactRunnerModuleV2(): ExactRunnerModuleV2 {
  const absolutePath = realpathSync(fileURLToPath(import.meta.url));
  if (
    !absolutePath.endsWith(
      `/${EVIDENCE_COMMAND_RUNNER_SOURCE_MODULE_LOCATOR_V2}`,
    )
  ) {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_IMPLEMENTATION_DRIFT",
      "Test command runner is not executing its declared TypeScript source module",
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
      "EVIDENCE_COMMAND_RUNNER_V2_IMPLEMENTATION_DRIFT",
      "Test command runner source is not one stable regular file",
    );
  }
  const contentHash = sha256(bytes);
  bytes.fill(0);
  return Object.freeze({
    contentHash,
    physicalIdentityHash: hashCanonicalJson({
      schema: "setfarm.evidence-command-runner-source-physical-file.v2",
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

type CommandEvidenceRunnerAuthorityStateV2 = Readonly<{
  runtimeLease: CandidateRuntimeCommandExecutionLeaseInternalV2;
  issued: Awaited<ReturnType<
    typeof issueCandidateRuntimeCommandExecutionLeaseInternalV2
  >>;
  store: ContentAddressedArtifactStore;
  execution: EvidenceExecutionIdentityV2;
  runnerModule: ExactRunnerModuleV2;
  platformCatalog: ReturnType<
    typeof getPlatformEvidenceDefinitionCatalogsV2
  >;
  runnerRequirement:
    ReturnType<
      typeof getPlatformEvidenceDefinitionCatalogsV2
    >["runnerRequirements"]["definitions"][number];
  adapterCatalog: ReturnType<
    typeof getEvidenceAdapterDefinitionCatalogV2
  >;
  adapterRequirement:
    ReturnType<
      typeof getEvidenceAdapterDefinitionCatalogV2
    >["definitions"][number];
  profile: ReturnType<
    typeof getProductDeliveryProfileCatalogV2
  >["profiles"][number];
  lifecycle: { status: "ready" | "claimed" | "consumed" };
}>;

const commandEvidenceRunnerAuthorityConstructorCapabilityV2 =
  Object.freeze({});
const commandEvidenceRunnerAuthorityStateV2 = new WeakMap<
  object,
  CommandEvidenceRunnerAuthorityStateV2
>();

export class CommandEvidenceRunnerAuthorityV2 {
  readonly runtimeBundleHash: string;
  readonly buildReceiptHash: string;
  readonly commandDefinitionHash: string;
  readonly predicateRef: string;
  readonly productionUse: "forbidden_shadow_test_fixture";

  constructor(
    capability: object,
    state: CommandEvidenceRunnerAuthorityStateV2,
  ) {
    if (
      capability
        !== commandEvidenceRunnerAuthorityConstructorCapabilityV2
    ) {
      throw new CommandEvidenceRunnerErrorV2(
        "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED",
        "Command evidence runner constructor capability is unavailable",
      );
    }
    this.runtimeBundleHash = state.issued.runtimeBundleHash;
    this.buildReceiptHash = state.issued.buildReceiptHash;
    this.commandDefinitionHash = state.issued.commandDefinitionHash;
    this.predicateRef = state.execution.predicateRef;
    this.productionUse = "forbidden_shadow_test_fixture";
    commandEvidenceRunnerAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticAuthorityV2(
  authority: CommandEvidenceRunnerAuthorityV2,
): CommandEvidenceRunnerAuthorityStateV2 {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority)
      !== CommandEvidenceRunnerAuthorityV2.prototype
  ) {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED",
      "Command evidence execution requires one authentic authority",
    );
  }
  const state = commandEvidenceRunnerAuthorityStateV2.get(authority);
  if (!state) {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED",
      "Command evidence execution requires one authentic authority",
    );
  }
  return state;
}

export type IssuedCommandEvidenceRunnerAuthorityV2 = Readonly<{
  status: "issued_shadow_test_fixture_authority";
  productionUse: "forbidden";
  authority: CommandEvidenceRunnerAuthorityV2;
}>;

export async function issueCommandEvidenceRunnerAuthorityV2ForTest(
  input: unknown,
): Promise<IssuedCommandEvidenceRunnerAuthorityV2> {
  const values = exactDataRecord(
    input,
    ["runtimeAuthority", "expectedBundleHash", "store", "execution"],
    "Command evidence runner test authority input",
  );
  if (
    isProxy(values.runtimeAuthority)
    || !(values.runtimeAuthority instanceof CandidateRuntimeBundleAuthorityV2)
    || typeof values.expectedBundleHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.expectedBundleHash)
    || isProxy(values.store)
    || Object.getPrototypeOf(values.store)
      !== ContentAddressedArtifactStore.prototype
    || Object.prototype.hasOwnProperty.call(values.store, "put")
    || Object.prototype.hasOwnProperty.call(values.store, "get")
    || Object.prototype.hasOwnProperty.call(values.store, "putPreparedBatch")
  ) {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
      "Command evidence runner test authority fields are invalid",
    );
  }
  let execution: EvidenceExecutionIdentityV2;
  try {
    execution = EvidenceExecutionIdentityV2Schema.parse(values.execution);
  } catch (error) {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
      "Command evidence execution identity is invalid",
      error,
    );
  }
  try {
    const issued =
      await issueCandidateRuntimeCommandExecutionLeaseInternalV2(
        values.runtimeAuthority,
        values.expectedBundleHash,
        "test_fixture",
      );
    const platformCatalog = getPlatformEvidenceDefinitionCatalogsV2();
    const runnerRequirement =
      platformCatalog.runnerRequirements.definitions.find(
        (requirement) =>
          requirement.runnerEntrypointRef
            === EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
      );
    const adapterCatalog = getEvidenceAdapterDefinitionCatalogV2();
    const adapterRequirement = adapterCatalog.definitions.find(
      (requirement) =>
        requirement.invocationKind === "command"
        && requirement.profileRequirement.profileId === issued.profileId,
    );
    const profileCatalog = getProductDeliveryProfileCatalogV2();
    const profile = profileCatalog.profiles.find(
      (candidate) => candidate.id === issued.profileId,
    );
    if (
      !runnerRequirement
      || runnerRequirement.requiredAbiRef
        !== "EVIDENCE_COMMAND_RUNNER_ABI_V2"
      || !adapterRequirement
      || adapterRequirement.checkRequirement.checkRef !== "CHECK_TEST_PASS"
      || adapterRequirement.executionRequirement.kind
        !== "generated_test_command"
      || !profile
      || profile.stackPackBinding.stackPackContentHash
        !== issued.stackPackContentHash
    ) {
      return fail(
        "EVIDENCE_COMMAND_RUNNER_V2_RUNTIME_REJECTED",
        "Code-owned runner, adapter and profile definitions do not close the command authority",
      );
    }
    const runnerModule = captureExactRunnerModuleV2();
    const lifecycle: CommandEvidenceRunnerAuthorityStateV2["lifecycle"] = {
      status: "ready",
    };
    const state: CommandEvidenceRunnerAuthorityStateV2 = Object.freeze({
      runtimeLease: issued.lease,
      issued,
      store: values.store as ContentAddressedArtifactStore,
      execution,
      runnerModule,
      platformCatalog,
      runnerRequirement,
      adapterCatalog,
      adapterRequirement,
      profile,
      lifecycle,
    });
    const authority = new CommandEvidenceRunnerAuthorityV2(
      commandEvidenceRunnerAuthorityConstructorCapabilityV2,
      state,
    );
    return Object.freeze({
      status: "issued_shadow_test_fixture_authority" as const,
      productionUse: "forbidden" as const,
      authority,
    });
  } catch (error) {
    if (error instanceof CommandEvidenceRunnerErrorV2) throw error;
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_RUNTIME_REJECTED",
      "Candidate runtime rejected command evidence authority",
      error,
    );
  }
}

function processTerminationV2(
  process: Awaited<ReturnType<
    typeof executeCandidateRuntimeCommandLeaseInternalV2
  >>["process"],
): Extract<
  EvidenceReceiptHashPayloadV2["lifecycle"],
  { processIdentityHash: string }
>["termination"] {
  if (process.termination.status === "exited") {
    return {
      status: "normal_exit",
      exitCode: process.termination.exitCode,
    };
  }
  if (process.termination.status === "platform_terminated") {
    return {
      status: "platform_terminated",
      signal: "SIGKILL",
      terminationReceiptHash: hashCanonicalJson({
        schema: "setfarm.evidence-command-platform-termination.v2",
        reason: process.termination.reason,
        pid: process.pid,
        startedAt: process.startedAt,
        finishedAt: process.finishedAt,
      }),
    };
  }
  const name = process.termination.signal;
  const signal = (EVIDENCE_PROCESS_SIGNAL_NAMES_V2 as readonly string[])
    .includes(name)
    ? {
        kind: "known_posix" as const,
        name: name as (typeof EVIDENCE_PROCESS_SIGNAL_NAMES_V2)[number],
      }
    : {
        kind: "runtime_reported_name" as const,
        name,
      };
  return {
    status: "signal_exit",
    signal,
    coreDumped: false,
    observationReceiptHash: hashCanonicalJson({
      schema: "setfarm.evidence-command-signal-observation.v2",
      signal,
      pid: process.pid,
      startedAt: process.startedAt,
      finishedAt: process.finishedAt,
    }),
  };
}

function commandLifecycleV2(
  result: Awaited<ReturnType<
    typeof executeCandidateRuntimeCommandLeaseInternalV2
  >>,
): Extract<
  EvidenceReceiptHashPayloadV2["lifecycle"],
  { processIdentityHash: string }
> {
  const process = result.process;
  const processIdentityHash = hashCanonicalJson({
    schema: "setfarm.evidence-command-process-identity.v2",
    pid: process.pid,
    runtimeBundleHash: result.runtimeBundleHash,
    buildReceiptHash: result.buildReceiptHash,
    commandDefinitionHash: result.commandDefinitionHash,
    testOutputContentHash: result.testOutputContentHash,
    nodeIdentityHash: result.nodeIdentityHash,
    nodeExecutableContentHash: result.nodeExecutableContentHash,
    environmentInstanceHash: process.environmentInstanceHash,
    sandboxExecutableContentHash:
      process.sandboxExecutableContentHash,
    sandboxExecutablePhysicalIdentityHash:
      process.sandboxExecutablePhysicalIdentityHash,
    sandboxProfileHash: process.sandboxProfileHash,
  });
  const termination = processTerminationV2(process);
  const identity = {
    kind: "command_process" as const,
    processIdentityHash,
    termination,
  };
  return {
    ...identity,
    lifecycleReceiptHash: hashCanonicalJson({
      schema: "setfarm.evidence-command-lifecycle-receipt.v2",
      lifecycle: identity,
    }),
  };
}

function isPassingNodeTestV2(
  process: Awaited<ReturnType<
    typeof executeCandidateRuntimeCommandLeaseInternalV2
  >>["process"],
): boolean {
  const summary = process.tapSummary;
  return process.termination.status === "exited"
    && process.termination.exitCode === 0
    && summary.status === "valid_terminal_summary"
    && summary.testCount >= 1
    && summary.passCount === summary.testCount
    && summary.failCount === 0
    && summary.cancelledCount === 0
    && summary.skippedCount === 0
    && summary.todoCount === 0;
}

export async function runEvidenceAdapterV2(
  input: unknown,
): Promise<DurableEvidenceExecutionResultV2> {
  const values = exactDataRecord(
    input,
    ["authority"],
    "Command evidence runner input",
  );
  const state = authenticAuthorityV2(
    values.authority as CommandEvidenceRunnerAuthorityV2,
  );
  if (state.lifecycle.status !== "ready") {
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_ALREADY_CONSUMED",
      "Command evidence runner authority is one-use",
    );
  }
  state.lifecycle.status = "claimed";
  let runtimeResult: Awaited<ReturnType<
    typeof executeCandidateRuntimeCommandLeaseInternalV2
  >> | undefined;
  let observationBytes: Buffer | undefined;
  try {
    const runnerBefore = captureExactRunnerModuleV2();
    if (
      canonicalJsonStringify(runnerBefore)
        !== canonicalJsonStringify(state.runnerModule)
    ) {
      return fail(
        "EVIDENCE_COMMAND_RUNNER_V2_IMPLEMENTATION_DRIFT",
        "Command evidence runner changed after authority issuance",
      );
    }
    runtimeResult = await executeCandidateRuntimeCommandLeaseInternalV2(
      state.runtimeLease,
    );
    const runnerAfter = captureExactRunnerModuleV2();
    if (
      canonicalJsonStringify(runnerAfter)
        !== canonicalJsonStringify(runnerBefore)
      || runtimeResult.runtimeBundleHash !== state.issued.runtimeBundleHash
      || runtimeResult.runtimeBundleClosureHash
        !== state.issued.runtimeBundleClosureHash
      || runtimeResult.buildReceiptHash !== state.issued.buildReceiptHash
      || runtimeResult.buildTopologyHash !== state.issued.buildTopologyHash
      || runtimeResult.commandContractHash
        !== state.issued.commandContractHash
      || runtimeResult.commandDefinitionHash
        !== state.issued.commandDefinitionHash
      || runtimeResult.testOutputContentHash
        !== state.issued.testOutputContentHash
      || runtimeResult.testOutputByteLength
        !== state.issued.testOutputByteLength
      || runtimeResult.testOutputPhysicalIdentityHash
        !== state.issued.testOutputPhysicalIdentityHash
      || runtimeResult.profileId !== state.profile.id
      || runtimeResult.stackPackContentHash
        !== state.profile.stackPackBinding.stackPackContentHash
    ) {
      return fail(
        "EVIDENCE_COMMAND_RUNNER_V2_IMPLEMENTATION_DRIFT",
        "Command runner, runtime bundle, topology or test member changed across execution",
      );
    }
    const process = runtimeResult.process;
    const stdoutHash = sha256(process.stdout);
    const stderrHash = sha256(process.stderr);
    const lifecycle = commandLifecycleV2(runtimeResult);
    const passing = isPassingNodeTestV2(process);
    const protocolInvalid =
      process.termination.status === "exited"
      && process.termination.exitCode === 0
      && process.tapSummary.status === "invalid_or_incomplete_summary";
    const observedValueHash = hashCanonicalJson({
      schema: "setfarm.evidence-command-observed-value.v2",
      termination: process.termination,
      tapSummary: process.tapSummary,
      stdout: {
        contentHash: stdoutHash,
        byteLength: process.stdout.byteLength,
      },
      stderr: {
        contentHash: stderrHash,
        byteLength: process.stderr.byteLength,
      },
    });
    const invocationRequestHash = hashCanonicalJson({
      schema: "setfarm.evidence-command-invocation-request.v2",
      commandRef: runtimeResult.commandRef,
      commandContractHash: runtimeResult.commandContractHash,
      commandDefinitionHash: runtimeResult.commandDefinitionHash,
      buildTestLocator: runtimeResult.buildTestLocator,
      runtimeTestLocator: runtimeResult.runtimeTestLocator,
      testOutputContentHash: runtimeResult.testOutputContentHash,
      testOutputByteLength: runtimeResult.testOutputByteLength,
    });
    observationBytes = canonicalJsonBytes({
      schema: "setfarm.evidence-command-observation.v2",
      profileId: runtimeResult.profileId,
      runtimeBundleHash: runtimeResult.runtimeBundleHash,
      buildReceiptHash: runtimeResult.buildReceiptHash,
      buildTopologyHash: runtimeResult.buildTopologyHash,
      commandRef: runtimeResult.commandRef,
      commandContractHash: runtimeResult.commandContractHash,
      commandDefinitionHash: runtimeResult.commandDefinitionHash,
      testOutput: {
        contentHash: runtimeResult.testOutputContentHash,
        byteLength: runtimeResult.testOutputByteLength,
        mode: runtimeResult.testOutputMode,
      },
      process: {
        startedAt: process.startedAt,
        finishedAt: process.finishedAt,
        durationMs: process.durationMs,
        termination: process.termination,
        tapSummary: process.tapSummary,
        stdoutHash,
        stderrHash,
      },
      sourceFenceBeforeHash: runtimeResult.sourceFenceBeforeHash,
      sourceFenceAfterHash: runtimeResult.sourceFenceAfterHash,
    });
    const producer = {
      pass: "evidence-command-runner-v2",
      codeSha: runtimeResult.producerCodeSha,
      toolVersions: {
        evidenceCommandRunner: "2.0.0",
        evidenceReceipt: "2.0.0",
        runnerEntrypoint:
          EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
      },
    };
    const result = await publishCandidateEvidenceV2ForTest({
      store: state.store,
      producer,
      runnerEntrypointRef:
        EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
      captures: [
        {
          channelRef: "COMMAND_OBSERVATION_V2",
          mediaType: "application/json",
          bytes: observationBytes,
        },
        {
          channelRef: "COMMAND_STDERR_V2",
          mediaType: "text/plain",
          bytes: process.stderr,
        },
        {
          channelRef: "COMMAND_STDOUT_V2",
          mediaType: "text/plain",
          bytes: process.stdout,
        },
      ],
      createReceipt: (captures) => {
        const captureEnvelopeHashes = captures.map(
          (capture) => capture.artifactEnvelopeHash,
        );
        const outcome = createEvidenceOutcomeCandidateV2(
          protocolInvalid
            ? {
                schema: "setfarm.evidence-outcome.v2",
                version: "2.0.0",
                checkKind: "command",
                status: "platform_rejected",
                verdict: "inconclusive",
                failureOwner: "platform_release",
                code: "EVIDENCE_PLATFORM_AUTHORITY_REJECTED",
                captureEnvelopeHashes,
              }
            : passing
              ? {
                  schema: "setfarm.evidence-outcome.v2",
                  version: "2.0.0",
                  checkKind: "command",
                  status: "passed",
                  verdict: "pass",
                  failureOwner: "none",
                  code: "EVIDENCE_CHECK_PASSED",
                  observedValueHash,
                  captureEnvelopeHashes,
                }
              : {
                  schema: "setfarm.evidence-outcome.v2",
                  version: "2.0.0",
                  checkKind: "command",
                  status: "product_failed",
                  verdict: "fail",
                  failureOwner: "generated_product",
                  code: "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH",
                  observedValueHash,
                  captureEnvelopeHashes,
                },
        );
        const identity: EvidenceReceiptHashPayloadV2 = {
          schema: EVIDENCE_RECEIPT_V2_SCHEMA,
          version: "2.0.0",
          authorityState: "candidate_unverified",
          productionUse: "forbidden",
          release: {
            kind: "shadow_candidate",
            platformCatalogHash: state.platformCatalog.catalogHash,
            runnerRequirementHash:
              state.runnerRequirement.definitionHash,
            runnerSourceModuleHash: runnerBefore.contentHash,
            runnerAbiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
            receiptSchemaHash: evidenceReceiptAbiPolicyHashV2(),
            adapterRequirementHash:
              state.adapterRequirement.definitionHash,
            adapterDefinitionCatalogHash:
              state.adapterCatalog.catalogHash,
          },
          product: {
            packetHash: runtimeResult!.packetHash,
            buildTopologyHash: runtimeResult!.buildTopologyHash,
            profileCatalogHash:
              state.platformCatalog.profileCatalogBinding.catalogHash,
            profileId: state.profile.id,
            profileHash: state.profile.profileHash,
            stackPackHash:
              state.profile.stackPackBinding.stackPackContentHash,
          },
          candidate: {
            buildReceiptHash: runtimeResult!.buildReceiptHash,
            runtimeBundleHash: runtimeResult!.runtimeBundleHash,
          },
          operation: {
            kind: "command",
            runnerEntrypointRef:
              EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
            commandRef: runtimeResult!.commandRef,
            commandContractHash:
              runtimeResult!.commandContractHash,
            commandDefinitionHash:
              runtimeResult!.commandDefinitionHash,
            testOutputContentHash:
              runtimeResult!.testOutputContentHash,
            testOutputByteLength:
              runtimeResult!.testOutputByteLength,
          },
          execution: state.execution,
          sourceBefore: {
            schema: "setfarm.evidence-source-fence.v2",
            candidateSourceReceiptHash:
              runtimeResult!.candidateSourceReceiptHash,
            semanticRevisionHash:
              runtimeResult!.semanticRevisionHash,
            sourceMaterializationReceiptHash:
              runtimeResult!.sourceMaterializationReceiptHash,
            runtimeBundleHash: runtimeResult!.runtimeBundleHash,
            physicalFenceHash:
              runtimeResult!.sourceFenceBeforeHash,
            origin: { kind: "private_content_first" },
          },
          sourceAfter: {
            schema: "setfarm.evidence-source-fence.v2",
            candidateSourceReceiptHash:
              runtimeResult!.candidateSourceReceiptHash,
            semanticRevisionHash:
              runtimeResult!.semanticRevisionHash,
            sourceMaterializationReceiptHash:
              runtimeResult!.sourceMaterializationReceiptHash,
            runtimeBundleHash: runtimeResult!.runtimeBundleHash,
            physicalFenceHash:
              runtimeResult!.sourceFenceAfterHash,
            origin: { kind: "private_content_first" },
          },
          startedAt: process.startedAt,
          finishedAt: process.finishedAt,
          durationMs: process.durationMs,
          invocationRequestHash,
          invocationResponseHash: outcome.outcomeHash,
          lifecycle,
          outcome,
          captures: [...captures],
        };
        try {
          return parseEvidenceReceiptCandidateV2({
            ...identity,
            receiptHash: hashEvidenceReceiptV2(identity),
          });
        } catch (error) {
          return fail(
            "EVIDENCE_COMMAND_RUNNER_V2_RECEIPT_INVALID",
            "Command observation did not produce one canonical EvidenceReceiptV2",
            error,
          );
        }
      },
    });
    process.stdout.fill(0);
    process.stderr.fill(0);
    return result;
  } catch (error) {
    runtimeResult?.process.stdout.fill(0);
    runtimeResult?.process.stderr.fill(0);
    if (error instanceof CommandEvidenceRunnerErrorV2) throw error;
    if (error instanceof CandidateRuntimeBundleErrorV2) {
      return fail(
        "EVIDENCE_COMMAND_RUNNER_V2_RUNTIME_REJECTED",
        "Candidate runtime rejected command evidence execution",
        error,
      );
    }
    return fail(
      "EVIDENCE_COMMAND_RUNNER_V2_PUBLICATION_REJECTED",
      "Command evidence execution or durable publication failed",
      error,
    );
  } finally {
    observationBytes?.fill(0);
    state.lifecycle.status = "consumed";
  }
}
