import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  createV3ImplementationAttemptHandoffV1,
  createV3ImplementationAttemptCompiler,
  captureDependencyFileSignatures,
  V3ImplementationAttemptError,
} from "../../src/execution/v3-implementation-attempt.js";
import {
  ExecutionAttemptV1Schema,
  type ExecutionAttemptV1,
} from "../../src/execution/schemas/execution-attempt-v1.js";
import { createOperationalRetryDirectiveV1 } from "../../src/execution/operational-retry-directive.js";
import { createV3SupervisorRetryDirectiveV1 } from "../../src/execution/v3-supervisor-retry-directive.js";
import { parseOperationalRetryAwareAttemptReservation } from "../../src/execution/operational-retry-reservation.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import type { SealedRuntimePacketV1 } from "../../src/product-compiler/runtime-artifact-reader.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { buildMinimalValidV3Contracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const PRODUCER = {
  pass: "product-packet-compiler",
  codeSha: "5840ae3",
  toolVersions: { zod: "4.4.3" },
} as const;

describe("v3 implementation attempt compiler", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-v3-attempt-"));
    roots.push(root);
    const worktree = path.join(root, "worktree");
    await mkdir(path.join(worktree, "src"), { recursive: true });
    const appBytes = Buffer.from("export const App = () => 'exact';\n", "utf8");
    await writeFile(path.join(worktree, "src/App.tsx"), appBytes);
    const values = buildMinimalValidV3Contracts();
    values.buildTopology.pathBindings[0]!.knownContentHash = createHash("sha256")
      .update(appBytes)
      .digest("hex");
    const store = new ContentAddressedArtifactStore(path.join(root, "artifacts"));
    const compilation = await compileProductBuildPacket({
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      compiler: { version: "3.0.0", codeSha: PRODUCER.codeSha },
      producer: PRODUCER,
      protocol: "v3",
      artifactStore: store,
    });
    assert.equal(compilation.status, "sealed", JSON.stringify(compilation));
    const packet: SealedRuntimePacketV1 = {
      runId: "run-v3-attempt",
      packetHash: compilation.packetHash!,
      producer: PRODUCER,
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      packet: compilation.packet!,
      compilationReport: compilation.report as SealedRuntimePacketV1["compilationReport"],
      refs: {
        productSpec: compilation.artifactHashes.productSpec!,
        designGraph: compilation.artifactHashes.designGraph!,
        buildTopology: compilation.artifactHashes.buildTopology!,
        storyPlan: compilation.artifactHashes.storyPlan!,
        packet: compilation.packetHash!,
        compilationReport: compilation.reportHash,
      },
    };
    return { root, worktree, packet };
  }

  it("publishes an exact slice, reserves its packet-bound fence, and reloads identical context", async () => {
    const { worktree, packet } = await fixture();
    const source = { sha: "1".repeat(40), treeHash: "2".repeat(64) };
    const supervisorRetrySource = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
    const published = new Map<string, { artifactType: string; producer: unknown; payload: unknown }>();
    const runRefs: Array<{ runId: string; refKey: string; artifactHash: string }> = [];
    let reservedInput: ReturnType<typeof parseOperationalRetryAwareAttemptReservation> | undefined;
    let reservedAttempt: ExecutionAttemptV1 | undefined;
    const attempts = new Map<string, ExecutionAttemptV1>();
    let dependencyPacketHash: string | undefined;
    const compiler = createV3ImplementationAttemptCompiler({
      readPacket: async () => packet,
      publish: async (rawEnvelope) => {
        const envelope = rawEnvelope as { artifactType: string; producer: unknown; payload: unknown };
        const hash = hashCanonicalJson(envelope);
        published.set(hash, envelope);
        return { hash } as never;
      },
      addRunRef: async (input) => { runRefs.push(input); },
      reserveAttempt: async (input) => {
        reservedInput = parseOperationalRetryAwareAttemptReservation(input);
        const timestamp = new Date("2026-07-13T10:00:00.000Z").toISOString();
        const retry = reservedInput.attemptClass === "infrastructure_retry";
        reservedAttempt = ExecutionAttemptV1Schema.parse({
          schema: "setfarm.execution-attempt.v1",
          attemptId: retry ? "ATT_v3-runtime-test-0002" : "ATT_v3-runtime-test-0001",
          claimId: reservedInput.claimId,
          runId: reservedInput.runId,
          stepId: reservedInput.stepId,
          storyId: reservedInput.storyId,
          generation: retry ? 2 : 1,
          fenceToken: "3".repeat(64),
          attemptClass: reservedInput.attemptClass,
          packetHash: reservedInput.packetHash,
          compilationReportHash: reservedInput.compilationReportHash,
          sliceHash: reservedInput.sliceHash,
          sourceBefore: reservedInput.sourceBefore,
          role: reservedInput.role,
          agentId: reservedInput.agentId,
          branch: reservedInput.branch,
          worktree: reservedInput.worktree,
          lease: { acquiredAt: timestamp, expiresAt: timestamp, heartbeatAt: timestamp },
          disposition: "claimed",
          evidenceRefs: reservedInput.evidenceRefs,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        attempts.set(reservedAttempt.attemptId, reservedAttempt);
        return { status: "reserved", attempt: reservedAttempt };
      },
      findAttempt: async (attemptId) => attempts.get(attemptId),
      readArtifact: async (hash) => {
        const envelope = published.get(hash);
        if (!envelope) throw new Error(`missing test artifact ${hash}`);
        return envelope;
      },
      captureSource: async () => source,
      captureSupervisorRetrySource: async () => supervisorRetrySource,
      readDependencies: async (input) => {
        dependencyPacketHash = input.packetHash;
        return {};
      },
    });

    const result = await compiler.reserve({
      runId: packet.runId,
      stepId: "implement",
      storyId: "US-001",
      claimId: 41,
      role: "developer",
      agentId: "feature-dev_developer",
      branch: "story/us-001",
      worktree,
    });
    assert.equal(result.packetHash, packet.packetHash);
    assert.equal(dependencyPacketHash, packet.packetHash);
    assert.equal(result.slice.packetHash, packet.packetHash);
    assert.equal(result.slice.sourceRevision.treeHash, source.treeHash);
    assert.equal(reservedInput?.sliceHash, result.sliceHash);
    assert.equal(reservedInput?.claimId, 41);
    assert.equal(result.evidencePlan.sliceHash, result.sliceHash);
    assert.equal(result.evidencePlan.storyId, "US-001");
    assert.equal(result.slice.runtimeEvidence?.adapter, "browser-service");
    assert.equal(result.slice.runtimeEvidence?.stackPackId, "vite-react-web-app");
    assert.deepEqual(result.evidencePlan.runtime, result.slice.runtimeEvidence);
    assert.ok(reservedInput?.evidenceRefs.includes(`setfarm://artifact/${result.evidencePlanArtifactHash}`));
    assert.deepEqual(runRefs, [
      {
        runId: packet.runId,
        refKey: `SLICE_US_001_${result.sliceHash.slice(0, 16).toUpperCase()}`,
        artifactHash: result.sliceHash,
      },
      {
        runId: packet.runId,
        refKey: `EVIDENCE_PLAN_US_001_${result.evidencePlanArtifactHash.slice(0, 16).toUpperCase()}`,
        artifactHash: result.evidencePlanArtifactHash,
      },
    ]);

    const loaded = await compiler.loadAttemptContext({
      runId: packet.runId,
      storyId: "US-001",
      attemptId: result.attempt.attemptId,
    });
    assert.equal(loaded.sliceHash, result.sliceHash);
    assert.deepEqual(loaded.slice, result.slice);
    assert.deepEqual(loaded.evidencePlan, result.evidencePlan);
    assert.equal(loaded.evidencePlanArtifactHash, result.evidencePlanArtifactHash);
    assert.equal(result.executionProfile.modelId, "minimax/MiniMax-M3");

    const operationalRetry = createOperationalRetryDirectiveV1({
      runId: packet.runId,
      stepId: "implement",
      storyId: "US-001",
      priorAttempt: {
        claimId: 41,
        attemptId: result.attempt.attemptId,
        generation: result.attempt.generation,
        attemptClass: "product_implementation",
        packetHash: result.packetHash,
        sliceHash: result.sliceHash,
        sourceBefore: result.sourceBefore,
        terminalDisposition: "inconclusive",
      },
      failure: {
        code: "IMPLEMENT_NO_DELTA_STALL",
        diagnostic: "IMPLEMENT_NO_DELTA_STALL: no bounded source delta",
      },
      nextSourceRevision: result.sourceBefore,
      allowedPaths: ["src/App.tsx"],
    });
    await assert.rejects(
      compiler.reserve({
        runId: packet.runId,
        stepId: "implement",
        storyId: "US-001",
        claimId: 42,
        role: "developer",
        agentId: "feature-dev_developer",
        branch: "story/us-001",
        worktree,
        operationalRetry,
      }),
      (error: unknown) => error instanceof V3ImplementationAttemptError
        && error.code === "V3_OPERATIONAL_RETRY_PRIOR_ATTEMPT_NOT_TERMINAL",
    );
    const terminalPrior = ExecutionAttemptV1Schema.parse({
      ...result.attempt,
      disposition: "inconclusive",
    });
    attempts.set(terminalPrior.attemptId, terminalPrior);
    const retry = await compiler.reserve({
      runId: packet.runId,
      stepId: "implement",
      storyId: "US-001",
      claimId: 42,
      role: "developer",
      agentId: "feature-dev_developer",
      branch: "story/us-001",
      worktree,
      operationalRetry,
    });
    assert.equal(retry.attempt.attemptClass, "infrastructure_retry");
    assert.equal(retry.attempt.generation, 2);
    assert.equal(retry.executionProfile.modelId, "kimi/kimi-for-coding");
    assert.equal(retry.operationalRetry?.directive.directiveHash, operationalRetry.directiveHash);
    assert.ok(retry.attempt.evidenceRefs.includes(`setfarm://operational-retry/${operationalRetry.directiveHash}`));
    assert.ok(retry.attempt.evidenceRefs.includes(`setfarm://operational-retry-artifact/${retry.operationalRetry?.artifactHash}`));

    const loadedRetry = await compiler.loadAttemptContext({
      runId: packet.runId,
      storyId: "US-001",
      attemptId: retry.attempt.attemptId,
    });
    assert.deepEqual(loadedRetry.operationalRetry, retry.operationalRetry);
    assert.deepEqual(loadedRetry.executionProfile, retry.executionProfile);

    const supervisorRetry = createV3SupervisorRetryDirectiveV1({
      runId: packet.runId,
      storyDbId: "story-db-v3-attempt-us-001",
      storyId: "US-001",
      storyClaimGeneration: 1,
      supervisorClaimId: 501,
      runtimeSessionId: "RTS_v3-attempt-supervisor-501",
      outputHash: "8".repeat(64),
      sourceRevision: supervisorRetrySource,
      decision: "retry",
      feedback: "Restore the required interaction and preserve the exact state transition.",
      retryOrdinal: 1,
      maxRetries: 3,
    });
    const supervisorRetryResult = await compiler.reserve({
      runId: packet.runId,
      stepId: "implement",
      storyId: "US-001",
      claimId: 43,
      role: "developer",
      agentId: "feature-dev_developer",
      branch: "story/us-001",
      worktree,
      supervisorRetry,
    });
    assert.equal(supervisorRetryResult.attempt.attemptClass, "product_implementation");
    assert.deepEqual(supervisorRetryResult.executionProfile, result.executionProfile);
    assert.equal(
      supervisorRetryResult.supervisorRetry?.directive.directiveHash,
      supervisorRetry.directiveHash,
    );
    assert.ok(supervisorRetryResult.attempt.evidenceRefs.includes(
      `setfarm://supervisor-retry/${supervisorRetry.directiveHash}`,
    ));
    assert.ok(supervisorRetryResult.attempt.evidenceRefs.includes(
      `setfarm://supervisor-retry-artifact/${supervisorRetryResult.supervisorRetry?.artifactHash}`,
    ));
    const driftedSupervisorRetry = createV3SupervisorRetryDirectiveV1({
      runId: supervisorRetry.runId,
      storyDbId: supervisorRetry.storyDbId,
      storyId: supervisorRetry.storyId,
      storyClaimGeneration: supervisorRetry.storyClaimGeneration,
      supervisorClaimId: supervisorRetry.supervisorClaimId,
      runtimeSessionId: supervisorRetry.runtimeSessionId,
      outputHash: supervisorRetry.outputHash,
      sourceRevision: { sha: "3".repeat(40), treeHash: "4".repeat(40) },
      decision: "retry",
      feedback: supervisorRetry.feedback,
      retryOrdinal: supervisorRetry.retryOrdinal,
      maxRetries: supervisorRetry.maxRetries,
    });
    await assert.rejects(
      compiler.reserve({
        runId: packet.runId,
        stepId: "implement",
        storyId: "US-001",
        claimId: 44,
        role: "developer",
        agentId: "feature-dev_developer",
        branch: "story/us-001",
        worktree,
        supervisorRetry: driftedSupervisorRetry,
      }),
      (error: unknown) => error instanceof V3ImplementationAttemptError
        && error.code === "V3_SUPERVISOR_RETRY_IDENTITY_MISMATCH",
    );
    const supervisorRetryHandoff = createV3ImplementationAttemptHandoffV1({
      stepDbId: "step-db-v3-attempt-implement",
      storyDbId: supervisorRetry.storyDbId,
      claimId: 43,
      branch: "story/us-001",
      workdir: worktree,
      compiled: supervisorRetryResult,
    });
    assert.deepEqual(supervisorRetryHandoff.supervisorRetry, supervisorRetry);
    assert.equal(
      supervisorRetryHandoff.supervisorRetryArtifactHash,
      supervisorRetryResult.supervisorRetry?.artifactHash,
    );
    assert.throws(() => createV3ImplementationAttemptHandoffV1({
      stepDbId: "step-db-v3-attempt-implement",
      storyDbId: "story-db-v3-attempt-wrong",
      claimId: 43,
      branch: "story/us-001",
      workdir: worktree,
      compiled: supervisorRetryResult,
    }));
    const loadedSupervisorRetry = await compiler.loadAttemptContext({
      runId: packet.runId,
      storyId: "US-001",
      attemptId: supervisorRetryResult.attempt.attemptId,
    });
    assert.deepEqual(loadedSupervisorRetry.supervisorRetry, supervisorRetryResult.supervisorRetry);
    assert.deepEqual(loadedSupervisorRetry.executionProfile, result.executionProfile);
  });

  it("rejects source drift before publishing a slice or reserving an attempt", async () => {
    const { worktree, packet } = await fixture();
    let capture = 0;
    let published = false;
    let reserved = false;
    const compiler = createV3ImplementationAttemptCompiler({
      readPacket: async () => packet,
      publish: async () => { published = true; return {} as never; },
      addRunRef: async () => undefined,
      reserveAttempt: async () => {
        reserved = true;
        throw new Error("reservation must not run");
      },
      findAttempt: async () => undefined,
      readArtifact: async () => { throw new Error("artifact read must not run"); },
      captureSource: async () => ({
        sha: "1".repeat(40),
        treeHash: (++capture === 1 ? "2" : "3").repeat(64),
      }),
      readDependencies: async () => ({}),
    });
    await assert.rejects(
      compiler.reserve({
        runId: packet.runId,
        stepId: "implement",
        storyId: "US-001",
        claimId: 42,
        role: "developer",
        agentId: "feature-dev_developer",
        branch: "story/us-001",
        worktree,
      }),
      (error: unknown) => error instanceof V3ImplementationAttemptError
        && error.code === "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE",
    );
    assert.equal(published, false);
    assert.equal(reserved, false);
  });

  it("rejects a packet stub that bypassed the reader without sealed runtime evidence before publication", async () => {
    const { worktree, packet } = await fixture();
    delete (packet.buildTopology as any).runtimeEvidenceContract;
    delete (packet.buildTopology as any).runtimeEvidenceContractHash;
    let published = false;
    let reserved = false;
    const source = { sha: "1".repeat(40), treeHash: "2".repeat(64) };
    const compiler = createV3ImplementationAttemptCompiler({
      readPacket: async () => packet,
      publish: async () => { published = true; return {} as never; },
      addRunRef: async () => undefined,
      reserveAttempt: async () => {
        reserved = true;
        throw new Error("reservation must not run");
      },
      findAttempt: async () => undefined,
      readArtifact: async () => { throw new Error("artifact read must not run"); },
      captureSource: async () => source,
      readDependencies: async () => ({}),
    });

    await assert.rejects(
      compiler.reserve({
        runId: packet.runId,
        stepId: "implement",
        storyId: "US-001",
        claimId: 43,
        role: "developer",
        agentId: "feature-dev_developer",
        branch: "story/us-001",
        worktree,
      }),
      (error: unknown) => error instanceof V3ImplementationAttemptError
        && error.code === "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
    );
    assert.equal(published, false);
    assert.equal(reserved, false);
  });

  it("attests dependency file hashes from the exact terminal commit, including absence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-v3-dependency-blob-"));
    roots.push(root);
    await mkdir(path.join(root, "src"), { recursive: true });
    const bytes = Buffer.from("export const dependency = true;\n", "utf8");
    await writeFile(path.join(root, "src/dependency.ts"), bytes);
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "setfarm-test@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: root });
    execFileSync("git", ["add", "src/dependency.ts"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "dependency source"], { cwd: root });
    const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const signatures = captureDependencyFileSignatures({
      sourceWorktree: root,
      commitSha,
      files: [
        { pathRef: "PATH_DEPENDENCY", path: "src/dependency.ts" },
        { pathRef: "PATH_MISSING", path: "src/missing.ts" },
      ],
    });
    assert.deepEqual(signatures, [
      {
        pathRef: "PATH_DEPENDENCY",
        presence: "present",
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      },
      {
        pathRef: "PATH_MISSING",
        presence: "absent",
        contentHash: topologyPathAbsenceHash("src/missing.ts"),
      },
    ]);
  });
});
