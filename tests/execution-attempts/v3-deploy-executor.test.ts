import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:net";
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { promisify } from "node:util";

import { createAcceptedCandidateV1 } from "../../src/evidence/accepted-candidate-v1.js";
import type { AcceptedCandidateV1 } from "../../src/evidence/accepted-candidate-v1.js";
import {
  createLocalProcessV3DeploymentAdapter as createLocalProcessV3DeploymentAdapterRaw,
  createV3DeployExecutor,
  reconcileLocalV3DeployPublication,
  V3DeployReceiptV1Schema,
  type V3DeploymentPlatformAdapter,
  type V3DeploymentRequestV1,
  type V3RuntimeDeploymentV1,
} from "../../src/execution/v3-deploy-executor.js";
import {
  V3DeployAuthorityError,
  type V3DeployAuthorityResult,
} from "../../src/execution/v3-deploy-authority.js";
import type { SealedRuntimePacketV1 } from "../../src/product-compiler/runtime-artifact-reader.js";
import type { BuildCommandV1, BuildTopologyV1 } from "../../src/product-compiler/schemas/build-topology-v1.js";
import {
  hashRuntimeDataContractV1,
  RuntimeDataContractV1Schema,
} from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";
import {
  shouldMaterializeRepoDeployEnvironment,
  shouldRunLegacyDeployCompletionGuard,
} from "../../src/installer/steps/11-deploy/env-policy.js";
import {
  commitV3DeployCompletion,
  evaluateV3DeployCapability,
} from "../../src/installer/steps/11-deploy/preclaim.js";
import type { V3DeployReceiptV1 } from "../../src/execution/schemas/v3-deploy-receipt-v1.js";
import { createV3BuildArtifactV1 } from "../../src/execution/schemas/v3-deploy-receipt-v1.js";
import {
  V3RuntimeIsolationProofV1Schema,
  createV3RuntimeIsolationAuthorityV1,
  createV3RuntimeIsolationChallengeV1,
  createV3RuntimeVolumeProvisioningV1,
} from "../../src/execution/schemas/v3-runtime-isolation-v1.js";
import { V3DeployPublicationPendingError } from "../../src/execution/v3-deploy-publication.js";
import { V3DeploymentObservationV1Schema } from "../../src/execution/schemas/v3-deployment-observation-v1.js";
import { captureShadowSourceRevision } from "../../src/execution/shadow-attempt-recorder.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { V3_STATIC_SPA_PREVIEW_SOURCE } from "../../src/product-compiler/stack-topology-catalog.js";

const execFileAsync = promisify(execFile);
const testIsolationConfigRoots = {
  setfarmConfigRoot: path.resolve("."),
  // Keep the adapter test hermetic in a standalone clone while proving that
  // configured sensitive roots outside HOME are denied by the exact profile.
  missionControlConfigRoot: path.resolve(".."),
};

function createLocalProcessV3DeploymentAdapter(
  input: Parameters<typeof createLocalProcessV3DeploymentAdapterRaw>[0] = {},
) {
  return createLocalProcessV3DeploymentAdapterRaw({
    ...input,
    isolationConfigRoots: testIsolationConfigRoots,
  });
}

function rehashObservation(value: Record<string, any>): Record<string, any> {
  const { observationHash: _hash, evidenceRef: _ref, ...identity } = value;
  const observationHash = hashCanonicalJson(identity);
  return {
    ...identity,
    observationHash,
    evidenceRef: `setfarm://deploy/observation/${identity.runId}/${identity.deploymentReceiptHash}/${observationHash}`,
  };
}

async function makeTemp(prefix: string): Promise<string> {
  return mkdtemp(path.join(await realpath(os.tmpdir()), prefix));
}

async function processIdsMatching(fragment: string): Promise<number[]> {
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,command="]);
  return stdout
    .split("\n")
    .filter((line) => line.includes(fragment))
    .map((line) => Number(/^\s*(\d+)/.exec(line)?.[1]))
    .filter((pid) => Number.isSafeInteger(pid) && pid > 1);
}

