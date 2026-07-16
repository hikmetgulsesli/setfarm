import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  IndexedArtifactPublisher,
  bootstrapArtifactIndex,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import {
  RuntimeArtifactReaderError,
  createRuntimeArtifactReader,
} from "../../src/product-compiler/runtime-artifact-reader.js";
import { createRuntimePacketCompiler } from "../../src/product-compiler/runtime-packet-compiler.js";
import {
  produceProductBuildAuthorityV1,
  readProductBuildAuthorityV1,
} from "../../src/server/product-build-authority.js";
import { ProductBuildAuthorityV1Schema } from "../../src/server/schemas/product-build-authority-v1.js";
import {
  buildMinimalValidV3Contracts,
  buildMinimalValidV3PacketV2Contracts,
} from "./fixtures/minimal-valid-contract.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const RELEASE_SHA = "c".repeat(40);
const limits = {
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 8 * 1024 * 1024,
  minFreeBytes: 0,
};

describe("sealed runtime artifact reader", () => {
  let database: TestDatabase;
  const roots: string[] = [];

  before(async () => { database = await createIsolatedTestDatabase(); });
  after(async () => database.cleanup());
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });
  beforeEach(async () => {
    await database.sql.unsafe(
      "TRUNCATE product_packets, run_artifact_refs, artifact_publication_reservations, semantic_artifacts, execution_attempts, claim_log, runs CASCADE",
    );
    await database.sql.unsafe(
      `UPDATE artifact_capacity SET quota_bytes = 8388608, max_payload_bytes = 4194304,
          total_bytes = 0, reserved_bytes = 0, state = 'bootstrap_required',
          reconciled_at = NULL, diagnostic = NULL, updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
    );
  });

  async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-runtime-reader-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits });
    await bootstrapArtifactIndex({
      index: createArtifactIndex(database.sql),
      store,
      quotaBytes: limits.rootQuotaBytes,
      maxPayloadBytes: limits.maxPayloadBytes,
    });
    const runId = "runtime-reader-v3";
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, compiler_release_sha,
         activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'reader', 'running', 'v3', $2, $3, $4)`,
      [runId, RELEASE_SHA, "d".repeat(64), releaseAdmissionHash],
    );
    const contracts = buildMinimalValidV3PacketV2Contracts();
    const compilation = await createRuntimePacketCompiler({
      sql: database.sql,
      artifactRoot,
      artifactLimits: limits,
      ownerInstanceId: "reader-test",
    }).compile({
      runId,
      expectedMode: "v3",
      ...contracts,
      compiler: { version: "3.0.0", codeSha: RELEASE_SHA },
      producer: { pass: "reader-test", codeSha: RELEASE_SHA, toolVersions: {} },
    });
    assert.equal(compilation.activation, "activated");
    return {
      runId,
      reader: createRuntimeArtifactReader({ sql: database.sql, artifactRoot, artifactLimits: limits }),
      compilation,
      contracts,
    };
  }

  async function legacyV1Fixture() {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-runtime-reader-v1-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits });
    const index = createArtifactIndex(database.sql);
    await bootstrapArtifactIndex({
      index,
      store,
      quotaBytes: limits.rootQuotaBytes,
      maxPayloadBytes: limits.maxPayloadBytes,
    });
    const runId = "runtime-reader-v1";
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, compiler_release_sha,
         activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'legacy reader', 'running', 'v3', $2, $3, $4)`,
      [runId, RELEASE_SHA, "e".repeat(64), releaseAdmissionHash],
    );
    const contracts = buildMinimalValidV3Contracts();
    const compiler = { version: "3.0.0", codeSha: RELEASE_SHA };
    const producer = { pass: "reader-v1-test", codeSha: RELEASE_SHA, toolVersions: {} };
    const compilation = await compileProductBuildPacket({
      ...contracts,
      compiler,
      producer,
      protocol: "v3",
      artifactStore: new IndexedArtifactPublisher({
        index,
        store,
        ownerInstanceId: "reader-v1-test",
      }),
    });
    assert.equal(compilation.status, "sealed");
    assert.equal(compilation.packet?.schema, "setfarm.product-build-packet.v1");
    assert.ok(compilation.packetHash);
    await index.activateProductPacket({
      runId,
      packetHash: compilation.packetHash,
      compiler,
      artifactRefs: {
        PRODUCT_SPEC: compilation.artifactHashes.productSpec!,
        DESIGN_GRAPH: compilation.artifactHashes.designGraph!,
        BUILD_TOPOLOGY: compilation.artifactHashes.buildTopology!,
        STORY_PLAN: compilation.artifactHashes.storyPlan!,
        PRODUCT_BUILD_PACKET: compilation.packetHash,
        COMPILATION_REPORT: compilation.reportHash,
      },
    });
    return {
      runId,
      contracts,
      reader: createRuntimeArtifactReader({ sql: database.sql, artifactRoot, artifactLimits: limits }),
    };
  }

  it("loads and cross-checks the exact seven-ref packet and nested design-source closure", async () => {
    const test = await fixture();
    const result = await test.reader.readSealedPacket(test.runId);
    assert.equal(result.packetHash, test.compilation.compilation.packetHash);
    assert.deepEqual(result.productSpec, test.contracts.productSpec);
    assert.deepEqual(result.storyPlan, test.contracts.storyPlan);
    assert.equal(result.compilationReport.status, "sealed");
    assert.equal(result.packet.schema, "setfarm.product-build-packet.v2");
    if (result.packet.schema !== "setfarm.product-build-packet.v2") return;
    assert.equal(result.designSourceClosure.kind, "stitch");
    assert.deepEqual(result.designSources?.generationTargets, test.contracts.designSource.generationTargets);

    const authority = produceProductBuildAuthorityV1(result);
    const { authorityHash, ...identity } = authority;
    assert.equal(authorityHash, hashCanonicalJson(identity));
    assert.equal(authority.refs.packet, result.packetHash);
    assert.equal(authority.designSources?.responseBindings.schema, "setfarm.stitch-target-response-bindings.v2");
    const drifted = structuredClone(authority) as any;
    drifted.designSources.responseBindings.bindings[0].requestScreenKey = "drifted-screen-key";
    assert.equal(ProductBuildAuthorityV1Schema.safeParse(drifted).success, false);
  });

  it("keeps active Product Build Packet v1 owners readable during the v2 migration", async () => {
    const test = await legacyV1Fixture();
    const result = await test.reader.readSealedPacket(test.runId);
    assert.equal(result.packet.schema, "setfarm.product-build-packet.v1");
    assert.deepEqual(result.productSpec, test.contracts.productSpec);
    assert.equal("designSourceClosure" in result, false);
    assert.equal(result.compilationReport.schema, "setfarm.product-compilation-report.v1");
    const authority = produceProductBuildAuthorityV1(result);
    assert.equal(authority.packet.schema, "setfarm.product-build-packet.v1");
    assert.equal(authority.designSourceClosure, undefined);
  });

  it("fails closed with one typed error when a nested closure artifact is missing", async () => {
    const test = await fixture();
    const sealed = await test.reader.readSealedPacket(test.runId);
    assert.equal(sealed.packet.schema, "setfarm.product-build-packet.v2");
    if (sealed.packet.schema !== "setfarm.product-build-packet.v2") return;
    const hash = sealed.designSourceClosure.kind === "stitch"
      ? sealed.designSourceClosure.renderedSemantics.envelopeHash
      : "";
    assert.ok(hash);
    await rm(test.reader.store.pathFor(hash), { force: true });

    await assert.rejects(
      test.reader.readSealedPacket(test.runId),
      (error: unknown) => error instanceof RuntimeArtifactReaderError
        && error.code === "RUNTIME_ARTIFACT_INDEX_MISMATCH",
    );
  });

  it("fails closed with one typed error when nested immutable bytes are corrupt", async () => {
    const test = await fixture();
    const sealed = await test.reader.readSealedPacket(test.runId);
    assert.equal(sealed.packet.schema, "setfarm.product-build-packet.v2");
    if (sealed.packet.schema !== "setfarm.product-build-packet.v2") return;
    const hash = sealed.designSourceClosure.kind === "stitch"
      ? sealed.designSourceClosure.responseBindings.envelopeHash
      : "";
    assert.ok(hash);
    await writeFile(test.reader.store.pathFor(hash), "{}", "utf8");

    await assert.rejects(
      test.reader.readSealedPacket(test.runId),
      (error: unknown) => error instanceof RuntimeArtifactReaderError
        && error.code === "RUNTIME_ARTIFACT_INDEX_MISMATCH",
    );
  });

  it("fails closed when an active v3 run has no canonical activation", async () => {
    const test = await fixture();
    const runId = "runtime-reader-unsealed";
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, compiler_release_sha,
         activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'unsealed reader', 'running', 'v3', $2, $3, $4)`,
      [runId, RELEASE_SHA, "e".repeat(64), releaseAdmissionHash],
    );
    await assert.rejects(
      test.reader.readSealedPacket(runId),
      (error: unknown) => error instanceof RuntimeArtifactReaderError
        && error.code === "RUNTIME_PACKET_NOT_SEALED",
    );
  });

  it("deep-audits the immutable packet after the run becomes terminal", async () => {
    const test = await fixture();
    await database.sql.unsafe(
      "UPDATE runs SET status = 'completed' WHERE id = $1",
      [test.runId],
    );

    const audited = await test.reader.auditTerminalPacket(test.runId);
    assert.equal(audited.packetHash, test.compilation.compilation.packetHash);
    assert.deepEqual(audited.buildTopology, test.contracts.buildTopology);

    const authority = await readProductBuildAuthorityV1(test.reader, test.runId);
    assert.equal(authority.packetHash, audited.packetHash);
    assert.equal(authority.authorityHash, produceProductBuildAuthorityV1(audited).authorityHash);

    await assert.rejects(
      test.reader.readSealedPacket(test.runId),
      (error: unknown) => error instanceof RuntimeArtifactReaderError
        && error.code === "RUNTIME_PACKET_NOT_ACTIVE",
    );
  });

  it("refuses terminal audit while the run is still mutable", async () => {
    const test = await fixture();
    await assert.rejects(
      test.reader.auditTerminalPacket(test.runId),
      (error: unknown) => error instanceof RuntimeArtifactReaderError
        && error.code === "RUNTIME_PACKET_NOT_TERMINAL",
    );
  });
});
