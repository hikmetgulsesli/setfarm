import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createEvidenceBundleV2, computeObservationRef } from "../../src/evidence/evidence-bundle-v2.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { createFindingSetV1, type FindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const SHA_A = "1".repeat(40);
const TREE_A = "2".repeat(40);

function structuredFindingSet(observedEvidenceRef = HASH_C, storyId = "US-001"): FindingSetV1 {
  return createFindingSetV1({
    runId: "run-recovery-1",
    storyId,
    packetHash: HASH_A,
    sliceHash: HASH_B,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
      observedEvidenceRefs: [observedEvidenceRef],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(findingSet: FindingSetV1): RecoveryCaseDraftV1 {
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_SAVE_RELOAD"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_SAVE_RELOAD"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
}

function expandedFindingSet(storyId: string): FindingSetV1 {
  return createFindingSetV1({
    runId: "run-recovery-1",
    storyId,
    packetHash: HASH_A,
    sliceHash: HASH_B,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    findings: [
      {
        origin: "runtime",
        classification: "structured",
        invariantRef: "INV_SAVE_RELOAD",
        sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
        observedEvidenceRefs: [HASH_C],
        expectedPredicateRef: "EVID_SAVE_RELOAD",
        status: "open",
      },
      {
        origin: "test",
        classification: "structured",
        invariantRef: "INV_LINK_TARGET",
        sourceLocators: [{ path: "src/routes.ts", contentHash: HASH_E }],
        observedEvidenceRefs: [HASH_F],
        expectedPredicateRef: "EVID_LINK_TARGET",
        status: "open",
      },
    ],
  });
}

function evidenceBundle(
  verdict: "pass" | "fail" | "inconclusive" = "fail",
  storyId = "US-001",
  attemptId?: string,
) {
  const observation = {
    kind: "runtime" as const,
    owner: "setfarm-orchestrator" as const,
    runtimeSessionId: "session-evidence-1",
    runtimeArtifactHash: HASH_E,
    startedAt: "2026-07-13T00:00:00.000Z",
    completedAt: "2026-07-13T00:00:01.000Z",
  };
  return createEvidenceBundleV2({
    runId: "run-recovery-1",
    storyId,
    packetHash: HASH_A,
    sliceHash: HASH_B,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    ...(attemptId ? { attemptId } : {}),
    predicates: [{
      invariantRef: "INV_SAVE_RELOAD",
      predicateRef: "EVID_SAVE_RELOAD",
      required: true,
      verdict,
      observationRefs: [computeObservationRef(observation)],
    }],
    observations: [observation],
    artifacts: [{
      hash: HASH_E,
      mediaType: "application/json",
      locator: "evidence/runtime.json",
    }],
    runner: { id: "setfarm-runtime-runner", version: "2.0.0", environmentHash: HASH_F },
    startedAt: "2026-07-13T00:00:00.000Z",
    completedAt: "2026-07-13T00:00:01.000Z",
  });
}

describe("finding, evidence, and recovery repository", () => {
  let database: TestDatabase;
  let repository: ReturnType<typeof createFindingRecoveryRepository>;

  before(async () => {
    database = await createIsolatedTestDatabase();
    repository = createFindingRecoveryRepository(database.sql);
    await database.insertRun("run-recovery-1");
  });

  it("accepts attempt-bound evidence only for an attested candidate source", async () => {
    const claimRows = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-recovery-1', 'implement', 'US-EVIDENCE-CANDIDATE', 'feature-dev')
      RETURNING id::integer AS id
    `;
    const attempts = createAttemptRepository(database.sql);
    const reserved = await attempts.reserve({
      claimId: claimRows[0]!.id,
      runId: "run-recovery-1",
      stepId: "implement",
      storyId: "US-EVIDENCE-CANDIDATE",
      attemptClass: "product_implementation",
      packetHash: HASH_A,
      compilationReportHash: HASH_F,
      sliceHash: HASH_B,
      sourceBefore: { sha: "9".repeat(40), treeHash: "8".repeat(40) },
      role: "developer",
      agentId: "feature-dev",
      branch: "story/evidence-candidate",
      worktree: ".worktrees/evidence-candidate",
      evidenceRefs: [`setfarm://claim-log/${claimRows[0]!.id}`],
    });
    assert.equal(reserved.status, "reserved");
    const evidence = evidenceBundle("pass", "US-EVIDENCE-CANDIDATE", reserved.attempt.attemptId);
    await assert.rejects(repository.putEvidenceBundle(evidence), /EVIDENCE_ATTEMPT_IDENTITY_MISMATCH/);

    const attested = await attempts.recordCandidateSource({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      sourceAfter: { sha: SHA_A, treeHash: TREE_A },
    });
    assert.equal(attested.status, "candidate");
    const stored = await repository.putEvidenceBundle(evidence);
    assert.equal(stored.status, "inserted");
  });

  after(async () => database.cleanup());

  it("writes immutable finding and evidence snapshots idempotently", async () => {
    const findings = structuredFindingSet();
    const first = await repository.putFindingSet(findings);
    const duplicate = await repository.putFindingSet(findings);
    assert.equal(first.status, "inserted");
    assert.equal(duplicate.status, "duplicate");
    assert.deepEqual(await repository.findFindingSet(findings.findingSetHash), findings);

    const evidence = evidenceBundle();
    const evidenceFirst = await repository.putEvidenceBundle(evidence);
    const evidenceDuplicate = await repository.putEvidenceBundle(evidence);
    assert.equal(evidenceFirst.status, "inserted");
    assert.equal(evidenceDuplicate.status, "duplicate");
    assert.equal(evidenceFirst.bundleHash, evidenceDuplicate.bundleHash);
    assert.deepEqual(await repository.findEvidenceBundle(evidenceFirst.bundleHash), evidence);
    await assert.rejects(
      repository.putEvidenceBundle(evidenceBundle("fail", "US-001", "ATT_missing-identity-123")),
      /EVIDENCE_ATTEMPT_IDENTITY_MISMATCH/,
    );

    await assert.rejects(
      database.sql`UPDATE finding_sets SET story_id = 'US-OTHER' WHERE finding_set_hash = ${findings.findingSetHash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`DELETE FROM evidence_bundles WHERE evidence_bundle_hash = ${evidenceFirst.bundleHash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
  });

  it("publishes one complete ordered finding set under one immediately closed owner", async () => {
    const findings = expandedFindingSet("US-FINDING-OWNER");
    const results = await Promise.all([
      repository.putFindingSet(findings),
      repository.putFindingSet(findings),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["duplicate", "inserted"]);
    const rows = await database.sql.unsafe<Array<{
      state: string;
      producer_implementation_id: string;
      owner_key: string;
      close_count: number;
      child_ids: string[];
    }>>(
      `SELECT owner.state,owner.producer_implementation_id,owner.owner_key,
              CASE WHEN owner.close_ref IS NULL THEN 0 ELSE 1 END::integer AS close_count,
              ARRAY(SELECT child.finding_id
                      FROM findings child
                     WHERE child.finding_set_hash=$1
                     ORDER BY array_position($2::text[],child.finding_id),child.finding_id) AS child_ids
         FROM internal_production_owner_reservations_v1 owner
        WHERE owner.category='finding' AND owner.owner_key=$1`,
      [findings.findingSetHash, findings.findings.map((finding) => finding.findingId)],
    );
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      state: "closed",
      producer_implementation_id: "a-finding-recovery-repository-v1",
      owner_key: findings.findingSetHash,
      close_count: 1,
      child_ids: findings.findings.map((finding) => finding.findingId),
    }]);
  });

  it("rejects a preexisting parent with a missing ordered child set instead of repairing it", async () => {
    const findings = expandedFindingSet("US-FINDING-PARTIAL");
    await database.sql.unsafe(
      `INSERT INTO finding_sets (
         finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
         source_sha,source_tree_hash,finding_ids,payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb)`,
      [
        findings.findingSetHash,
        findings.findingSetId,
        findings.runId,
        findings.storyId,
        findings.packetHash,
        findings.sliceHash,
        findings.sourceRevision.sha,
        findings.sourceRevision.treeHash,
        JSON.stringify(findings.findings.map((finding) => finding.findingId)),
        JSON.stringify(findings),
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO findings (
         finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb)`,
      [
        findings.findingSetHash,
        findings.findings[0]!.findingId,
        findings.findings[0]!.origin,
        findings.findings[0]!.classification,
        findings.findings[0]!.invariantRef,
        findings.findings[0]!.status,
        hashCanonicalJson(findings.findings[0]!.sourceLocators),
        JSON.stringify(findings.findings[0]),
      ],
    );
    await assert.rejects(repository.putFindingSet(findings), /FINDING_OWNER_ADOPTION_INVALID/);
    const rows = await database.sql.unsafe<Array<{ owner_count: number; child_count: number }>>(
      `SELECT (SELECT count(*)::integer FROM internal_production_owner_reservations_v1
                WHERE category='finding' AND owner_key=$1) AS owner_count,
              (SELECT count(*)::integer FROM findings WHERE finding_set_hash=$1) AS child_count`,
      [findings.findingSetHash],
    );
    assert.deepEqual({ ...rows[0]! }, { owner_count: 0, child_count: 1 });
  });

  it("rejects extra children and reordered parent identity without creating an owner", async () => {
    for (const corruption of ["extra-child", "reordered-parent"] as const) {
      const findingSet = expandedFindingSet(`US-FINDING-${corruption.toUpperCase()}`);
      const expectedIds = findingSet.findings.map((finding) => finding.findingId);
      await database.sql.unsafe(
        `INSERT INTO finding_sets (
           finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
           source_sha,source_tree_hash,finding_ids,payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb)`,
        [
          findingSet.findingSetHash,
          findingSet.findingSetId,
          findingSet.runId,
          findingSet.storyId,
          findingSet.packetHash,
          findingSet.sliceHash,
          findingSet.sourceRevision.sha,
          findingSet.sourceRevision.treeHash,
          JSON.stringify(corruption === "reordered-parent" ? [...expectedIds].reverse() : expectedIds),
          JSON.stringify(findingSet),
        ],
      );
      for (const finding of findingSet.findings) {
        await database.sql.unsafe(
          `INSERT INTO findings (
             finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb)`,
          [
            findingSet.findingSetHash,
            finding.findingId,
            finding.origin,
            finding.classification,
            finding.invariantRef,
            finding.status,
            hashCanonicalJson(finding.sourceLocators),
            JSON.stringify(finding),
          ],
        );
      }
      if (corruption === "extra-child") {
        await database.sql.unsafe(
          `INSERT INTO findings (
             finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
           ) VALUES ($1,$2,'runtime','structured','INV_EXTRA','open',$3,$4::text::jsonb)`,
          [
            findingSet.findingSetHash,
            `FIND_${"e".repeat(64)}`,
            HASH_A,
            JSON.stringify({ corruption: "extra-child" }),
          ],
        );
      }
      await assert.rejects(repository.putFindingSet(findingSet), /FINDING_OWNER_ADOPTION_INVALID/);
      const rows = await database.sql.unsafe<Array<{ owner_count: number; child_count: number }>>(
        `SELECT (SELECT count(*)::integer FROM internal_production_owner_reservations_v1
                  WHERE category='finding' AND owner_key=$1) AS owner_count,
                (SELECT count(*)::integer FROM findings WHERE finding_set_hash=$1) AS child_count`,
        [findingSet.findingSetHash],
      );
      assert.deepEqual({ ...rows[0]! }, {
        owner_count: 0,
        child_count: findingSet.findings.length + (corruption === "extra-child" ? 1 : 0),
      });
    }
  });

  it("rolls parent children and owner bytes back when the finding close is rejected", async () => {
    const findings = expandedFindingSet("US-FINDING-CLOSE-ROLLBACK");
    await database.sql.unsafe(`
      CREATE FUNCTION test_reject_finding_owner_close_v1() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.category='finding' AND NEW.owner_key='${findings.findingSetHash}' AND NEW.state='closed' THEN
          RAISE EXCEPTION 'TEST_REJECT_FINDING_OWNER_CLOSE';
        END IF;
        RETURN NEW;
      END $$
    `);
    await database.sql.unsafe(`
      CREATE TRIGGER test_reject_finding_owner_close_v1
      BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
      FOR EACH ROW EXECUTE FUNCTION test_reject_finding_owner_close_v1()
    `);
    try {
      await assert.rejects(repository.putFindingSet(findings), /TEST_REJECT_FINDING_OWNER_CLOSE/);
    } finally {
      await database.sql.unsafe(
        "DROP TRIGGER test_reject_finding_owner_close_v1 ON internal_production_owner_reservations_v1",
      );
      await database.sql.unsafe("DROP FUNCTION test_reject_finding_owner_close_v1()")
    }
    const rows = await database.sql.unsafe<Array<{
      parent_count: number;
      child_count: number;
      owner_count: number;
    }>>(
      `SELECT (SELECT count(*)::integer FROM finding_sets WHERE finding_set_hash=$1) AS parent_count,
              (SELECT count(*)::integer FROM findings WHERE finding_set_hash=$1) AS child_count,
              (SELECT count(*)::integer FROM internal_production_owner_reservations_v1
                WHERE category='finding' AND owner_key=$1) AS owner_count`,
      [findings.findingSetHash],
    );
    assert.deepEqual({ ...rows[0]! }, { parent_count: 0, child_count: 0, owner_count: 0 });
  });

  it("authorizes one model retry for the same logical finding and unchanged source", async () => {
    const original = structuredFindingSet();
    const refreshedEvidence = structuredFindingSet(HASH_F);
    await repository.putFindingSet(original);
    await repository.putFindingSet(refreshedEvidence);
    assert.equal(original.findings[0]?.findingId, refreshedEvidence.findings[0]?.findingId);
    assert.notEqual(original.findingSetHash, refreshedEvidence.findingSetHash);

    const firstCaseResult = await repository.openRecoveryCase(recoveryDraft(original), {
      now: new Date("2026-07-13T01:00:00.000Z"),
    });
    const secondCaseResult = await repository.openRecoveryCase(recoveryDraft(refreshedEvidence), {
      now: new Date("2026-07-13T01:00:01.000Z"),
    });
    assert.equal(firstCaseResult.status, "opened");
    assert.equal(secondCaseResult.status, "opened");

    const authorized = await repository.authorizeDispatch({
      recoveryCaseId: firstCaseResult.recoveryCase.recoveryCaseId,
      expectedStateVersion: firstCaseResult.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: firstCaseResult.recoveryCase.sourceRevision,
    }, { now: new Date("2026-07-13T01:01:00.000Z") });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorization");
    assert.equal(authorized.recoveryCase.budget.used.implement, 1);
    assert.equal(authorized.recoveryCase.status, "repairing");

    const sameCaseDuplicate = await repository.authorizeDispatch({
      recoveryCaseId: authorized.recoveryCase.recoveryCaseId,
      expectedStateVersion: authorized.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: authorized.recoveryCase.sourceRevision,
    });
    assert.equal(sameCaseDuplicate.status, "duplicate");

    const evidenceRevisionDuplicate = await repository.authorizeDispatch({
      recoveryCaseId: secondCaseResult.recoveryCase.recoveryCaseId,
      expectedStateVersion: secondCaseResult.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: secondCaseResult.recoveryCase.sourceRevision,
    });
    assert.equal(evidenceRevisionDuplicate.status, "duplicate");
    const secondCurrent = await repository.findRecoveryCase(secondCaseResult.recoveryCase.recoveryCaseId);
    assert.equal(secondCurrent?.budget.used.implement, 0);
  });

  it("uses versioned transitions and requires explicit terminal ownership", async () => {
    const findings = structuredFindingSet(HASH_E, "US-TERMINAL");
    await repository.putFindingSet(findings);
    const opened = await repository.openRecoveryCase(recoveryDraft(findings), {
      now: new Date("2026-07-13T02:00:00.000Z"),
    });
    const authorized = await repository.authorizeDispatch({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: opened.recoveryCase.sourceRevision,
    });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorization");

    const stale = await repository.transitionRecoveryCase({
      recoveryCaseId: authorized.recoveryCase.recoveryCaseId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      status: "blocked",
      terminal: {
        owner: "implement",
        outcome: "blocked",
        reasonCode: "budget_exhausted",
        evidenceBundleHashes: [],
      },
      decisionRef: HASH_F,
    });
    assert.equal(stale.status, "stale_version");

    const terminal = await repository.transitionRecoveryCase({
      recoveryCaseId: authorized.recoveryCase.recoveryCaseId,
      expectedStateVersion: authorized.recoveryCase.stateVersion,
      status: "blocked",
      terminal: {
        owner: "implement",
        outcome: "blocked",
        reasonCode: "budget_exhausted",
        evidenceBundleHashes: [],
      },
      decisionRef: HASH_F,
    }, { now: new Date("2026-07-13T02:01:00.000Z") });
    assert.equal(terminal.status, "transitioned");
    if (terminal.status !== "transitioned") throw new Error("expected transition");
    assert.equal(terminal.recoveryCase.terminal?.owner, "implement");
    assert.equal(terminal.recoveryCase.decisionRefs.includes(HASH_F), true);
  });

  it("blocks partial finding-set overlap instead of resending an unchanged finding", async () => {
    const storyId = "US-OVERLAP";
    const firstSet = structuredFindingSet(HASH_C, storyId);
    await repository.putFindingSet(firstSet);
    const firstCase = await repository.openRecoveryCase(recoveryDraft(firstSet));
    const firstDispatch = await repository.authorizeDispatch({
      recoveryCaseId: firstCase.recoveryCase.recoveryCaseId,
      expectedStateVersion: firstCase.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: firstCase.recoveryCase.sourceRevision,
    });
    assert.equal(firstDispatch.status, "authorized");

    const expanded = expandedFindingSet(storyId);
    await repository.putFindingSet(expanded);
    const expandedDraft = recoveryDraft(expanded);
    const expandedCase = await repository.openRecoveryCase({
      ...expandedDraft,
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_LINK_TARGET", "INV_SAVE_RELOAD"],
        requiredPaths: ["src/App.tsx", "src/routes.ts"],
      },
      allowedPaths: ["src/App.tsx", "src/routes.ts"],
      evidencePlan: ["EVID_LINK_TARGET", "EVID_SAVE_RELOAD"],
    });
    const conflict = await repository.authorizeDispatch({
      recoveryCaseId: expandedCase.recoveryCase.recoveryCaseId,
      expectedStateVersion: expandedCase.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: expandedCase.recoveryCase.sourceRevision,
    });
    assert.equal(conflict.status, "finding_conflict");
    if (conflict.status !== "finding_conflict") throw new Error("expected finding conflict");
    assert.deepEqual(conflict.conflictingFindingIds, firstSet.findings.map((finding) => finding.findingId));
  });

  it("serializes concurrent dispatch authorization to one bounded model retry", async () => {
    const findings = structuredFindingSet(HASH_D, "US-CONCURRENT");
    await repository.putFindingSet(findings);
    const opened = await repository.openRecoveryCase(recoveryDraft(findings));
    const request = {
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
      sourceRevision: opened.recoveryCase.sourceRevision,
    };
    const results = await Promise.all([
      repository.authorizeDispatch(request),
      repository.authorizeDispatch(request),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["authorized", "stale_version"]);
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM recovery_dispatches
       WHERE recovery_case_id = ${opened.recoveryCase.recoveryCaseId}
    `;
    assert.equal(rows[0]?.count, 1);
  });

  it("cannot resolve from a failing child bundle and resolves only with complete pass evidence", async () => {
    const findings = structuredFindingSet(HASH_C, "US-RESOLUTION");
    await repository.putFindingSet(findings);
    const opened = await repository.openRecoveryCase(recoveryDraft(findings));
    const failedEvidence = await repository.putEvidenceBundle(evidenceBundle("fail", findings.storyId));
    await assert.rejects(
      repository.transitionRecoveryCase({
        recoveryCaseId: opened.recoveryCase.recoveryCaseId,
        expectedStateVersion: opened.recoveryCase.stateVersion,
        status: "resolved",
        terminal: {
          owner: "implement",
          outcome: "resolved",
          reasonCode: "evidence_satisfied",
          evidenceBundleHashes: [failedEvidence.bundleHash],
        },
        decisionRef: HASH_D,
      }),
      /RECOVERY_RESOLUTION_EVIDENCE_NOT_PASSING/,
    );

    const passingEvidence = await repository.putEvidenceBundle(evidenceBundle("pass", findings.storyId));
    const resolved = await repository.transitionRecoveryCase({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      status: "resolved",
      terminal: {
        owner: "implement",
        outcome: "resolved",
        reasonCode: "evidence_satisfied",
        evidenceBundleHashes: [passingEvidence.bundleHash],
      },
      decisionRef: HASH_E,
    });
    assert.equal(resolved.status, "transitioned");
    if (resolved.status !== "transitioned") throw new Error("expected resolution");
    assert.equal(resolved.recoveryCase.status, "resolved");
  });

  it("routes unstructured review input only to exact-path bounded supervisor ownership", async () => {
    await database.insertRun("run-recovery-review");
    const unstructured = createFindingSetV1({
      runId: "run-recovery-review",
      storyId: "US-REVIEW",
      packetHash: HASH_A,
      sliceHash: HASH_B,
      sourceRevision: { sha: SHA_A, treeHash: TREE_A },
      findings: [{
        origin: "review",
        classification: "unstructured_review",
        externalRef: {
          platform: "github",
          repositoryNodeId: "R_repo",
          prNumber: 1925,
          threadId: "PRRT_thread",
          headSha: SHA_A,
          commentRevisionHash: HASH_C,
        },
        invariantRef: "INV_UNSTRUCTURED_REVIEW",
        sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
        observedEvidenceRefs: [HASH_E],
        status: "open",
      }],
    });
    await repository.putFindingSet(unstructured);
    await assert.rejects(
      repository.openRecoveryCase(recoveryDraft(unstructured)),
      /UNSTRUCTURED_REVIEW_REQUIRES_SUPERVISOR_EVIDENCE_OWNER/,
    );
    const supervisor = await repository.openRecoveryCase({
      ...recoveryDraft(unstructured),
      owner: "supervisor",
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_UNSTRUCTURED_REVIEW"],
        requiredPaths: ["src/App.tsx"],
      },
      allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_REVIEW_THREAD_CURRENT"],
      budget: {
        limits: { implement: 0, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
      },
    });
    assert.equal(supervisor.status, "opened");
    assert.equal(supervisor.recoveryCase.owner, "supervisor");

    const other = createFindingSetV1({
      runId: unstructured.runId,
      storyId: "US-REVIEW-OTHER",
      packetHash: unstructured.packetHash,
      sliceHash: unstructured.sliceHash,
      sourceRevision: unstructured.sourceRevision,
      findings: unstructured.findings.map(({ findingId: _findingId, ...finding }) => finding),
    });
    await repository.putFindingSet(other);
    await assert.rejects(
      repository.openRecoveryCase({
        ...recoveryDraft(other),
        owner: "supervisor",
        expectedDelta: {
          kind: "source_change",
          invariantRefs: ["INV_UNSTRUCTURED_REVIEW"],
          requiredPaths: ["src/other.ts"],
        },
        allowedPaths: ["src/other.ts"],
        evidencePlan: ["EVID_REVIEW_THREAD_CURRENT"],
        budget: {
          limits: { implement: 0, supervisorRepair: 1, evidenceOnly: 1 },
          used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
        },
      }),
      /UNSTRUCTURED_REVIEW_SOURCE_AUTHORITY_MISMATCH/,
    );
  });
});