const runId = "run-v3-deploy-executor-0001";
const sourceRevision = Object.freeze({ sha: "a".repeat(40), treeHash: "b".repeat(64) });
const candidate = createAcceptedCandidateV1({
  runId,
  packetHash: "1".repeat(64),
  storyPlanHash: "2".repeat(64),
  sourceRevision,
  storyEvidence: [{
    storyId: "US-001",
    attemptId: "ATT_1234567890abcdef",
    sliceHash: "3".repeat(64),
    evidencePlanHash: "4".repeat(64),
    evidencePlanArtifactHash: "5".repeat(64),
    evidenceBundleHash: "6".repeat(64),
    evidenceId: `EVB_${"6".repeat(64)}`,
    predicateRefs: ["EVID_RUNTIME_HEALTH"],
  }],
  acceptor: {
    id: "setfarm-final-tree-acceptor",
    version: "1.0.0",
    codeSha: "c".repeat(40),
    environmentHash: "d".repeat(64),
  },
});
const canonicalProjectId = `prod-deploy-fixture-${candidate.candidateHash.slice(0, 12)}`;
const syntheticArtifact = createV3BuildArtifactV1({
  schema: "setfarm.v3-build-artifact.v1",
  runId,
  outputPaths: ["dist"],
  files: [{
    path: "dist/index.html",
    byteLength: 2,
    contentHash: "7".repeat(64),
    executable: false,
  }],
  totalBytes: 2,
});
const syntheticSealedRuntimeManifestHash = "8".repeat(64);
const syntheticSealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidate.candidateHash}/${syntheticArtifact.artifactHash}/${syntheticSealedRuntimeManifestHash}`;
const syntheticLifecycleToken = "12345678-1234-4234-8234-123456789abc";

function command(
  id: string,
  kind: "build" | "preview",
  argv: string[],
  envRefs: string[] = [],
): BuildCommandV1 {
  return {
    id,
    kind,
    argv,
    cwd: ".",
    timeoutMs: 30_000,
    capabilityRefs: [],
    envRefs,
  };
}

function platformPreview(root: "." | "dist" = "dist", envRefs: string[] = []): BuildCommandV1 {
  return command(
    "CMD_PREVIEW",
    "preview",
    ["node", "-e", V3_STATIC_SPA_PREVIEW_SOURCE, root],
    envRefs,
  );
}

function noHostRuntimeDataContract(
  techStack: "vite-react" | "static-html" | "node-express",
) {
  const contract = RuntimeDataContractV1Schema.parse({
    schema: "setfarm.runtime-data-contract.v1",
    contractVersion: 1,
    sourceProductSpecHash: "a".repeat(64),
    delivery: { platform: techStack === "node-express" ? "api" : "web", techStack, database: "none" },
    policyBindings: [],
    authorities: [{
      id: "AUTH_DATA_STATELESS",
      kind: "stateless",
      durability: "none",
      persistenceRefs: [],
    }],
    writableVolumes: [],
    scratch: { kind: "none" },
  });
  return { contract, contractHash: hashRuntimeDataContractV1(contract) };
}

function topology(commands: BuildCommandV1[]): BuildTopologyV1 {
  const runtimeData = noHostRuntimeDataContract("vite-react");
  return {
    schema: "setfarm.build-topology.v1",
    stackPack: { id: "vite-react-web-app", version: "1.1.0", contentHash: "e".repeat(64) },
    repo: { id: "deploy-fixture", baseSha: "f".repeat(40), treeHash: "0".repeat(40) },
    owners: [],
    pathBindings: [],
    sharedGrants: [],
    entrypoints: [],
    commands,
    capabilities: [],
    runtimeDataContract: runtimeData.contract,
    runtimeDataContractHash: runtimeData.contractHash,
    policies: {
      packageManager: "npm",
      allowedRoots: ["."],
      deniedGlobs: [".env*"],
      buildOutputPaths: ["dist"],
    },
  } as unknown as BuildTopologyV1;
}

function staticTopology(commands: BuildCommandV1[]): BuildTopologyV1 {
  const runtimeData = noHostRuntimeDataContract("static-html");
  return {
    schema: "setfarm.build-topology.v1",
    stackPack: { id: "static-html-site", version: "1.1.0", contentHash: "9".repeat(64) },
    repo: { id: "static-deploy-fixture", baseSha: "f".repeat(40), treeHash: "0".repeat(40) },
    owners: [],
    pathBindings: [],
    sharedGrants: [],
    entrypoints: [],
    commands,
    capabilities: [],
    runtimeDataContract: runtimeData.contract,
    runtimeDataContractHash: runtimeData.contractHash,
    policies: {
      packageManager: "none",
      allowedRoots: ["."],
      deniedGlobs: [".env*"],
      buildOutputPaths: ["index.html"],
    },
  } as unknown as BuildTopologyV1;
}

function packet(
  buildTopology: BuildTopologyV1,
  techStack: "vite-react" | "static-html" = "vite-react",
): SealedRuntimePacketV1 {
  return {
    runId,
    packetHash: candidate.packetHash,
    buildTopology,
    productSpec: {
      product: {
        id: "PROD_DEPLOY_FIXTURE",
        name: "Canonical Deploy Fixture",
        class: "utility",
        goals: [{ id: "GOAL_DEPLOY", statement: "Prove deterministic v3 deployment." }],
        nonGoals: [],
      },
      delivery: {
        platform: "web",
        techStack,
      },
    },
  } as unknown as SealedRuntimePacketV1;
}

function authority(observed = sourceRevision): Extract<V3DeployAuthorityResult, { status: "authorized" }> {
  return { status: "authorized", candidate, observedSource: observed };
}

function runtime(projectId = canonicalProjectId): V3RuntimeDeploymentV1 {
  const runtimeDataContractHash = noHostRuntimeDataContract("vite-react").contractHash;
  const volumeProvisioning = createV3RuntimeVolumeProvisioningV1({
    schema: "setfarm.v3-runtime-volume-provisioning.v1",
    runId,
    projectId,
    runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" },
  });
  const runtimeIsolation = createV3RuntimeIsolationAuthorityV1({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: "darwin-sandbox-exec",
    adapterVersion: "1.0.0",
    runId,
    projectId,
    candidateHash: candidate.candidateHash,
    buildArtifactHash: syntheticArtifact.artifactHash,
    policyHash: "9".repeat(64),
    profileHash: "a".repeat(64),
    wrapperArtifactHash: "b".repeat(64),
    runtimeDataContractHash,
    volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
  });
  return {
    schema: "setfarm.v3-runtime-deployment.v1",
    mode: "local",
    projectId,
    serviceId: "process:101",
    host: "127.0.0.1",
    port: 4311,
    healthUrl: "http://127.0.0.1:4311/",
    deployUrl: "http://127.0.0.1:4311/",
    evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}`,
    buildArtifactHash: syntheticArtifact.artifactHash,
    buildArtifactEvidenceRef: syntheticArtifact.evidenceRef,
    sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${runId}/${candidate.candidateHash}/${syntheticArtifact.artifactHash}`,
    sealedRuntimeManifestHash: syntheticSealedRuntimeManifestHash,
    sealedRuntimeManifestEvidenceRef: syntheticSealedRuntimeManifestEvidenceRef,
    sealAuthorityHash: "d".repeat(64),
    sealAuthorityEvidenceRef: `setfarm://deploy/seal-authority/${runId}/${candidate.candidateHash}/${syntheticArtifact.artifactHash}/${"d".repeat(64)}`,
    runtimeDataContractHash,
    volumeProvisioning,
    runtimeIsolation,
  };
}

function healthProof(): V3DeployReceiptV1["health"] {
  const ownerProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: 101,
    processStartedAt: "2026-07-13T09:59:00.000Z",
    processGroupId: 101,
    source: "observed_os" as const,
  };
  const deployment = runtime();
  const challenge = createV3RuntimeIsolationChallengeV1({
    schema: "setfarm.v3-runtime-isolation-challenge.v1",
    nonce: "e".repeat(64),
    authorityHash: deployment.runtimeIsolation.authorityHash,
    wrapperProcessIdentity: ownerProcess,
    deniedRootProbes: [
      { rootId: "sealed-runtime", outcome: "denied" },
      { rootId: "state-authority", outcome: "denied" },
    ],
    deniedReadProbes: [
      { authorityId: "launch-agents", outcome: "denied" },
      { authorityId: "mission-control-config", outcome: "denied" },
      { authorityId: "setfarm-config", outcome: "denied" },
    ],
    deniedNetworkProbes: [{ authorityId: "all-outbound", outcome: "denied" }],
    deniedProcessExecProbes: [{ executableId: "launchctl", outcome: "denied" }],
    deniedSignalProbes: [{ authorityId: "control-sentinel", outcome: "denied" }],
    allowedVolumeProbes: [],
    challengedAt: "2026-07-13T09:59:59.000Z",
  });
  const runtimeIsolation = V3RuntimeIsolationProofV1Schema.parse({
    ...deployment.runtimeIsolation,
    schema: "setfarm.v3-runtime-isolation-proof.v1",
    challenge,
    checkedAt: "2026-07-13T10:00:00.000Z",
    checks: { runtimeIsolation: "pass" },
  });
  return {
    schema: "setfarm.v3-deploy-health-proof.v1",
    status: "pass",
    httpStatus: 200,
    checkedAt: "2026-07-13T10:00:00.000Z",
    evidenceRef: deployment.evidenceRef + "/health",
    buildArtifactHash: syntheticArtifact.artifactHash,
    buildArtifactEvidenceRef: syntheticArtifact.evidenceRef,
    sealedRuntimeManifestHash: syntheticSealedRuntimeManifestHash,
    sealedRuntimeManifestEvidenceRef: syntheticSealedRuntimeManifestEvidenceRef,
    listenerOwnership: {
      schema: "setfarm.v3-listener-ownership.v1",
      ownerProcess,
      listenerPids: [101],
      listenerProcesses: [ownerProcess],
      host: "127.0.0.1",
      port: 4311,
      checkedAt: "2026-07-13T10:00:00.000Z",
      evidenceRef: `${deployment.evidenceRef}/listener/${ownerProcess.pid}`,
    },
    runtimeIsolation,
  };
}

