import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:net";
import { promisify } from "node:util";
import type postgres from "postgres";
import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { isPlatformOwnedV3PreviewCommand } from "../product-compiler/stack-topology-catalog.js";
import { createRuntimeArtifactReader, type SealedRuntimePacket } from "../product-compiler/runtime-artifact-reader.js";
import {
  hashRuntimeDataContractV1,
  RuntimeDataContractV1Schema,
  type RuntimeDataContractV1,
} from "../product-compiler/schemas/runtime-data-contract-v1.js";
import type { BuildCommandV1, BuildTopologyV1 } from "../product-compiler/schemas/build-topology-v1.js";
import {
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
  resolveV3SealCapacity,
  runtimeConfig,
} from "../runtime-config.js";
import type { AcceptedCandidateV1 } from "../evidence/accepted-candidate-v1.js";
import {
  observeProcessIdentity,
} from "./process-identity.js";
import {
  captureV3BuildArtifact,
  exactV3BuildArtifactMatch,
} from "./v3-build-artifact.js";
import {
  ensureCanonicalV3StateRoot,
  materializeV3SealedRuntime,
  type V3SealDurabilityBoundary,
  verifyV3SealedRuntime,
} from "./v3-sealed-runtime.js";
import type { V3SealCapacityLimits } from "./v3-seal-capacity.js";
import {
  ProcessIdentityV1Schema,
  sameProcessIdentity,
  type ProcessIdentityV1,
} from "./schemas/process-identity-v1.js";
import {
  assertV3DeployAuthority,
  V3DeployAuthorityError,
  type V3DeployAuthorityResult,
} from "./v3-deploy-authority.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import {
  createV3DeployReceiptV1,
  V3BuildArtifactV1Schema,
  V3DeployHealthProofV1Schema,
  V3DeployReceiptV1Schema,
  V3RuntimeDeploymentV1Schema,
  type V3DeployHealthProofV1,
  type V3ListenerOwnershipV1,
  type V3DeployReceiptV1,
  type V3RuntimeDeploymentV1,
  type V3BuildArtifactV1,
} from "./schemas/v3-deploy-receipt-v1.js";
import {
  V3RuntimeIsolationAuthorityV1Schema,
  V3RuntimeIsolationPolicyV1Schema,
  V3RuntimeIsolationProofV1Schema,
  V3RuntimeVolumeProvisioningV1Schema,
  exactV3RuntimeIsolationAuthorityContext,
  type V3RuntimeIsolationAuthorityV1,
  type V3RuntimeIsolationPolicyV1,
  type V3RuntimeIsolationProofV1,
  type V3RuntimeVolumeProvisioningV1,
} from "./schemas/v3-runtime-isolation-v1.js";
import {
  createV3DeploymentObservationV1,
  type V3DeploymentObservationV1,
} from "./schemas/v3-deployment-observation-v1.js";
import {
  challengeDarwinIsolatedRuntime,
  canonicalDarwinIsolationConfigRoots,
  createWriteFreeDarwinIsolationBundle,
  darwinRuntimeIsolationAvailable,
  spawnDarwinIsolatedRuntime,
} from "./v3-darwin-runtime-isolation.js";

export {
  V3DeployHealthProofV1Schema,
  V3DeployReceiptV1Schema,
  V3RuntimeDeploymentV1Schema,
} from "./schemas/v3-deploy-receipt-v1.js";
export type {
  V3DeployHealthProofV1,
  V3DeployReceiptV1,
  V3RuntimeDeploymentV1,
} from "./schemas/v3-deploy-receipt-v1.js";

const execFileAsync = promisify(execFile);
const MAX_COMMAND_OUTPUT_BYTES = 16 * 1024 * 1024;
const DEFAULT_HEALTH_ATTEMPTS = 30;
const DEFAULT_HEALTH_INTERVAL_MS = 500;
const DEFAULT_LOCAL_PORT_START = 3_507;
const DEFAULT_LOCAL_PORT_END = 9_999;

export type V3DeployTargetV1 = Readonly<{
  mode: "local" | "remote";
  remoteHost?: string;
}>;

export type V3DeploymentRequestV1 = Readonly<{
  schema: "setfarm.v3-deployment-request.v1";
  runId: string;
  worktree: string;
  projectId: string;
  displayName: string;
  summary: string;
  candidate: AcceptedCandidateV1;
  topology: BuildTopologyV1;
  buildCommand: BuildCommandV1;
  previewCommand: BuildCommandV1;
  target: V3DeployTargetV1;
  environment: Readonly<Record<string, string>>;
}>;

export interface V3DeploymentPlatformAdapter {
  readonly notDeployableReason?: V3DeployNotDeployableReason;
  deploy(request: V3DeploymentRequestV1): Promise<Readonly<{
    runtime: V3RuntimeDeploymentV1;
    buildArtifact: V3BuildArtifactV1;
    lifecycleToken: string;
    stagedReceipt?: V3DeployReceiptV1;
  }>>;
  verifyHealth(
    request: V3DeploymentRequestV1,
    deployment: V3RuntimeDeploymentV1,
    buildArtifact: V3BuildArtifactV1,
    lifecycleToken: string,
  ): Promise<V3DeployHealthProofV1>;
  stagePublication(
    request: V3DeploymentRequestV1,
    deployment: V3RuntimeDeploymentV1,
    receipt: V3DeployReceiptV1,
    lifecycleToken: string,
  ): Promise<void>;
  release(
    request: V3DeploymentRequestV1,
    deployment: V3RuntimeDeploymentV1,
    lifecycleToken: string,
    outcome: "committed" | "reconcile",
  ): Promise<void>;
  rollback(
    request: V3DeploymentRequestV1,
    deployment: V3RuntimeDeploymentV1,
    reason: string,
    lifecycleToken: string,
  ): Promise<void>;
}

export type V3DeployNotDeployableReason =
  | "SEALED_TOPOLOGY_HAS_NO_PREVIEW_COMMAND"
  | "SEALED_RUNTIME_COMMAND_UNSUPPORTED"
  | "SEALED_RUNTIME_DATA_CONTRACT_INVALID"
  | "SEALED_RUNTIME_DATA_HARD_QUOTA_UNSUPPORTED"
  | "SEALED_RUNTIME_NETWORK_POLICY_UNSUPPORTED"
  | "SEALED_RUNTIME_ISOLATION_ADAPTER_UNAVAILABLE"
  | "SEALED_RUNTIME_ISOLATION_CONFIG_UNAVAILABLE";

export type V3DeployExecutorResult =
  | Readonly<{
    status: "not_deployable";
    reason: V3DeployNotDeployableReason;
    candidate: AcceptedCandidateV1;
    sourceRevision: SourceRevisionV1;
  }>
  | Readonly<{
    status: "deployed";
    candidate: AcceptedCandidateV1;
    receipt: V3DeployReceiptV1;
    release(outcome?: "committed" | "reconcile"): Promise<void>;
    rollback(reason: string): Promise<void>;
  }>;

type Sql = postgres.Sql | postgres.TransactionSql;

export type V3DeployExecutorDependencies = Readonly<{
  readPacket(runId: string): Promise<SealedRuntimePacket>;
  assertAuthority(input: Readonly<{ runId: string; worktree: string }>): Promise<V3DeployAuthorityResult>;
  adapter: V3DeploymentPlatformAdapter;
  now?: () => Date;
}>;

function deploymentError(
  code: ConstructorParameters<typeof V3DeployAuthorityError>[0],
  message: string,
  evidence: Readonly<Record<string, string | null>> = {},
): V3DeployAuthorityError {
  return new V3DeployAuthorityError(code, message, evidence);
}

function canonicalFailureCode(error: unknown): string {
  if (error instanceof V3DeployAuthorityError) return error.code;
  return String(error).match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/)?.[0]
    ?? "UNCLASSIFIED_FAILURE";
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  if (!normalized) throw deploymentError("V3_DEPLOY_PACKET_INVALID", "deploy project identity is empty");
  return normalized;
}

function exactCommand(topology: BuildTopologyV1, kind: "build" | "preview"): BuildCommandV1 | undefined {
  const commands = topology.commands.filter((command) => command.kind === kind);
  if (commands.length > 1) {
    throw deploymentError("V3_DEPLOY_PACKET_INVALID", `sealed topology has ${commands.length} ${kind} commands`, {
      stackPackId: topology.stackPack.id,
      commandKind: kind,
    });
  }
  return commands[0];
}

function exactRuntimeDataContract(topology: BuildTopologyV1): Readonly<{
  contract: RuntimeDataContractV1;
  contractHash: string;
}> {
  const contract = RuntimeDataContractV1Schema.parse(topology.runtimeDataContract);
  const contractHash = z.string().regex(/^[a-f0-9]{64}$/).parse(topology.runtimeDataContractHash);
  if (hashRuntimeDataContractV1(contract) !== contractHash) {
    throw new Error("V3_DEPLOY_RUNTIME_DATA_CONTRACT_HASH_MISMATCH");
  }
  return { contract, contractHash };
}

function runtimeDataDeploymentBlock(
  topology: BuildTopologyV1,
): Extract<V3DeployExecutorResult, { status: "not_deployable" }>["reason"] | null {
  let runtimeData: ReturnType<typeof exactRuntimeDataContract>;
  try {
    runtimeData = exactRuntimeDataContract(topology);
  } catch {
    return "SEALED_RUNTIME_DATA_CONTRACT_INVALID";
  }
  if (
    runtimeData.contract.writableVolumes.length > 0
    || runtimeData.contract.scratch.kind !== "none"
    || runtimeData.contract.authorities.some((authority) =>
      authority.kind === "server-filesystem" || authority.kind === "external-database")
  ) {
    return "SEALED_RUNTIME_DATA_HARD_QUOTA_UNSUPPORTED";
  }
  return null;
}

function runtimeCommandDeploymentBlock(
  command: BuildCommandV1,
): Extract<V3DeployExecutorResult, { status: "not_deployable" }>["reason"] | null {
  return isPlatformOwnedV3PreviewCommand(command)
    ? null
    : "SEALED_RUNTIME_COMMAND_UNSUPPORTED";
}

function resolveDeploymentEnvironment(
  commands: readonly BuildCommandV1[],
  context: Readonly<Record<string, string>>,
  processEnvironment: NodeJS.ProcessEnv = process.env,
): Readonly<Record<string, string>> {
  const names = [...new Set(commands.flatMap((command) => command.envRefs ?? []))].sort();
  const environment: Record<string, string> = {};
  for (const name of names) {
    const value = context[name]
      ?? context[name.toLowerCase()]
      ?? processEnvironment[name];
    if (value === undefined || value === "") {
      throw deploymentError("V3_DEPLOY_RUNTIME_ENV_MISSING", `sealed deploy command requires missing environment ${name}`, {
        environmentName: name,
      });
    }
    environment[name] = value;
  }
  return Object.freeze(environment);
}

function sameCandidate(
  result: V3DeployAuthorityResult,
  candidate: AcceptedCandidateV1,
): result is Extract<V3DeployAuthorityResult, { status: "authorized" }> {
  return result.status === "authorized"
    && result.candidate.candidateHash === candidate.candidateHash
    && result.candidate.packetHash === candidate.packetHash;
}

function assertAuthorized(result: V3DeployAuthorityResult): Extract<V3DeployAuthorityResult, { status: "authorized" }> {
  if (result.status !== "authorized") {
    throw deploymentError("V3_DEPLOY_PACKET_INVALID", "v3 executor received a non-v3 authority result", {
      protocol: result.protocol,
    });
  }
  return result;
}

function createReceipt(input: Readonly<{
  runId: string;
  candidate: AcceptedCandidateV1;
  packet: SealedRuntimePacket;
  buildCommand: BuildCommandV1;
  previewCommand: BuildCommandV1;
  sourceBefore: SourceRevisionV1;
  sourceAfter: SourceRevisionV1;
  buildArtifact: V3BuildArtifactV1;
  runtime: V3RuntimeDeploymentV1;
  health: V3DeployHealthProofV1;
  environmentNames: string[];
  completedAt: string;
}>): V3DeployReceiptV1 {
  const product = input.packet.productSpec.product;
  const delivery = input.packet.productSpec.delivery;
  return createV3DeployReceiptV1({
    schema: "setfarm.v3-deploy-receipt.v1",
    runId: input.runId,
    candidateId: input.candidate.candidateId,
    candidateHash: input.candidate.candidateHash,
    packetHash: input.candidate.packetHash,
    project: {
      schema: "setfarm.v3-deploy-project.v1",
      productId: product.id,
      projectId: input.runtime.projectId,
      displayName: product.name,
      summary: product.goals[0]!.statement,
    },
    stack: {
      schema: "setfarm.v3-deploy-stack.v1",
      stackPackId: input.packet.buildTopology.stackPack.id,
      stackPackVersion: input.packet.buildTopology.stackPack.version,
      stackPackContentHash: input.packet.buildTopology.stackPack.contentHash,
      platform: delivery?.platform ?? null,
      techStack: delivery?.techStack ?? null,
    },
    buildCommandId: input.buildCommand.id,
    previewCommandId: input.previewCommand.id,
    sourceBefore: input.sourceBefore,
    sourceAfter: input.sourceAfter,
    buildArtifact: input.buildArtifact,
    runtime: input.runtime,
    health: input.health,
    terminalProjectProjection: {
      schema: "setfarm.v3-terminal-project-projection.v1",
      owner: "mission-control-terminal-projector",
      state: "pending_terminal_projection",
      runId: input.runId,
      candidateHash: input.candidate.candidateHash,
      projectId: input.runtime.projectId,
      serviceId: input.runtime.serviceId,
      port: input.runtime.port,
      healthUrl: input.runtime.healthUrl,
      evidenceRef: `setfarm://run/${input.runId}/deploy-receipt`,
      buildArtifactHash: input.buildArtifact.artifactHash,
    },
    environmentNames: [...input.environmentNames].sort(),
    completedAt: input.completedAt,
  });
}

