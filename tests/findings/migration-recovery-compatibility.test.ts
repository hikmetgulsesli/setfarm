import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  applyContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import {
  computeRecoveryDispatchDedupeKey,
  computeRecoveryFindingDispatchDedupeKey,
  createRecoveryCaseV1,
  type RecoveryCaseV1,
} from "../../src/recovery/recovery-case.js";
import {
  computeRevisionDispatchDedupeKey,
  createRecoveryCaseRevisionV1,
} from "../../src/recovery/recovery-delivery.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const EVIDENCE_HASH = "c".repeat(64);
const SOURCE_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);
const CREATED_AT = new Date("2026-07-13T07:00:00.000Z");

let database: TestDatabase | undefined;

afterEach(async () => {
  await database?.cleanup();
  database = undefined;
});

function finding(runId: string, storyId: string) {
  return createFindingSetV1({
    runId,
    storyId,
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: SOURCE_HASH }],
      observedEvidenceRefs: [EVIDENCE_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recovery(findingSet: ReturnType<typeof finding>, usedImplement = 0) {
  return createRecoveryCaseV1({
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((item) => item.findingId),
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
      used: { implement: usedImplement, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: usedImplement ? "repairing" : "open",
    decisionRefs: [],
  }, { now: CREATED_AT });
}

async function insertRecoveryCase(value: RecoveryCaseV1): Promise<void> {
  await database!.sql.unsafe(
    `INSERT INTO recovery_cases (
       recovery_case_id, dedupe_key, run_id, story_id, finding_set_hash, finding_ids,
       packet_hash, slice_hash, source_sha, source_tree_hash, owner, expected_delta,
       allowed_paths, evidence_plan, prior_attempt_refs,
       max_implement, max_supervisor_repair, max_evidence_only,
       used_implement, used_supervisor_repair, used_evidence_only,
       status, terminal, decision_refs, state_version, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6::text::jsonb,
       $7, $8, $9, $10, $11, $12::text::jsonb,
       $13::text::jsonb, $14::text::jsonb, $15::text::jsonb,
       $16, $17, $18, $19, $20, $21,
       $22, NULL, $23::text::jsonb, $24, $25, $26
     )`,
    [
      value.recoveryCaseId,
      value.dedupeKey,
      value.runId,
      value.storyId,
      value.findingSetHash,
      JSON.stringify(value.findingIds),
      value.packetHash,
      value.sliceHash,
      value.sourceRevision.sha,
      value.sourceRevision.treeHash,
      value.owner,
      JSON.stringify(value.expectedDelta),
      JSON.stringify(value.allowedPaths),
      JSON.stringify(value.evidencePlan),
      JSON.stringify(value.priorAttemptRefs),
      value.budget.limits.implement,
      value.budget.limits.supervisorRepair,
      value.budget.limits.evidenceOnly,
      value.budget.used.implement,
      value.budget.used.supervisorRepair,
      value.budget.used.evidenceOnly,
      value.status,
      JSON.stringify(value.decisionRefs),
      value.stateVersion,
      value.createdAt,
      value.updatedAt,
    ],
  );
}

async function insertLegacyDispatch(
  value: RecoveryCaseV1,
  dispatchClass: "product_implementation" | "supervisor_repair" | "evidence_only",
  authorizedAt: Date,
): Promise<string> {
  const dispatchKey = computeRecoveryDispatchDedupeKey({
    dispatchClass,
    runId: value.runId,
    storyId: value.storyId,
    findingIds: value.findingIds,
    packetHash: value.packetHash,
    sliceHash: value.sliceHash,
    sourceRevision: value.sourceRevision,
    evidencePlan: value.evidencePlan,
  });
  const dispatchId = `RDISP_${dispatchKey}`;
  await database!.sql.unsafe(
    `INSERT INTO recovery_dispatches (
       dispatch_id, recovery_case_id, dispatch_class, dispatch_dedupe_key,
       source_sha, source_tree_hash, packet_hash, slice_hash, finding_set_hash,
       finding_ids, evidence_plan, authorized_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               $10::text::jsonb, $11::text::jsonb, $12)`,
    [
      dispatchId,
      value.recoveryCaseId,
      dispatchClass,
      dispatchKey,
      value.sourceRevision.sha,
      value.sourceRevision.treeHash,
      value.packetHash,
      value.sliceHash,
      value.findingSetHash,
      JSON.stringify(value.findingIds),
      JSON.stringify(value.evidencePlan),
      authorizedAt,
    ],
  );
  for (const findingId of value.findingIds) {
    const findingDispatchKey = computeRecoveryFindingDispatchDedupeKey({
      dispatchClass,
      runId: value.runId,
      storyId: value.storyId,
      findingId,
      packetHash: value.packetHash,
      sliceHash: value.sliceHash,
      sourceTreeHash: value.sourceRevision.treeHash,
    });
    await database!.sql.unsafe(
      `INSERT INTO recovery_dispatch_findings (
         dispatch_id, finding_id, finding_dispatch_key, run_id, story_id,
         dispatch_class, source_tree_hash, packet_hash, slice_hash, authorized_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dispatchId,
        findingId,
        findingDispatchKey,
        value.runId,
        value.storyId,
        dispatchClass,
        value.sourceRevision.treeHash,
        value.packetHash,
        value.sliceHash,
        authorizedAt,
      ],
    );
  }
  return dispatchId;
}

async function insertLegacyRevision(value: RecoveryCaseV1): Promise<string> {
  const legacyRevisionId = `RREV_${value.dedupeKey}`;
  await database!.sql.unsafe(
    `INSERT INTO recovery_case_revisions (
       revision_id, recovery_case_id, revision_number, parent_revision_id,
       revision_identity_key, run_id, story_id, finding_set_hash, finding_ids,
       packet_hash, contract_slice_hash, source_sha, source_tree_hash,
       owner, expected_delta, allowed_paths, evidence_plan,
       evidence_plan_artifact_hash, created_at
     ) VALUES (
       $1, $2, 1, NULL, $3, $4, $5, $6, $7::text::jsonb,
       $8, $9, $10, $11, $12, $13::text::jsonb, $14::text::jsonb,
       $15::text::jsonb, NULL, $16
     )`,
    [
      legacyRevisionId,
      value.recoveryCaseId,
      value.dedupeKey,
      value.runId,
      value.storyId,
      value.findingSetHash,
      JSON.stringify(value.findingIds),
      value.packetHash,
      value.sliceHash,
      value.sourceRevision.sha,
      value.sourceRevision.treeHash,
      value.owner,
      JSON.stringify(value.expectedDelta),
      JSON.stringify(value.allowedPaths),
      JSON.stringify(value.evidencePlan),
      value.createdAt,
    ],
  );
  await database!.sql.unsafe(
    "UPDATE recovery_cases SET current_revision_id = $2 WHERE recovery_case_id = $1",
    [value.recoveryCaseId, legacyRevisionId],
  );
  return legacyRevisionId;
}

async function downgradeRecoveryDeliveryLedgerToV10(): Promise<void> {
  for (const statement of [
    // v17 is intentionally unwound with its pointer contract before v11. A
    // current-schema test database otherwise retains a real FK from the review
    // resolution ledger to recovery_revision_dispatches, which is not a v10
    // database and cannot truthfully exercise the v10 -> current upgrade path.
    "DROP TRIGGER trg_recovery_cases_github_review_resolution_set_once ON recovery_cases",
    "DROP FUNCTION setfarm_enforce_github_review_resolution_pointer_set_once()",
    "ALTER TABLE recovery_cases DROP CONSTRAINT recovery_cases_github_review_resolution_fkey",
    "ALTER TABLE recovery_cases DROP CONSTRAINT recovery_cases_github_review_resolution_terminal_check",
    "ALTER TABLE recovery_cases DROP CONSTRAINT recovery_cases_github_review_resolution_hash_check",
    "ALTER TABLE recovery_cases DROP COLUMN github_review_resolution_evidence_hash",
    "DROP TABLE github_review_resolution_evidence",
    "DELETE FROM setfarm_schema_migrations WHERE version = 17",
    "DROP TABLE recovery_dispatch_migration_receipts",
    "DROP TABLE recovery_dispatch_deliveries",
    "ALTER TABLE execution_attempts DROP CONSTRAINT execution_attempts_recovery_dispatch_fkey",
    "ALTER TABLE execution_attempts DROP CONSTRAINT execution_attempts_recovery_pair_check",
    "ALTER TABLE execution_attempts DROP COLUMN recovery_dispatch_id",
    "ALTER TABLE execution_attempts DROP COLUMN recovery_case_revision_id",
    "DROP TABLE recovery_revision_dispatch_findings",
    "DROP TABLE recovery_revision_dispatches",
    "ALTER TABLE recovery_cases DROP CONSTRAINT recovery_cases_current_revision_fkey",
    "DROP TABLE recovery_case_revisions",
    "ALTER TABLE recovery_cases DROP COLUMN current_revision_id",
    "DELETE FROM setfarm_schema_migrations WHERE version = 11",
  ]) {
    await database!.sql.unsafe(statement);
  }
}

describe("revisioned recovery migration compatibility", () => {
  it("keeps fresh v11 recovery revisions exact", async () => {
    database = await createIsolatedTestDatabase();
    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.migrations.find((item) => item.version === 11)?.state, "applied");

    const findingSet = finding("run-fresh-revision", "US-FRESH");
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const value = recovery(findingSet);
    const {
      schema: _schema,
      recoveryCaseId: _recoveryCaseId,
      dedupeKey: _dedupeKey,
      stateVersion: _stateVersion,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...draft
    } = value;
    const opened = await findings.openRecoveryCase(draft, { now: CREATED_AT });
    const current = await createRecoveryDeliveryRepository(database.sql)
      .findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(current);
    assert.notEqual(current.revisionIdentityKey, opened.recoveryCase.dedupeKey);
    assert.equal(current.revisionId, `RREV_${current.revisionIdentityKey}`);
  });

  it("upgrades populated v10 cases without re-authorizing an unprovably consumed dispatch", async () => {
    database = await createIsolatedTestDatabase();
    await downgradeRecoveryDeliveryLedgerToV10();
    const findingSet = finding("run-v10-upgrade", "US-V10");
    await createFindingRecoveryRepository(database.sql).putFindingSet(findingSet);
    const legacyCase = recovery(findingSet, 1);
    await insertRecoveryCase(legacyCase);
    const dispatchKey = computeRecoveryDispatchDedupeKey({
      dispatchClass: "product_implementation",
      runId: legacyCase.runId,
      storyId: legacyCase.storyId,
      findingIds: legacyCase.findingIds,
      packetHash: legacyCase.packetHash,
      sliceHash: legacyCase.sliceHash,
      sourceRevision: legacyCase.sourceRevision,
      evidencePlan: legacyCase.evidencePlan,
    });
    const dispatchId = `RDISP_${dispatchKey}`;
    await database.sql.unsafe(
      `INSERT INTO recovery_dispatches (
         dispatch_id, recovery_case_id, dispatch_class, dispatch_dedupe_key,
         source_sha, source_tree_hash, packet_hash, slice_hash, finding_set_hash,
         finding_ids, evidence_plan, authorized_at
       ) VALUES ($1, $2, 'product_implementation', $3, $4, $5, $6, $7, $8,
                 $9::text::jsonb, $10::text::jsonb, $11)`,
      [
        dispatchId,
        legacyCase.recoveryCaseId,
        dispatchKey,
        legacyCase.sourceRevision.sha,
        legacyCase.sourceRevision.treeHash,
        legacyCase.packetHash,
        legacyCase.sliceHash,
        legacyCase.findingSetHash,
        JSON.stringify(legacyCase.findingIds),
        JSON.stringify(legacyCase.evidencePlan),
        CREATED_AT,
      ],
    );
    const findingDispatchKey = computeRecoveryFindingDispatchDedupeKey({
      dispatchClass: "product_implementation",
      runId: legacyCase.runId,
      storyId: legacyCase.storyId,
      findingId: legacyCase.findingIds[0]!,
      packetHash: legacyCase.packetHash,
      sliceHash: legacyCase.sliceHash,
      sourceTreeHash: legacyCase.sourceRevision.treeHash,
    });
    await database.sql.unsafe(
      `INSERT INTO recovery_dispatch_findings (
         dispatch_id, finding_id, finding_dispatch_key, run_id, story_id,
         dispatch_class, source_tree_hash, packet_hash, slice_hash, authorized_at
       ) VALUES ($1, $2, $3, $4, $5, 'product_implementation', $6, $7, $8, $9)`,
      [
        dispatchId,
        legacyCase.findingIds[0]!,
        findingDispatchKey,
        legacyCase.runId,
        legacyCase.storyId,
        legacyCase.sourceRevision.treeHash,
        legacyCase.packetHash,
        legacyCase.sliceHash,
        CREATED_AT,
      ],
    );

    const applied = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(applied.applied, [
      "011_revisioned_recovery_delivery_ledger",
      "017_v3_github_review_resolution_evidence",
    ]);
    const expected = createRecoveryCaseRevisionV1({
      recoveryCaseId: legacyCase.recoveryCaseId,
      revisionNumber: 1,
      runId: legacyCase.runId,
      storyId: legacyCase.storyId,
      findingSetHash: legacyCase.findingSetHash,
      findingIds: legacyCase.findingIds,
      packetHash: legacyCase.packetHash,
      contractSliceHash: legacyCase.sliceHash,
      sourceRevision: legacyCase.sourceRevision,
      owner: legacyCase.owner,
      expectedDelta: legacyCase.expectedDelta,
      allowedPaths: legacyCase.allowedPaths,
      evidencePlan: legacyCase.evidencePlan,
    }, { now: CREATED_AT });
    const current = await createRecoveryDeliveryRepository(database.sql)
      .findCurrentRevision(legacyCase.recoveryCaseId);
    assert.deepEqual(current, expected);
    assert.notEqual(current!.revisionId, `RREV_${legacyCase.dedupeKey}`);
    const revisionDispatchKey = computeRevisionDispatchDedupeKey({
      dispatchClass: "product_implementation",
      runId: legacyCase.runId,
      storyId: legacyCase.storyId,
      findingIds: legacyCase.findingIds,
      packetHash: legacyCase.packetHash,
      sourceTreeHash: legacyCase.sourceRevision.treeHash,
      evidencePlan: legacyCase.evidencePlan,
    });
    const revisionDispatchId = `RDISP_${revisionDispatchKey}`;
    assert.notEqual(revisionDispatchId, dispatchId);
    const migratedDispatch = await createRecoveryDeliveryRepository(database.sql)
      .findDispatch(revisionDispatchId);
    assert.equal(migratedDispatch?.revisionId, expected.revisionId);
    assert.equal(migratedDispatch?.dispatchDedupeKey, revisionDispatchKey);
    const migrated = await database.sql<Array<{ revision_id: string; state: string }>>`
      SELECT dispatch.revision_id, delivery.state
        FROM recovery_revision_dispatches dispatch
        JOIN recovery_dispatch_deliveries delivery USING (dispatch_id)
       WHERE dispatch.dispatch_id = ${revisionDispatchId}
    `;
    assert.deepEqual(migrated[0], { revision_id: expected.revisionId, state: "superseded" });

    const replay = await applyContractSpineMigrations(database.sql);
    assert.equal(replay.alreadyApplied.includes("011_revisioned_recovery_delivery_ledger"), true);
    assert.deepEqual(
      await createRecoveryDeliveryRepository(database.sql).findCurrentRevision(legacyCase.recoveryCaseId),
      expected,
    );
  });

  it("preserves owner evolution as immutable history without reviving any legacy delivery", async () => {
    database = await createIsolatedTestDatabase();
    await downgradeRecoveryDeliveryLedgerToV10();
    const findingSet = finding("run-v10-owner-evolution", "US-V10-EVOLUTION");
    await createFindingRecoveryRepository(database.sql).putFindingSet(findingSet);
    const legacyCase = recovery(findingSet, 1);
    await insertRecoveryCase(legacyCase);
    const historicalImplement = await insertLegacyDispatch(
      legacyCase,
      "product_implementation",
      new Date("2026-07-13T07:01:00.000Z"),
    );

    await database.sql.unsafe(
      `UPDATE recovery_cases
          SET owner = 'supervisor', status = 'repairing', updated_at = $2
        WHERE recovery_case_id = $1`,
      [legacyCase.recoveryCaseId, new Date("2026-07-13T07:02:00.000Z")],
    );
    const historicalSupervisor = await insertLegacyDispatch(
      legacyCase,
      "supervisor_repair",
      new Date("2026-07-13T07:03:00.000Z"),
    );
    const currentEvidence = await insertLegacyDispatch(
      legacyCase,
      "evidence_only",
      new Date("2026-07-13T07:04:00.000Z"),
    );

    const applied = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(applied.applied, [
      "011_revisioned_recovery_delivery_ledger",
      "017_v3_github_review_resolution_evidence",
    ]);
    const rows = await database.sql<Array<{
      legacy_dispatch_id: string;
      disposition: string;
      reason_code: string;
      delivery_state: string | null;
    }>>`
      SELECT receipt.legacy_dispatch_id, receipt.disposition, receipt.reason_code,
             delivery.state AS delivery_state
        FROM recovery_dispatch_migration_receipts receipt
        LEFT JOIN recovery_dispatch_deliveries delivery
          ON delivery.dispatch_id = receipt.canonical_dispatch_id
       WHERE receipt.recovery_case_id = ${legacyCase.recoveryCaseId}
    `;
    const receipts = new Map(rows.map((row) => [row.legacy_dispatch_id, row]));
    assert.deepEqual({ ...receipts.get(historicalImplement)! }, {
      legacy_dispatch_id: historicalImplement,
      disposition: "legacy_history_only",
      reason_code: "historical_semantics_not_current",
      delivery_state: null,
    });
    assert.deepEqual({ ...receipts.get(historicalSupervisor)! }, {
      legacy_dispatch_id: historicalSupervisor,
      disposition: "canonical_terminal",
      reason_code: "historical_safe_dispatch",
      delivery_state: "superseded",
    });
    assert.deepEqual({ ...receipts.get(currentEvidence)! }, {
      legacy_dispatch_id: currentEvidence,
      disposition: "canonical_terminal",
      reason_code: "historical_safe_dispatch",
      delivery_state: "superseded",
    });
    const active = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM recovery_dispatch_deliveries
       WHERE run_id = ${legacyCase.runId}
         AND story_id = ${legacyCase.storyId}
         AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
    `;
    assert.equal(active[0]?.count, 0);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("migrates a terminal legacy case without reviving its last dispatch", async () => {
    database = await createIsolatedTestDatabase();
    await downgradeRecoveryDeliveryLedgerToV10();
    const findingSet = finding("run-v10-terminal", "US-V10-TERMINAL");
    await createFindingRecoveryRepository(database.sql).putFindingSet(findingSet);
    const legacyCase = recovery(findingSet, 1);
    await insertRecoveryCase(legacyCase);
    const legacyDispatchId = await insertLegacyDispatch(
      legacyCase,
      "product_implementation",
      new Date("2026-07-13T07:05:00.000Z"),
    );
    await database.sql.unsafe(
      `UPDATE recovery_cases
          SET status = 'blocked', terminal = $2::text::jsonb, updated_at = $3
        WHERE recovery_case_id = $1`,
      [
        legacyCase.recoveryCaseId,
        JSON.stringify({
          owner: "implement",
          outcome: "blocked",
          reasonCode: "budget_exhausted",
          evidenceBundleHashes: [],
        }),
        new Date("2026-07-13T07:06:00.000Z"),
      ],
    );

    await applyContractSpineMigrations(database.sql);
    const rows = await database.sql<Array<{
      disposition: string;
      reason_code: string;
      state: string;
    }>>`
      SELECT receipt.disposition, receipt.reason_code, delivery.state
        FROM recovery_dispatch_migration_receipts receipt
        JOIN recovery_dispatch_deliveries delivery
          ON delivery.dispatch_id = receipt.canonical_dispatch_id
       WHERE receipt.legacy_dispatch_id = ${legacyDispatchId}
    `;
    assert.deepEqual({ ...rows[0] }, {
      disposition: "canonical_terminal",
      reason_code: "historical_safe_dispatch",
      state: "superseded",
    });
    const active = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM recovery_dispatch_deliveries
       WHERE run_id = ${legacyCase.runId}
         AND story_id = ${legacyCase.storyId}
         AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
    `;
    assert.equal(active[0]?.count, 0);
  });

  it("rolls the whole v11 migration back when immutable v10 dispatch evidence is corrupt", async () => {
    database = await createIsolatedTestDatabase();
    await downgradeRecoveryDeliveryLedgerToV10();
    const findingSet = finding("run-v10-unsafe", "US-V10-UNSAFE");
    await createFindingRecoveryRepository(database.sql).putFindingSet(findingSet);
    const legacyCase = recovery(findingSet, 1);
    await insertRecoveryCase(legacyCase);
    const dispatchKey = computeRecoveryDispatchDedupeKey({
      dispatchClass: "product_implementation",
      runId: legacyCase.runId,
      storyId: legacyCase.storyId,
      findingIds: legacyCase.findingIds,
      packetHash: legacyCase.packetHash,
      sliceHash: legacyCase.sliceHash,
      sourceRevision: legacyCase.sourceRevision,
      evidencePlan: legacyCase.evidencePlan,
    });
    await database.sql.unsafe(
      `INSERT INTO recovery_dispatches (
         dispatch_id, recovery_case_id, dispatch_class, dispatch_dedupe_key,
         source_sha, source_tree_hash, packet_hash, slice_hash, finding_set_hash,
         finding_ids, evidence_plan, authorized_at
       ) VALUES ($1, $2, 'product_implementation', $3, $4, $5, $6, $7, $8,
                 $9::text::jsonb, $10::text::jsonb, $11)`,
      [
        `RDISP_${dispatchKey}`,
        legacyCase.recoveryCaseId,
        dispatchKey,
        legacyCase.sourceRevision.sha,
        "3".repeat(40),
        legacyCase.packetHash,
        legacyCase.sliceHash,
        legacyCase.findingSetHash,
        JSON.stringify(legacyCase.findingIds),
        JSON.stringify(legacyCase.evidencePlan),
        CREATED_AT,
      ],
    );

    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      /RECOVERY_V10_DISPATCH_FINDINGS_UNSAFE/,
    );
    const shape = await database.sql<Array<{ present: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'recovery_cases'
           AND column_name = 'current_revision_id'
      ) AS present
    `;
    assert.equal(shape[0]?.present, false);
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version = 11
    `;
    assert.equal(journal[0]?.count, 0);
  });

  it("rehydrates the exact buggy 011 signature once and rejects dispatch-bearing ambiguity", async () => {
    database = await createIsolatedTestDatabase();
    const findings = createFindingRecoveryRepository(database.sql);
    const delivery = createRecoveryDeliveryRepository(database.sql);

    const compatibleFinding = finding("run-legacy-rehydrate", "US-REHYDRATE");
    await findings.putFindingSet(compatibleFinding);
    const compatibleCase = recovery(compatibleFinding);
    await insertRecoveryCase(compatibleCase);
    const legacyRevisionId = await insertLegacyRevision(compatibleCase);
    const expected = createRecoveryCaseRevisionV1({
      recoveryCaseId: compatibleCase.recoveryCaseId,
      revisionNumber: 2,
      parentRevisionId: legacyRevisionId,
      runId: compatibleCase.runId,
      storyId: compatibleCase.storyId,
      findingSetHash: compatibleCase.findingSetHash,
      findingIds: compatibleCase.findingIds,
      packetHash: compatibleCase.packetHash,
      contractSliceHash: compatibleCase.sliceHash,
      sourceRevision: compatibleCase.sourceRevision,
      owner: compatibleCase.owner,
      expectedDelta: compatibleCase.expectedDelta,
      allowedPaths: compatibleCase.allowedPaths,
      evidencePlan: compatibleCase.evidencePlan,
    }, { now: CREATED_AT });
    assert.deepEqual(await delivery.findCurrentRevision(compatibleCase.recoveryCaseId), expected);
    assert.deepEqual(await delivery.findCurrentRevision(compatibleCase.recoveryCaseId), expected);
    const counts = await database.sql<Array<{ revisions: number }>>`
      SELECT COUNT(*)::integer AS revisions FROM recovery_case_revisions
       WHERE recovery_case_id = ${compatibleCase.recoveryCaseId}
    `;
    assert.equal(counts[0]?.revisions, 2);

    const unsafeFinding = finding("run-legacy-unsafe", "US-UNSAFE");
    await findings.putFindingSet(unsafeFinding);
    const unsafeCase = recovery(unsafeFinding);
    await insertRecoveryCase(unsafeCase);
    const unsafeRevisionId = await insertLegacyRevision(unsafeCase);
    const revisionDispatchKey = computeRevisionDispatchDedupeKey({
      dispatchClass: "product_implementation",
      runId: unsafeCase.runId,
      storyId: unsafeCase.storyId,
      findingIds: unsafeCase.findingIds,
      packetHash: unsafeCase.packetHash,
      sourceTreeHash: unsafeCase.sourceRevision.treeHash,
      evidencePlan: unsafeCase.evidencePlan,
    });
    await database.sql.unsafe(
      `INSERT INTO recovery_revision_dispatches (
         dispatch_id, recovery_case_id, revision_id, dispatch_class, dispatch_dedupe_key,
         source_sha, source_tree_hash, packet_hash, contract_slice_hash, finding_set_hash,
         finding_ids, evidence_plan, evidence_plan_artifact_hash, authorized_at
       ) VALUES ($1, $2, $3, 'product_implementation', $4, $5, $6, $7, $8, $9,
                 $10::text::jsonb, $11::text::jsonb, NULL, $12)`,
      [
        `RDISP_${revisionDispatchKey}`,
        unsafeCase.recoveryCaseId,
        unsafeRevisionId,
        revisionDispatchKey,
        unsafeCase.sourceRevision.sha,
        unsafeCase.sourceRevision.treeHash,
        unsafeCase.packetHash,
        unsafeCase.sliceHash,
        unsafeCase.findingSetHash,
        JSON.stringify(unsafeCase.findingIds),
        JSON.stringify(unsafeCase.evidencePlan),
        CREATED_AT,
      ],
    );
    await assert.rejects(
      delivery.findCurrentRevision(unsafeCase.recoveryCaseId),
      (error: unknown) => error instanceof Error
        && error.message.includes("RECOVERY_LEGACY_REVISION_REHYDRATION_REQUIRED")
        && error.cause instanceof Error
        && error.cause.message.includes("RECOVERY_LEGACY_REVISION_REHYDRATION_DISPATCH_UNSAFE"),
    );
  });
});