async function listenOnEphemeralPort(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function freePortStart(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const server = createServer();
    const port = await listenOnEphemeralPort(server);
    await closeServer(server);
    if (port <= 65_525) return port;
  }
  throw new Error("test could not find a bounded local port range");
}

function localRequest(input: Readonly<{
  worktree: string;
  projectId: string;
  requestRunId?: string;
  requestCandidate?: AcceptedCandidateV1;
  buildCommand?: BuildCommandV1;
}>): V3DeploymentRequestV1 {
  const build = input.buildCommand ?? command("CMD_BUILD", "build", [
    process.execPath,
    "-e",
    "const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','ok')",
  ]);
  const preview = platformPreview();
  const requestCandidate = input.requestCandidate ?? candidate;
  return {
    schema: "setfarm.v3-deployment-request.v1",
    runId: input.requestRunId ?? runId,
    worktree: input.worktree,
    projectId: input.projectId,
    displayName: "Adapter Test",
    summary: "Adapter test.",
    candidate: requestCandidate,
    topology: topology([build, preview]),
    buildCommand: build,
    previewCommand: preview,
    target: { mode: "local" },
    environment: {},
  };
}

function acceptedCandidateFor(input: Readonly<{
  runId: string;
  packetHash: string;
  sourceRevision: typeof sourceRevision;
}>): AcceptedCandidateV1 {
  return createAcceptedCandidateV1({
    runId: input.runId,
    packetHash: input.packetHash,
    storyPlanHash: "2".repeat(64),
    sourceRevision: input.sourceRevision,
    storyEvidence: candidate.storyEvidence,
    acceptor: candidate.acceptor,
  });
}

async function prepareLocalRepo(root: string): Promise<Readonly<{
  sourceRevision: typeof sourceRevision;
  candidate: AcceptedCandidateV1;
}>> {
  await writeFile(path.join(root, ".gitignore"), "dist/\nnode_modules/\nruntime/\nbuild-count.txt\n", "utf8");
  await writeFile(path.join(root, "package.json"), "{\"name\":\"deploy-test\",\"private\":true}\n", "utf8");
  await writeFile(path.join(root, "source.txt"), "accepted source\n", "utf8");
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "setfarm-tests@example.invalid"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Setfarm Tests"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const revision = await captureShadowSourceRevision(root) as typeof sourceRevision;
  return {
    sourceRevision: revision,
    candidate: acceptedCandidateFor({ runId, packetHash: candidate.packetHash, sourceRevision: revision }),
  };
}

async function prepareStaticRepo(root: string): Promise<Readonly<{
  sourceRevision: typeof sourceRevision;
  candidate: AcceptedCandidateV1;
}>> {
  await writeFile(path.join(root, ".gitignore"), "runtime/\n", "utf8");
  await writeFile(path.join(root, "index.html"), "<!doctype html><title>sealed static</title>\n", "utf8");
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "setfarm-tests@example.invalid"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Setfarm Tests"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-qm", "static fixture"], { cwd: root });
  const revision = await captureShadowSourceRevision(root) as typeof sourceRevision;
  return {
    sourceRevision: revision,
    candidate: acceptedCandidateFor({ runId, packetHash: candidate.packetHash, sourceRevision: revision }),
  };
}

const cleanupPaths: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map(async (entry) => {
    try { await execFileAsync("chmod", ["-R", "u+w", entry]); } catch { /* best-effort test cleanup */ }
    await rm(entry, { recursive: true, force: true });
  }));
});