function temporalReceiptIdentity(receipt: V3DeployReceiptV1): unknown {
  const {
    receiptHash: _receiptHash,
    completedAt: _completedAt,
    health,
    ...identity
  } = receipt;
  const {
    checkedAt: _healthCheckedAt,
    listenerOwnership,
    runtimeIsolation,
    ...healthIdentity
  } = health;
  const { checkedAt: _listenerCheckedAt, ...listenerIdentity } = listenerOwnership;
  const {
    checkedAt: _isolationCheckedAt,
    challenge,
    ...runtimeIsolationIdentity
  } = runtimeIsolation;
  const {
    nonce: _challengeNonce,
    challengedAt: _challengedAt,
    challengeHash: _challengeHash,
    ...challengeIdentity
  } = challenge;
  return {
    ...identity,
    health: {
      ...healthIdentity,
      listenerOwnership: listenerIdentity,
      runtimeIsolation: {
        ...runtimeIsolationIdentity,
        challenge: challengeIdentity,
      },
    },
  };
}

function chooseStagedOrFreshReceipt(
  staged: V3DeployReceiptV1 | undefined,
  fresh: V3DeployReceiptV1,
): V3DeployReceiptV1 {
  if (!staged) return fresh;
  const parsed = V3DeployReceiptV1Schema.parse(staged);
  if (JSON.stringify(temporalReceiptIdentity(parsed)) !== JSON.stringify(temporalReceiptIdentity(fresh))) {
    throw deploymentError("V3_DEPLOY_PLATFORM_FAILED", "staged deploy receipt conflicts with live lifecycle evidence", {
      runId: fresh.runId,
      stagedReceiptHash: parsed.receiptHash,
      freshReceiptHash: fresh.receiptHash,
    });
  }
  return parsed;
}

export function createV3DeployExecutor(dependencies: V3DeployExecutorDependencies) {
  return Object.freeze({
    async execute(input: Readonly<{
      runId: string;
      worktree: string;
      context: Readonly<Record<string, string>>;
      target: V3DeployTargetV1;
    }>): Promise<V3DeployExecutorResult> {
      let packet: SealedRuntimePacket;
      try {
        packet = await dependencies.readPacket(input.runId);
      } catch (error) {
        throw deploymentError("V3_DEPLOY_PACKET_INVALID", `cannot read sealed deploy packet: ${String(error).slice(0, 500)}`, {
          runId: input.runId,
        });
      }
      const buildCommand = exactCommand(packet.buildTopology, "build");
      if (!buildCommand) {
        throw deploymentError("V3_DEPLOY_PACKET_INVALID", "sealed topology has no build command", {
          runId: input.runId,
          stackPackId: packet.buildTopology.stackPack.id,
        });
      }
      const previewCommand = exactCommand(packet.buildTopology, "preview");
      const environment = resolveDeploymentEnvironment(
        previewCommand ? [buildCommand, previewCommand] : [buildCommand],
        input.context,
      );

      // This is intentionally the final awaited operation before a platform
      // adapter may mutate a build output, process, service, or MC projection.
      const preSideEffectAuthority = assertAuthorized(await dependencies.assertAuthority({
        runId: input.runId,
        worktree: input.worktree,
      }));
      if (preSideEffectAuthority.candidate.packetHash !== packet.packetHash) {
        throw deploymentError("V3_DEPLOY_PACKET_INVALID", "AcceptedCandidate and sealed packet differ", {
          runId: input.runId,
          candidatePacketHash: preSideEffectAuthority.candidate.packetHash,
          sealedPacketHash: packet.packetHash,
        });
      }
      if (!previewCommand) {
        return {
          status: "not_deployable",
          reason: "SEALED_TOPOLOGY_HAS_NO_PREVIEW_COMMAND",
          candidate: preSideEffectAuthority.candidate,
          sourceRevision: preSideEffectAuthority.observedSource,
        };
      }
      const runtimeDataBlock = runtimeDataDeploymentBlock(packet.buildTopology);
      if (runtimeDataBlock) {
        return {
          status: "not_deployable",
          reason: runtimeDataBlock,
          candidate: preSideEffectAuthority.candidate,
          sourceRevision: preSideEffectAuthority.observedSource,
        };
      }
      if (packet.buildTopology.capabilities.some((capability) => capability.enabled && capability.kind === "network")) {
        return {
          status: "not_deployable",
          reason: "SEALED_RUNTIME_NETWORK_POLICY_UNSUPPORTED",
          candidate: preSideEffectAuthority.candidate,
          sourceRevision: preSideEffectAuthority.observedSource,
        };
      }
      const runtimeCommandBlock = runtimeCommandDeploymentBlock(previewCommand);
      if (runtimeCommandBlock) {
        return {
          status: "not_deployable",
          reason: runtimeCommandBlock,
          candidate: preSideEffectAuthority.candidate,
          sourceRevision: preSideEffectAuthority.observedSource,
        };
      }
      if (dependencies.adapter.notDeployableReason) {
        return {
          status: "not_deployable",
          reason: dependencies.adapter.notDeployableReason,
          candidate: preSideEffectAuthority.candidate,
          sourceRevision: preSideEffectAuthority.observedSource,
        };
      }

      const product = packet.productSpec.product;
      const projectId = `${slug(product.id)}-${preSideEffectAuthority.candidate.candidateHash.slice(0, 12)}`;
      const request: V3DeploymentRequestV1 = Object.freeze({
        schema: "setfarm.v3-deployment-request.v1",
        runId: input.runId,
        worktree: input.worktree,
        projectId,
        displayName: product.name,
        summary: product.goals[0]!.statement,
        candidate: preSideEffectAuthority.candidate,
        topology: packet.buildTopology,
        buildCommand,
        previewCommand,
        target: input.target,
        environment,
      });

      let deployment: V3RuntimeDeploymentV1 | undefined;
      let buildArtifact: V3BuildArtifactV1 | undefined;
      let lifecycleToken: string | undefined;
      try {
        const launch = await dependencies.adapter.deploy(request);
        deployment = V3RuntimeDeploymentV1Schema.parse(launch.runtime);
        buildArtifact = V3BuildArtifactV1Schema.parse(launch.buildArtifact);
        lifecycleToken = z.string().uuid().parse(launch.lifecycleToken);
        const health = V3DeployHealthProofV1Schema.parse(
          await dependencies.adapter.verifyHealth(request, deployment, buildArtifact, lifecycleToken),
        );
        // Completion authority is captured only after health. Any source/build
        // mutation causes rollback before the claim can be completed. Projects
        // transfer intentionally remains a post-terminal canonical projection:
        // Mission Control rejects active-run transfer, so pre-terminal deploy
        // must never register a heuristic project card.
        const postSideEffectAuthority = await dependencies.assertAuthority({
          runId: input.runId,
          worktree: input.worktree,
        });
        if (!sameCandidate(postSideEffectAuthority, request.candidate)) {
          throw deploymentError("V3_DEPLOY_SOURCE_REVISION_MISMATCH", "deploy authority changed during platform execution", {
            runId: input.runId,
            candidateHash: request.candidate.candidateHash,
          });
        }
        const freshReceipt = createReceipt({
          runId: input.runId,
          candidate: request.candidate,
          packet,
          buildCommand,
          previewCommand,
          sourceBefore: preSideEffectAuthority.observedSource,
          sourceAfter: postSideEffectAuthority.observedSource,
          buildArtifact,
          runtime: deployment,
          health,
          environmentNames: Object.keys(environment),
          completedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
        });
        const receipt = chooseStagedOrFreshReceipt(launch.stagedReceipt, freshReceipt);
        await dependencies.adapter.stagePublication(request, deployment, receipt, lifecycleToken);
        return {
          status: "deployed",
          candidate: request.candidate,
          receipt,
          release: (outcome = "committed") => dependencies.adapter.release(
            request,
            deployment!,
            lifecycleToken!,
            outcome,
          ),
          rollback: (reason: string) => dependencies.adapter.rollback(
            request,
            deployment!,
            reason,
            lifecycleToken!,
          ),
        };
      } catch (error) {
        if (!deployment) {
          if (error instanceof V3DeployAuthorityError) throw error;
          throw deploymentError("V3_DEPLOY_PLATFORM_FAILED", `typed deployment adapter failed: ${String(error).slice(0, 600)}`, {
            runId: input.runId,
          });
        }
        try {
          if (!lifecycleToken) throw error;
          await dependencies.adapter.rollback(
            request,
            deployment,
            String(error).slice(0, 1_000),
            lifecycleToken,
          );
        } catch (rollbackError) {
          throw deploymentError("V3_DEPLOY_ROLLBACK_FAILED", `deploy failed and rollback failed: ${String(rollbackError).slice(0, 500)}`, {
            runId: input.runId,
            projectId: deployment.projectId,
            primaryFailureCode: canonicalFailureCode(error),
            primaryFailureHash: hashCanonicalJson(String(error)),
          });
        }
        if (error instanceof V3DeployAuthorityError) throw error;
        throw deploymentError("V3_DEPLOY_PLATFORM_FAILED", `typed deployment adapter failed: ${String(error).slice(0, 600)}`, {
          runId: input.runId,
          projectId: deployment.projectId,
        });
      }
    },
  });
}

function resolvedCwd(worktree: string, relative: string): string {
  const root = path.resolve(worktree);
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw deploymentError("V3_DEPLOY_PACKET_INVALID", "sealed command cwd escapes worktree", {
      cwdHash: hashCanonicalJson(relative),
    });
  }
  return resolved;
}

function commandArgv(command: BuildCommandV1, host: string, port: number): string[] {
  const argv = command.argv.map((argument) => argument
    .replaceAll("{{HOST}}", host)
    .replaceAll("{{PORT}}", String(port)));
  if (argv[0] === "node") argv[0] = process.execPath;
  return argv;
}

function minimalBuildEnvironment(overrides: Readonly<Record<string, string>>, host: string, port: number): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return {
    ...environment,
    ...overrides,
    NODE_ENV: "production",
    BROWSER: "none",
    HOST: host,
    PORT: String(port),
  };
}

function minimalRuntimeEnvironment(
  overrides: Readonly<Record<string, string>>,
  host: string,
  port: number,
  sealedRuntimeRoot: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "LANG", "LC_ALL"]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return {
    ...environment,
    ...overrides,
    HOME: sealedRuntimeRoot,
    TMPDIR: sealedRuntimeRoot,
    XDG_CACHE_HOME: sealedRuntimeRoot,
    NODE_ENV: "production",
    BROWSER: "none",
    HOST: host,
    PORT: String(port),
  };
}

function ensureSafeRuntimeLog(logRoot: string, projectId: string): string {
  const filePath = path.join(logRoot, `${projectId}.log`);
  const descriptor = openSync(
    filePath,
    fsConstants.O_WRONLY
      | fsConstants.O_APPEND
      | fsConstants.O_CREAT
      | fsConstants.O_NOFOLLOW,
    0o600,
  );
  try {
    const descriptorStats = fstatSync(descriptor);
    const pathStats = lstatSync(filePath);
    if (
      !descriptorStats.isFile()
      || !pathStats.isFile()
      || pathStats.isSymbolicLink()
      || descriptorStats.dev !== pathStats.dev
      || descriptorStats.ino !== pathStats.ino
      || (pathStats.mode & 0o777) !== 0o600
    ) {
      throw new Error("V3_DEPLOY_ISOLATION_LOG_PATH_UNSAFE");
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(logRoot);
  if (realpathSync(filePath) !== filePath) throw new Error("V3_DEPLOY_ISOLATION_LOG_PATH_NONCANONICAL");
  return filePath;
}

type LocalProcessHandle = Readonly<{
  pid: number;
  logPath: string;
  lease: V3LocalPortLeaseV1;
  buildArtifact: V3BuildArtifactV1;
  sealedRuntimeRoot: string;
}>;
const localProcesses = new Map<string, LocalProcessHandle>();

const V3LocalPortLeaseV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-port-lease.v1"),
  leaseId: z.string().uuid(),
  phase: z.enum(["allocating", "runtime"]),
  runId: z.string().min(1).max(500),
  projectId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,150}[a-z0-9])?$/),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  port: z.number().int().min(1).max(65_535),
  ownerPid: z.number().int().positive(),
  ownerIdentity: ProcessIdentityV1Schema,
  acquiredAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.ownerIdentity.pid !== value.ownerPid) {
    context.addIssue({
      code: "custom",
      path: ["ownerIdentity", "pid"],
      message: "owner identity must bind the exact lease owner pid",
    });
  }
});

