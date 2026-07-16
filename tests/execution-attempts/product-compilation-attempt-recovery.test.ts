import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  ProductCompilationAttemptRepository,
} from "../../src/product-compiler/product-compilation-attempt-repository.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const hash = (value: string): string => hashCanonicalJson({ value });
const RUN_ID = "run-product-compilation-recovery";

describe("expired product compilation attempt recovery", () => {
  let database: TestDatabase;
  let repository: ProductCompilationAttemptRepository;
  let originClaimId: number;
  let claimCounter = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
    repository = new ProductCompilationAttemptRepository(database.sql);
    const releaseSha = "a".repeat(40);
    const admissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, protocol, protocol_version,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${RUN_ID}, 'feature-dev', 'expired compilation recovery fixture',
        'running', 'v3', 1, ${releaseSha}, ${"b".repeat(64)}, ${admissionHash}
      )
    `;
    originClaimId = await createOpenClaim("origin");
  });

  after(async () => database.cleanup());

  async function createOpenClaim(label: string): Promise<number> {
    claimCounter += 1;
    const rows = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (
        ${RUN_ID}, ${`design-recovery-${label}-${claimCounter}`}, NULL,
        ${`recovery-agent-${label}-${claimCounter}`}
      )
      RETURNING id::text AS id
    `;
    return Number(rows[0]!.id);
  }

  async function reserve(label: string) {
    const result = await repository.reserve({
      runId: RUN_ID,
      originClaimId,
      ownerClaimId: originClaimId,
      passKind: "design_source_generation",
      authorityHash: hash(`${label}-authority`),
      requestHash: hash(`${label}-request`),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: `old-owner-${label}`,
      leaseMs: 60_000,
    });
    assert.equal(result.status, "reserved", JSON.stringify(result));
    if (result.status !== "reserved") throw new Error("unreachable");
    return result.attempt;
  }

  async function expire(attemptId: string): Promise<void> {
    await database.sql`
      UPDATE product_compilation_attempts
         SET lease_expires_at = heartbeat_at
       WHERE attempt_id = ${attemptId}
    `;
  }

  it("rotates an expired reserved lease without changing attempt or input authority", async () => {
    const previous = await reserve("reserved");
    await expire(previous.attemptId);
    const newOwnerClaimId = await createOpenClaim("reserved-owner");
    const recovered = await repository.recoverExpired({
      attemptId: previous.attemptId,
      runId: RUN_ID,
      ownerClaimId: newOwnerClaimId,
      ownerInstanceId: "new-owner-reserved",
      leaseMs: 45_000,
    });

    assert.equal(recovered.status, "reserved_safe_to_resume");
    assert.equal(recovered.attempt.state, "reserved");
    assert.equal(recovered.attempt.attemptId, previous.attemptId);
    assert.equal(recovered.attempt.runId, previous.runId);
    assert.equal(recovered.attempt.originClaimId, previous.originClaimId);
    assert.equal(recovered.attempt.ownerClaimId, newOwnerClaimId);
    assert.equal(recovered.attempt.passKind, previous.passKind);
    assert.equal(recovered.attempt.authorityHash, previous.authorityHash);
    assert.equal(recovered.attempt.requestHash, previous.requestHash);
    assert.equal(recovered.attempt.ordinal, previous.ordinal);
    assert.deepEqual(recovered.attempt.retryAuthority, previous.retryAuthority);
    assert.equal(recovered.attempt.attemptLocator, previous.attemptLocator);
    assert.deepEqual(recovered.attempt.dispatch, previous.dispatch);
    assert.equal(recovered.attempt.generation, previous.generation + 1);
    assert.notEqual(recovered.attempt.fenceToken, previous.fenceToken);
    assert.equal(recovered.attempt.lease?.ownerInstanceId, "new-owner-reserved");

    await assert.rejects(() => repository.heartbeat({
      attemptId: previous.attemptId,
      generation: previous.generation,
      fenceToken: previous.fenceToken,
      ownerInstanceId: "old-owner-reserved",
    }), /PRODUCT_COMPILATION_STALE_FENCE/);

    const live = await repository.heartbeat({
      attemptId: recovered.attempt.attemptId,
      generation: recovered.attempt.generation,
      fenceToken: recovered.attempt.fenceToken,
      ownerInstanceId: "new-owner-reserved",
    }, 30_000);
    assert.equal(live.generation, recovered.attempt.generation);
  });

  it("preserves dispatch identity and requires quarantine instead of redispatch", async () => {
    const previous = await reserve("dispatching");
    const dispatching = await repository.commitDispatchIntent({
      attemptId: previous.attemptId,
      generation: previous.generation,
      fenceToken: previous.fenceToken,
      ownerInstanceId: "old-owner-dispatching",
      externalOperationId: "stitch-operation-expired-1",
    });
    await expire(previous.attemptId);
    const newOwnerClaimId = await createOpenClaim("dispatching-owner");
    const recovered = await repository.recoverExpired({
      attemptId: previous.attemptId,
      runId: RUN_ID,
      ownerClaimId: newOwnerClaimId,
      ownerInstanceId: "new-owner-dispatching",
    });

    assert.equal(recovered.status, "dispatching_must_quarantine");
    assert.equal(recovered.attempt.state, "dispatching");
    assert.deepEqual(recovered.attempt.dispatch, dispatching.dispatch);
    await assert.rejects(() => repository.commitDispatchIntent({
      attemptId: recovered.attempt.attemptId,
      generation: recovered.attempt.generation,
      fenceToken: recovered.attempt.fenceToken,
      ownerInstanceId: "new-owner-dispatching",
      externalOperationId: "forbidden-redispatch",
    }), /PRODUCT_COMPILATION_DISPATCH_STATE_INVALID/);

    const quarantined = await repository.sealFailure({
      attemptId: recovered.attempt.attemptId,
      generation: recovered.attempt.generation,
      fenceToken: recovered.attempt.fenceToken,
      ownerInstanceId: "new-owner-dispatching",
      disposition: "dispatch_ambiguous",
      failure: {
        failureArtifactHash: hash("expired-dispatch-artifact"),
        failureFingerprint: hash("expired-dispatch-fingerprint"),
        operationalCauseHash: hash("expired-dispatch-cause"),
        reasonCodes: ["DESIGN_SOURCE_DISPATCH_LEASE_EXPIRED"],
      },
    });
    assert.equal(quarantined.state, "quarantined");
    assert.equal(quarantined.disposition, "dispatch_ambiguous");
    assert.equal(quarantined.dispatch?.intentCommittedAt, dispatching.dispatch?.intentCommittedAt);
    assert.equal(quarantined.dispatch?.startedAt, dispatching.dispatch?.startedAt);
    assert.equal(quarantined.dispatch?.externalOperationId, dispatching.dispatch?.externalOperationId);
    assert.ok(quarantined.dispatch?.finishedAt);
  });

  it("allows exactly one concurrent recovery winner", async () => {
    const previous = await reserve("concurrent");
    await expire(previous.attemptId);
    const [ownerClaimA, ownerClaimB] = await Promise.all([
      createOpenClaim("concurrent-a"),
      createOpenClaim("concurrent-b"),
    ]);
    const outcomes = await Promise.allSettled([
      repository.recoverExpired({
        attemptId: previous.attemptId,
        runId: RUN_ID,
        ownerClaimId: ownerClaimA,
        ownerInstanceId: "concurrent-owner-a",
      }),
      repository.recoverExpired({
        attemptId: previous.attemptId,
        runId: RUN_ID,
        ownerClaimId: ownerClaimB,
        ownerInstanceId: "concurrent-owner-b",
      }),
    ]);
    const winners = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const losers = outcomes.filter((outcome) => outcome.status === "rejected");
    assert.equal(winners.length, 1, JSON.stringify(outcomes));
    assert.equal(losers.length, 1, JSON.stringify(outcomes));
    assert.match(String((losers[0] as PromiseRejectedResult).reason),
      /PRODUCT_COMPILATION_RECOVERY_LEASE_NOT_EXPIRED/);
    const persisted = await repository.get(previous.attemptId);
    assert.equal(persisted?.generation, previous.generation + 1);
    assert.ok([ownerClaimA, ownerClaimB].includes(persisted!.ownerClaimId));
  });

  it("fails closed for live leases, terminal attempts, and closed new owner claims", async () => {
    const live = await reserve("live");
    const liveOwnerClaim = await createOpenClaim("live-owner");
    await assert.rejects(() => repository.recoverExpired({
      attemptId: live.attemptId,
      runId: RUN_ID,
      ownerClaimId: liveOwnerClaim,
      ownerInstanceId: "new-owner-live",
    }), /PRODUCT_COMPILATION_RECOVERY_LEASE_NOT_EXPIRED/);

    const terminal = await reserve("terminal");
    await repository.commitDispatchIntent({
      attemptId: terminal.attemptId,
      generation: terminal.generation,
      fenceToken: terminal.fenceToken,
      ownerInstanceId: "old-owner-terminal",
      externalOperationId: null,
    });
    await repository.sealAccepted({
      attemptId: terminal.attemptId,
      generation: terminal.generation,
      fenceToken: terminal.fenceToken,
      ownerInstanceId: "old-owner-terminal",
      outputRefs: { designSourceClosureHash: hash("terminal-output") },
    });
    const terminalOwnerClaim = await createOpenClaim("terminal-owner");
    await assert.rejects(() => repository.recoverExpired({
      attemptId: terminal.attemptId,
      runId: RUN_ID,
      ownerClaimId: terminalOwnerClaim,
      ownerInstanceId: "new-owner-terminal",
    }), /PRODUCT_COMPILATION_RECOVERY_STATE_INVALID/);

    const closedClaimAttempt = await reserve("closed-claim");
    await expire(closedClaimAttempt.attemptId);
    const closedClaimId = await createOpenClaim("closed-owner");
    await database.sql`
      UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${closedClaimId}
    `;
    await assert.rejects(() => repository.recoverExpired({
      attemptId: closedClaimAttempt.attemptId,
      runId: RUN_ID,
      ownerClaimId: closedClaimId,
      ownerInstanceId: "new-owner-closed-claim",
    }), /PRODUCT_COMPILATION_RECOVERY_OWNER_CLAIM_INVALID/);
  });

  it("lets the trigger accept only an exact expired ownership rotation", async () => {
    const previous = await reserve("trigger");
    const newOwnerClaimId = await createOpenClaim("trigger-owner");
    await assert.rejects(
      () => database.sql`
        UPDATE product_compilation_attempts
           SET owner_claim_id = ${newOwnerClaimId}
         WHERE attempt_id = ${previous.attemptId}
      `,
      /SETFARM_PRODUCT_COMPILATION_ATTEMPT_AUTHORITY_IMMUTABLE/,
    );
    await assert.rejects(
      () => database.sql`
        UPDATE product_compilation_attempts
           SET owner_instance_id = 'forged-owner-instance'
         WHERE attempt_id = ${previous.attemptId}
      `,
      /SETFARM_PRODUCT_COMPILATION_LEASE_IDENTITY_IMMUTABLE/,
    );

    await expire(previous.attemptId);
    await assert.rejects(
      () => database.sql.unsafe(
        `UPDATE product_compilation_attempts
            SET owner_claim_id = $2,
                generation = generation + 1,
                fence_token = $3,
                owner_instance_id = 'forged-recovery-owner',
                lease_token = $4,
                lease_acquired_at = stamp.now,
                lease_expires_at = stamp.now + INTERVAL '30 seconds',
                heartbeat_at = stamp.now,
                updated_at = stamp.now,
                request_hash = $5
           FROM (SELECT clock_timestamp() AS now) AS stamp
          WHERE attempt_id = $1`,
        [
          previous.attemptId,
          newOwnerClaimId,
          "c".repeat(64),
          "d".repeat(64),
          hash("forged-request"),
        ],
      ),
      /SETFARM_PRODUCT_COMPILATION_ATTEMPT_AUTHORITY_IMMUTABLE/,
    );

    const recovered = await repository.recoverExpired({
      attemptId: previous.attemptId,
      runId: RUN_ID,
      ownerClaimId: newOwnerClaimId,
      ownerInstanceId: "exact-trigger-owner",
      leaseMs: 30_000,
    });
    assert.equal(recovered.status, "reserved_safe_to_resume");
  });
});
