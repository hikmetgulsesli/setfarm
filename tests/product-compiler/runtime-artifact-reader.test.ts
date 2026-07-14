import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  RuntimeArtifactReaderError,
  createRuntimeArtifactReader,
} from "../../src/product-compiler/runtime-artifact-reader.js";
import { createRuntimePacketCompiler } from "../../src/product-compiler/runtime-packet-compiler.js";
import { buildMinimalValidV3Contracts } from "./fixtures/minimal-valid-contract.js";
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
    const contracts = buildMinimalValidV3Contracts();
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

  it("loads and cross-checks the exact six-artifact activated packet", async () => {
    const test = await fixture();
    const result = await test.reader.readSealedPacket(test.runId);
    assert.equal(result.packetHash, test.compilation.compilation.packetHash);
    assert.deepEqual(result.productSpec, test.contracts.productSpec);
    assert.deepEqual(result.storyPlan, test.contracts.storyPlan);
    assert.equal(result.compilationReport.status, "sealed");
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
