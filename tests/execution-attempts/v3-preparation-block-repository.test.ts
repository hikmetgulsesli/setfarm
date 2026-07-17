import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createV3PreparationBlockRepository } from "../../src/execution/v3-preparation-block-repository.js";
import {
  decideV3PreparationFailure,
  type V3PreparationIdentityV1,
} from "../../src/execution/v3-preparation-decision.js";
import { V3ImplementationAttemptError } from "../../src/execution/v3-implementation-attempt.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RUN_ID = "run-v3-preparation-ledger";
const PACKET_HASH = "a".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);
const RELEASE_SHA = "3".repeat(40);

function identity(input: Readonly<{
  storyId?: string;
  sourceTreeHash?: string;
  errorCode?: string;
}> = {}): V3PreparationIdentityV1 {
  return {
    schema: "setfarm.v3-preparation-identity.v1",
    runId: RUN_ID,
    stepId: "implement",
    storyId: input.storyId ?? "US-002",
    packetHash: PACKET_HASH,
    sourceSha: SOURCE_SHA,
    sourceTreeHash: input.sourceTreeHash ?? SOURCE_TREE,
    phase: "eligibility",
    errorCode: input.errorCode ?? "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
    dependencyState: [{ storyId: "US-001", state: "missing" }],
  };
}

function decision(value: V3PreparationIdentityV1) {
  return decideV3PreparationFailure({
    identity: {
      runId: value.runId,
      stepId: value.stepId,
      storyId: value.storyId,
      packetHash: value.packetHash,
      sourceSha: value.sourceSha,
      sourceTreeHash: value.sourceTreeHash,
      phase: value.phase,
      dependencyState: value.dependencyState,
    },
    error: new V3ImplementationAttemptError(
      value.errorCode as "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
      "Exact dependency attempt is missing",
    ),
  });
}

