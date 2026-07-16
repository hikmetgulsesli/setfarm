import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createV3NormalImplementationPreclaim,
  type V3NormalImplementationPreclaimDependencies,
  type V3NormalImplementationStoryRow,
  type V3TerminalDependencyAttemptProjection,
} from "../../src/execution/v3-normal-implementation-preclaim.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import {
  createV3PreparationClaimAuthorityV1,
  type V3PreparationClaimAuthorityV1,
} from "../../src/execution/v3-preparation-claim-authority.js";
import {
  V3PreparationBlockV1Schema,
  type V3PreparationBlockV1,
} from "../../src/execution/v3-preparation-decision.js";
import { resolveV3GitRevision } from "../../src/execution/v3-git-revision.js";
import type {
  ExactSealedRuntimePacket,
  SealedRuntimePacketV1,
  SealedRuntimePacketV3,
} from "../../src/product-compiler/runtime-artifact-reader.js";
import { buildMinimalValidV3Contracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "../product-compiler/fixtures/product-build-packet-v3.js";

const RUN_ID = "run-v3-normal-preclaim";
const STEP_ID = "implement";
const PACKET_HASH = "e".repeat(64);
const NATIVE_V3_RELEASE_SHA = "c".repeat(40);

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function packet(): SealedRuntimePacketV1 {
  const values = buildMinimalValidV3Contracts();
  const first = values.storyPlan.stories[0]!;
  values.storyPlan.stories.push({
    ...first,
    id: "US-002",
    order: 2,
    title: "Dependent story",
    description: "Implement the exact dependent behavior.",
    dependsOn: ["US-001"],
  });
  const refs = {
    productSpec: values.packet.productSpecHash,
    designGraph: values.packet.designGraphHash,
    buildTopology: values.packet.buildTopologyHash,
    storyPlan: values.packet.storyPlanHash,
    packet: PACKET_HASH,
    compilationReport: "f".repeat(64),
  };
  return {
    runId: RUN_ID,
    packetHash: PACKET_HASH,
    producer: { pass: "test", codeSha: values.packet.compiler.codeSha, toolVersions: {} },
    productSpec: values.productSpec,
    designGraph: values.designGraph,
    buildTopology: values.buildTopology,
    storyPlan: values.storyPlan,
    packet: values.packet,
    compilationReport: {
      schema: "setfarm.product-compilation-report.v1",
      compiler: values.packet.compiler,
      inputHashes: ["9".repeat(64)],
      diagnostics: [],
      validationIds: values.packet.validationIds,
      status: "sealed",
      artifactHashes: {
        productSpec: refs.productSpec,
        designGraph: refs.designGraph,
        buildTopology: refs.buildTopology,
        storyPlan: refs.storyPlan,
      },
      packetHash: PACKET_HASH,
    },
    refs,
  };
}

function semanticEnvelopeHash(
  artifactType: string,
  producer: SealedRuntimePacketV3["producer"],
  payload: unknown,
): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
}

