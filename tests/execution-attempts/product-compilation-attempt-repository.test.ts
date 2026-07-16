import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  ProductCompilationAttemptRepository,
} from "../../src/product-compiler/product-compilation-attempt-repository.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const hash = (value: string): string => hashCanonicalJson({ value });

describe("product compilation attempt ledger", () => {
  let database: TestDatabase;
  let repository: ProductCompilationAttemptRepository;
  let claimId: number;

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
        'run-product-compilation', 'feature-dev', 'product compilation fixture',
        'running', 'v3', 1, ${releaseSha}, ${"b".repeat(64)}, ${admissionHash}
      )
    `;
    const claims = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-product-compilation', 'design', NULL, 'setfarm-product-compiler')
      RETURNING id::text AS id
    `;
    claimId = Number(claims[0]!.id);
  });

  after(async () => database.cleanup());

  it("commits dispatch intent before accepting one sealed output", async () => {
    const authorityHash = hash("accepted-authority");
    const reserved = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("accepted-request"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "product-compiler-test",
      leaseMs: 60_000,
    });
    assert.equal(reserved.status, "reserved");
    const duplicate = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("accepted-request"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "product-compiler-test",
      leaseMs: 60_000,
    });
    assert.equal(duplicate.status, "duplicate");
    if (reserved.status !== "reserved") return;

    const dispatching = await repository.commitDispatchIntent({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      externalOperationId: null,
    });
    assert.equal(dispatching.state, "dispatching");
    assert.ok(dispatching.dispatch?.intentCommittedAt);

    await assert.rejects(() => repository.commitDispatchIntent({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      externalOperationId: null,
    }), /PRODUCT_COMPILATION_DISPATCH_STATE_INVALID/);

    const sealed = await repository.sealAccepted({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      outputRefs: { designSourceClosureHash: hash("closure") },
    });
    assert.equal(sealed.state, "sealed");
    assert.equal(sealed.disposition, "accepted");
    assert.equal(sealed.lease, null);

    const replay = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("different-request-after-acceptance"),
      ordinal: 2,
      retryAuthority: {
        parentAttemptRef: reserved.attempt.attemptId,
        parentFailureArtifactHash: hash("absent"),
        parentFailureFingerprint: hash("absent"),
        retryDeltaHash: hash("forbidden"),
      },
      ownerInstanceId: "product-compiler-test",
    });
    assert.equal(replay.status, "already_accepted");
  });

  it("permits one retry only from a sealed exact failure and proven delta", async () => {
    const authorityHash = hash("retry-authority");
    const first = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("retry-request-1"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "product-compiler-test",
    });
    assert.equal(first.status, "reserved");
    if (first.status !== "reserved") return;
    await repository.commitDispatchIntent({
      attemptId: first.attempt.attemptId,
      generation: first.attempt.generation,
      fenceToken: first.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      externalOperationId: null,
    });
    const failure = {
      failureArtifactHash: hash("failure-artifact"),
      failureFingerprint: hash("failure-fingerprint"),
      operationalCauseHash: hash("operational-cause"),
      reasonCodes: ["DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED"],
    };
    const rejected = await repository.sealFailure({
      attemptId: first.attempt.attemptId,
      generation: first.attempt.generation,
      fenceToken: first.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      disposition: "rejected",
      failure,
    });
    assert.equal(rejected.disposition, "rejected");

    await assert.rejects(() => repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("retry-request-2"),
      ordinal: 2,
      retryAuthority: {
        parentAttemptRef: first.attempt.attemptId,
        parentFailureArtifactHash: failure.failureArtifactHash,
        parentFailureFingerprint: hash("wrong-fingerprint"),
        retryDeltaHash: hash("delta"),
      },
      ownerInstanceId: "product-compiler-test",
    }), /PRODUCT_COMPILATION_RETRY_AUTHORITY_INVALID/);

    const second = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("retry-request-2"),
      ordinal: 2,
      retryAuthority: {
        parentAttemptRef: first.attempt.attemptId,
        parentFailureArtifactHash: failure.failureArtifactHash,
        parentFailureFingerprint: failure.failureFingerprint,
        retryDeltaHash: hash("delta"),
      },
      ownerInstanceId: "product-compiler-test",
    });
    assert.equal(second.status, "reserved");
    if (second.status === "reserved") {
      assert.equal(second.attempt.ordinal, 2);
      assert.equal(second.attempt.retryAuthority?.parentAttemptRef, first.attempt.attemptId);
    }
  });

  it("quarantines ambiguous dispatch and forbids redispatch", async () => {
    const authorityHash = hash("ambiguous-authority");
    const reserved = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("ambiguous-request"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "product-compiler-test",
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;
    await repository.commitDispatchIntent({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      externalOperationId: null,
    });
    const quarantined = await repository.sealFailure({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      disposition: "dispatch_ambiguous",
      failure: {
        failureArtifactHash: hash("ambiguous-artifact"),
        failureFingerprint: hash("ambiguous-fingerprint"),
        operationalCauseHash: hash("dispatch-ambiguity"),
        reasonCodes: ["DESIGN_SOURCE_DISPATCH_AMBIGUOUS"],
      },
    });
    assert.equal(quarantined.state, "quarantined");
    await assert.rejects(() => repository.commitDispatchIntent({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      ownerInstanceId: "product-compiler-test",
      externalOperationId: null,
    }), /PRODUCT_COMPILATION_STALE_FENCE/);
  });

  it("keeps a closed originating claim as immutable identity while a new open owner performs retry", async () => {
    const claimRows = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-product-compilation', 'design-closed-origin', NULL, 'originating-claim-owner')
      RETURNING id::text AS id
    `;
    const originClaimId = Number(claimRows[0]!.id);
    const authorityHash = hash("closed-origin-authority");
    const first = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId,
      ownerClaimId: originClaimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("closed-origin-request-1"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "originating-claim-owner",
    });
    assert.equal(first.status, "reserved");
    if (first.status !== "reserved") return;
    await repository.commitDispatchIntent({
      attemptId: first.attempt.attemptId,
      generation: first.attempt.generation,
      fenceToken: first.attempt.fenceToken,
      ownerInstanceId: "originating-claim-owner",
      externalOperationId: null,
    });
    const failure = {
      failureArtifactHash: hash("closed-origin-failure-artifact"),
      failureFingerprint: hash("closed-origin-failure-fingerprint"),
      operationalCauseHash: hash("closed-origin-cause"),
      reasonCodes: ["DESIGN_TARGET_EVIDENCE_INCOMPLETE"],
    };
    await repository.sealFailure({
      attemptId: first.attempt.attemptId,
      generation: first.attempt.generation,
      fenceToken: first.attempt.fenceToken,
      ownerInstanceId: "originating-claim-owner",
      disposition: "rejected",
      failure,
    });
    await database.sql`
      UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${originClaimId}
    `;
    const newOwnerRows = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-product-compilation', 'design-closed-origin', NULL, 'retry-claim-owner')
      RETURNING id::text AS id
    `;
    const newOwnerClaimId = Number(newOwnerRows[0]!.id);
    const retry = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId,
      ownerClaimId: newOwnerClaimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("closed-origin-request-2"),
      ordinal: 2,
      retryAuthority: {
        parentAttemptRef: first.attempt.attemptId,
        parentFailureArtifactHash: failure.failureArtifactHash,
        parentFailureFingerprint: failure.failureFingerprint,
        retryDeltaHash: hash("closed-origin-retry-delta"),
      },
      ownerInstanceId: "retry-claim-owner",
    });
    assert.equal(retry.status, "reserved");
    if (retry.status !== "reserved") return;
    assert.equal(retry.attempt.originClaimId, originClaimId);
    assert.equal(retry.attempt.ownerClaimId, newOwnerClaimId);
  });

  it("database trigger freezes authority fields independently of repository code", async () => {
    const authorityHash = hash("immutable-authority");
    const reserved = await repository.reserve({
      runId: "run-product-compilation",
      originClaimId: claimId,
      ownerClaimId: claimId,
      passKind: "design_source_generation",
      authorityHash,
      requestHash: hash("immutable-request"),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "product-compiler-test",
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;
    await assert.rejects(
      () => database.sql`
        UPDATE product_compilation_attempts
           SET request_hash = ${hash("tampered")}
         WHERE attempt_id = ${reserved.attempt.attemptId}
      `,
      /SETFARM_PRODUCT_COMPILATION_ATTEMPT_AUTHORITY_IMMUTABLE/,
    );
  });
});