type V3LocalPortLeaseV1 = z.infer<typeof V3LocalPortLeaseV1Schema>;

const V3LocalOperationLockV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-operation-lock.v1"),
  token: z.string().uuid(),
  runId: z.string().min(1).max(500),
  projectId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,150}[a-z0-9])?$/),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  operation: z.enum(["deploy", "verify_health", "rollback", "reconcile"]),
  ownerIdentity: ProcessIdentityV1Schema,
  acquiredAt: z.string().datetime({ offset: true }),
}).strict();

type V3LocalOperationLockV1 = z.infer<typeof V3LocalOperationLockV1Schema>;

const V3LocalLaunchGateV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-launch-gate.v1"),
  leaseId: z.string().uuid(),
  runId: z.string().min(1).max(500),
  projectId: z.string().min(1).max(160),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type V3LocalLaunchGateV1 = z.infer<typeof V3LocalLaunchGateV1Schema>;

const V3LocalPublicationMarkerV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-publication-marker.v1"),
  receipt: V3DeployReceiptV1Schema,
  stagedAt: z.string().datetime({ offset: true }),
}).strict();

type V3LocalPublicationMarkerV1 = z.infer<typeof V3LocalPublicationMarkerV1Schema>;

const V3LocalRuntimeIsolationBindingIdentityV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-runtime-isolation-binding.v1"),
  runId: z.string().min(1).max(500),
  projectId: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,150}[a-z0-9])?$/),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  buildArtifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  sealedRuntimeManifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  leaseId: z.string().uuid(),
  runtimePort: z.number().int().min(1).max(65_535),
  wrapperProcessIdentity: ProcessIdentityV1Schema,
  controlPort: z.number().int().min(1).max(65_535),
  runtimeIsolationPolicy: V3RuntimeIsolationPolicyV1Schema,
  runtimeIsolation: V3RuntimeIsolationAuthorityV1Schema,
  volumeProvisioning: V3RuntimeVolumeProvisioningV1Schema,
  createdAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  const policy = value.runtimeIsolationPolicy;
  if (
    value.wrapperProcessIdentity.source !== "observed_os"
    || value.wrapperProcessIdentity.processGroupId !== value.wrapperProcessIdentity.pid
    || policy.runId !== value.runId
    || policy.projectId !== value.projectId
    || policy.candidateHash !== value.candidateHash
    || policy.buildArtifactHash !== value.buildArtifactHash
    || policy.policyHash !== value.runtimeIsolation.policyHash
    || policy.profileHash !== value.runtimeIsolation.profileHash
    || policy.runtimeDataContractHash !== value.runtimeIsolation.runtimeDataContractHash
    || policy.volumeProvisioningHash !== value.runtimeIsolation.volumeProvisioningHash
    || value.volumeProvisioning.runId !== value.runId
    || value.volumeProvisioning.projectId !== value.projectId
    || value.volumeProvisioning.runtimeDataContractHash !== policy.runtimeDataContractHash
    || value.volumeProvisioning.volumeProvisioningHash !== policy.volumeProvisioningHash
    || !exactV3RuntimeIsolationAuthorityContext(value.runtimeIsolation, {
      runId: value.runId,
      projectId: value.projectId,
      candidateHash: value.candidateHash,
      buildArtifactHash: value.buildArtifactHash,
    })
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeIsolation"],
      message: "Local runtime isolation control must bind exact deployment authority",
    });
  }
});

const V3LocalRuntimeIsolationBindingV1Schema = V3LocalRuntimeIsolationBindingIdentityV1Schema.extend({
  controlBindingHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((value, context) => {
  const { controlBindingHash: _hash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.controlBindingHash) {
    context.addIssue({ code: "custom", path: ["controlBindingHash"], message: "Local runtime isolation binding hash mismatch" });
  }
});

type V3LocalRuntimeIsolationBindingV1 = z.infer<typeof V3LocalRuntimeIsolationBindingV1Schema>;

const V3LocalRuntimeIsolationControlV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-runtime-isolation-control.v1"),
  binding: V3LocalRuntimeIsolationBindingV1Schema,
  controlToken: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type V3LocalRuntimeIsolationControlV1 = z.infer<typeof V3LocalRuntimeIsolationControlV1Schema>;

function publicIsolationBinding(
  control: V3LocalRuntimeIsolationControlV1,
): V3LocalRuntimeIsolationBindingV1 {
  return control.binding;
}

const V3LocalDeploymentStateV1Schema = z.object({
  schema: z.literal("setfarm.v3-local-deployment-state.v1"),
  runId: z.string().min(1).max(500),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  buildArtifact: V3BuildArtifactV1Schema,
  sealedRuntimeRoot: z.string().min(1).max(4_000),
  previewCwd: z.string().min(1).max(1_000),
  packageManager: z.enum(["npm", "pnpm", "yarn", "bun", "pip", "poetry", "gradle", "xcode", "none"]),
  runtime: V3RuntimeDeploymentV1Schema,
  portLease: V3LocalPortLeaseV1Schema,
  isolationBinding: V3LocalRuntimeIsolationBindingV1Schema,
}).strict().superRefine((value, context) => {
  const expectedServiceId = `process:${value.portLease.ownerPid}`;
  const expectedUrl = `http://127.0.0.1:${value.portLease.port}/`;
  if (
    value.runId !== value.portLease.runId
    || value.candidateHash !== value.portLease.candidateHash
    || value.packetHash !== value.portLease.packetHash
    || value.portLease.phase !== "runtime"
    || value.runtime.mode !== "local"
    || value.runtime.projectId !== value.portLease.projectId
    || value.runtime.port !== value.portLease.port
    || value.runtime.serviceId !== expectedServiceId
    || value.runtime.host !== "127.0.0.1"
    || value.runtime.healthUrl !== expectedUrl
    || value.runtime.deployUrl !== expectedUrl
    || value.runtime.evidenceRef !== `setfarm://deploy/runtime/${value.runId}/${value.portLease.projectId}`
    || value.runtime.buildArtifactHash !== value.buildArtifact.artifactHash
    || value.runtime.buildArtifactEvidenceRef !== value.buildArtifact.evidenceRef
    || value.runtime.sealedRuntimeRef !== `setfarm://deploy/sealed-runtime/${value.runId}/${value.candidateHash}/${value.buildArtifact.artifactHash}`
    || value.runtime.sealedRuntimeManifestEvidenceRef !== `setfarm://deploy/sealed-runtime-manifest/${value.runId}/${value.candidateHash}/${value.buildArtifact.artifactHash}/${value.runtime.sealedRuntimeManifestHash}`
    || value.isolationBinding.runId !== value.runId
    || value.isolationBinding.projectId !== value.runtime.projectId
    || value.isolationBinding.candidateHash !== value.candidateHash
    || value.isolationBinding.packetHash !== value.packetHash
    || value.isolationBinding.buildArtifactHash !== value.buildArtifact.artifactHash
    || value.isolationBinding.sealedRuntimeManifestHash !== value.runtime.sealedRuntimeManifestHash
    || value.isolationBinding.leaseId !== value.portLease.leaseId
    || value.isolationBinding.runtimePort !== value.portLease.port
    || !sameProcessIdentity(value.isolationBinding.wrapperProcessIdentity, value.portLease.ownerIdentity)
    || JSON.stringify(value.isolationBinding.runtimeIsolation) !== JSON.stringify(value.runtime.runtimeIsolation)
    || JSON.stringify(value.isolationBinding.volumeProvisioning) !== JSON.stringify(value.runtime.volumeProvisioning)
    || !path.isAbsolute(value.sealedRuntimeRoot)
    || path.resolve(value.sealedRuntimeRoot, value.previewCwd) !== value.sealedRuntimeRoot
      && !path.resolve(value.sealedRuntimeRoot, value.previewCwd).startsWith(`${value.sealedRuntimeRoot}${path.sep}`)
  ) {
    context.addIssue({
      code: "custom",
      path: ["portLease"],
      message: "local runtime state must bind the exact runtime port lease",
    });
  }
});

type V3LocalDeploymentStateV1 = z.infer<typeof V3LocalDeploymentStateV1Schema>;
type ProcessStatus = "alive" | "dead" | "unknown";

function processStatus(identity: ProcessIdentityV1): ProcessStatus {
  const observed = observeProcessIdentity(identity.pid);
  if (observed) return sameProcessIdentity(identity, observed) ? "alive" : "dead";
  try {
    process.kill(identity.pid, 0);
    return "unknown";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown";
  }
}

function localProcessKey(stateRoot: string, runId: string, projectId: string): string {
  return `${stateRoot}\u0000${runId}\u0000${projectId}`;
}

function leasePath(stateRoot: string, port: number): string {
  return path.join(stateRoot, `port-${port}.lock`);
}

function statePath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.json`);
}

function pidPath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.pid`);
}

function artifactPath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.build-artifact.json`);
}

function operationLockPath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.operation.lock`);
}

function launchGatePath(stateRoot: string, leaseId: string): string {
  return path.join(stateRoot, `launch-${leaseId}.go`);
}

function quarantinePath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.quarantine.json`);
}

function publicationMarkerPath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.publication-pending.json`);
}

function isolationControlPath(stateRoot: string, projectId: string): string {
  return path.join(stateRoot, `${projectId}.isolation-control.json`);
}

function fsyncDirectory(directoryPath: string): void {
  const descriptor = openSync(directoryPath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function unlinkDurably(filePath: string): void {
  unlinkSync(filePath);
  fsyncDirectory(path.dirname(filePath));
}

function sameLease(left: V3LocalPortLeaseV1, right: V3LocalPortLeaseV1): boolean {
  return left.schema === right.schema
    && left.leaseId === right.leaseId
    && left.phase === right.phase
    && left.runId === right.runId
    && left.projectId === right.projectId
    && left.candidateHash === right.candidateHash
    && left.packetHash === right.packetHash
    && left.port === right.port
    && left.ownerPid === right.ownerPid
    && left.acquiredAt === right.acquiredAt
    && left.ownerIdentity.schema === right.ownerIdentity.schema
    && left.ownerIdentity.pid === right.ownerIdentity.pid
    && left.ownerIdentity.processStartedAt === right.ownerIdentity.processStartedAt
    && left.ownerIdentity.processGroupId === right.ownerIdentity.processGroupId
    && left.ownerIdentity.source === right.ownerIdentity.source;
}

function leaseMatchesRequest(lease: V3LocalPortLeaseV1, request: V3DeploymentRequestV1): boolean {
  return lease.runId === request.runId
    && lease.projectId === request.projectId
    && lease.candidateHash === request.candidate.candidateHash
    && lease.packetHash === request.candidate.packetHash;
}

type LeaseReadResult =
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "valid"; lease: V3LocalPortLeaseV1 }>;

function readLease(filePath: string): LeaseReadResult {
  if (!existsSync(filePath)) return { status: "absent" };
  try {
    const stats = lstatSync(filePath);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || (stats.mode & 0o777) !== 0o600
      || (typeof process.getuid === "function" && stats.uid !== process.getuid())
      || realpathSync(filePath) !== path.resolve(filePath)
    ) return { status: "invalid" };
    return {
      status: "valid",
      lease: V3LocalPortLeaseV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8"))),
    };
  } catch {
    return { status: "invalid" };
  }
}

function sameOperationLock(left: V3LocalOperationLockV1, right: V3LocalOperationLockV1): boolean {
  return left.token === right.token
    && left.runId === right.runId
    && left.projectId === right.projectId
    && left.candidateHash === right.candidateHash
    && left.packetHash === right.packetHash
    && left.operation === right.operation
    && left.acquiredAt === right.acquiredAt
    && sameProcessIdentity(left.ownerIdentity, right.ownerIdentity);
}