function nativeV3Packet(): SealedRuntimePacketV3 {
  const contracts = buildNoDesignProductBuildPacketV3Contracts();
  const producer = {
    pass: "v3-normal-preclaim-test",
    codeSha: NATIVE_V3_RELEASE_SHA,
    toolVersions: {},
  };
  const sourceMap = produceImplementationSourceMapV1(contracts.implementationSourceInputsV1);
  assert.equal(sourceMap.status, "produced", JSON.stringify(sourceMap));
  if (sourceMap.status !== "produced") throw new Error("unreachable");
  const refs = {
    productSpec: semanticEnvelopeHash("setfarm.product-spec.v2", producer, contracts.productSpecV2),
    designGraph: null,
    buildTopology: semanticEnvelopeHash("setfarm.build-topology.v1", producer, contracts.buildTopologyV1),
    storyPlan: semanticEnvelopeHash("setfarm.story-plan.v2", producer, contracts.storyPlanV2),
    designSourceClosure: semanticEnvelopeHash(
      "setfarm.design-source-closure.v2",
      producer,
      contracts.designSourceClosureV2,
    ),
    implementationSourceMap: semanticEnvelopeHash(
      "setfarm.implementation-source-map.v1",
      producer,
      sourceMap.sourceMap,
    ),
  };
  const compiler = { version: "4.0.0", codeSha: NATIVE_V3_RELEASE_SHA };
  const packetPayload = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3",
    packetVersion: 3,
    parentPacketHashes: [],
    designSourceKind: "none",
    productSpecV2Hash: refs.productSpec,
    designGraphV2Hash: null,
    buildTopologyV1Hash: refs.buildTopology,
    storyPlanV2Hash: refs.storyPlan,
    designSourceClosureV2Hash: refs.designSourceClosure,
    implementationSourceMapV1Hash: refs.implementationSourceMap,
    compiler,
    validationIds: ["VALIDATE_NATIVE_V3_PRECLAIM"],
  });
  const packetHash = semanticEnvelopeHash("setfarm.product-build-packet.v3", producer, packetPayload);
  const compilationReport = {
    schema: "setfarm.product-compilation-report.v3" as const,
    compiler,
    inputHashes: ["9".repeat(64)],
    diagnostics: [],
    validationIds: packetPayload.validationIds,
    status: "sealed" as const,
    artifactHashes: {
      productSpecV2: refs.productSpec,
      designGraphV2: null,
      buildTopologyV1: refs.buildTopology,
      storyPlanV2: refs.storyPlan,
      designSourceClosureV2: refs.designSourceClosure,
      implementationSourceMapV1: refs.implementationSourceMap,
    },
    packetHash,
  };
  return {
    runId: RUN_ID,
    packetHash,
    producer,
    productSpec: contracts.productSpecV2,
    designGraph: null,
    buildTopology: contracts.buildTopologyV1,
    storyPlan: contracts.storyPlanV2,
    designSourceClosure: contracts.designSourceClosureV2,
    implementationSourceMap: sourceMap.sourceMap,
    packet: packetPayload,
    compilationReport,
    refs: {
      ...refs,
      packet: packetHash,
      compilationReport: semanticEnvelopeHash(
        "setfarm.product-compilation-report.v3",
        producer,
        compilationReport,
      ),
    },
  };
}

function row(input: Readonly<{
  storyId?: string;
  storyIndex?: number;
  dependsOn?: unknown;
}> = {}): V3NormalImplementationStoryRow {
  const storyId = input.storyId ?? "US-002";
  return {
    id: `row-${storyId}`,
    run_id: RUN_ID,
    story_id: storyId,
    story_index: input.storyIndex ?? (storyId === "US-001" ? 0 : 1),
    status: "pending",
    depends_on: input.dependsOn === undefined
      ? JSON.stringify(storyId === "US-001" ? [] : ["US-001"])
      : input.dependsOn,
  };
}

type BlockRepository = V3NormalImplementationPreclaimDependencies["blockRepository"];

function fakeBlockRepository(options: Readonly<{
  authorityOverride?: (authority: V3PreparationClaimAuthorityV1) => unknown;
  fixedStateVersion?: number;
}> = {}) {
  let open: V3PreparationBlockV1 | undefined;
  let occurrence = 0;
  const stats = {
    recordCalls: 0,
    resolveReadyCalls: 0,
    historicalRows: [] as V3PreparationBlockV1[],
  };
  const repository: BlockRepository = {
    findOpen: async () => open,
    readOpenFingerprint: async () => open?.fingerprint,
    record: async (input) => {
      stats.recordCalls += 1;
      occurrence += 1;
      open = V3PreparationBlockV1Schema.parse({
        schema: "setfarm.v3-preparation-block.v1",
        blockId: `VPB_${input.decision.fingerprint}_${occurrence}`,
        fingerprint: input.decision.fingerprint,
        occurrence,
        runId: input.identity.runId,
        stepId: input.identity.stepId,
        storyId: input.identity.storyId,
        packetHash: input.identity.packetHash,
        sourceSha: input.identity.sourceSha,
        sourceTreeHash: input.identity.sourceTreeHash,
        phase: input.identity.phase,
        errorCode: input.identity.errorCode,
        action: input.decision.action,
        dependencyState: input.identity.dependencyState,
        detail: input.detail,
        evidenceRefs: [...input.evidenceRefs],
        openedAt: new Date(1_700_000_000_000 + occurrence).toISOString(),
      });
      stats.historicalRows.push(open);
      return { status: "opened" as const, block: open };
    },
    resolveReady: async (input) => {
      stats.resolveReadyCalls += 1;
      const authority = createV3PreparationClaimAuthorityV1({
        stateVersion: options.fixedStateVersion ?? stats.resolveReadyCalls,
        runId: input.runId,
        stepId: input.stepId,
        storyId: input.storyId,
        packetHash: input.packetHash,
        baseRevision: { sha: input.sourceSha, treeHash: input.sourceTreeHash },
        projectedDependencyIds: [...(input.projectedDependencyIds ?? [])],
        dependencyAttempts: input.dependencyState.map((dependency) => {
          assert.equal(dependency.state, "ready");
          return {
            storyId: dependency.storyId,
            attemptId: dependency.attemptId!,
            attemptClass: "product_implementation" as const,
            disposition: dependency.disposition!,
            sourceRevision: {
              sha: dependency.sourceAfterSha!,
              treeHash: dependency.sourceAfterTreeHash!,
            },
          };
        }),
      });
      const hadOpen = Boolean(open);
      open = undefined;
      return {
        status: hadOpen ? "resolved" as const : "none" as const,
        authority: (options.authorityOverride?.(authority) ?? authority) as V3PreparationClaimAuthorityV1,
      };
    },
  };
  return { repository, stats };
}