describe("v3 preparation block ledger", () => {
  let database: TestDatabase;
  let repository: ReturnType<typeof createV3PreparationBlockRepository>;

  before(async () => {
    database = await createIsolatedTestDatabase();
    repository = createV3PreparationBlockRepository(database.sql);
    const admissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'preparation ledger test', 'running',
                 'v3', 1, $2, $3, $4, $5)`,
      [RUN_ID, RELEASE_SHA, PACKET_HASH, "4".repeat(64), admissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO semantic_artifacts (
         artifact_hash, artifact_type, byte_length, producer_metadata
       ) VALUES ($1, 'setfarm.product-build-packet.v1', 1, $2::text::jsonb)`,
      [PACKET_HASH, JSON.stringify({
        pass: "preparation-ledger-test",
        codeSha: RELEASE_SHA,
        toolVersions: { setfarm: "test" },
      })],
    );
    await database.sql.unsafe(
      `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
       VALUES ($1, $2, $3::text::jsonb)`,
      [RUN_ID, PACKET_HASH, JSON.stringify({ version: "3.0.0", codeSha: RELEASE_SHA })],
    );
  });

  after(async () => database.cleanup());

  it("journals v16 and detects disabled transition enforcement", async () => {
    const journal = await database.sql<Array<{ name: string }>>`
      SELECT name FROM setfarm_schema_migrations WHERE version = 16
    `;
    assert.equal(journal[0]?.name, "016_v3_preparation_block_ledger");
    await database.sql`ALTER TABLE v3_preparation_blocks
                       DISABLE TRIGGER trg_v3_preparation_blocks_transition`;
    try {
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /Migration 16 /.test(error.message),
      );
    } finally {
      await database.sql`ALTER TABLE v3_preparation_blocks
                         ENABLE TRIGGER trg_v3_preparation_blocks_transition`;
    }
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("opens once, supersedes only on exact delta, and materializes historical recurrence without redispatch", async () => {
    const firstIdentity = identity();
    const firstDecision = decision(firstIdentity);
    const first = await repository.record({
      identity: firstIdentity,
      decision: firstDecision,
      detail: "dependency missing",
      evidenceRefs: [`setfarm://artifact/${PACKET_HASH}`],
      now: new Date("2999-01-01T00:00:00.000Z"),
    });
    assert.equal(first.status, "opened");
    assert.ok(new Date(first.block.openedAt).getTime() < new Date("2999-01-01T00:00:00.000Z").getTime());
    const duplicate = await repository.record({
      identity: firstIdentity,
      decision: firstDecision,
      detail: "dependency missing",
      evidenceRefs: [`setfarm://artifact/${PACKET_HASH}`],
      now: new Date("2026-07-13T10:00:01.000Z"),
    });
    assert.equal(duplicate.status, "duplicate");

    const deltaIdentity = identity({ sourceTreeHash: "5".repeat(40) });
    const delta = await repository.record({
      identity: deltaIdentity,
      decision: decision(deltaIdentity),
      detail: "same dependency missing at changed source",
      evidenceRefs: [`setfarm://artifact/${PACKET_HASH}`],
      now: new Date("2026-07-13T10:01:00.000Z"),
    });
    assert.equal(delta.status, "superseded");
    assert.equal((await repository.findOpen({ runId: RUN_ID, stepId: "implement", storyId: "US-002" }))?.fingerprint, delta.block.fingerprint);

    const historical = await repository.record({
      identity: firstIdentity,
      decision: firstDecision,
      detail: "source reverted to an already-observed exact state",
      evidenceRefs: [`setfarm://artifact/${PACKET_HASH}`],
      now: new Date("2026-07-13T10:02:00.000Z"),
    });
    assert.equal(historical.status, "historical");
    assert.equal(historical.block.fingerprint, first.block.fingerprint);
    assert.equal(historical.block.occurrence, 3);
    assert.equal((await repository.findOpen({ runId: RUN_ID, stepId: "implement", storyId: "US-002" }))?.blockId, historical.block.blockId);
    const rows = await database.sql<Array<{ count: number; open_count: number }>>`
      SELECT COUNT(*)::integer AS count,
             COUNT(*) FILTER (WHERE resolved_at IS NULL)::integer AS open_count
        FROM v3_preparation_blocks
       WHERE run_id = ${RUN_ID} AND story_id = 'US-002'
    `;
    assert.deepEqual(rows[0], { count: 3, open_count: 1 });
  });

  it("serializes concurrent identical publication and resolves only from a changed ready fingerprint", async () => {
    const concurrentIdentity = identity({ storyId: "US-003" });
    const concurrentDecision = decision(concurrentIdentity);
    const results = await Promise.all([
      repository.record({
        identity: concurrentIdentity,
        decision: concurrentDecision,
        detail: "dependency missing",
        evidenceRefs: [],
      }),
      repository.record({
        identity: concurrentIdentity,
        decision: concurrentDecision,
        detail: "dependency missing",
        evidenceRefs: [],
      }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["duplicate", "opened"]);
    const resolved = await repository.resolveReady({
      runId: RUN_ID,
      stepId: "implement",
      storyId: "US-003",
      packetHash: PACKET_HASH,
      sourceSha: SOURCE_SHA,
      sourceTreeHash: SOURCE_TREE,
      dependencyState: [{
        storyId: "US-001",
        state: "ready",
        attemptId: "ATT_dependency-terminal-0001",
        disposition: "produced_delta",
        sourceAfterSha: "6".repeat(40),
        sourceAfterTreeHash: "7".repeat(40),
      }],
      now: new Date("2999-01-01T00:00:00.000Z"),
    });
    assert.equal(resolved.status, "resolved");
    assert.ok(new Date(resolved.block!.resolvedAt!).getTime() < new Date("2999-01-01T00:00:00.000Z").getTime());
    assert.equal(await repository.findOpen({ runId: RUN_ID, stepId: "implement", storyId: "US-003" }), undefined);
  });

  it("forbids identity edits, second resolution, deletion, and an unsealed packet owner", async () => {
    const blockId = `VPB_${decision(identity()).fingerprint}_1`;
    await assert.rejects(
      database.sql.unsafe("UPDATE v3_preparation_blocks SET detail = 'tampered' WHERE block_id = $1", [blockId]),
      /SETFARM_V3_PREPARATION_BLOCK_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql.unsafe("DELETE FROM v3_preparation_blocks WHERE block_id = $1", [blockId]),
      /SETFARM_V3_PREPARATION_BLOCK_IMMUTABLE/,
    );
    const invalidIdentity = { ...identity({ storyId: "US-004" }), packetHash: "8".repeat(64) };
    await assert.rejects(
      repository.record({
        identity: invalidIdentity,
        decision: decision(invalidIdentity),
        detail: "wrong packet",
        evidenceRefs: [],
      }),
      /V3_PREPARATION_RUN_AUTHORITY_MISMATCH/,
    );
  });
});