function readOperationLock(filePath: string): V3LocalOperationLockV1 {
  try {
    return V3LocalOperationLockV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_OPERATION_LOCK_INVALID:${String(error).slice(0, 300)}`);
  }
}

function acquireOperationLock(
  stateRoot: string,
  request: Pick<V3DeploymentRequestV1, "runId" | "projectId"> & Readonly<{
    candidate: Pick<AcceptedCandidateV1, "candidateHash" | "packetHash">;
  }>,
  operation: V3LocalOperationLockV1["operation"],
): V3LocalOperationLockV1 {
  const filePath = operationLockPath(stateRoot, request.projectId);
  const ownerIdentity = observeProcessIdentity(process.pid);
  if (!ownerIdentity) throw new Error("V3_DEPLOY_OPERATION_OWNER_IDENTITY_UNAVAILABLE");
  const requested = V3LocalOperationLockV1Schema.parse({
    schema: "setfarm.v3-local-operation-lock.v1",
    token: randomUUID(),
    runId: request.runId,
    projectId: request.projectId,
    candidateHash: request.candidate.candidateHash,
    packetHash: request.candidate.packetHash,
    operation,
    ownerIdentity,
    acquiredAt: new Date().toISOString(),
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (writeExclusiveJson(filePath, requested)) return requested;
    const current = readOperationLock(filePath);
    const status = processStatus(current.ownerIdentity);
    if (status === "alive") {
      throw new Error(`V3_DEPLOY_LOCAL_REQUEST_LOCKED:${current.operation}:${current.ownerIdentity.pid}`);
    }
    if (status === "unknown") throw new Error("V3_DEPLOY_LOCAL_OPERATION_LOCK_OWNER_AMBIGUOUS");
    const reread = readOperationLock(filePath);
    if (!sameOperationLock(current, reread)) {
      throw new Error("V3_DEPLOY_LOCAL_OPERATION_LOCK_CHANGED");
    }
    unlinkDurably(filePath);
  }
  throw new Error("V3_DEPLOY_LOCAL_REQUEST_LOCKED");
}

function releaseOperationLock(
  stateRoot: string,
  projectId: string,
  expected: V3LocalOperationLockV1,
): void {
  const filePath = operationLockPath(stateRoot, projectId);
  const current = readOperationLock(filePath);
  if (!sameOperationLock(current, expected)) {
    throw new Error("V3_DEPLOY_LOCAL_OPERATION_LOCK_OWNERSHIP_MISMATCH");
  }
  unlinkDurably(filePath);
}

function assertLifecycleOperationLock(
  stateRoot: string,
  request: V3DeploymentRequestV1,
  lifecycleToken: string,
): V3LocalOperationLockV1 {
  const current = readOperationLock(operationLockPath(stateRoot, request.projectId));
  if (
    current.token !== lifecycleToken
    || current.operation !== "deploy"
    || current.runId !== request.runId
    || current.projectId !== request.projectId
    || current.candidateHash !== request.candidate.candidateHash
    || current.packetHash !== request.candidate.packetHash
    || processStatus(current.ownerIdentity) !== "alive"
  ) {
    throw new Error("V3_DEPLOY_LOCAL_LIFECYCLE_OWNERSHIP_MISMATCH");
  }
  return current;
}

function writeExclusiveJson(filePath: string, value: unknown): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(path.dirname(filePath));
    return true;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, filePath);
    fsyncDirectory(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try { unlinkSync(temporaryPath); } catch { /* temporary file was never created or already removed */ }
    throw error;
  }
}

function writeTextAtomically(filePath: string, value: string): void {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(descriptor, value, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, filePath);
    fsyncDirectory(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try { unlinkSync(temporaryPath); } catch { /* no durable target was published */ }
    throw error;
  }
}

function releaseExactLease(filePath: string, expected: V3LocalPortLeaseV1): void {
  const observed = readLease(filePath);
  if (observed.status !== "valid" || !sameLease(observed.lease, expected)) {
    throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
  }
  unlinkDurably(filePath);
}

function replaceExactLease(
  filePath: string,
  expected: V3LocalPortLeaseV1,
  replacement: V3LocalPortLeaseV1,
): void {
  const observed = readLease(filePath);
  if (observed.status !== "valid" || !sameLease(observed.lease, expected)) {
    throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
  }
  writeJsonAtomically(filePath, V3LocalPortLeaseV1Schema.parse(replacement));
}

function readDeploymentState(filePath: string): V3LocalDeploymentStateV1 {
  try {
    const stats = lstatSync(filePath);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || (stats.mode & 0o777) !== 0o600
      || (typeof process.getuid === "function" && stats.uid !== process.getuid())
      || realpathSync(filePath) !== path.resolve(filePath)
    ) {
      throw new Error("mode_owner_type_or_path");
    }
    return V3LocalDeploymentStateV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_STATE_INVALID:${String(error).slice(0, 300)}`);
  }
}

function readIsolationControl(filePath: string): V3LocalRuntimeIsolationControlV1 {
  try {
    const stats = lstatSync(filePath);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || (stats.mode & 0o777) !== 0o600
      || (typeof process.getuid === "function" && stats.uid !== process.getuid())
      || realpathSync(filePath) !== path.resolve(filePath)
    ) {
      throw new Error("mode_or_type");
    }
    return V3LocalRuntimeIsolationControlV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_ISOLATION_CONTROL_INVALID:${String(error).slice(0, 300)}`);
  }
}

function unlinkExactIsolationControl(
  filePath: string,
  expected: V3LocalRuntimeIsolationControlV1,
): void {
  if (!existsSync(filePath)) return;
  const observed = readIsolationControl(filePath);
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function unlinkExactDeploymentState(filePath: string, expectedLease: V3LocalPortLeaseV1): void {
  if (!existsSync(filePath)) return;
  const state = readDeploymentState(filePath);
  if (!sameLease(state.portLease, expectedLease)) {
    throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function unlinkExactPid(filePath: string, expectedPid: number): void {
  if (!existsSync(filePath)) return;
  if (readFileSync(filePath, "utf8").trim() !== String(expectedPid)) {
    throw new Error("V3_DEPLOY_LOCAL_PID_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function readBuildArtifact(filePath: string): V3BuildArtifactV1 {
  try {
    const stats = lstatSync(filePath);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || (stats.mode & 0o777) !== 0o600
      || (typeof process.getuid === "function" && stats.uid !== process.getuid())
      || realpathSync(filePath) !== path.resolve(filePath)
    ) {
      throw new Error("mode_owner_type_or_path");
    }
    return V3BuildArtifactV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_BUILD_ARTIFACT_INVALID:${String(error).slice(0, 300)}`);
  }
}

function unlinkExactBuildArtifact(filePath: string, expected: V3BuildArtifactV1): void {
  if (!existsSync(filePath)) return;
  if (!exactV3BuildArtifactMatch(expected, readBuildArtifact(filePath))) {
    throw new Error("V3_DEPLOY_LOCAL_BUILD_ARTIFACT_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function readPublicationMarker(filePath: string): V3LocalPublicationMarkerV1 {
  try {
    return V3LocalPublicationMarkerV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_PUBLICATION_MARKER_INVALID:${String(error).slice(0, 300)}`);
  }
}

function assertPublicationMarkerIdentity(
  marker: V3LocalPublicationMarkerV1,
  request: V3DeploymentRequestV1,
  deployment: V3RuntimeDeploymentV1,
): void {
  const receipt = marker.receipt;
  if (
    receipt.runId !== request.runId
    || receipt.candidateHash !== request.candidate.candidateHash
    || receipt.packetHash !== request.candidate.packetHash
    || receipt.project.projectId !== request.projectId
    || JSON.stringify(receipt.runtime) !== JSON.stringify(deployment)
  ) {
    throw new Error("V3_DEPLOY_LOCAL_PUBLICATION_MARKER_IDENTITY_CONFLICT");
  }
}

function stagePublicationMarker(
  stateRoot: string,
  request: V3DeploymentRequestV1,
  deployment: V3RuntimeDeploymentV1,
  receipt: V3DeployReceiptV1,
): void {
  const filePath = publicationMarkerPath(stateRoot, request.projectId);
  const marker = V3LocalPublicationMarkerV1Schema.parse({
    schema: "setfarm.v3-local-publication-marker.v1",
    receipt,
    stagedAt: new Date().toISOString(),
  });
  if (writeExclusiveJson(filePath, marker)) return;
  const observed = readPublicationMarker(filePath);
  assertPublicationMarkerIdentity(observed, request, deployment);
  if (JSON.stringify(observed.receipt) !== JSON.stringify(receipt)) {
    throw new Error("V3_DEPLOY_LOCAL_PUBLICATION_MARKER_RECEIPT_CONFLICT");
  }
}

function unlinkPublicationMarkerForLease(stateRoot: string, lease: V3LocalPortLeaseV1): void {
  const filePath = publicationMarkerPath(stateRoot, lease.projectId);
  if (!existsSync(filePath)) return;
  const marker = readPublicationMarker(filePath);
  if (
    marker.receipt.runId !== lease.runId
    || marker.receipt.project.projectId !== lease.projectId
    || marker.receipt.candidateHash !== lease.candidateHash
    || marker.receipt.packetHash !== lease.packetHash
    || marker.receipt.runtime.port !== lease.port
    || marker.receipt.runtime.serviceId !== `process:${lease.ownerPid}`
  ) {
    throw new Error("V3_DEPLOY_LOCAL_PUBLICATION_MARKER_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function exactLaunchGate(lease: V3LocalPortLeaseV1): V3LocalLaunchGateV1 {
  return V3LocalLaunchGateV1Schema.parse({
    schema: "setfarm.v3-local-launch-gate.v1",
    leaseId: lease.leaseId,
    runId: lease.runId,
    projectId: lease.projectId,
    candidateHash: lease.candidateHash,
    packetHash: lease.packetHash,
  });
}

function publishExactLaunchGate(stateRoot: string, lease: V3LocalPortLeaseV1): void {
  const filePath = launchGatePath(stateRoot, lease.leaseId);
  const expected = exactLaunchGate(lease);
  if (writeExclusiveJson(filePath, expected)) return;
  let observed: V3LocalLaunchGateV1;
  try {
    observed = V3LocalLaunchGateV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_LAUNCH_GATE_INVALID:${String(error).slice(0, 300)}`);
  }
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("V3_DEPLOY_LOCAL_LAUNCH_GATE_IDENTITY_CONFLICT");
  }
}

function unlinkExactLaunchGate(stateRoot: string, lease: V3LocalPortLeaseV1): void {
  const filePath = launchGatePath(stateRoot, lease.leaseId);
  if (!existsSync(filePath)) return;
  let observed: V3LocalLaunchGateV1;
  try {
    observed = V3LocalLaunchGateV1Schema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`V3_DEPLOY_LOCAL_LAUNCH_GATE_INVALID:${String(error).slice(0, 300)}`);
  }
  if (JSON.stringify(observed) !== JSON.stringify(exactLaunchGate(lease))) {
    throw new Error("V3_DEPLOY_LOCAL_LAUNCH_GATE_IDENTITY_CONFLICT");
  }
  unlinkDurably(filePath);
}

function exactRuntimeForLease(
  request: V3DeploymentRequestV1,
  lease: V3LocalPortLeaseV1,
  buildArtifact: V3BuildArtifactV1,
  sealedRuntimeRef: string,
  sealedRuntimeManifestHash: string,
  sealedRuntimeManifestEvidenceRef: string,
  sealAuthorityHash: string,
  sealAuthorityEvidenceRef: string,
  isolationControl: V3LocalRuntimeIsolationControlV1,
): V3RuntimeDeploymentV1 {
  const isolationBinding = publicIsolationBinding(isolationControl);
  return V3RuntimeDeploymentV1Schema.parse({
    schema: "setfarm.v3-runtime-deployment.v1",
    mode: "local",
    projectId: request.projectId,
    serviceId: `process:${lease.ownerPid}`,
    host: "127.0.0.1",
    port: lease.port,
    healthUrl: `http://127.0.0.1:${lease.port}/`,
    deployUrl: `http://127.0.0.1:${lease.port}/`,
    evidenceRef: `setfarm://deploy/runtime/${request.runId}/${request.projectId}`,
    buildArtifactHash: buildArtifact.artifactHash,
    buildArtifactEvidenceRef: buildArtifact.evidenceRef,
    sealedRuntimeRef,
    sealedRuntimeManifestHash,
    sealedRuntimeManifestEvidenceRef,
    sealAuthorityHash,
    sealAuthorityEvidenceRef,
    runtimeDataContractHash: isolationBinding.runtimeIsolation.runtimeDataContractHash,
    volumeProvisioning: isolationBinding.volumeProvisioning,
    runtimeIsolation: isolationBinding.runtimeIsolation,
  });
}