function dependencies(input: Readonly<{
  stories?: readonly V3NormalImplementationStoryRow[];
  attempts?: () => readonly V3TerminalDependencyAttemptProjection[];
  packet?: () => ExactSealedRuntimePacket;
  blockRepository?: BlockRepository;
  syncBeforePin?: V3NormalImplementationPreclaimDependencies["syncBeforePin"];
  resolveRevision?: typeof resolveV3GitRevision;
}> = {}): V3NormalImplementationPreclaimDependencies {
  return {
    readPacket: async () => (input.packet ?? packet)(),
    readPendingStories: async () => input.stories ?? [row()],
    readTerminalDependencyAttempts: async () => input.attempts?.() ?? [],
    blockRepository: input.blockRepository ?? fakeBlockRepository().repository,
    ...(input.syncBeforePin ? { syncBeforePin: input.syncBeforePin } : {}),
    ...(input.resolveRevision ? { resolveRevision: input.resolveRevision } : {}),
  };
}

describe("v3 normal implementation preclaim", () => {
  let repo = "";
  let firstSha = "";
  let firstTree = "";

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-normal-preclaim-"));
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    await writeFile(path.join(repo, "tracked.txt"), "first\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    git(repo, ["commit", "-qm", "first"]);
    firstSha = git(repo, ["rev-parse", "HEAD"]);
    firstTree = git(repo, ["rev-parse", `${firstSha}^{tree}`]);
    git(repo, ["branch", "base", firstSha]);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it("accepts an exact native ProductBuildPacketV3 and rejects child-ref drift before selection", async () => {
    const accepted = createV3NormalImplementationPreclaim(dependencies({
      packet: nativeV3Packet,
      stories: [],
    }));
    assert.deepEqual(await accepted.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    }), { status: "none" });

    const rejected = createV3NormalImplementationPreclaim(dependencies({
      packet: () => {
        const value = structuredClone(nativeV3Packet());
        value.refs.implementationSourceMap = "0".repeat(64);
        return value;
      },
      stories: [],
    }));
    const result = await rejected.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.equal(result.error.code, "V3_NORMAL_PRECLAIM_PACKET_INVALID");
      assert.equal(result.consumesClaim, false);
      assert.equal(result.dispatchModel, false);
    }
  });

  it("selects the lowest story_index and runs sync before the single immutable pin", async () => {
    const events: string[] = [];
    let pins = 0;
    const blocks = fakeBlockRepository();
    const preclaim = createV3NormalImplementationPreclaim(dependencies({
      stories: [row(), row({ storyId: "US-001", storyIndex: 0 })],
      blockRepository: blocks.repository,
      syncBeforePin: async () => { events.push("sync"); },
      resolveRevision: (input) => {
        events.push("pin");
        pins += 1;
        return resolveV3GitRevision(input);
      },
    }));
    const result = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") assert.fail("expected ready authority");
    assert.equal(result.story.story_id, "US-001");
    assert.deepEqual(result.baseRevision, { sha: firstSha, treeHash: firstTree });
    assert.deepEqual(events, ["sync", "pin"]);
    assert.equal(pins, 1);
  });

  it("turns ten unchanged dependency polls into one block and zero execution side effects", async () => {
    const blocks = fakeBlockRepository();
    const executionSideEffects = { claim: 0, runtime: 0, attempt: 0, model: 0 };
    const preclaim = createV3NormalImplementationPreclaim(dependencies({
      blockRepository: blocks.repository,
    }));
    const results = [];
    for (let poll = 0; poll < 10; poll += 1) {
      results.push(await preclaim.prepare({
        runId: RUN_ID,
        stepId: STEP_ID,
        repo,
        requestedBaseRef: "base",
      }));
    }
    assert.equal(results.every((result) => result.status === "blocked"), true);
    for (const result of results) {
      if (result.status !== "blocked") assert.fail("expected unchanged block");
      assert.equal(result.consumesClaim, false);
      assert.equal(result.dispatchModel, false);
      assert.equal(result.decision?.dispatchModel, false);
    }
    assert.equal(results[0]?.status === "blocked" && results[0].ledgerStatus, "opened");
    assert.equal(results[9]?.status === "blocked" && results[9].ledgerStatus, "unchanged");
    assert.equal(blocks.stats.recordCalls, 1);
    assert.equal(blocks.stats.historicalRows.length, 1);
    assert.equal(blocks.stats.resolveReadyCalls, 0);
    assert.deepEqual(executionSideEffects, { claim: 0, runtime: 0, attempt: 0, model: 0 });
  });

  it("resolves a dependency delta into an exact preparation claim authority", async () => {
    const blocks = fakeBlockRepository();
    let attempts: readonly V3TerminalDependencyAttemptProjection[] = [];
    const preclaim = createV3NormalImplementationPreclaim(dependencies({
      blockRepository: blocks.repository,
      attempts: () => attempts,
    }));
    const initial = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(initial.status, "blocked");

    attempts = [{
      storyId: "US-001",
      attemptId: "ATT_dependency-terminal-0001",
      disposition: "produced_delta",
      sourceAfterSha: "7".repeat(40),
      sourceAfterTreeHash: "8".repeat(40),
    }];
    const ready = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(ready.status, "ready");
    if (ready.status !== "ready") assert.fail("expected dependency-ready authority");
    assert.equal(ready.authority.storyId, "US-002");
    assert.equal(ready.authority.packetHash, PACKET_HASH);
    assert.deepEqual(ready.authority.baseRevision, { sha: firstSha, treeHash: firstTree });
    assert.deepEqual(ready.authority.projectedDependencyIds, ["US-001"]);
    assert.equal(ready.authority.dependencyAttempts[0]?.attemptId, "ATT_dependency-terminal-0001");
    assert.equal(blocks.stats.recordCalls, 1);
    assert.equal(blocks.stats.resolveReadyCalls, 1);
  });

  it("blocks malformed, duplicate, and noncanonical dependency projections before pin", async () => {
    for (const dependsOn of ["not-json", '["US-001","US-001"]', '["US-002","US-001"]']) {
      let pins = 0;
      const blocks = fakeBlockRepository();
      const preclaim = createV3NormalImplementationPreclaim(dependencies({
        stories: [row({ dependsOn })],
        blockRepository: blocks.repository,
        resolveRevision: (input) => { pins += 1; return resolveV3GitRevision(input); },
      }));
      const result = await preclaim.prepare({
        runId: RUN_ID,
        stepId: STEP_ID,
        repo,
        requestedBaseRef: "base",
      });
      assert.equal(result.status, "blocked");
      if (result.status !== "blocked") assert.fail("expected projection block");
      assert.equal(result.error.code, "V3_NORMAL_PRECLAIM_DEPENDENCY_PROJECTION_INVALID");
      assert.equal(pins, 0);
      assert.equal(blocks.stats.recordCalls, 0);
    }
  });

  it("blocks an exact sealed StoryPlan mismatch and packet tamper", async () => {
    const mismatch = createV3NormalImplementationPreclaim(dependencies({
      stories: [row({ dependsOn: "[]" })],
    }));
    const mismatchResult = await mismatch.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(mismatchResult.status, "blocked");
    if (mismatchResult.status !== "blocked") assert.fail("expected packet projection block");
    assert.equal(mismatchResult.error.code, "V3_NORMAL_PRECLAIM_DEPENDENCY_PACKET_MISMATCH");

    const tampered = createV3NormalImplementationPreclaim(dependencies({
      packet: () => {
        const value = packet();
        return { ...value, refs: { ...value.refs, storyPlan: "0".repeat(64) } };
      },
    }));
    const tamperedResult = await tampered.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(tamperedResult.status, "blocked");
    if (tamperedResult.status !== "blocked") assert.fail("expected packet tamper block");
    assert.equal(tamperedResult.error.code, "V3_NORMAL_PRECLAIM_PACKET_INVALID");
  });

  it("blocks missing packet, repository/ref failure, and expected-SHA drift with structural causes", async () => {
    const missingPacket = createV3NormalImplementationPreclaim({
      ...dependencies(),
      readPacket: async () => { throw Object.assign(new Error("packet missing"), { code: "RUNTIME_PACKET_NOT_SEALED" }); },
    });
    const packetResult = await missingPacket.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(packetResult.status, "blocked");
    if (packetResult.status !== "blocked") assert.fail("expected packet block");
    assert.equal(packetResult.error.code, "V3_NORMAL_PRECLAIM_PACKET_UNAVAILABLE");
    assert.equal(packetResult.error.causeCode, "RUNTIME_PACKET_NOT_SEALED");

    const preclaim = createV3NormalImplementationPreclaim(dependencies());
    const missingRef = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "missing-base",
    });
    assert.equal(missingRef.status, "blocked");
    if (missingRef.status !== "blocked") assert.fail("expected missing ref block");
    assert.equal(missingRef.error.code, "V3_NORMAL_PRECLAIM_SOURCE_UNAVAILABLE");
    assert.equal(missingRef.error.causeCode, "V3_GIT_REF_INVALID");

    await writeFile(path.join(repo, "tracked.txt"), "second\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    git(repo, ["commit", "-qm", "second"]);
    git(repo, ["branch", "-f", "base", "HEAD"]);
    const drift = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
      expectedSha: firstSha,
    });
    assert.equal(drift.status, "blocked");
    if (drift.status !== "blocked") assert.fail("expected ref CAS block");
    assert.equal(drift.error.causeCode, "V3_GIT_EXPECTED_SHA_MISMATCH");
  });

  it("rejects a missing or tampered ready authority", async () => {
    const blocks = fakeBlockRepository({
      authorityOverride: (authority) => ({ ...authority, storyId: "US-999" }),
    });
    const preclaim = createV3NormalImplementationPreclaim(dependencies({
      stories: [row({ storyId: "US-001", storyIndex: 0 })],
      blockRepository: blocks.repository,
    }));
    const result = await preclaim.prepare({
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    });
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") assert.fail("expected authority block");
    assert.equal(result.error.code, "V3_NORMAL_PRECLAIM_AUTHORITY_INVALID");
  });

  it("allows concurrent prepares to read the same ready authority without publishing a claim", async () => {
    const blocks = fakeBlockRepository({ fixedStateVersion: 1 });
    const claimPublication = { calls: 0 };
    const preclaim = createV3NormalImplementationPreclaim(dependencies({
      stories: [row({ storyId: "US-001", storyIndex: 0 })],
      blockRepository: blocks.repository,
    }));
    const input = {
      runId: RUN_ID,
      stepId: STEP_ID,
      repo,
      requestedBaseRef: "base",
    };
    const [left, right] = await Promise.all([preclaim.prepare(input), preclaim.prepare(input)]);
    assert.equal(left.status, "ready");
    assert.equal(right.status, "ready");
    if (left.status !== "ready" || right.status !== "ready") assert.fail("expected two read-ready results");
    assert.equal(left.authority.authorityHash, right.authority.authorityHash);
    assert.equal(blocks.stats.resolveReadyCalls, 2);
    assert.equal(claimPublication.calls, 0, "claim CAS belongs to the later publication boundary");
  });
});