describe("Product Compiler v3 deterministic deploy executor", () => {
  it("recovers the exact live launcher after a crash before deployment-state publication", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-state-crash-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    await mkdir(stateRoot, { recursive: true });
    const projectId = `prod-state-crash-${fixture.candidate.candidateHash.slice(0, 12)}`;
    const request = localRequest({
      worktree: temp,
      projectId,
      requestCandidate: fixture.candidate,
    });
    const payloadPath = path.join(stateRoot, "state-crash-worker.json");
    await writeFile(payloadPath, `${JSON.stringify({
      stateRoot,
      portStart: start,
      portEnd: start + 5,
      isolationConfigRoots: testIsolationConfigRoots,
      request,
    })}\n`, "utf8");
    const workerPath = path.resolve(
      "tests/execution-attempts/fixtures/v3-deploy-crash-worker.ts",
    );
    await assert.rejects(
      execFileAsync(process.execPath, ["--import", "tsx", workerPath, payloadPath], {
        cwd: path.resolve("."),
        timeout: 30_000,
      }),
      (error: unknown) => (
        error instanceof Error
        && "code" in error
        && (error as { code?: number }).code === 91
      ),
    );
    const statePath = path.join(stateRoot, `${projectId}.json`);
    await assert.rejects(lstat(statePath), /ENOENT/);

    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot,
      portStart: start,
      portEnd: start + 5,
      healthAttempts: 30,
      healthIntervalMs: 25,
    });
    let recovered: Awaited<ReturnType<typeof adapter.deploy>> | undefined;
    try {
      recovered = await adapter.deploy(request);
      assert.equal((await lstat(statePath)).isFile(), true);
      const state = JSON.parse(await readFile(statePath, "utf8")) as {
        runtime: V3RuntimeDeploymentV1;
      };
      assert.deepEqual(state.runtime, recovered.runtime);
      const health = await adapter.verifyHealth(
        request,
        recovered.runtime,
        recovered.buildArtifact,
        recovered.lifecycleToken,
      );
      assert.equal(health.status, "pass");
    } finally {
      if (recovered) {
        await adapter.rollback(
          request,
          recovered.runtime,
          "state crash test cleanup",
          recovered.lifecycleToken,
        );
      }
    }
  });

  it("orders exact authority around all platform side effects and emits a terminal-project projection ref", async () => {
    const events: string[] = [];
    let requestSeen: V3DeploymentRequestV1 | undefined;
    let authorityCalls = 0;
    const adapter: V3DeploymentPlatformAdapter = {
      async deploy(request) {
        events.push("deploy");
        requestSeen = request;
        return {
          runtime: runtime(request.projectId),
          buildArtifact: syntheticArtifact,
          lifecycleToken: syntheticLifecycleToken,
        };
      },
      async verifyHealth() {
        events.push("health");
        return healthProof();
      },
      async stagePublication() { events.push("stage"); },
      async release() { events.push("release"); },
      async rollback() { events.push("rollback"); },
    };
    const executor = createV3DeployExecutor({
      async readPacket() {
        events.push("packet");
        return packet(topology([
          command("CMD_BUILD", "build", ["npm", "run", "build"], ["DATABASE_URL"]),
          platformPreview("dist", ["DATABASE_URL"]),
        ]));
      },
      async assertAuthority() {
        authorityCalls += 1;
        events.push(`authority-${authorityCalls}`);
        return authority();
      },
      adapter,
      now: () => new Date("2026-07-13T10:01:00.000Z"),
    });

    const result = await executor.execute({
      runId,
      worktree: "/tmp/deploy-fixture",
      context: {
        run_slug: "deploy-fixture",
        project_display_name: "Deploy Fixture",
        DATABASE_URL: "postgresql://runtime-only.invalid/db",
      },
      target: { mode: "local" },
    });

    assert.equal(result.status, "deployed");
    if (result.status !== "deployed") return;
    assert.deepEqual(events, ["packet", "authority-1", "deploy", "health", "authority-2", "stage"]);
    assert.equal(requestSeen?.environment.DATABASE_URL, "postgresql://runtime-only.invalid/db");
    assert.equal(requestSeen?.projectId, canonicalProjectId);
    assert.equal(requestSeen?.displayName, "Canonical Deploy Fixture");
    assert.equal(requestSeen?.summary, "Prove deterministic v3 deployment.");
    assert.deepEqual(result.receipt.environmentNames, ["DATABASE_URL"]);
    assert.equal(result.receipt.candidateId, candidate.candidateId);
    assert.equal(result.receipt.project.productId, "PROD_DEPLOY_FIXTURE");
    assert.equal(result.receipt.project.projectId, canonicalProjectId);
    assert.equal(result.receipt.project.displayName, "Canonical Deploy Fixture");
    assert.equal(result.receipt.project.summary, "Prove deterministic v3 deployment.");
    assert.equal(result.receipt.stack.stackPackId, "vite-react-web-app");
    assert.equal(result.receipt.stack.techStack, "vite-react");
    assert.equal(result.receipt.terminalProjectProjection.owner, "mission-control-terminal-projector");
    assert.equal(result.receipt.terminalProjectProjection.state, "pending_terminal_projection");
    assert.equal(result.receipt.terminalProjectProjection.projectId, canonicalProjectId);
    assert.match(result.receipt.terminalProjectProjection.evidenceRef, /deploy-receipt$/);
    assert.deepEqual(V3DeployReceiptV1Schema.parse(result.receipt), result.receipt);
  });

  it("rolls back a healthy deployment when the final source authority changes", async () => {
    const events: string[] = [];
    let authorityCalls = 0;
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([
        command("CMD_BUILD", "build", ["true"]),
        platformPreview(),
      ])),
      async assertAuthority() {
        authorityCalls += 1;
        if (authorityCalls === 1) return authority();
        throw new V3DeployAuthorityError(
          "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
          "source changed during deploy",
          { runId },
        );
      },
      adapter: {
        async deploy(request) {
          events.push("deploy");
          return {
            runtime: runtime(request.projectId),
            buildArtifact: syntheticArtifact,
            lifecycleToken: syntheticLifecycleToken,
          };
        },
        async verifyHealth() {
          events.push("health");
          return healthProof();
        },
        async stagePublication() { events.push("stage"); },
        async release() { events.push("release"); },
        async rollback() { events.push("rollback"); },
      },
    });

    await assert.rejects(
      executor.execute({ runId, worktree: "/tmp/deploy-fixture", context: {}, target: { mode: "local" } }),
      (error: unknown) => error instanceof V3DeployAuthorityError
        && error.code === "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
    );
    assert.deepEqual(events, ["deploy", "health", "rollback"]);
  });

  it("does not invoke a platform adapter for a sealed non-deployable topology", async () => {
    let calls = 0;
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([command("CMD_BUILD", "build", ["true"])])),
      assertAuthority: async () => authority(),
      adapter: {
        async deploy() {
          calls += 1;
          return { runtime: runtime(), buildArtifact: syntheticArtifact, lifecycleToken: syntheticLifecycleToken };
        },
        async verifyHealth() { calls += 1; throw new Error("unreachable"); },
        async stagePublication() { calls += 1; },
        async release() { calls += 1; },
        async rollback() { calls += 1; },
      },
    });
    const result = await executor.execute({
      runId,
      worktree: "/tmp/deploy-fixture",
      context: {},
      target: { mode: "local" },
    });
    assert.equal(result.status, "not_deployable");
    assert.equal(calls, 0);
  });

  it("rejects a non-platform runtime command before invoking the adapter", async () => {
    let calls = 0;
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([
        command("CMD_BUILD", "build", ["true"]),
        command("CMD_PREVIEW", "preview", ["npm", "run", "preview"]),
      ])),
      assertAuthority: async () => authority(),
      adapter: {
        async deploy() {
          calls += 1;
          return { runtime: runtime(), buildArtifact: syntheticArtifact, lifecycleToken: syntheticLifecycleToken };
        },
        async verifyHealth() { calls += 1; throw new Error("unreachable"); },
        async stagePublication() { calls += 1; },
        async release() { calls += 1; },
        async rollback() { calls += 1; },
      },
    });

    const result = await executor.execute({
      runId,
      worktree: "/tmp/deploy-fixture",
      context: {},
      target: { mode: "local" },
    });

    assert.equal(result.status, "not_deployable");
    if (result.status !== "not_deployable") return;
    assert.equal(result.reason, "SEALED_RUNTIME_COMMAND_UNSUPPORTED");
    assert.equal(calls, 0);
  });

  it("keeps v3 runtime env out of the repo and preserves both legacy policies", () => {
    assert.equal(shouldMaterializeRepoDeployEnvironment({ stepId: "deploy", protocol: "v3" }), false);
    assert.equal(shouldRunLegacyDeployCompletionGuard({ stepId: "deploy", protocol: "v3" }), false);
    assert.equal(shouldMaterializeRepoDeployEnvironment({ stepId: "deploy", protocol: "legacy" }), true);
    assert.equal(shouldRunLegacyDeployCompletionGuard({ stepId: "deploy", protocol: "legacy" }), true);
    assert.equal(shouldMaterializeRepoDeployEnvironment({ stepId: "deploy", protocol: "shadow" }), true);
    assert.equal(shouldRunLegacyDeployCompletionGuard({ stepId: "deploy", protocol: "shadow" }), true);
  });

  it("rolls back the runtime when atomic receipt publication fails, but not after a proven commit", async () => {
    const receipt = { receiptHash: "f".repeat(64) } as V3DeployReceiptV1;
    const publicationFailure = new Error("receipt transaction rolled back");
    let rollbacks = 0;
    await assert.rejects(
      commitV3DeployCompletion({
        runId,
        stepDbId: "deploy-step",
        receipt,
        complete: async () => { throw publicationFailure; },
        canonicalCommitStatus: async () => "absent",
        releaseOwnership: async () => {},
        rollback: async () => { rollbacks += 1; },
      }),
      (error: unknown) => error === publicationFailure,
    );
    assert.equal(rollbacks, 1);

    const committed = await commitV3DeployCompletion({
      runId,
      stepDbId: "deploy-step",
      receipt,
      complete: async () => { throw new Error("post-commit continuation failed"); },
      canonicalCommitStatus: async () => "committed",
      releaseOwnership: async () => {},
      rollback: async () => { rollbacks += 1; },
    });
    assert.equal(committed, "already_committed");
    assert.equal(rollbacks, 1, "canonical service must remain alive after the receipt transaction committed");

    let releases: Array<"committed" | "reconcile"> = [];
    await assert.rejects(
      commitV3DeployCompletion({
        runId,
        stepDbId: "deploy-step",
        receipt,
        complete: async () => { throw new Error("connection lost after possible commit"); },
        canonicalCommitStatus: async () => "unknown",
        releaseOwnership: async (outcome) => { releases.push(outcome); },
        rollback: async () => { rollbacks += 1; },
      }),
      (error: unknown) => error instanceof V3DeployPublicationPendingError,
    );
    assert.deepEqual(releases, ["reconcile"]);
    assert.equal(rollbacks, 1, "unknown publication must preserve runtime for canonical reconciliation");
  });

  it("allocates locally with Mission Control unavailable and adopts the exact live runtime after a crash replay", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-adapter-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const buildCountPath = path.join(temp, "build-count.txt");
    const build = command("CMD_BUILD", "build", [
      process.execPath,
      "-e",
      "const fs=require('node:fs');fs.appendFileSync(process.argv[1],'build\\n');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','sealed')",
      buildCountPath,
    ]);
    const preview = platformPreview();
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot: path.join(temp, "runtime"),
      healthAttempts: 30,
      healthIntervalMs: 25,
      portStart: start,
      portEnd: start + 5,
    });
    const sealedPacket = packet(topology([build, preview]));
    const executor = createV3DeployExecutor({
      readPacket: async () => sealedPacket,
      assertAuthority: async () => ({
        status: "authorized",
        candidate: fixture.candidate,
        observedSource: fixture.sourceRevision,
      }),
      adapter,
    });
    const projectId = `prod-deploy-fixture-${fixture.candidate.candidateHash.slice(0, 12)}`;
    const request = localRequest({ worktree: temp, projectId, requestCandidate: fixture.candidate, buildCommand: build });
    let cleanupLaunch: Awaited<ReturnType<typeof adapter.deploy>> | undefined;
    try {
      const first = await executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } });
      assert.equal(first.status, "deployed");
      if (first.status !== "deployed") return;
      await first.release("reconcile");
      const isolationControlFile = path.join(temp, "runtime", `${projectId}.isolation-control.json`);
      const publicStateBytes = await readFile(path.join(temp, "runtime", `${projectId}.json`), "utf8");
      const privateControlBytes = await readFile(isolationControlFile, "utf8");
      const privateControl = JSON.parse(privateControlBytes) as { controlToken: string; binding: { controlBindingHash: string } };
      assert.equal((await lstat(isolationControlFile)).mode & 0o777, 0o600);
      assert.match(privateControl.controlToken, /^[a-f0-9]{64}$/);
      assert.match(privateControl.binding.controlBindingHash, /^[a-f0-9]{64}$/);
      assert.equal(publicStateBytes.includes(privateControl.controlToken), false);
      assert.equal(JSON.stringify(first.receipt).includes(privateControl.controlToken), false);
      const observationPayloadPath = path.join(temp, "runtime", "observation-worker.json");
      await writeFile(observationPayloadPath, `${JSON.stringify({
        stateRoot: path.join(temp, "runtime"),
        receipt: first.receipt,
      })}\n`);
      const observationWorker = path.resolve(
        "tests/execution-attempts/fixtures/v3-deployment-observation-worker.ts",
      );
      const observed = await execFileAsync(process.execPath, ["--import", "tsx", observationWorker, observationPayloadPath], {
        cwd: path.resolve("."),
        timeout: 15_000,
      });
      const observation = V3DeploymentObservationV1Schema.parse(JSON.parse(observed.stdout));
      assert.equal(observation.deploymentReceiptHash, first.receipt.receiptHash);
      assert.equal(observation.runtimeIsolation.authorityHash, first.receipt.runtime.runtimeIsolation.authorityHash);
      assert.equal(observation.checks.runtimeIsolation, "pass");
      const referenceMutations: Array<(value: Record<string, any>) => void> = [
        (value) => { value.runtime.evidenceRef = "file:///Users/setrox/.ssh/id_ed25519"; },
        (value) => { value.runtime.buildArtifactEvidenceRef = "/Users/setrox/private"; },
        (value) => { value.runtime.sealedRuntimeRef = "/home/runner/private"; },
        (value) => { value.listenerOwnership.evidenceRef = `${value.listenerOwnership.evidenceRef}-sibling`; },
        (value) => { value.deploymentStateEvidenceRef = "file:///tmp/state"; },
        (value) => { value.leaseIdentityEvidenceRef = "/Users/setrox/lease"; },
      ];
      for (const mutate of referenceMutations) {
        const forged = structuredClone(observation) as unknown as Record<string, any>;
        mutate(forged);
        assert.equal(V3DeploymentObservationV1Schema.safeParse(rehashObservation(forged)).success, false);
      }
      {
        const forged = structuredClone(observation) as unknown as Record<string, any>;
        forged.runtime.runtimeDataContractHash = "f".repeat(64);
        assert.equal(V3DeploymentObservationV1Schema.safeParse(rehashObservation(forged)).success, false);
      }
      {
        const forged = structuredClone(observation) as unknown as Record<string, any>;
        const volume = forged.runtime.volumeProvisioning;
        volume.projectId = "sibling-project";
        const { volumeProvisioningHash: _volumeHash, evidenceRef: _volumeRef, ...volumeIdentity } = volume;
        volume.volumeProvisioningHash = hashCanonicalJson(volumeIdentity);
        volume.evidenceRef = `setfarm://deploy/runtime-volumes/${volume.runId}/${volume.projectId}/${volume.volumeProvisioningHash}`;
        assert.equal(V3DeploymentObservationV1Schema.safeParse(rehashObservation(forged)).success, false);
      }
      const reconciliationIdentity = {
        stateRoot: path.join(temp, "runtime"),
        runId,
        projectId,
        candidateHash: fixture.candidate.candidateHash,
        packetHash: fixture.candidate.packetHash,
      };
      assert.deepEqual(
        await reconcileLocalV3DeployPublication({
          ...reconciliationIdentity,
          canonicalStatus: async () => "unknown",
        }),
        { status: "unknown_preserved", receiptHash: first.receipt.receiptHash },
      );
      const absent = await reconcileLocalV3DeployPublication({
        ...reconciliationIdentity,
        canonicalStatus: async () => "absent",
      });
      assert.equal(absent.status, "retry_required");
      if (absent.status === "retry_required") assert.equal(absent.receipt.receiptHash, first.receipt.receiptHash);
      const runtimeStatePath = path.join(temp, "runtime", `${projectId}.json`);
      assert.equal(
        await readFile(path.join(temp, "runtime", `${projectId}.pid`), "utf8").then((value) => value.trim()),
        first.receipt.runtime.serviceId.replace("process:", ""),
      );
      await rm(runtimeStatePath);
      const replay = await executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } });
      assert.equal(replay.status, "deployed");
      if (replay.status !== "deployed") return;
      assert.equal(replay.receipt.receiptHash, first.receipt.receiptHash);
      assert.deepEqual(replay.receipt.runtime, first.receipt.runtime);
      assert.equal(JSON.parse(await readFile(runtimeStatePath, "utf8")).runtime.serviceId, first.receipt.runtime.serviceId);
      assert.equal(await readFile(buildCountPath, "utf8"), "build\n", "adoption must not rebuild or redeploy unchanged source");
      await replay.release("reconcile");
      assert.deepEqual(
        await reconcileLocalV3DeployPublication({
          ...reconciliationIdentity,
          canonicalStatus: async () => "committed",
        }),
        { status: "cleared_committed", receiptHash: first.receipt.receiptHash },
      );
      cleanupLaunch = await adapter.deploy(request);
      await adapter.rollback(request, cleanupLaunch.runtime, "test cleanup", cleanupLaunch.lifecycleToken);
      cleanupLaunch = undefined;
    } finally {
      if (cleanupLaunch) {
        await adapter.rollback(request, cleanupLaunch.runtime, "failed test cleanup", cleanupLaunch.lifecycleToken);
      }
    }
  });

  it("allocates different ports atomically for concurrent v3 deploys", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-concurrent-");
    cleanupPaths.push(temp);
    const firstRoot = path.join(temp, "first");
    const secondRoot = path.join(temp, "second");
    await mkdir(firstRoot, { recursive: true });
    await mkdir(secondRoot, { recursive: true });
    const firstFixture = await prepareLocalRepo(firstRoot);
    const secondBase = await prepareLocalRepo(secondRoot);
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    const firstAdapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 10 });
    const secondAdapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 10 });
    const secondCandidate = acceptedCandidateFor({
      runId: `${runId}-second`,
      packetHash: "9".repeat(64),
      sourceRevision: secondBase.sourceRevision,
    });
    const firstRequest = localRequest({
      worktree: firstRoot,
      projectId: "concurrent-first",
      requestCandidate: firstFixture.candidate,
    });
    const secondRequest = localRequest({
      worktree: secondRoot,
      projectId: "concurrent-second",
      requestRunId: `${runId}-second`,
      requestCandidate: secondCandidate,
    });
    let firstLaunch: Awaited<ReturnType<typeof firstAdapter.deploy>> | undefined;
    let secondLaunch: Awaited<ReturnType<typeof secondAdapter.deploy>> | undefined;
    try {
      [firstLaunch, secondLaunch] = await Promise.all([
        firstAdapter.deploy(firstRequest),
        secondAdapter.deploy(secondRequest),
      ]);
      assert.notEqual(firstLaunch.runtime.port, secondLaunch.runtime.port);
    } finally {
      await Promise.all([
        firstLaunch
          ? firstAdapter.rollback(firstRequest, firstLaunch.runtime, "test cleanup", firstLaunch.lifecycleToken)
          : Promise.resolve(),
        secondLaunch
          ? secondAdapter.rollback(secondRequest, secondLaunch.runtime, "test cleanup", secondLaunch.lifecycleToken)
          : Promise.resolve(),
      ]);
    }
  });

  it("skips a port already bound by an external process", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-occupied-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const occupied = createServer();
    const occupiedPort = await listenOnEphemeralPort(occupied);
    if (occupiedPort > 65_530) {
      await closeServer(occupied);
      return;
    }
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot: path.join(temp, "runtime"),
      portStart: occupiedPort,
      portEnd: occupiedPort + 5,
    });
    const request = localRequest({
      worktree: temp,
      projectId: "occupied-port-test",
      requestCandidate: fixture.candidate,
    });
    let launch: Awaited<ReturnType<typeof adapter.deploy>> | undefined;
    try {
      launch = await adapter.deploy(request);
      assert.notEqual(launch.runtime.port, occupiedPort);
    } finally {
      if (launch) await adapter.rollback(request, launch.runtime, "test cleanup", launch.lifecycleToken);
      await closeServer(occupied);
    }
  });

  it("never deletes or adopts a malformed lease and allocates another port", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-malformed-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    await mkdir(stateRoot, { recursive: true });
    const malformedPath = path.join(stateRoot, `port-${start}.lock`);
    await writeFile(malformedPath, "not-json\n", "utf8");
    const adapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 5 });
    const request = localRequest({
      worktree: temp,
      projectId: "malformed-lease-test",
      requestCandidate: fixture.candidate,
    });
    let launch: Awaited<ReturnType<typeof adapter.deploy>> | undefined;
    try {
      launch = await adapter.deploy(request);
      assert.notEqual(launch.runtime.port, start);
      assert.equal(await readFile(malformedPath, "utf8"), "not-json\n");
    } finally {
      if (launch) await adapter.rollback(request, launch.runtime, "test cleanup", launch.lifecycleToken);
    }
  });

  it("refuses rollback when the durable lease no longer has exact ownership", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-ownership-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    const adapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 5 });
    const request = localRequest({
      worktree: temp,
      projectId: "rollback-ownership-test",
      requestCandidate: fixture.candidate,
    });
    const launch = await adapter.deploy(request);
    const deployment = launch.runtime;
    const state = JSON.parse(await readFile(path.join(stateRoot, "rollback-ownership-test.json"), "utf8")) as {
      portLease: Record<string, unknown>;
    };
    const originalLease = state.portLease;
    const durableLeasePath = path.join(stateRoot, `port-${deployment.port}.lock`);
    await writeFile(durableLeasePath, `${JSON.stringify({ ...originalLease, leaseId: randomUUID() })}\n`, "utf8");
    try {
      await assert.rejects(
        adapter.rollback(request, deployment, "must not kill foreign ownership", launch.lifecycleToken),
        /V3_DEPLOY_LOCAL_LEASE_OWNERSHIP_MISMATCH/,
      );
      assert.doesNotThrow(() => process.kill(Number(deployment.serviceId.replace("process:", "")), 0));
    } finally {
      await writeFile(durableLeasePath, `${JSON.stringify(originalLease)}\n`, "utf8");
      await adapter.rollback(request, deployment, "test cleanup", launch.lifecycleToken);
    }
  });

  it("admits exactly one lifecycle owner for concurrent identical requests", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-same-request-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const countPath = path.join(temp, "build-count.txt");
    const build = command("CMD_BUILD", "build", [
      process.execPath,
      "-e",
      "const fs=require('node:fs');fs.appendFileSync(process.argv[1],'build\\n');setTimeout(()=>{fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','one-owner')},150)",
      countPath,
    ]);
    const stateRoot = path.join(temp, "runtime");
    const firstAdapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 5 });
    const secondAdapter = createLocalProcessV3DeploymentAdapter({ stateRoot, portStart: start, portEnd: start + 5 });
    const request = localRequest({
      worktree: temp,
      projectId: "same-request",
      requestCandidate: fixture.candidate,
      buildCommand: build,
    });
    const settled = await Promise.allSettled([
      firstAdapter.deploy(request),
      secondAdapter.deploy(request),
    ]);
    const fulfilled = settled.filter((entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof firstAdapter.deploy>>> =>
      entry.status === "fulfilled");
    const rejected = settled.filter((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(String(rejected[0]!.reason), /V3_DEPLOY_LOCAL_REQUEST_LOCKED/);
    assert.equal(await readFile(countPath, "utf8"), "build\n");
    const owner = fulfilled[0]!.value;
    await firstAdapter.rollback(request, owner.runtime, "test cleanup", owner.lifecycleToken);
  });

  it("serves the immutable sealed artifact when ignored worktree output mutates after health", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-sealed-runtime-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const dependencyStorePath = path.join(temp, "node_modules", ".store", "runtime-value", "value.txt");
    const dependencyValuePath = path.join(temp, "node_modules", "runtime-value", "value.txt");
    await mkdir(path.dirname(dependencyStorePath), { recursive: true });
    await writeFile(dependencyStorePath, "sealed-dependency", "utf8");
    await symlink(path.join(".store", "runtime-value"), path.join(temp, "node_modules", "runtime-value"), "dir");
    const start = await freePortStart();
    const build = command("CMD_BUILD", "build", [
      process.execPath,
      "-e",
      "const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','sealed-byte')",
    ]);
    const preview = platformPreview();
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot: path.join(temp, "runtime"),
      portStart: start,
      portEnd: start + 5,
      healthIntervalMs: 25,
    });
    let authorityCalls = 0;
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([build, preview])),
      async assertAuthority() {
        authorityCalls += 1;
        if (authorityCalls === 2) {
          await writeFile(path.join(temp, "dist", "index.html"), "mutated-worktree", "utf8");
          await writeFile(dependencyValuePath, "mutated-dependency", "utf8");
        }
        return {
          status: "authorized" as const,
          candidate: fixture.candidate,
          observedSource: fixture.sourceRevision,
        };
      },
      adapter,
    });
    const result = await executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } });
    assert.equal(result.status, "deployed");
    if (result.status !== "deployed") return;
    try {
      assert.equal(await readFile(path.join(temp, "dist", "index.html"), "utf8"), "mutated-worktree");
      assert.equal(await readFile(dependencyValuePath, "utf8"), "mutated-dependency");
      assert.equal(
        await fetch(result.receipt.runtime.deployUrl).then((response) => response.text()),
        "sealed-byte",
      );
      const sealedRoot = path.join(
        temp,
        "runtime",
        "sealed",
        fixture.candidate.candidateHash,
        result.receipt.buildArtifact.artifactHash,
      );
      assert.equal((await lstat(path.join(sealedRoot, "node_modules"))).isSymbolicLink(), false);
      assert.equal((await lstat(path.join(sealedRoot, "node_modules", "runtime-value"))).isSymbolicLink(), false);
      assert.equal(
        await readFile(path.join(sealedRoot, "node_modules", "runtime-value", "value.txt"), "utf8"),
        "sealed-dependency",
      );
      assert.match(result.receipt.runtime.sealedRuntimeRef, new RegExp(result.receipt.buildArtifact.artifactHash));
      assert.match(
        result.receipt.runtime.sealedRuntimeManifestEvidenceRef,
        new RegExp(result.receipt.runtime.sealedRuntimeManifestHash),
      );
    } finally {
      await result.rollback("test cleanup");
    }
  });

  it("deploys a tracked static index as one exact source-and-build artifact", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-static-overlap-");
    cleanupPaths.push(temp);
    const fixture = await prepareStaticRepo(temp);
    const start = await freePortStart();
    const build = command("CMD_BUILD", "build", ["true"]);
    const preview = platformPreview(".");
    const buildTopology = staticTopology([build, preview]);
    const stateRoot = path.join(temp, "runtime");
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot,
      portStart: start,
      portEnd: start + 5,
      healthIntervalMs: 25,
    });
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(buildTopology, "static-html"),
      assertAuthority: async () => ({
        status: "authorized",
        candidate: fixture.candidate,
        observedSource: fixture.sourceRevision,
      }),
      adapter,
    });
    const result = await executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } });
    assert.equal(result.status, "deployed");
    if (result.status !== "deployed") return;
    try {
      assert.equal(
        await fetch(result.receipt.runtime.deployUrl).then((response) => response.text()),
        "<!doctype html><title>sealed static</title>\n",
      );
      assert.deepEqual(result.receipt.buildArtifact.files.map((file) => file.path), ["index.html"]);
      const sealedRoot = path.join(
        stateRoot,
        "sealed",
        fixture.candidate.candidateHash,
        result.receipt.buildArtifact.artifactHash,
      );
      const manifest = JSON.parse(await readFile(
        path.join(sealedRoot, ".setfarm-sealed-runtime-manifest.json"),
        "utf8",
      )) as { files: Array<{ path: string }> };
      assert.equal(manifest.files.filter((file) => file.path === "index.html").length, 1);
    } finally {
      await result.rollback("test cleanup");
    }
  });

  it("rejects sealed source drift while producing health evidence", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-source-drift-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot,
      portStart: start,
      portEnd: start + 5,
      healthIntervalMs: 25,
    });
    const request = localRequest({
      worktree: temp,
      projectId: "sealed-source-drift",
      requestCandidate: fixture.candidate,
    });
    const launch = await adapter.deploy(request);
    const sealedSourcePath = path.join(
      stateRoot,
      "sealed",
      fixture.candidate.candidateHash,
      launch.buildArtifact.artifactHash,
      "source.txt",
    );
    try {
      await chmod(sealedSourcePath, 0o600);
      await writeFile(sealedSourcePath, "drifted sealed source\n", "utf8");
      await chmod(sealedSourcePath, 0o400);
      await assert.rejects(
        adapter.verifyHealth(request, launch.runtime, launch.buildArtifact, launch.lifecycleToken),
        /V3_DEPLOY_SEALED_RUNTIME_DRIFT/,
      );
    } finally {
      await adapter.rollback(request, launch.runtime, "test cleanup", launch.lifecycleToken);
    }
  });

  it("rejects sealed dependency drift before adopting a live runtime on replay", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-dependency-drift-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const dependencyValuePath = path.join(temp, "node_modules", "runtime-value", "value.txt");
    await mkdir(path.dirname(dependencyValuePath), { recursive: true });
    await writeFile(dependencyValuePath, "accepted dependency", "utf8");
    const start = await freePortStart();
    const stateRoot = path.join(temp, "runtime");
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot,
      portStart: start,
      portEnd: start + 5,
      healthIntervalMs: 25,
    });
    const request = localRequest({
      worktree: temp,
      projectId: "sealed-dependency-drift",
      requestCandidate: fixture.candidate,
    });
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([request.buildCommand, request.previewCommand])),
      assertAuthority: async () => ({
        status: "authorized",
        candidate: fixture.candidate,
        observedSource: fixture.sourceRevision,
      }),
      adapter,
    });
    const first = await executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } });
    assert.equal(first.status, "deployed");
    if (first.status !== "deployed") return;
    const cleanupRequest = localRequest({
      worktree: temp,
      projectId: first.receipt.runtime.projectId,
      requestCandidate: fixture.candidate,
      buildCommand: request.buildCommand,
    });
    await first.release("reconcile");
    const sealedDependencyPath = path.join(
      stateRoot,
      "sealed",
      fixture.candidate.candidateHash,
      first.receipt.buildArtifact.artifactHash,
      "node_modules",
      "runtime-value",
      "value.txt",
    );
    try {
      await chmod(sealedDependencyPath, 0o600);
      await writeFile(sealedDependencyPath, "drifted dependency", "utf8");
      await chmod(sealedDependencyPath, 0o400);
      await assert.rejects(
        executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } }),
        (error: unknown) => error instanceof V3DeployAuthorityError
          && error.code === "V3_DEPLOY_PLATFORM_FAILED"
          && error.message.includes("V3_DEPLOY_SEALED_RUNTIME_DRIFT"),
      );
    } finally {
      await chmod(sealedDependencyPath, 0o600);
      await writeFile(sealedDependencyPath, "accepted dependency", "utf8");
      await chmod(sealedDependencyPath, 0o400);
      const cleanupLaunch = await adapter.deploy(cleanupRequest);
      assert.equal(cleanupLaunch.runtime.serviceId, first.receipt.runtime.serviceId);
      await adapter.rollback(
        cleanupRequest,
        cleanupLaunch.runtime,
        "test cleanup",
        cleanupLaunch.lifecycleToken,
      );
      assert.deepEqual(
        await processIdsMatching(temp),
        [],
        "rollback must terminate every process rooted in the exact deployment fixture",
      );
    }
  });

  it("rejects a foreign listener even when the endpoint returns HTTP 200", async () => {
    const temp = await makeTemp("setfarm-v3-deploy-foreign-listener-");
    cleanupPaths.push(temp);
    const fixture = await prepareLocalRepo(temp);
    const start = await freePortStart();
    const adapter = createLocalProcessV3DeploymentAdapter({
      stateRoot: path.join(temp, "runtime"),
      portStart: start,
      portEnd: start + 5,
      healthIntervalMs: 25,
      listenerPids: async () => [process.pid],
    });
    const executor = createV3DeployExecutor({
      readPacket: async () => packet(topology([
        localRequest({ worktree: temp, projectId: "unused", requestCandidate: fixture.candidate }).buildCommand,
        localRequest({ worktree: temp, projectId: "unused", requestCandidate: fixture.candidate }).previewCommand,
      ])),
      assertAuthority: async () => ({
        status: "authorized",
        candidate: fixture.candidate,
        observedSource: fixture.sourceRevision,
      }),
      adapter,
    });
    await assert.rejects(
      executor.execute({ runId, worktree: temp, context: {}, target: { mode: "local" } }),
      /V3_DEPLOY_FOREIGN_LISTENER/,
    );
  });

  it("requires the exact process-prefixed service identity in receipt cross-binding", () => {
    const validRuntime = runtime();
    const validHealth = healthProof();
    const invalid = {
      schema: "setfarm.v3-deploy-receipt.v1",
      runId,
      candidateId: candidate.candidateId,
      candidateHash: candidate.candidateHash,
      packetHash: candidate.packetHash,
      project: {
        schema: "setfarm.v3-deploy-project.v1",
        productId: "PROD_DEPLOY_FIXTURE",
        projectId: canonicalProjectId,
        displayName: "fixture",
        summary: "fixture",
      },
      stack: {
        schema: "setfarm.v3-deploy-stack.v1",
        stackPackId: "vite-react-web-app",
        stackPackVersion: "1.1.0",
        stackPackContentHash: "e".repeat(64),
        platform: "web",
        techStack: "vite-react",
      },
      buildCommandId: "CMD_BUILD",
      previewCommandId: "CMD_PREVIEW",
      sourceBefore: sourceRevision,
      sourceAfter: sourceRevision,
      buildArtifact: syntheticArtifact,
      runtime: { ...validRuntime, serviceId: "101" },
      health: validHealth,
      terminalProjectProjection: {
        schema: "setfarm.v3-terminal-project-projection.v1",
        owner: "mission-control-terminal-projector",
        state: "pending_terminal_projection",
        runId,
        candidateHash: candidate.candidateHash,
        projectId: canonicalProjectId,
        serviceId: "101",
        port: validRuntime.port,
        healthUrl: validRuntime.healthUrl,
        evidenceRef: `setfarm://run/${runId}/deploy-receipt`,
        buildArtifactHash: syntheticArtifact.artifactHash,
      },
      environmentNames: [],
      completedAt: "2026-07-13T10:00:00.000Z",
      receiptHash: "f".repeat(64),
    };
    assert.throws(() => V3DeployReceiptV1Schema.parse(invalid), /Health proof listener ownership is not bound/);
    const manifestMismatch = {
      ...invalid,
      runtime: validRuntime,
      health: { ...validHealth, sealedRuntimeManifestHash: "9".repeat(64) },
      terminalProjectProjection: {
        ...invalid.terminalProjectProjection,
        serviceId: validRuntime.serviceId,
      },
    };
    assert.throws(
      () => V3DeployReceiptV1Schema.parse(manifestMismatch),
      /runtime and health must bind the exact sealed runtime/i,
    );
  });

  it("treats Setfarm local deployment as v3 capability without Mission Control or systemd", () => {
    assert.deepEqual(evaluateV3DeployCapability({
      platform: "darwin",
      localMissionControl: false,
      localSystemctl: false,
      remoteHost: "",
      remoteReachable: false,
      deployRequired: false,
      deployDisabled: false,
    }), {
      shouldSkip: false,
      mode: "local",
      reason: "Setfarm-owned local process deployment is available.",
    });
  });
});