function exactStateForLease(
  request: V3DeploymentRequestV1,
  lease: V3LocalPortLeaseV1,
  buildArtifact: V3BuildArtifactV1,
  sealedRuntimeRoot: string,
  sealedRuntimeRef: string,
  sealedRuntimeManifestHash: string,
  sealedRuntimeManifestEvidenceRef: string,
  sealAuthorityHash: string,
  sealAuthorityEvidenceRef: string,
  isolationControl: V3LocalRuntimeIsolationControlV1,
  runtime = exactRuntimeForLease(
    request,
    lease,
    buildArtifact,
    sealedRuntimeRef,
    sealedRuntimeManifestHash,
    sealedRuntimeManifestEvidenceRef,
    sealAuthorityHash,
    sealAuthorityEvidenceRef,
    isolationControl,
  ),
): V3LocalDeploymentStateV1 {
  return V3LocalDeploymentStateV1Schema.parse({
    schema: "setfarm.v3-local-deployment-state.v1",
    runId: request.runId,
    candidateHash: request.candidate.candidateHash,
    packetHash: request.candidate.packetHash,
    buildArtifact,
    sealedRuntimeRoot,
    previewCwd: request.previewCommand.cwd,
    packageManager: request.topology.policies.packageManager,
    runtime,
    portLease: lease,
    isolationBinding: publicIsolationBinding(isolationControl),
  });
}

async function proveRuntimeIsolation(
  control: V3LocalRuntimeIsolationControlV1,
): Promise<V3RuntimeIsolationProofV1> {
  const binding = publicIsolationBinding(control);
  const observed = observeProcessIdentity(binding.wrapperProcessIdentity.pid);
  if (
    !observed
    || !sameProcessIdentity(observed, binding.wrapperProcessIdentity)
    || observed.processGroupId !== observed.pid
  ) {
    throw new Error("V3_DEPLOY_ISOLATION_WRAPPER_IDENTITY_MISMATCH");
  }
  const challenge = await challengeDarwinIsolatedRuntime({
    controlPort: binding.controlPort,
    controlToken: control.controlToken,
    authorityHash: binding.runtimeIsolation.authorityHash,
    wrapperProcessIdentity: observed,
  });
  return V3RuntimeIsolationProofV1Schema.parse({
    schema: "setfarm.v3-runtime-isolation-proof.v1",
    adapterId: binding.runtimeIsolation.adapterId,
    adapterVersion: binding.runtimeIsolation.adapterVersion,
    runId: binding.runtimeIsolation.runId,
    projectId: binding.runtimeIsolation.projectId,
    candidateHash: binding.runtimeIsolation.candidateHash,
    buildArtifactHash: binding.runtimeIsolation.buildArtifactHash,
    policyHash: binding.runtimeIsolation.policyHash,
    profileHash: binding.runtimeIsolation.profileHash,
    wrapperArtifactHash: binding.runtimeIsolation.wrapperArtifactHash,
    runtimeDataContractHash: binding.runtimeIsolation.runtimeDataContractHash,
    volumeProvisioningHash: binding.runtimeIsolation.volumeProvisioningHash,
    evidenceRef: binding.runtimeIsolation.evidenceRef,
    authorityHash: binding.runtimeIsolation.authorityHash,
    challenge,
    checkedAt: new Date().toISOString(),
    checks: { runtimeIsolation: "pass" },
  });
}

function recordCleanupQuarantine(
  stateRoot: string,
  lease: V3LocalPortLeaseV1,
  reason: unknown,
): void {
  writeJsonAtomically(quarantinePath(stateRoot, lease.projectId), {
    schema: "setfarm.v3-local-cleanup-quarantine.v1",
    lease,
    reason: String(reason).slice(0, 1_000),
    recordedAt: new Date().toISOString(),
  });
}

function cleanupExactDeadDeployment(
  stateRoot: string,
  lease: V3LocalPortLeaseV1,
  buildArtifact?: V3BuildArtifactV1,
): void {
  try {
    const controlFilePath = isolationControlPath(stateRoot, lease.projectId);
    if (existsSync(controlFilePath)) {
      const control = readIsolationControl(controlFilePath);
      const binding = publicIsolationBinding(control);
      if (
        binding.runId !== lease.runId
        || binding.projectId !== lease.projectId
        || binding.candidateHash !== lease.candidateHash
        || binding.packetHash !== lease.packetHash
        || binding.leaseId !== lease.leaseId
      ) {
        throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_IDENTITY_CONFLICT");
      }
      if (processStatus(binding.wrapperProcessIdentity) !== "dead") {
        throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_OWNER_STILL_ALIVE");
      }
      unlinkExactIsolationControl(controlFilePath, control);
    }
    unlinkExactDeploymentState(statePath(stateRoot, lease.projectId), lease);
    unlinkExactPid(pidPath(stateRoot, lease.projectId), lease.ownerPid);
    if (buildArtifact) unlinkExactBuildArtifact(artifactPath(stateRoot, lease.projectId), buildArtifact);
    unlinkExactLaunchGate(stateRoot, lease);
    unlinkPublicationMarkerForLease(stateRoot, lease);
    // The sealed runtime and its sibling seal-authority CAS are immutable crash
    // evidence. Retry must adopt them exactly or fail closed; lifecycle cleanup
    // never silently deletes either artifact.
    // The lease is the recovery authority and is intentionally removed last.
    releaseExactLease(leasePath(stateRoot, lease.port), lease);
  } catch (error) {
    recordCleanupQuarantine(stateRoot, lease, error);
    throw error;
  }
}

async function observeSpawnedProcessIdentity(pid: number): Promise<ProcessIdentityV1> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const identity = observeProcessIdentity(pid);
    if (identity) return identity;
    if (attempt + 1 < 20) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("V3_DEPLOY_PROCESS_IDENTITY_UNAVAILABLE");
}

function processGroupAlive(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function waitForProcessGroupDeath(processGroupId: number, attempts: number): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!processGroupAlive(processGroupId)) return true;
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !processGroupAlive(processGroupId);
}

