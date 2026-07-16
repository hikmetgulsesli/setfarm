import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ArtifactIndexError,
  createArtifactIndex,
  type ArtifactIdentity,
} from "../../src/product-compiler/artifact-index.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const producer = Object.freeze({
  pass: "artifact-index-test",
  codeSha: "a".repeat(40),
  toolVersions: Object.freeze({ node: "22", setfarm: "test" }),
});

function artifact(
  token: string,
  byteLength: number,
  artifactType = "setfarm.product-spec.v1",
): ArtifactIdentity {
  return {
    hash: token.repeat(64),
    artifactType,
    byteLength,
    producer,
  };
}

function at(offsetMs: number): Date {
  return new Date(Date.UTC(2026, 6, 13, 12, 0, 0, offsetMs));
}

describe("durable semantic artifact index", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe(
      "TRUNCATE product_packets, run_artifact_refs, artifact_publication_reservations, semantic_artifacts CASCADE",
    );
    await database.sql.unsafe(
      `UPDATE artifact_capacity
          SET quota_bytes = 536870912,
              max_payload_bytes = 4194304,
              total_bytes = 0,
              reserved_bytes = 0,
              state = 'bootstrap_required',
              reconciled_at = NULL,
              diagnostic = NULL,
              updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
    );
  });

  it("bootstraps from an exact inventory once and fails closed on index/filesystem drift", async () => {
    const index = createArtifactIndex(database.sql);
    const firstArtifact = artifact("a", 20);
    assert.equal((await index.getCapacity()).state, "bootstrap_required");

    const first = await index.bootstrap({
      artifacts: [firstArtifact],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(0),
    });
    assert.deepEqual({
      state: first.state,
      totalBytes: first.totalBytes,
      reservedBytes: first.reservedBytes,
    }, {
      state: "ready",
      totalBytes: 20,
      reservedBytes: 0,
    });
    assert.deepEqual((await index.getArtifact(firstArtifact.hash))?.producer, producer);
    assert.equal(
      (await index.verifyInventory({ artifacts: [firstArtifact] })).totalBytes,
      firstArtifact.byteLength,
    );
    const semanticColumns = await database.sql<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'semantic_artifacts'
       ORDER BY ordinal_position
    `;
    assert.deepEqual(semanticColumns.map((row) => row.column_name), [
      "artifact_hash",
      "artifact_type",
      "byte_length",
      "producer_metadata",
      "created_at",
    ]);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO semantic_artifacts (
           artifact_hash, artifact_type, byte_length, producer_metadata
         ) VALUES ($1, 'setfarm.product-spec.v1', 1, $2::text::jsonb)`,
        [
          "9".repeat(64),
          JSON.stringify({ ...producer, unexpected: true }),
        ],
      ),
      /semantic_artifacts_producer_keys_check/,
    );

    const repeated = await index.bootstrap({
      artifacts: [firstArtifact],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(1),
    });
    assert.equal(repeated.totalBytes, 20);
    await assert.rejects(
      index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(2) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH",
    );
    assert.equal((await index.getCapacity()).state, "quarantined");
    await assert.rejects(
      index.reservePublication({
        reservationId: "reservation-after-drift",
        artifact: artifact("8", 1),
        ownerInstanceId: "publisher-a",
        now: at(3),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_INDEX_NOT_READY",
    );
  });

  it("verifies exact filesystem identities and capacity accounting without mutating state", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("5", 20);
    await index.bootstrap({ artifacts: [target], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const before = await index.getCapacity();
    await assert.rejects(
      index.verifyInventory({ artifacts: [] }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH",
    );
    await database.sql.unsafe(
      "UPDATE artifact_capacity SET total_bytes = total_bytes + 1 WHERE capacity_key = 'semantic-artifacts'",
    );
    await assert.rejects(
      index.verifyInventory({ artifacts: [target] }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_INDEX_ACCOUNTING_MISMATCH",
    );
    assert.equal((await index.getCapacity()).updatedAt, before.updatedAt);
  });

  it("reserves before publication and settles exact idempotent CAS metadata", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("b", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });

    const reserved = await index.reservePublication({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;
    assert.equal((await index.getCapacity()).reservedBytes, 20);

    const repeatedReservation = await index.reservePublication({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(11),
    });
    assert.equal(repeatedReservation.status, "reserved");
    if (repeatedReservation.status !== "reserved") return;
    assert.equal(repeatedReservation.reservation.leaseToken, reserved.reservation.leaseToken);
    assert.equal((await index.getCapacity()).reservedBytes, 20);
    const heartbeat = await index.heartbeatReservation({
      reservationId: "reservation-exact",
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      leaseMs: 1_000,
      now: at(500),
    });
    assert.notEqual(heartbeat.leaseExpiresAt, reserved.reservation.leaseExpiresAt);

    const published = await index.publish({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      now: at(501),
    });
    assert.equal(published.created, true);
    const idempotent = await index.publish({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      now: at(502),
    });
    assert.equal(idempotent.created, false);
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 20, reservedBytes: 0 });
    await assert.rejects(
      database.sql`UPDATE semantic_artifacts SET byte_length = 21 WHERE artifact_hash = ${target.hash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`DELETE FROM semantic_artifacts WHERE artifact_hash = ${target.hash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );

    const alreadyPublished = await index.reservePublication({
      reservationId: "reservation-after-publish",
      artifact: target,
      ownerInstanceId: "publisher-b",
      now: at(503),
    });
    assert.equal(alreadyPublished.status, "already_published");
    await assert.rejects(
      index.reservePublication({
        reservationId: "reservation-wrong-identity",
        artifact: { ...target, artifactType: "setfarm.story-plan.v1" },
        ownerInstanceId: "publisher-b",
        now: at(504),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_IDENTITY_MISMATCH",
    );
  });

  it("lets the exact live lease owner release a failed publication without waiting for expiry", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("7", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const reserved = await index.reservePublication({
      reservationId: "reservation-owned-release",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;

    await assert.rejects(
      index.finalizeOwnedReservation({
        reservationId: "reservation-owned-release",
        ownerInstanceId: "publisher-b",
        leaseToken: reserved.reservation.leaseToken!,
        resolution: "released",
        diagnostic: "wrong owner",
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_RESERVATION_LEASE_LOST",
    );
    const released = await index.finalizeOwnedReservation({
      reservationId: "reservation-owned-release",
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      resolution: "released",
      diagnostic: "filesystem publication failed before index commit",
      now: at(12),
    });
    assert.equal(released.state, "released");
    assert.equal((await index.getCapacity()).reservedBytes, 0);

    const corruptTarget = artifact("6", 10);
    const corrupt = await index.reservePublication({
      reservationId: "reservation-owned-quarantine",
      artifact: corruptTarget,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(20),
    });
    assert.equal(corrupt.status, "reserved");
    if (corrupt.status !== "reserved") return;
    await index.finalizeOwnedReservation({
      reservationId: "reservation-owned-quarantine",
      ownerInstanceId: "publisher-a",
      leaseToken: corrupt.reservation.leaseToken!,
      resolution: "quarantined",
      diagnostic: "filesystem artifact is corrupt",
      now: at(21),
    });
    const capacity = await index.getCapacity();
    assert.equal(capacity.state, "quarantined");
    assert.equal(capacity.diagnostic, "filesystem artifact is corrupt");
  });

  it("fences the quota under concurrent reservations", async () => {
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const results = await Promise.allSettled([
      index.reservePublication({
        reservationId: "reservation-race-a",
        artifact: artifact("c", 60),
        ownerInstanceId: "publisher-a",
        leaseMs: 100,
        now: at(10),
      }),
      index.reservePublication({
        reservationId: "reservation-race-b",
        artifact: artifact("d", 60),
        ownerInstanceId: "publisher-b",
        leaseMs: 100,
        now: at(10),
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof ArtifactIndexError);
    assert.equal(rejected.reason.code, "ARTIFACT_CAPACITY_EXCEEDED");
    assert.equal((await index.getCapacity()).reservedBytes, 60);

    const expired = await index.listExpired(at(111));
    assert.equal(expired.length, 1);
    await index.releaseExpired({ reservationId: expired[0]!.reservationId, now: at(111) });
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("adopts, releases, and quarantines only expired reservations without changing total bytes", async () => {
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const firstArtifact = artifact("e", 30);
    const first = await index.reservePublication({
      reservationId: "reservation-adopt",
      artifact: firstArtifact,
      ownerInstanceId: "dead-owner",
      leaseMs: 100,
      now: at(10),
    });
    await index.reservePublication({
      reservationId: "reservation-release",
      artifact: artifact("f", 25),
      ownerInstanceId: "dead-owner",
      leaseMs: 100,
      now: at(10),
    });
    assert.equal(first.status, "reserved");
    await assert.rejects(
      index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(50) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_ACTIVE_RESERVATIONS",
    );
    assert.equal((await index.getCapacity()).reservedBytes, 55);
    const adopted = await index.adoptExpired({
      reservationId: "reservation-adopt",
      artifact: firstArtifact,
      ownerInstanceId: "recovery-owner",
      leaseMs: 100,
      now: at(111),
    });
    assert.equal(adopted.ownerInstanceId, "recovery-owner");
    assert.notEqual(adopted.leaseToken, first.status === "reserved" ? first.reservation.leaseToken : undefined);
    await assert.rejects(
      index.releaseExpired({ reservationId: "reservation-adopt", now: at(112) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_RESERVATION_NOT_EXPIRED",
    );
    const quarantined = await index.quarantineExpired({
      reservationId: "reservation-adopt",
      diagnostic: "published bytes could not be verified",
      now: at(212),
    });
    assert.equal(quarantined.state, "quarantined");
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 0, reservedBytes: 25 });
    assert.equal((await index.getCapacity()).state, "quarantined");

    const released = await index.releaseExpired({
      reservationId: "reservation-release",
      diagnostic: "no target file exists",
      now: at(212),
    });
    assert.equal(released.state, "released");
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("seals immutable run refs and one packet without mutating runs.packet_hash", async () => {
    const index = createArtifactIndex(database.sql);
    const packetA = artifact("1", 40, "setfarm.product-build-packet.v1");
    const packetB = artifact("2", 45, "setfarm.product-build-packet.v1");
    const child = artifact("3", 15);
    await index.bootstrap({
      artifacts: [packetA, packetB, child],
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    await database.insertRun("artifact-index-run");

    const ref = await index.addRunArtifactRef({
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      now: at(10),
    });
    assert.equal(ref.created, true);
    assert.equal((await index.addRunArtifactRef({
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      now: at(11),
    })).created, false);
    assert.deepEqual(await index.getRunArtifactRef("artifact-index-run", "PRODUCT_SPEC"), {
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      artifactType: child.artifactType,
      createdAt: at(10).toISOString(),
    });
    assert.deepEqual((await index.listRunArtifactRefs("artifact-index-run")).map((item) => item.refKey), [
      "PRODUCT_SPEC",
    ]);
    assert.equal(await index.getRunArtifactRef("artifact-index-run", "STORY_PLAN"), undefined);
    await assert.rejects(
      index.addRunArtifactRef({
        runId: "artifact-index-run",
        refKey: "PRODUCT_SPEC",
        artifactHash: packetA.hash,
        now: at(12),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "RUN_ARTIFACT_REF_CONFLICT",
    );

    const compiler = { version: "3.0.0", codeSha: "b".repeat(40) };
    assert.equal((await index.sealProductPacket({
      runId: "artifact-index-run",
      packetHash: packetA.hash,
      compiler,
      now: at(20),
    })).created, true);
    assert.equal((await index.sealProductPacket({
      runId: "artifact-index-run",
      packetHash: packetA.hash,
      compiler,
      now: at(21),
    })).created, false);
    await assert.rejects(
      index.sealProductPacket({
        runId: "artifact-index-run",
        packetHash: packetB.hash,
        compiler,
        now: at(22),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_SEAL_CONFLICT",
    );
    const runs = await database.sql<Array<{ packet_hash: string | null }>>`
      SELECT packet_hash FROM runs WHERE id = 'artifact-index-run'
    `;
    assert.equal(runs[0]?.packet_hash, null);

    await assert.rejects(
      database.sql`UPDATE product_packets SET packet_hash = ${packetB.hash} WHERE run_id = 'artifact-index-run'`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`UPDATE run_artifact_refs SET artifact_hash = ${packetA.hash} WHERE run_id = 'artifact-index-run'`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await database.insertRun("artifact-index-run-invalid");
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
         VALUES ('artifact-index-run-invalid', $1, $2::text::jsonb)`,
        [packetA.hash, JSON.stringify({ ...compiler, extra: true })],
      ),
      /product_packets_compiler_keys_check/,
    );
  });

  it("atomically activates the exact canonical packet refs before any v3 attempt", async () => {
    const index = createArtifactIndex(database.sql);
    const refs = {
      PRODUCT_SPEC: artifact("a", 10, "setfarm.product-spec.v1"),
      DESIGN_GRAPH: artifact("b", 10, "setfarm.design-interaction-graph.v1"),
      BUILD_TOPOLOGY: artifact("c", 10, "setfarm.build-topology.v1"),
      STORY_PLAN: artifact("d", 10, "setfarm.story-plan.v1"),
      PRODUCT_BUILD_PACKET: artifact("e", 10, "setfarm.product-build-packet.v1"),
      COMPILATION_REPORT: artifact("f", 10, "setfarm.product-compilation-report.v1"),
    } as const;
    await index.bootstrap({
      artifacts: Object.values(refs),
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(producer.codeSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        'packet-activation-run', 'feature-dev', 'packet activation', 'running', 'v3',
        ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    const hashes = Object.fromEntries(
      Object.entries(refs).map(([key, value]) => [key, value.hash]),
    ) as Record<keyof typeof refs, string>;
    const compiler = { version: "3.0.0", codeSha: producer.codeSha };

    const activated = await index.activateProductPacket({
      runId: "packet-activation-run",
      packetHash: refs.PRODUCT_BUILD_PACKET.hash,
      compiler,
      artifactRefs: hashes,
      now: at(10),
    });
    assert.equal(activated.created, true);
    const repeated = await index.activateProductPacket({
      runId: "packet-activation-run",
      packetHash: refs.PRODUCT_BUILD_PACKET.hash,
      compiler,
      artifactRefs: hashes,
      now: at(11),
    });
    assert.equal(repeated.created, false);
    const rows = await database.sql<Array<{ packet_hash: string; refs: number }>>`
      SELECT r.packet_hash, COUNT(ra.ref_key)::integer AS refs
        FROM runs r JOIN run_artifact_refs ra ON ra.run_id = r.id
       WHERE r.id = 'packet-activation-run'
       GROUP BY r.packet_hash
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { packet_hash: refs.PRODUCT_BUILD_PACKET.hash, refs: 6 },
    ]);

    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        'packet-activation-rollback', 'feature-dev', 'packet rollback', 'running', 'v3',
        ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-activation-rollback",
        packetHash: refs.PRODUCT_BUILD_PACKET.hash,
        compiler,
        artifactRefs: { ...hashes, STORY_PLAN: refs.PRODUCT_SPEC.hash },
        now: at(20),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
    );
    const rolledBack = await database.sql<Array<{ refs: number; packets: number; packet_hash: string | null }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
        (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
        r.packet_hash
      FROM runs r WHERE r.id = 'packet-activation-rollback'
    `;
    assert.deepEqual(rolledBack.map((row) => ({ ...row })), [
      { refs: 0, packets: 0, packet_hash: null },
    ]);
  });

  it("activates ProductBuildPacketV3 only from its exact CAS payload and native ref set", async () => {
    const index = createArtifactIndex(database.sql);
    const compiler = { version: "4.0.0", codeSha: producer.codeSha };
    const refs = {
      PRODUCT_SPEC: artifact("1", 10, "setfarm.product-spec.v2"),
      BUILD_TOPOLOGY: artifact("2", 10, "setfarm.build-topology.v1"),
      STORY_PLAN: artifact("3", 10, "setfarm.story-plan.v2"),
      DESIGN_SOURCE_CLOSURE: artifact("4", 10, "setfarm.design-source-closure.v2"),
      COMPILATION_REPORT: artifact("5", 10, "setfarm.product-compilation-report.v3"),
    } as const;
    const packet = {
      schema: "setfarm.product-build-packet.v3" as const,
      packetVersion: 3 as const,
      parentPacketHashes: [],
      designSourceKind: "none" as const,
      productSpecV2Hash: refs.PRODUCT_SPEC.hash,
      designGraphV2Hash: null,
      buildTopologyV1Hash: refs.BUILD_TOPOLOGY.hash,
      storyPlanV2Hash: refs.STORY_PLAN.hash,
      designSourceClosureV2Hash: refs.DESIGN_SOURCE_CLOSURE.hash,
      compiler,
      validationIds: ["VALIDATE_V3_SCHEMA_STRICT"],
    };
    const packetHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.product-build-packet.v3",
      producer,
      payload: packet,
    });
    const packetArtifact: ArtifactIdentity = {
      hash: packetHash,
      artifactType: "setfarm.product-build-packet.v3",
      byteLength: 10,
      producer,
    };
    await index.bootstrap({
      artifacts: [...Object.values(refs), packetArtifact],
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(producer.codeSha);
    for (const runId of ["packet-v3-activation", "packet-v3-forged"]) {
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'packet v3 activation', 'running', 'v3',
          ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
        )
      `;
    }
    const artifactRefs = {
      PRODUCT_SPEC: refs.PRODUCT_SPEC.hash,
      BUILD_TOPOLOGY: refs.BUILD_TOPOLOGY.hash,
      STORY_PLAN: refs.STORY_PLAN.hash,
      DESIGN_SOURCE_CLOSURE: refs.DESIGN_SOURCE_CLOSURE.hash,
      PRODUCT_BUILD_PACKET: packetHash,
      COMPILATION_REPORT: refs.COMPILATION_REPORT.hash,
    };
    const activated = await index.activateProductPacket({
      runId: "packet-v3-activation",
      packetHash,
      compiler,
      packet,
      artifactRefs,
      now: at(10),
    });
    assert.equal(activated.created, true);
    assert.equal((await index.listRunArtifactRefs("packet-v3-activation")).length, 6);

    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-v3-forged",
        packetHash,
        compiler,
        packet: { ...packet, storyPlanV2Hash: refs.PRODUCT_SPEC.hash },
        artifactRefs,
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_IDENTITY_MISMATCH",
    );
    const rolledBack = await database.sql<Array<{ refs: number; packets: number; packet_hash: string | null }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
        (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
        r.packet_hash
      FROM runs r WHERE r.id = 'packet-v3-forged'
    `;
    assert.deepEqual(rolledBack.map((row) => ({ ...row })), [
      { refs: 0, packets: 0, packet_hash: null },
    ]);
  });
});
