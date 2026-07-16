import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import {
  ArtifactIndexError,
  createArtifactIndex,
} from "../../src/product-compiler/artifact-index.js";
import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import {
  RuntimePacketCompilerError,
  createRuntimePacketCompiler,
} from "../../src/product-compiler/runtime-packet-compiler.js";
import {
  buildMinimalValidContracts,
} from "./fixtures/minimal-valid-contract.js";
import {
  buildNoDesignProductBuildPacketV3Contracts,
  buildStitchProductBuildPacketV3Contracts,
} from "./fixtures/product-build-packet-v3.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const RELEASE_SHA = "c".repeat(40);
const limits = {
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 8 * 1024 * 1024,
  minFreeBytes: 0,
};

describe("runtime Product Build Packet compiler", () => {
  let database: TestDatabase;
  const roots: string[] = [];

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe(
      "TRUNCATE product_packets, run_artifact_refs, artifact_publication_reservations, semantic_artifacts, execution_attempts, claim_log, runs CASCADE",
    );
    await database.sql.unsafe(
      `UPDATE artifact_capacity
          SET quota_bytes = 8388608, max_payload_bytes = 4194304,
              total_bytes = 0, reserved_bytes = 0,
              state = 'bootstrap_required', reconciled_at = NULL,
              diagnostic = NULL, updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
    );
  });

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function fixture(mode: "shadow" | "v3") {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-runtime-packet-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits });
    await bootstrapArtifactIndex({
      index: createArtifactIndex(database.sql),
      store,
      quotaBytes: limits.rootQuotaBytes,
      maxPayloadBytes: limits.maxPayloadBytes,
    });
    const runId = `runtime-packet-${mode}`;
    const releaseAdmissionHash = mode === "v3"
      ? await database.seedV3ReleaseGoAdmission(RELEASE_SHA)
      : null;
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol,
         compiler_release_sha, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'runtime packet', 'running', $2, $3, $4, $5)`,
      [runId, mode, RELEASE_SHA, "d".repeat(64), releaseAdmissionHash],
    );
    const contracts = mode === "v3"
      ? buildNoDesignProductBuildPacketV3Contracts()
      : buildMinimalValidContracts();
    const compiler = createRuntimePacketCompiler({
      sql: database.sql,
      artifactRoot,
      artifactLimits: limits,
      ownerInstanceId: `test-${mode}`,
    });
    return {
      runId,
      compiler,
      input: {
        runId,
        expectedMode: mode,
        ...contracts,
        compiler: { version: "3.0.0", codeSha: RELEASE_SHA },
        producer: {
          pass: "runtime-packet-test",
          codeSha: RELEASE_SHA,
          toolVersions: { node: process.versions.node },
        },
      },
    } as const;
  }

  it("atomically activates one deterministic v3 packet and its exact six-ref no-design set", async () => {
    const test = await fixture("v3");
    const [first, second] = await Promise.all([
      test.compiler.compile(test.input),
      test.compiler.compile(test.input),
    ]);
    assert.equal(first.activation, "activated");
    assert.equal(second.activation, "activated");
    assert.equal(first.compilation.packetHash, second.compilation.packetHash);
    assert.equal([first, second].filter((item) => item.activationCreated).length, 1);
    const rows = await database.sql<Array<{
      packet_hash: string | null;
      packets: number;
      refs: number;
    }>>`
      SELECT r.packet_hash,
             (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
             (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs
        FROM runs r WHERE r.id = ${test.runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      packet_hash: first.compilation.packetHash,
      packets: 1,
      refs: 6,
    }]);
  });

  it("activates the exact seven-ref native Stitch packet without historical adapters", async () => {
    const test = await fixture("v3");
    Object.assign(
      test.input,
      await buildStitchProductBuildPacketV3Contracts(test.input.producer),
    );
    const result = await test.compiler.compile(test.input);
    assert.equal(result.activation, "activated");
    assert.equal(result.compilation.packet?.schema, "setfarm.product-build-packet.v3");
    const rows = await database.sql<Array<{
      refs: number;
      graph_type: string | null;
      nested_design_sources: number;
    }>>`
      SELECT COUNT(ra.ref_key)::integer AS refs,
             MAX(a.artifact_type) FILTER (WHERE ra.ref_key = 'DESIGN_GRAPH') AS graph_type,
             (SELECT COUNT(*)::integer
                FROM semantic_artifacts nested
               WHERE nested.artifact_type IN (
                 'setfarm.design-generation-targets.v2',
                 'setfarm.stitch-direct-response-evidence.v2',
                 'setfarm.stitch-rendered-semantics.v2',
                 'setfarm.stitch-target-candidate-selection.v2',
                 'setfarm.stitch-target-response-bindings.v3'
               )) AS nested_design_sources
        FROM run_artifact_refs ra
        JOIN semantic_artifacts a ON a.artifact_hash = ra.artifact_hash
       WHERE ra.run_id = ${test.runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      refs: 7,
      graph_type: "setfarm.design-interaction-graph.v2",
      nested_design_sources: 5,
    }]);
  });

  it("records shadow artifacts without activating product_packets or runs.packet_hash", async () => {
    const test = await fixture("shadow");
    const result = await test.compiler.compile(test.input);
    assert.equal(result.activation, "observed");
    assert.equal(result.compilation.status, "sealed");
    const rows = await database.sql<Array<{
      packet_hash: string | null;
      packets: number;
      refs: number;
      non_shadow_refs: number;
    }>>`
      SELECT r.packet_hash,
             (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
             (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
             (SELECT COUNT(*)::integer FROM run_artifact_refs
               WHERE run_id = r.id AND ref_key NOT LIKE 'SHADOW_%') AS non_shadow_refs
        FROM runs r WHERE r.id = ${test.runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      packet_hash: null,
      packets: 0,
      refs: 6,
      non_shadow_refs: 0,
    }]);
  });

  it("stores a rejected v3 report but never creates a half-sealed packet", async () => {
    const test = await fixture("v3");
    (test.input.storyPlanV2 as any).schema = "setfarm.story-plan.v1";
    const result = await test.compiler.compile(test.input);
    assert.equal(result.activation, "rejected");
    assert.equal(result.compilation.status, "rejected");
    const rows = await database.sql<Array<{
      packet_hash: string | null;
      packets: number;
      canonical_refs: number;
      rejected_refs: number;
    }>>`
      SELECT r.packet_hash,
             (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
             (SELECT COUNT(*)::integer FROM run_artifact_refs
               WHERE run_id = r.id AND ref_key IN (
                 'PRODUCT_SPEC', 'DESIGN_GRAPH', 'BUILD_TOPOLOGY', 'STORY_PLAN',
                 'DESIGN_SOURCE_CLOSURE', 'PRODUCT_BUILD_PACKET', 'COMPILATION_REPORT'
               )) AS canonical_refs,
             (SELECT COUNT(*)::integer FROM run_artifact_refs
               WHERE run_id = r.id AND ref_key LIKE 'REJECTED_%') AS rejected_refs
        FROM runs r WHERE r.id = ${test.runId}
    `;
    assert.equal(rows[0]?.packet_hash, null);
    assert.equal(rows[0]?.packets, 0);
    assert.equal(rows[0]?.canonical_refs, 0);
    assert.equal((rows[0]?.rejected_refs ?? 0) > 0, true);
  });

  it("rejects historical ProductSpec bytes on the explicit v3 compiler path", async () => {
    const test = await fixture("v3");
    const historical = buildMinimalValidContracts();
    (test.input as any).productSpecV2 = historical.productSpec;
    const result = await test.compiler.compile(test.input);
    assert.equal(result.activation, "rejected");
    assert.equal(
      result.compilation.report.diagnostics.some((item) =>
        item.code === "CONTRACT_V3_PRODUCT_SPEC_SCHEMA_INVALID"),
      true,
    );
  });

  it("pins v3 compilation to the run, compiler, and producer release SHA before publication", async () => {
    const test = await fixture("v3");
    await assert.rejects(
      test.compiler.compile({
        ...test.input,
        producer: { ...test.input.producer, codeSha: "f".repeat(40) },
      }),
      (error: unknown) => error instanceof RuntimePacketCompilerError
        && error.code === "RUNTIME_PACKET_RUN_RELEASE_MISMATCH",
    );
    const rows = await database.sql<Array<{ refs: number; packets: number; packet_hash: string | null }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
        (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
        r.packet_hash
      FROM runs r WHERE r.id = ${test.runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { refs: 0, packets: 0, packet_hash: null },
    ]);
  });

  it("applies the indexed payload limit to native v3 child envelopes", async () => {
    const test = await fixture("v3");
    const storyPlan = structuredClone(test.input.storyPlanV2) as any;
    storyPlan.stories[0].description = "v3 authority ".repeat(700);
    storyPlan.partitionHash = hashCanonicalJson(storyPlan.stories);
    (test.input as any).storyPlanV2 = storyPlan;

    const envelopeBytes = (artifactType: string, payload: unknown) => canonicalJsonBytes({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType,
      producer: test.input.producer,
      payload,
    }).byteLength;
    const earlierEnvelopeBytes = [
      ["setfarm.product-spec.v2", test.input.productSpecV2],
      ["setfarm.build-topology.v1", test.input.buildTopologyV1],
    ].map(([artifactType, payload]) => envelopeBytes(artifactType as string, payload));
    const storyEnvelopeBytes = envelopeBytes(
      "setfarm.story-plan.v2",
      storyPlan,
    );
    const maxEarlierEnvelopeBytes = Math.max(...earlierEnvelopeBytes);
    assert.equal(storyEnvelopeBytes > maxEarlierEnvelopeBytes, true);
    await database.sql.unsafe(
      `UPDATE artifact_capacity SET max_payload_bytes = $1, updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
      [maxEarlierEnvelopeBytes],
    );

    await assert.rejects(
      test.compiler.compile(test.input),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_PAYLOAD_TOO_LARGE",
    );
    const rows = await database.sql<Array<{ packet_hash: string | null; packets: number }>>`
      SELECT r.packet_hash,
             (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets
        FROM runs r WHERE r.id = ${test.runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{ packet_hash: null, packets: 0 }]);
  });
});