async function terminateExactProcessGroup(identity: ProcessIdentityV1): Promise<void> {
  if (identity.processGroupId !== identity.pid) {
    throw new Error("V3_DEPLOY_PROCESS_GROUP_OWNER_INVALID");
  }
  const observed = observeProcessIdentity(identity.pid);
  if (!observed) {
    if (processStatus(identity) === "dead" && !processGroupAlive(identity.pid)) return;
    throw new Error("V3_DEPLOY_PROCESS_IDENTITY_AMBIGUOUS");
  }
  if (!sameProcessIdentity(identity, observed) || observed.processGroupId !== identity.pid) {
    throw new Error("V3_DEPLOY_PROCESS_IDENTITY_AMBIGUOUS");
  }
  try {
    process.kill(-identity.pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if (await waitForProcessGroupDeath(identity.pid, 60)) return;
  try {
    process.kill(-identity.pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  if (!await waitForProcessGroupDeath(identity.pid, 60)) {
    throw new Error("V3_DEPLOY_PROCESS_GROUP_DEATH_UNPROVEN");
  }
}

type PortReservation = Readonly<{
  lease: V3LocalPortLeaseV1;
  filePath: string;
  server: Server;
}>;

async function bindReservation(host: string, port: number): Promise<Server> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen({ host, port, exclusive: true }, () => {
      server.off("error", onError);
      resolve();
    });
  });
  server.unref();
  return server;
}

async function closeReservation(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function reserveLocalPort(input: Readonly<{
  stateRoot: string;
  request: V3DeploymentRequestV1;
  portStart: number;
  portEnd: number;
}>): Promise<PortReservation> {
  if (
    !Number.isInteger(input.portStart)
    || !Number.isInteger(input.portEnd)
    || input.portStart < 1
    || input.portEnd > 65_535
    || input.portStart > input.portEnd
  ) {
    throw new Error("V3_DEPLOY_LOCAL_PORT_RANGE_INVALID");
  }
  const allocatorIdentity = observeProcessIdentity(process.pid);
  if (!allocatorIdentity) throw new Error("V3_DEPLOY_ALLOCATOR_IDENTITY_UNAVAILABLE");
  for (let port = input.portStart; port <= input.portEnd; port += 1) {
    const filePath = leasePath(input.stateRoot, port);
    // A port lease belongs to another exact request lock domain. Allocation
    // never mutates it opportunistically; only its request owner may reconcile
    // and reclaim it.
    if (existsSync(filePath)) continue;
    const lease = V3LocalPortLeaseV1Schema.parse({
      schema: "setfarm.v3-local-port-lease.v1",
      leaseId: randomUUID(),
      phase: "allocating",
      runId: input.request.runId,
      projectId: input.request.projectId,
      candidateHash: input.request.candidate.candidateHash,
      packetHash: input.request.candidate.packetHash,
      port,
      ownerPid: process.pid,
      ownerIdentity: allocatorIdentity,
      acquiredAt: new Date().toISOString(),
    });
    if (!writeExclusiveJson(filePath, lease)) continue;
    try {
      return { lease, filePath, server: await bindReservation("127.0.0.1", port) };
    } catch (error) {
      releaseExactLease(filePath, lease);
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") continue;
      throw error;
    }
  }
  throw new Error(`V3_DEPLOY_LOCAL_PORT_EXHAUSTED:${input.portStart}-${input.portEnd}`);
}

function findRequestLeases(stateRoot: string, request: V3DeploymentRequestV1): V3LocalPortLeaseV1[] {
  return readdirSync(stateRoot)
    .filter((entry) => /^port-\d+\.lock$/.test(entry))
    .flatMap((entry) => {
      const observed = readLease(path.join(stateRoot, entry));
      return observed.status === "valid" && leaseMatchesRequest(observed.lease, request)
        ? [observed.lease]
        : [];
    });
}

async function defaultListenerPids(port: number): Promise<number[]> {
  try {
    const result = await execFileAsync(
      "lsof",
      ["-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"],
      { timeout: 3_000, maxBuffer: 1_000_000 },
    );
    return [...new Set(result.stdout.split(/\r?\n/)
      .filter((entry) => /^p[1-9][0-9]*$/.test(entry))
      .map((entry) => Number(entry.slice(1))))].sort((left, right) => left - right);
  } catch (error) {
    const code: unknown = (error as { code?: unknown }).code;
    if (code === 1 || code === "1") return [];
    throw new Error(`V3_DEPLOY_LISTENER_EVIDENCE_UNAVAILABLE:${String(error).slice(0, 300)}`);
  }
}

async function proveListenerOwnership(input: Readonly<{
  deployment: V3RuntimeDeploymentV1;
  lease: V3LocalPortLeaseV1;
  listenerPids(port: number): Promise<number[]>;
}>): Promise<V3ListenerOwnershipV1> {
  const owner = observeProcessIdentity(input.lease.ownerPid);
  if (
    !owner
    || !sameProcessIdentity(input.lease.ownerIdentity, owner)
    || owner.processGroupId !== owner.pid
  ) {
    throw new Error("V3_DEPLOY_LISTENER_OWNER_IDENTITY_MISMATCH");
  }
  const listenerPids = await input.listenerPids(input.deployment.port);
  if (listenerPids.length === 0) throw new Error("V3_DEPLOY_LISTENER_MISSING");
  const listenerProcesses: ProcessIdentityV1[] = [];
  for (const pid of listenerPids) {
    const listener = observeProcessIdentity(pid);
    if (!listener || listener.processGroupId !== owner.pid) {
      throw new Error(`V3_DEPLOY_FOREIGN_LISTENER:${pid}`);
    }
    listenerProcesses.push(listener);
  }
  return {
    schema: "setfarm.v3-listener-ownership.v1",
    ownerProcess: owner,
    listenerPids,
    listenerProcesses,
    host: input.deployment.host,
    port: input.deployment.port,
    checkedAt: new Date().toISOString(),
    evidenceRef: `${input.deployment.evidenceRef}/listener/${owner.pid}`,
  };
}

export function createLocalProcessV3DeploymentAdapter(input: Readonly<{
  stateRoot?: string;
  logRoot?: string;
  isolationConfigRoots?: Readonly<{
    setfarmConfigRoot: string;
    missionControlConfigRoot: string;
  }>;
  healthAttempts?: number;
  healthIntervalMs?: number;
  portStart?: number;
  portEnd?: number;
  listenerPids?: (port: number) => Promise<number[]>;
  sealCapacityLimits?: V3SealCapacityLimits;
  onDurabilityBoundary?: (
    boundary: V3SealDurabilityBoundary | "deployment_state_pending",
  ) => void;
}> = {}): V3DeploymentPlatformAdapter {
  const stateRoot = ensureCanonicalV3StateRoot(
    input.stateRoot ?? path.join(runtimeConfig.setfarmDir, "v3-deployments"),
  );
  const logRoot = ensureCanonicalV3StateRoot(
    input.logRoot ?? path.join(
      runtimeConfig.setfarmDir,
      "v3-runtime-logs",
      createHash("sha256").update(stateRoot).digest("hex").slice(0, 24),
    ),
  );
  if (
    logRoot === stateRoot
    || logRoot.startsWith(`${stateRoot}${path.sep}`)
    || stateRoot.startsWith(`${logRoot}${path.sep}`)
  ) {
    throw new Error("V3_DEPLOY_ISOLATION_LOG_ROOT_OVERLAPS_STATE_AUTHORITY");
  }
  const portStart = input.portStart ?? DEFAULT_LOCAL_PORT_START;
  const portEnd = input.portEnd ?? DEFAULT_LOCAL_PORT_END;
  const listenerPids = input.listenerPids ?? defaultListenerPids;
  const sealCapacityLimits = input.sealCapacityLimits ?? resolveV3SealCapacity();
  const environmentConfigRoots = process.env.SETFARM_SOURCE_ROOT && process.env.MISSION_CONTROL_CONFIG_ROOT
    ? {
      setfarmConfigRoot: process.env.SETFARM_SOURCE_ROOT,
      missionControlConfigRoot: process.env.MISSION_CONTROL_CONFIG_ROOT,
    }
    : undefined;
  const configuredIsolationRoots = input.isolationConfigRoots ?? environmentConfigRoots;
  let isolationConfigRoots: ReturnType<typeof canonicalDarwinIsolationConfigRoots> | undefined;
  if (configuredIsolationRoots) {
    try {
      isolationConfigRoots = canonicalDarwinIsolationConfigRoots(configuredIsolationRoots);
    } catch {
      isolationConfigRoots = undefined;
    }
  }
  const notDeployableReason: V3DeployNotDeployableReason | undefined = !darwinRuntimeIsolationAvailable()
    ? "SEALED_RUNTIME_ISOLATION_ADAPTER_UNAVAILABLE"
    : !isolationConfigRoots
      ? "SEALED_RUNTIME_ISOLATION_CONFIG_UNAVAILABLE"
      : undefined;

  return Object.freeze({
    ...(notDeployableReason ? { notDeployableReason } : {}),
    async deploy(request: V3DeploymentRequestV1): Promise<Readonly<{
      runtime: V3RuntimeDeploymentV1;
      buildArtifact: V3BuildArtifactV1;
      lifecycleToken: string;
    }>> {
      if (request.target.mode !== "local") {
        throw deploymentError("V3_DEPLOY_TARGET_UNSUPPORTED", "local process adapter cannot mutate a remote deploy host", {
          targetMode: "remote",
          remoteHostHash: hashCanonicalJson(request.target.remoteHost ?? null),
        });
      }
      if (notDeployableReason || !isolationConfigRoots) {
        throw new Error(notDeployableReason ?? "SEALED_RUNTIME_ISOLATION_CONFIG_UNAVAILABLE");
      }
      if (!/^[a-z0-9](?:[a-z0-9-]{0,150}[a-z0-9])?$/.test(request.projectId)) {
        throw new Error("V3_DEPLOY_LOCAL_PROJECT_ID_INVALID");
      }
      const runtimeData = exactRuntimeDataContract(request.topology);
      const runtimeDataContractHash = runtimeData.contractHash;
      const operationLock = acquireOperationLock(stateRoot, request, "deploy");
      let lifecyclePublished = false;
      let lifecycleQuarantined = false;
      try {
        const persistedStatePath = statePath(stateRoot, request.projectId);
        const persistedPidPath = pidPath(stateRoot, request.projectId);
        const persistedArtifactPath = artifactPath(stateRoot, request.projectId);
        const persistedIsolationControlPath = isolationControlPath(stateRoot, request.projectId);
        const persistedPublicationPath = publicationMarkerPath(stateRoot, request.projectId);
        let stagedMarker = existsSync(persistedPublicationPath)
          ? readPublicationMarker(persistedPublicationPath)
          : undefined;
        const logPath = ensureSafeRuntimeLog(logRoot, request.projectId);
        const processKey = localProcessKey(stateRoot, request.runId, request.projectId);
        if (existsSync(persistedStatePath)) {
          const state = readDeploymentState(persistedStatePath);
          if (
            state.runId !== request.runId
            || state.candidateHash !== request.candidate.candidateHash
            || state.packetHash !== request.candidate.packetHash
            || state.runtime.projectId !== request.projectId
            || state.previewCwd !== request.previewCommand.cwd
            || state.packageManager !== request.topology.policies.packageManager
          ) {
            throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
          }
          const observedLease = readLease(leasePath(stateRoot, state.portLease.port));
          if (observedLease.status !== "valid" || !sameLease(observedLease.lease, state.portLease)) {
            throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
          }
          if (
            !existsSync(persistedArtifactPath)
            || !exactV3BuildArtifactMatch(state.buildArtifact, readBuildArtifact(persistedArtifactPath))
          ) {
            throw new Error("V3_DEPLOY_LOCAL_BUILD_ARTIFACT_IDENTITY_CONFLICT");
          }
          const persistedControl = readIsolationControl(persistedIsolationControlPath);
          if (JSON.stringify(publicIsolationBinding(persistedControl)) !== JSON.stringify(state.isolationBinding)) {
            throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_IDENTITY_CONFLICT");
          }
          const status = processStatus(state.portLease.ownerIdentity);
          if (status === "alive") {
            await verifyV3SealedRuntime({
              root: state.sealedRuntimeRoot,
              runId: request.runId,
              candidateHash: request.candidate.candidateHash,
              expectedSource: request.candidate.sourceRevision,
              artifact: state.buildArtifact,
              previewCwd: request.previewCommand.cwd,
              packageManager: request.topology.policies.packageManager,
              expectedRuntimeDataContractHash: runtimeDataContractHash,
              expectedManifestHash: state.runtime.sealedRuntimeManifestHash,
              expectedManifestEvidenceRef: state.runtime.sealedRuntimeManifestEvidenceRef,
            });
            await proveRuntimeIsolation(persistedControl);
            publishExactLaunchGate(stateRoot, state.portLease);
            if (stagedMarker) assertPublicationMarkerIdentity(stagedMarker, request, state.runtime);
            localProcesses.set(processKey, {
              pid: state.portLease.ownerPid,
              logPath,
              lease: state.portLease,
              buildArtifact: state.buildArtifact,
              sealedRuntimeRoot: state.sealedRuntimeRoot,
            });
            lifecyclePublished = true;
            return {
              runtime: state.runtime,
              buildArtifact: state.buildArtifact,
              lifecycleToken: operationLock.token,
              ...(stagedMarker ? { stagedReceipt: stagedMarker.receipt } : {}),
            };
          }
          if (status === "unknown") throw new Error("V3_DEPLOY_PROCESS_IDENTITY_AMBIGUOUS");
          cleanupExactDeadDeployment(stateRoot, state.portLease, state.buildArtifact);
          stagedMarker = undefined;
        }

        const orphanLeases = findRequestLeases(stateRoot, request);
        if (orphanLeases.length > 1) throw new Error("V3_DEPLOY_LOCAL_LEASE_IDENTITY_CONFLICT");
        let orphanLease = orphanLeases[0];
        if (orphanLease) {
          const orphanControl = existsSync(persistedIsolationControlPath)
            ? readIsolationControl(persistedIsolationControlPath)
            : undefined;
          const orphanBinding = orphanControl ? publicIsolationBinding(orphanControl) : undefined;
          if (orphanControl && (
            orphanBinding!.runId !== request.runId
            || orphanBinding!.projectId !== request.projectId
            || orphanBinding!.candidateHash !== request.candidate.candidateHash
            || orphanBinding!.packetHash !== request.candidate.packetHash
            || orphanBinding!.leaseId !== orphanLease.leaseId
            || orphanBinding!.runtimePort !== orphanLease.port
          )) {
            throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_IDENTITY_CONFLICT");
          }
          if (
            orphanLease.phase === "allocating"
            && orphanControl
            && processStatus(orphanBinding!.wrapperProcessIdentity) === "alive"
          ) {
            const promotedLease = V3LocalPortLeaseV1Schema.parse({
              ...orphanLease,
              phase: "runtime",
              ownerPid: orphanBinding!.wrapperProcessIdentity.pid,
              ownerIdentity: orphanBinding!.wrapperProcessIdentity,
            });
            replaceExactLease(leasePath(stateRoot, orphanLease.port), orphanLease, promotedLease);
            orphanLease = promotedLease;
          }
          const status = processStatus(orphanLease.ownerIdentity);
          if (orphanLease.phase === "runtime" && status === "alive") {
            if (!orphanControl || !sameProcessIdentity(orphanBinding!.wrapperProcessIdentity, orphanLease.ownerIdentity)) {
              throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_MISSING");
            }
            if (!existsSync(persistedArtifactPath)) {
              throw new Error("V3_DEPLOY_LOCAL_BUILD_ARTIFACT_MISSING");
            }
            const recoveredArtifact = readBuildArtifact(persistedArtifactPath);
            if (recoveredArtifact.evidenceRef !== `setfarm://deploy/build-artifact/${request.runId}/${recoveredArtifact.artifactHash}`) {
              throw new Error("V3_DEPLOY_LOCAL_BUILD_ARTIFACT_IDENTITY_CONFLICT");
            }
            const sealedRuntime = await materializeV3SealedRuntime({
              stateRoot,
              runId: request.runId,
              candidateHash: request.candidate.candidateHash,
              expectedSource: request.candidate.sourceRevision,
              worktree: request.worktree,
              artifact: recoveredArtifact,
              previewCwd: request.previewCommand.cwd,
              packageManager: request.topology.policies.packageManager,
              runtimeDataContractHash,
              capacityLimits: sealCapacityLimits,
              onDurabilityBoundary: input.onDurabilityBoundary,
            });
            const recoveredRuntime = exactRuntimeForLease(
              request,
              orphanLease,
              recoveredArtifact,
              sealedRuntime.evidenceRef,
              sealedRuntime.manifestHash,
              sealedRuntime.manifestEvidenceRef,
              sealedRuntime.sealAuthorityHash,
              sealedRuntime.sealAuthorityEvidenceRef,
              orphanControl,
            );
            await proveRuntimeIsolation(orphanControl);
            writeTextAtomically(persistedPidPath, `${orphanLease.ownerPid}\n`);
            writeJsonAtomically(
              persistedStatePath,
              exactStateForLease(
                request,
                orphanLease,
                recoveredArtifact,
                sealedRuntime.root,
                sealedRuntime.evidenceRef,
                sealedRuntime.manifestHash,
                sealedRuntime.manifestEvidenceRef,
                sealedRuntime.sealAuthorityHash,
                sealedRuntime.sealAuthorityEvidenceRef,
                orphanControl,
                recoveredRuntime,
              ),
            );
            publishExactLaunchGate(stateRoot, orphanLease);
            if (stagedMarker) assertPublicationMarkerIdentity(stagedMarker, request, recoveredRuntime);
            localProcesses.set(processKey, {
              pid: orphanLease.ownerPid,
              logPath,
              lease: orphanLease,
              buildArtifact: recoveredArtifact,
              sealedRuntimeRoot: sealedRuntime.root,
            });
            lifecyclePublished = true;
            return {
              runtime: recoveredRuntime,
              buildArtifact: recoveredArtifact,
              lifecycleToken: operationLock.token,
              ...(stagedMarker ? { stagedReceipt: stagedMarker.receipt } : {}),
            };
          }
          if (status !== "dead") {
            throw new Error(orphanLease.phase === "allocating"
              ? "V3_DEPLOY_LOCAL_DEPLOY_IN_PROGRESS"
              : "V3_DEPLOY_PROCESS_IDENTITY_AMBIGUOUS");
          }
          if (orphanControl && processStatus(orphanBinding!.wrapperProcessIdentity) === "alive") {
            await terminateExactProcessGroup(orphanBinding!.wrapperProcessIdentity);
          }
          let orphanArtifact: V3BuildArtifactV1 | undefined;
          if (existsSync(persistedArtifactPath)) orphanArtifact = readBuildArtifact(persistedArtifactPath);
          cleanupExactDeadDeployment(stateRoot, orphanLease, orphanArtifact);
          stagedMarker = undefined;
        }

        if (stagedMarker) {
          throw new Error("V3_DEPLOY_LOCAL_PUBLICATION_MARKER_WITHOUT_RUNTIME");
        }
        if (existsSync(persistedIsolationControlPath)) {
          throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_WITHOUT_LEASE");
        }

        const host = "127.0.0.1";
        const reservation = await reserveLocalPort({ stateRoot, request, portStart, portEnd });
        let ownedLease = reservation.lease;
        let reservationOpen = true;
        let launcherPid = 0;
        let launcherIdentity: ProcessIdentityV1 | undefined;
        let buildArtifact: V3BuildArtifactV1 | undefined;
        let isolationControl: V3LocalRuntimeIsolationControlV1 | undefined;
        try {
          const buildEnvironment = minimalBuildEnvironment(request.environment, host, reservation.lease.port);
          const buildArgv = commandArgv(request.buildCommand, host, reservation.lease.port);
          await execFileAsync(buildArgv[0]!, buildArgv.slice(1), {
            cwd: resolvedCwd(request.worktree, request.buildCommand.cwd),
            env: buildEnvironment,
            timeout: request.buildCommand.timeoutMs,
            maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
          });

          buildArtifact = await captureV3BuildArtifact({
            runId: request.runId,
            worktree: request.worktree,
            outputPaths: request.topology.policies.buildOutputPaths,
          });
          if (!writeExclusiveJson(persistedArtifactPath, buildArtifact)) {
            throw new Error("V3_DEPLOY_LOCAL_BUILD_ARTIFACT_IDENTITY_CONFLICT");
          }
          const sealedRuntime = await materializeV3SealedRuntime({
            stateRoot,
            runId: request.runId,
            candidateHash: request.candidate.candidateHash,
            expectedSource: request.candidate.sourceRevision,
            worktree: request.worktree,
            artifact: buildArtifact,
            previewCwd: request.previewCommand.cwd,
            packageManager: request.topology.policies.packageManager,
            runtimeDataContractHash,
            capacityLimits: sealCapacityLimits,
            onDurabilityBoundary: input.onDurabilityBoundary,
          });

          const previewArgv = commandArgv(request.previewCommand, host, reservation.lease.port);
          const gate = exactLaunchGate(reservation.lease);
          const gateFilePath = launchGatePath(stateRoot, reservation.lease.leaseId);
          const runtimeEnvironment = minimalRuntimeEnvironment(
            request.environment,
            host,
            reservation.lease.port,
            sealedRuntime.root,
          );
          const isolation = createWriteFreeDarwinIsolationBundle({
            runId: request.runId,
            projectId: request.projectId,
            candidateHash: request.candidate.candidateHash,
            buildArtifactHash: buildArtifact.artifactHash,
            stateRoot,
            sealedRuntimeRoot: sealedRuntime.root,
            gatePath: gateFilePath,
            logPath,
            previewArgv,
            environment: runtimeEnvironment,
            runtimeDataContract: runtimeData.contract,
            runtimeDataContractHash,
            ...isolationConfigRoots,
          });
          const launcher = await spawnDarwinIsolatedRuntime({
            gatePath: gateFilePath,
            expectedGate: gate,
            cwd: resolvedCwd(sealedRuntime.root, request.previewCommand.cwd),
            argv: previewArgv,
            environment: runtimeEnvironment,
            logPath,
            isolation,
          });
          launcherPid = Number(launcher.child.pid ?? 0);
          if (!launcherPid) throw new Error("V3_DEPLOY_PROCESS_START_FAILED");
          launcherIdentity = await observeSpawnedProcessIdentity(launcherPid);
          if (launcherIdentity.processGroupId !== launcherIdentity.pid) {
            throw new Error("V3_DEPLOY_PROCESS_GROUP_OWNER_INVALID");
          }
          const isolationControlIdentity = V3LocalRuntimeIsolationBindingIdentityV1Schema.parse({
            schema: "setfarm.v3-local-runtime-isolation-binding.v1",
            runId: request.runId,
            projectId: request.projectId,
            candidateHash: request.candidate.candidateHash,
            packetHash: request.candidate.packetHash,
            buildArtifactHash: buildArtifact.artifactHash,
            sealedRuntimeManifestHash: sealedRuntime.manifestHash,
            leaseId: reservation.lease.leaseId,
            runtimePort: reservation.lease.port,
            wrapperProcessIdentity: launcherIdentity,
            controlPort: launcher.controlPort,
            runtimeIsolationPolicy: isolation.policy,
            runtimeIsolation: isolation.authority,
            volumeProvisioning: isolation.volumeProvisioning,
            createdAt: new Date().toISOString(),
          });
          isolationControl = V3LocalRuntimeIsolationControlV1Schema.parse({
            schema: "setfarm.v3-local-runtime-isolation-control.v1",
            binding: {
              ...isolationControlIdentity,
              controlBindingHash: hashCanonicalJson(isolationControlIdentity),
            },
            controlToken: launcher.controlToken,
          });
          await proveRuntimeIsolation(isolationControl);
          if (!writeExclusiveJson(persistedIsolationControlPath, isolationControl)) {
            throw new Error("V3_DEPLOY_LOCAL_ISOLATION_CONTROL_IDENTITY_CONFLICT");
          }
          launcher.child.unref();
          const runtimeLease = V3LocalPortLeaseV1Schema.parse({
            ...reservation.lease,
            phase: "runtime",
            ownerPid: launcherPid,
            ownerIdentity: launcherIdentity,
          });
          replaceExactLease(reservation.filePath, reservation.lease, runtimeLease);
          ownedLease = runtimeLease;
          const runtime = exactRuntimeForLease(
            request,
            runtimeLease,
            buildArtifact,
            sealedRuntime.evidenceRef,
            sealedRuntime.manifestHash,
            sealedRuntime.manifestEvidenceRef,
            sealedRuntime.sealAuthorityHash,
            sealedRuntime.sealAuthorityEvidenceRef,
            isolationControl,
          );
          input.onDurabilityBoundary?.("deployment_state_pending");
          writeTextAtomically(persistedPidPath, `${launcherPid}\n`);
          writeJsonAtomically(
            persistedStatePath,
            exactStateForLease(
              request,
              runtimeLease,
              buildArtifact,
              sealedRuntime.root,
              sealedRuntime.evidenceRef,
              sealedRuntime.manifestHash,
              sealedRuntime.manifestEvidenceRef,
              sealedRuntime.sealAuthorityHash,
              sealedRuntime.sealAuthorityEvidenceRef,
              isolationControl,
              runtime,
            ),
          );
          await closeReservation(reservation.server);
          reservationOpen = false;
          publishExactLaunchGate(stateRoot, runtimeLease);
          localProcesses.set(processKey, {
            pid: launcherPid,
            logPath,
            lease: runtimeLease,
            buildArtifact,
            sealedRuntimeRoot: sealedRuntime.root,
          });
          lifecyclePublished = true;
          return { runtime, buildArtifact, lifecycleToken: operationLock.token };
        } catch (error) {
          if (reservationOpen) {
            try { await closeReservation(reservation.server); } catch { /* primary failure remains canonical */ }
          }
          let deathFailure: unknown;
          try {
            if (launcherIdentity) {
              await terminateExactProcessGroup(launcherIdentity);
            } else if (launcherPid > 0) {
              try { process.kill(-launcherPid, "SIGTERM"); } catch (signalError) {
                if ((signalError as NodeJS.ErrnoException).code !== "ESRCH") throw signalError;
              }
              if (!await waitForProcessGroupDeath(launcherPid, 60)) {
                try { process.kill(-launcherPid, "SIGKILL"); } catch (signalError) {
                  if ((signalError as NodeJS.ErrnoException).code !== "ESRCH") throw signalError;
                }
              }
              if (!await waitForProcessGroupDeath(launcherPid, 60)) {
                throw new Error("V3_DEPLOY_PROCESS_GROUP_DEATH_UNPROVEN");
              }
            }
          } catch (terminationError) {
            deathFailure = terminationError;
          }
          localProcesses.delete(processKey);
          if (deathFailure) {
            recordCleanupQuarantine(stateRoot, ownedLease, deathFailure);
            lifecycleQuarantined = true;
            throw new Error(`V3_DEPLOY_LOCAL_CLEANUP_QUARANTINED:${String(deathFailure).slice(0, 300)};PRIMARY:${String(error).slice(0, 300)}`);
          }
          try {
            cleanupExactDeadDeployment(stateRoot, ownedLease, buildArtifact);
          } catch (cleanupError) {
            lifecycleQuarantined = true;
            throw new Error(`V3_DEPLOY_LOCAL_CLEANUP_OWNERSHIP_FAILED:${String(cleanupError).slice(0, 300)};PRIMARY:${String(error).slice(0, 300)}`);
          }
          throw error;
        }
      } finally {
        if (!lifecyclePublished && !lifecycleQuarantined) {
          releaseOperationLock(stateRoot, request.projectId, operationLock);
        }
      }
    },

    async verifyHealth(
      request: V3DeploymentRequestV1,
      deployment: V3RuntimeDeploymentV1,
      buildArtifact: V3BuildArtifactV1,
      lifecycleToken: string,
    ): Promise<V3DeployHealthProofV1> {
      assertLifecycleOperationLock(stateRoot, request, lifecycleToken);
      const runtimeDataContractHash = exactRuntimeDataContract(request.topology).contractHash;
      {
        const state = readDeploymentState(statePath(stateRoot, request.projectId));
        const isolationControl = readIsolationControl(isolationControlPath(stateRoot, request.projectId));
        if (
          JSON.stringify(state.runtime) !== JSON.stringify(V3RuntimeDeploymentV1Schema.parse(deployment))
          || !exactV3BuildArtifactMatch(state.buildArtifact, buildArtifact)
          || !exactV3BuildArtifactMatch(readBuildArtifact(artifactPath(stateRoot, request.projectId)), buildArtifact)
          || JSON.stringify(publicIsolationBinding(isolationControl)) !== JSON.stringify(state.isolationBinding)
        ) {
          throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
        }
        const observedLease = readLease(leasePath(stateRoot, state.portLease.port));
        if (observedLease.status !== "valid" || !sameLease(observedLease.lease, state.portLease)) {
          throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
        }
        let lastStatus = 0;
        const attempts = input.healthAttempts ?? DEFAULT_HEALTH_ATTEMPTS;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            const response = await fetch(deployment.healthUrl, {
              signal: AbortSignal.timeout(3_000),
              redirect: "manual",
            });
            lastStatus = response.status;
            await response.body?.cancel();
            if (response.status >= 200 && response.status < 400) {
              let listenerOwnership: V3ListenerOwnershipV1;
              try {
                listenerOwnership = await proveListenerOwnership({
                  deployment,
                  lease: state.portLease,
                  listenerPids,
                });
              } catch (error) {
                if (!String(error).includes("V3_DEPLOY_LISTENER_MISSING")) throw error;
                if (attempt + 1 < attempts) {
                  await new Promise((resolve) => setTimeout(resolve, input.healthIntervalMs ?? DEFAULT_HEALTH_INTERVAL_MS));
                  continue;
                }
                throw error;
              }
              await verifyV3SealedRuntime({
                root: state.sealedRuntimeRoot,
                runId: request.runId,
                candidateHash: request.candidate.candidateHash,
                expectedSource: request.candidate.sourceRevision,
                artifact: buildArtifact,
                previewCwd: request.previewCommand.cwd,
                packageManager: request.topology.policies.packageManager,
                expectedRuntimeDataContractHash: runtimeDataContractHash,
                expectedManifestHash: deployment.sealedRuntimeManifestHash,
                expectedManifestEvidenceRef: deployment.sealedRuntimeManifestEvidenceRef,
              });
              const runtimeIsolation = await proveRuntimeIsolation(isolationControl);
              return V3DeployHealthProofV1Schema.parse({
                schema: "setfarm.v3-deploy-health-proof.v1",
                status: "pass",
                httpStatus: response.status,
                checkedAt: new Date().toISOString(),
                evidenceRef: `${deployment.evidenceRef}/health`,
                buildArtifactHash: buildArtifact.artifactHash,
                buildArtifactEvidenceRef: buildArtifact.evidenceRef,
                sealedRuntimeManifestHash: deployment.sealedRuntimeManifestHash,
                sealedRuntimeManifestEvidenceRef: deployment.sealedRuntimeManifestEvidenceRef,
                listenerOwnership,
                runtimeIsolation,
              });
            }
          } catch (error) {
            if (
              String(error).includes("V3_DEPLOY_FOREIGN_LISTENER")
              || String(error).includes("V3_DEPLOY_BUILD_OUTPUT_")
              || String(error).includes("V3_DEPLOY_SEALED_RUNTIME_")
              || String(error).includes("V3_DEPLOY_LISTENER_EVIDENCE_UNAVAILABLE")
              || String(error).includes("V3_DEPLOY_LISTENER_OWNER_IDENTITY_MISMATCH")
            ) {
              throw error;
            }
            lastStatus = 0;
          }
          if (attempt + 1 < attempts) {
            await new Promise((resolve) => setTimeout(resolve, input.healthIntervalMs ?? DEFAULT_HEALTH_INTERVAL_MS));
          }
        }
        throw deploymentError("V3_DEPLOY_HEALTH_FAILED", `runtime health check did not pass (last status ${lastStatus})`, {
          projectId: deployment.projectId,
          lastHttpStatus: String(lastStatus),
        });
      }
    },

    async stagePublication(
      request: V3DeploymentRequestV1,
      deployment: V3RuntimeDeploymentV1,
      receipt: V3DeployReceiptV1,
      lifecycleToken: string,
    ): Promise<void> {
      assertLifecycleOperationLock(stateRoot, request, lifecycleToken);
      const state = readDeploymentState(statePath(stateRoot, request.projectId));
      if (JSON.stringify(state.runtime) !== JSON.stringify(V3RuntimeDeploymentV1Schema.parse(deployment))) {
        throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
      }
      stagePublicationMarker(stateRoot, request, deployment, receipt);
    },

    async release(
      request: V3DeploymentRequestV1,
      deployment: V3RuntimeDeploymentV1,
      lifecycleToken: string,
      outcome: "committed" | "reconcile",
    ): Promise<void> {
      const operationLock = assertLifecycleOperationLock(stateRoot, request, lifecycleToken);
      const state = readDeploymentState(statePath(stateRoot, request.projectId));
      if (
        !leaseMatchesRequest(state.portLease, request)
        || JSON.stringify(state.runtime) !== JSON.stringify(V3RuntimeDeploymentV1Schema.parse(deployment))
      ) {
        throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
      }
      const markerPath = publicationMarkerPath(stateRoot, request.projectId);
      const marker = readPublicationMarker(markerPath);
      assertPublicationMarkerIdentity(marker, request, deployment);
      if (outcome === "committed") unlinkDurably(markerPath);
      releaseOperationLock(stateRoot, request.projectId, operationLock);
    },

    async rollback(
      request: V3DeploymentRequestV1,
      deployment: V3RuntimeDeploymentV1,
      reason: string,
      lifecycleToken: string,
    ): Promise<void> {
      const operationLock = assertLifecycleOperationLock(stateRoot, request, lifecycleToken);
      {
        const processKey = localProcessKey(stateRoot, request.runId, request.projectId);
        const handle = localProcesses.get(processKey);
        const persistedStatePath = statePath(stateRoot, request.projectId);
        const state = existsSync(persistedStatePath)
          ? readDeploymentState(persistedStatePath)
          : undefined;
        const expectedLease = state?.portLease ?? handle?.lease;
        const expectedArtifact = state?.buildArtifact ?? handle?.buildArtifact;
        if (!expectedLease || !expectedArtifact || !leaseMatchesRequest(expectedLease, request)) {
          throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
        }
        if (
          expectedLease.phase !== "runtime"
          || deployment.projectId !== request.projectId
          || deployment.port !== expectedLease.port
          || deployment.serviceId !== `process:${expectedLease.ownerPid}`
          || deployment.buildArtifactHash !== expectedArtifact.artifactHash
          || (state && JSON.stringify(state.runtime) !== JSON.stringify(V3RuntimeDeploymentV1Schema.parse(deployment)))
        ) {
          throw new Error("V3_DEPLOY_LOCAL_STATE_IDENTITY_CONFLICT");
        }
        const observedLease = readLease(leasePath(stateRoot, expectedLease.port));
        if (observedLease.status !== "valid" || !sameLease(observedLease.lease, expectedLease)) {
          throw new Error("V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH");
        }
        await terminateExactProcessGroup(expectedLease.ownerIdentity);
        cleanupExactDeadDeployment(stateRoot, expectedLease, expectedArtifact);
        localProcesses.delete(processKey);
        releaseOperationLock(stateRoot, request.projectId, operationLock);
        void reason;
      }
    },
  });
}

