import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  createV3ImplementationAttemptCompiler,
  captureDependencyFileSignatures,
  V3ImplementationAttemptError,
} from "../../src/execution/v3-implementation-attempt.js";
import {
  ExecutionAttemptReservationV1Schema,
  ExecutionAttemptV1Schema,
  type ExecutionAttemptV1,
} from "../../src/execution/schemas/execution-attempt-v1.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import type { SealedRuntimePacketV1 } from "../../src/product-compiler/runtime-artifact-reader.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

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

  async function fixture(stackPackId = "vite-react-web-app") {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-v3-attempt-"));
    roots.push(root);
    const worktree = path.join(root, "worktree");
    await mkdir(path.join(worktree, "src"), { recursive: true });
    const appBytes = Buffer.from("export const App = () => 'exact';\n", "utf8");
    await writeFile(path.join(worktree, "src/App.tsx"), appBytes);
    const values = buildMinimalValidContracts();
    values.buildTopology.stackPack.id = stackPackId;
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
    const published = new Map<string, { artifactType: string; producer: unknown; payload: unknown }>();
    const runRefs: Array<{ runId: string; refKey: string; artifactHash: string }> = [];
    let reservedInput: ReturnType<typeof ExecutionAttemptReservationV1Schema.parse> | undefined;
    let reservedAttempt: ExecutionAttemptV1 | undefined;
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
        reservedInput = ExecutionAttemptReservationV1Schema.parse(input);
        const timestamp = new Date("2026-07-13T10:00:00.000Z").toISOString();
        reservedAttempt = ExecutionAttemptV1Schema.parse({
          schema: "setfarm.execution-attempt.v1",
          attemptId: "ATT_v3-runtime-test-0001",
          claimId: reservedInput.claimId,
          runId: reservedInput.runId,
          stepId: reservedInput.stepId,
          storyId: reservedInput.storyId,
          generation: 1,
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
        return { status: "reserved", attempt: reservedAttempt };
      },
      findAttempt: async () => reservedAttempt,
      readArtifact: async (hash) => {
        const envelope = published.get(hash);
        if (!envelope) throw new Error(`missing test artifact ${hash}`);
        return envelope;
      },
      captureSource: async () => source,
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

  it("rejects a sealed stack without an authoritative runtime contract before publication", async () => {
    const { worktree, packet } = await fixture("node-cli");
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
        && error.code === "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
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