export type V3DeployPublicationReconciliationResult =
  | Readonly<{ status: "none" }>
  | Readonly<{ status: "cleared_committed"; receiptHash: string }>
  | Readonly<{ status: "retry_required"; receipt: V3DeployReceiptV1 }>
  | Readonly<{ status: "unknown_preserved"; receiptHash: string }>;

/**
 * Cross-process, cache-free observation owner used by the dashboard. Every
 * call reopens private mode-0600 control authority and re-challenges the live
 * sandbox before it can report ACTIVE.
 */
export async function observeLocalV3Deployment(input: Readonly<{
  stateRoot?: string;
  receipt: V3DeployReceiptV1;
  listenerPids?: (port: number) => Promise<number[]>;
  httpTimeoutMs?: number;
  now?: () => Date;
}>): Promise<V3DeploymentObservationV1> {
  const receipt = V3DeployReceiptV1Schema.parse(input.receipt);
  if (receipt.runtime.mode !== "local") {
    throw new Error("V3_DEPLOY_OBSERVATION_REMOTE_UNSUPPORTED");
  }
  const stateRoot = ensureCanonicalV3StateRoot(
    input.stateRoot ?? path.join(runtimeConfig.setfarmDir, "v3-deployments"),
  );
  const state = readDeploymentState(statePath(stateRoot, receipt.project.projectId));
  const control = readIsolationControl(isolationControlPath(stateRoot, receipt.project.projectId));
  if (
    state.runId !== receipt.runId
    || state.candidateHash !== receipt.candidateHash
    || state.packetHash !== receipt.packetHash
    || !exactV3BuildArtifactMatch(state.buildArtifact, receipt.buildArtifact)
    || JSON.stringify(state.runtime) !== JSON.stringify(receipt.runtime)
    || JSON.stringify(publicIsolationBinding(control)) !== JSON.stringify(state.isolationBinding)
  ) {
    throw new Error("V3_DEPLOY_OBSERVATION_RECEIPT_IDENTITY_MISMATCH");
  }
  const observedLease = readLease(leasePath(stateRoot, state.portLease.port));
  if (observedLease.status !== "valid" || !sameLease(observedLease.lease, state.portLease)) {
    throw new Error("V3_DEPLOY_OBSERVATION_LEASE_IDENTITY_MISMATCH");
  }
  if (processStatus(state.portLease.ownerIdentity) !== "alive") {
    throw new Error("V3_DEPLOY_OBSERVATION_PROCESS_NOT_ALIVE");
  }
  if (!exactV3BuildArtifactMatch(
    receipt.buildArtifact,
    readBuildArtifact(artifactPath(stateRoot, receipt.project.projectId)),
  )) {
    throw new Error("V3_DEPLOY_OBSERVATION_BUILD_ARTIFACT_MISMATCH");
  }
  const timeoutMs = input.httpTimeoutMs ?? 3_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5_000) {
    throw new Error("V3_DEPLOY_OBSERVATION_TIMEOUT_INVALID");
  }
  const response = await fetch(receipt.runtime.healthUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "manual",
  });
  const httpCheckedAt = new Date().toISOString();
  const httpStatus = response.status;
  try {
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`V3_DEPLOY_OBSERVATION_HTTP_STATUS_INVALID:${response.status}`);
    }
  } finally {
    await response.body?.cancel();
  }
  const listenerOwnership = await proveListenerOwnership({
    deployment: receipt.runtime,
    lease: state.portLease,
    listenerPids: input.listenerPids ?? defaultListenerPids,
  });
  await verifyV3SealedRuntime({
    root: state.sealedRuntimeRoot,
    runId: receipt.runId,
    candidateHash: receipt.candidateHash,
    expectedSource: receipt.sourceAfter,
    artifact: receipt.buildArtifact,
    previewCwd: state.previewCwd,
    packageManager: state.packageManager,
    expectedRuntimeDataContractHash: receipt.runtime.runtimeDataContractHash,
    expectedManifestHash: receipt.runtime.sealedRuntimeManifestHash,
    expectedManifestEvidenceRef: receipt.runtime.sealedRuntimeManifestEvidenceRef,
  });
  const runtimeIsolation = await proveRuntimeIsolation(control);
  const stateAfter = readDeploymentState(statePath(stateRoot, receipt.project.projectId));
  const controlAfter = readIsolationControl(isolationControlPath(stateRoot, receipt.project.projectId));
  const leaseAfter = readLease(leasePath(stateRoot, state.portLease.port));
  if (
    JSON.stringify(stateAfter) !== JSON.stringify(state)
    || JSON.stringify(controlAfter) !== JSON.stringify(control)
    || leaseAfter.status !== "valid"
    || !sameLease(leaseAfter.lease, state.portLease)
    || processStatus(state.portLease.ownerIdentity) !== "alive"
  ) {
    throw new Error("V3_DEPLOY_OBSERVATION_AUTHORITY_CHANGED_DURING_PROBE");
  }
  const observedAt = (input.now ?? (() => new Date()))().toISOString();
  const deploymentStateHash = hashCanonicalJson(state);
  const leaseIdentityHash = hashCanonicalJson(state.portLease);
  return createV3DeploymentObservationV1({
    schema: "setfarm.v3-deployment-observation.v1",
    observationVersion: 1,
    runId: receipt.runId,
    deploymentReceiptHash: receipt.receiptHash,
    receiptCompletedAt: receipt.completedAt,
    candidateHash: receipt.candidateHash,
    packetHash: receipt.packetHash,
    projectId: receipt.project.projectId,
    buildArtifactHash: receipt.buildArtifact.artifactHash,
    sealedRuntimeManifestHash: receipt.runtime.sealedRuntimeManifestHash,
    sealedRuntimeManifestEvidenceRef: receipt.runtime.sealedRuntimeManifestEvidenceRef,
    sealAuthorityHash: receipt.runtime.sealAuthorityHash,
    sealAuthorityEvidenceRef: receipt.runtime.sealAuthorityEvidenceRef,
    runtime: receipt.runtime,
    listenerOwnership,
    runtimeIsolation,
    deploymentStateHash,
    deploymentStateEvidenceRef: `setfarm://deploy/runtime-state/${receipt.runId}/${receipt.project.projectId}/${deploymentStateHash}`,
    controlBindingHash: state.isolationBinding.controlBindingHash,
    leaseIdentityHash,
    leaseIdentityEvidenceRef: `setfarm://deploy/runtime-lease/${receipt.runId}/${receipt.project.projectId}/${leaseIdentityHash}`,
    httpProof: {
      schema: "setfarm.v3-runtime-http-proof.v1",
      healthUrl: receipt.runtime.healthUrl,
      httpStatus,
      checkedAt: httpCheckedAt,
      evidenceRef: `${receipt.runtime.evidenceRef}/http/${receipt.receiptHash}`,
    },
    checks: {
      receiptIdentity: "pass",
      processIdentity: "pass",
      listenerOwnership: "pass",
      runtimeHttp: "pass",
      sealedRuntime: "pass",
      runtimeIsolation: "pass",
    },
    observedAt,
  });
}

/**
 * Restart-safe resolver for the durable marker staged before the receipt DB
 * transaction. The caller supplies canonical DB readback; this function owns
 * filesystem serialization and never infers commit state from process prose.
 */
export async function reconcileLocalV3DeployPublication(input: Readonly<{
  stateRoot: string;
  runId: string;
  projectId: string;
  candidateHash: string;
  packetHash: string;
  canonicalStatus(receiptHash: string): Promise<"committed" | "absent" | "unknown">;
}>): Promise<V3DeployPublicationReconciliationResult> {
  const stateRoot = ensureCanonicalV3StateRoot(input.stateRoot);
  const identity = {
    runId: input.runId,
    projectId: input.projectId,
    candidate: {
      candidateHash: input.candidateHash,
      packetHash: input.packetHash,
    },
  };
  const operationLock = acquireOperationLock(stateRoot, identity, "reconcile");
  try {
    const filePath = publicationMarkerPath(stateRoot, input.projectId);
    if (!existsSync(filePath)) return { status: "none" };
    const marker = readPublicationMarker(filePath);
    if (
      marker.receipt.runId !== input.runId
      || marker.receipt.project.projectId !== input.projectId
      || marker.receipt.candidateHash !== input.candidateHash
      || marker.receipt.packetHash !== input.packetHash
    ) {
      throw new Error("V3_DEPLOY_LOCAL_PUBLICATION_MARKER_IDENTITY_CONFLICT");
    }
    const status = await input.canonicalStatus(marker.receipt.receiptHash);
    if (status === "committed") {
      unlinkDurably(filePath);
      return { status: "cleared_committed", receiptHash: marker.receipt.receiptHash };
    }
    if (status === "absent") return { status: "retry_required", receipt: marker.receipt };
    return { status: "unknown_preserved", receiptHash: marker.receipt.receiptHash };
  } finally {
    releaseOperationLock(stateRoot, input.projectId, operationLock);
  }
}

export function createPostgresV3DeployExecutor(input: Readonly<{
  sql: Sql;
  adapter?: V3DeploymentPlatformAdapter;
}>): ReturnType<typeof createV3DeployExecutor> {
  const reader = createRuntimeArtifactReader({
    sql: input.sql as postgres.Sql,
    artifactRoot: resolveProductArtifactDir(),
    artifactLimits: resolveProductArtifactCapacity(),
  });
  return createV3DeployExecutor({
    readPacket: (runId) => reader.readSealedPacket(runId),
    assertAuthority: ({ runId, worktree }) => assertV3DeployAuthority({
      sql: input.sql,
      runId,
      worktree,
    }),
    adapter: input.adapter ?? createLocalProcessV3DeploymentAdapter(),
  });
}
