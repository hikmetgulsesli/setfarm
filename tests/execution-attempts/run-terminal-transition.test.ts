import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import type postgres from "postgres";

import {
  applyContractSpineMigrations,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackV3StoryClaimRuntimeBindingToV28,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackOperationalFailureCauseSealToV20,
  rollbackPreparationAuthorityV2LedgerToV24,
  rollbackProductCompilationAttemptLedgerToV21,
  rollbackRecoveryTerminalLeaseIdentityToV19,
} from "../../src/db/contract-spine-migrations.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  closeClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import { withdrawPreDispatchClaimInTransaction } from "../../src/execution/pre-dispatch-withdrawal-authority.js";
import {
  assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1,
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  type PgTransactionSql,
} from "../../src/db-pg.js";
import {
  transitionRunToTerminal,
  transitionRunToTerminalInTransaction,
} from "../../src/execution/run-terminal-transition.js";
import {
  createRuntimeCompletionRepository,
  markRuntimeCompletionOwnerCommittedInTransaction,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
} from "../../src/execution/run-termination.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import {
  lockV3TerminalRecoveryChainInTransaction,
  settleV3TerminalRecoveryChainInTransaction,
} from "../../src/recovery/v3-terminal-recovery-chain.js";
import { exactProductReservation, HASH_A } from "./fixtures.js";
import {
  createIsolatedMigration31TestDatabase,
  createIsolatedTestDatabase,
} from "./test-database.js";

const RUNTIME_DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/run-terminal-completion-drain"],
};

const AUTHENTIC_MIGRATION_32_JOURNAL_ROW = Object.freeze({
  version: 32,
  name: "contract-spine-bootstrap-main-claim-handoff-v1",
  checksum: "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d",
  state: "applied",
});

async function seedBoundDrainedTermination(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{
    runId: string;
    requestId: string;
    targetStatus: "failed" | "cancelled";
    diagnostic: string;
  }>,
): Promise<void> {
  const requested = await requestRunTermination(database.sql, {
    runId: input.runId,
    targetStatus: input.targetStatus,
    requestedBy: "task6-terminal-fixture",
    diagnostic: input.diagnostic,
    requestId: input.requestId,
  });
  assert.equal(requested.status, "requested");
  const terminations = createRunTerminationRepository(database.sql);
  const claimed = await terminations.claim({
    requestId: input.requestId,
    ownerInstanceId: "task6-terminal-owner",
  });
  assert.equal(claimed?.state, "draining");
  const drained = await terminations.markDrained({
    requestId: input.requestId,
    ownerInstanceId: "task6-terminal-owner",
    evidence: { task6Fixture: true },
  });
  assert.equal(drained.state, "drained");
}

async function rollbackCurrentToV21(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
    targetReleaseSha: "c".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
    targetReleaseSha: "d".repeat(40),
  });
  await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
    targetReleaseSha: "e".repeat(40),
  });
  await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
    targetReleaseSha: "f".repeat(40),
  });
  await rollbackPlatformReleaseStoreRecordLedgerV3ToV26(database.sql, {
    targetReleaseSha: "0".repeat(40),
  });
  await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
    targetReleaseSha: "1".repeat(40),
  });
  await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
    targetReleaseSha: "2".repeat(40),
  });
  await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
    targetReleaseSha: "3".repeat(40),
  });
  await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
    targetReleaseSha: "4".repeat(40),
  });
  await rollbackProductCompilationAttemptLedgerToV21(database.sql, {
    targetReleaseSha: "5".repeat(40),
  });
}

async function seedActiveStory(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', ${storyDbId})
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claimed_by, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 1)
  `;
  const claimId = await database.sql.begin(async (transaction) => {
    const rows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      "a-claim-loop-runtime-v1",
      rows,
    );
    return insertAndBindInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      birth,
      {
        runId,
        workflowStepId: "implement",
        storyId: "US-002",
        claimAgentId: "feature-dev_developer",
        claimedAt: new Date(),
      },
    );
  }) as number;
  return { stepDbId, storyDbId, claimId };
}

async function publishMigration31FindingSet(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  findingSet: ReturnType<typeof createFindingSetV1>,
): Promise<void> {
  const ownerLedger = await database.sql<Array<{ owner_table: string | null }>>`
    SELECT to_regclass('public.internal_production_owner_reservations_v1')::text AS owner_table
  `;
  assert.equal(ownerLedger[0]?.owner_table, null);
  await database.sql.begin(async (transaction) => {
    await transaction.unsafe(
      `INSERT INTO finding_sets (
         finding_set_hash, finding_set_id, run_id, story_id, packet_hash, slice_hash,
         source_sha, source_tree_hash, finding_ids, payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10::text::jsonb)`,
      [
        findingSet.findingSetHash,
        findingSet.findingSetId,
        findingSet.runId,
        findingSet.storyId,
        findingSet.packetHash,
        findingSet.sliceHash,
        findingSet.sourceRevision.sha,
        findingSet.sourceRevision.treeHash,
        JSON.stringify(findingSet.findings.map((finding) => finding.findingId)),
        JSON.stringify(findingSet),
      ],
    );
    for (const finding of findingSet.findings) {
      await transaction.unsafe(
        `INSERT INTO findings (
           finding_set_hash, finding_id, origin, classification, invariant_ref,
           status, source_fingerprint, payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb)`,
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
  });
}

async function seedActiveRecovery(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{
    runId: string;
    runStatus: "failed" | "completed";
    findingPublication?: "current" | "migration31";
  }>,
) {
  const releaseSha = "d".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, protocol,
      compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
    ) VALUES (
      ${input.runId}, 'feature-dev', 'terminal recovery chain', 'running', 'v3',
      ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
    )
  `;
  const stepDbId = `${input.runId}-implement`;
  const storyDbId = `${input.runId}-story`;
  const storyId = "US-RECOVERY-TERMINAL";
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type)
    VALUES
      (${stepDbId}, ${input.runId}, 'implement', 'feature-dev_developer', 1, '', '', 'pending', 'loop')
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status)
    VALUES
      (${storyDbId}, ${input.runId}, 1, ${storyId}, 'Terminal recovery story', 'failed')
  `;
  const findingSet = createFindingSetV1({
    runId: input.runId,
    storyId,
    packetHash: HASH_A,
    sliceHash: "b".repeat(64),
    sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: "3".repeat(64) }],
      observedEvidenceRefs: ["4".repeat(64)],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
  const findings = createFindingRecoveryRepository(database.sql);
  if (input.findingPublication === "migration31") {
    await publishMigration31FindingSet(database, findingSet);
  } else {
    await findings.putFindingSet(findingSet);
  }
  const opened = await findings.openRecoveryCase({
    runId: input.runId,
    storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: HASH_A,
    sliceHash: "b".repeat(64),
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
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  });
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  const authorized = await deliveries.authorizeCurrentRevision({
    recoveryCaseId: opened.recoveryCase.recoveryCaseId,
    revisionId: revision.revisionId,
    expectedStateVersion: opened.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  });
  assert.equal(authorized.status, "authorized");
  if (authorized.status !== "authorized") throw new Error("expected authorized recovery fixture");
  await database.sql`UPDATE runs SET status = ${input.runStatus} WHERE id = ${input.runId}`;
  return { recoveryCaseId: opened.recoveryCase.recoveryCaseId, dispatchId: authorized.dispatch.dispatchId };
}

describe("canonical run terminal owner", () => {
  it("P4 recovery source bootstrap actual terminal skips the second owner close only after deep proof", async () => {
    const source = await readFile(path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/execution/run-terminal-transition.ts",
    ), "utf8");
    const transition = source.indexOf("export async function transitionRunToTerminalInTransaction(");
    const pendingBarrier = source.indexOf("assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(", transition);
    const firstMutationCapableCall = source.indexOf("normalizeTask5TerminalCompletionContractInTransactionV1(", transition);
    const mutation = source.indexOf("UPDATE runs", pendingBarrier);
    const proof = source.indexOf("resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(", mutation);
    const ordinary = source.indexOf("resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(", proof);
    assert.ok(transition >= 0 && pendingBarrier > transition && firstMutationCapableCall > pendingBarrier && mutation > firstMutationCapableCall && proof > mutation && ordinary > proof,
      "bound-H1 delivery is refused after read/lock preflight but before terminal normalization or any later mutation; only an already closed H4 owner reaches post-update terminal proof");
    const preBarrier = source.slice(transition, pendingBarrier);
    assert.doesNotMatch(preBarrier, /normalizeTask5TerminalCompletionContractInTransactionV1|settleV3TerminalRecoveryChainInTransaction|releaseRuntimeSessionForTerminalRunInTransactionV1|terminalize[A-Za-z0-9_$]*InTransactionV1|closeInternalProduction|enqueueOperationalOutboxEventInTransaction|(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s/i,
      "the delivery-pending barrier precedes every mutation-capable terminal helper and SQL statement while permitting prior locked reads");
    const insertionFence = /await\s+lockInternalProductionWorkflowRunInsertionFenceV1\(\s*sql\s*\)\s*;/.exec(preBarrier);
    const lockedRun = /SELECT\s+id\s*,[\s\S]*status[\s\S]*protocol[\s\S]*context[\s\S]*FROM\s+runs\s+WHERE\s+id\s*=\s*\$1\s+FOR\s+UPDATE/i.exec(preBarrier);
    assert.ok(insertionFence && lockedRun && insertionFence.index < lockedRun.index,
      "terminalization takes the shared recovery-run insertion fence before the run row, preserving persistence's global fence-to-owner-to-run lock order");
    assert.match(source, /import\s*\{[^}]*lockInternalProductionWorkflowRunInsertionFenceV1[^}]*\}\s*from\s*["']\.\.\/db-pg\.js["']/,
      "the terminal transition imports the exact shared insertion-fence lock instead of recreating a second lock domain");
    assert.match(preBarrier, /SELECT\s+id\s*,[\s\S]*status[\s\S]*protocol[\s\S]*context[\s\S]*FROM\s+runs\s+WHERE\s+id\s*=\s*\$1\s+FOR\s+UPDATE/i,
      "the terminal caller locks and retains the exact run identity, workflow state, protocol, and recovery context before invoking the barrier");
    assert.match(source.slice(transition, firstMutationCapableCall), /await\s+assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1\(\s*sql\s*,\s*\{[\s\S]*runId:\s*run\.id[\s\S]*workflowState:\s*run\.status[\s\S]*protocol:\s*run\.protocol[\s\S]*runContext:\s*run\.context[\s\S]*\}\s*\)\s*;/,
      "the pre-mutation barrier receives the exact already-locked run authority rather than a zero-argument ambient lookup");
    assert.match(source.slice(proof, ordinary + 500), /recoverySourceBootstrapTerminal === null/);
    assert.match(source, /if \(terminalPair !== null\) \{/);
    const dbSource = await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/db-pg.ts"), "utf8");
    assert.doesNotMatch(dbSource, /observeInternalProductionRecoverySourceBootstrapStatusV1/, "db-pg terminal proof cannot discover authority through the mutable zero-input status");
    assert.match(dbSource, /resolveInternalProductionRecoverySourceBootstrapRunReceiptV1/, "db-pg uses only the final pair-only run-receipt authority edge");
    const recoveryTerminalStart = dbSource.indexOf("export async function resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(");
    const recoveryTerminalEnd = dbSource.indexOf("export async function resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(", recoveryTerminalStart);
    assert.ok(recoveryTerminalStart >= 0 && recoveryTerminalEnd > recoveryTerminalStart);
    const recoveryTerminal = dbSource.slice(recoveryTerminalStart, recoveryTerminalEnd);
    assert.match(recoveryTerminal, /producer_implementation_id='a-recovery-source-bootstrap-run-v1'[\s\S]*category='run'[\s\S]*owner_key=\$\{input\.runId\}[\s\S]*state='closed'/,
      "the specialized terminal resolver admits only the exact recovery run after bootstrap has closed both H1 reservations");
    assert.doesNotMatch(recoveryTerminal, /state='bound'|\[\s*["']bound["']\s*\]/,
      "a bound H1 recovery run cannot be terminalized through the specialized closed-pair authority");
    const deliveryBarrierStart = dbSource.indexOf("export async function assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(");
    const deliveryBarrierEnd = dbSource.indexOf("\nexport ", deliveryBarrierStart + 1);
    assert.ok(deliveryBarrierStart >= 0 && deliveryBarrierEnd > deliveryBarrierStart,
      "db-pg exposes one exact bound-H1 delivery-pending barrier for run terminalization");
    const deliveryBarrier = dbSource.slice(deliveryBarrierStart, deliveryBarrierEnd);
    const staticFailures: string[] = [];
    const staticCheck = (label: string, check: () => void): void => {
      try {
        check();
      } catch (error) {
        staticFailures.push(`${label}: ${String(error)}`);
      }
    };
    assert.match(deliveryBarrier, /^export\s+async\s+function\s+assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1\(\s*sql:\s*InternalProductionPgTransactionSql\s*,\s*input:/,
      "the delivery-pending barrier consumes the terminal caller's existing locked transaction and authenticated run input");
    const migration32Gate = deliveryBarrier.indexOf("public.setfarm_schema_migrations");
    const insertionFenceLock = deliveryBarrier.indexOf("lockInternalProductionWorkflowRunInsertionFenceV1(sql)");
    assert.equal(migration32Gate >= 0 && insertionFenceLock > migration32Gate, true,
      "migration 32 journal presence is checked before recovery-only locking or catalog reads");
    assert.match(deliveryBarrier.slice(migration32Gate, insertionFenceLock), /WHERE\s+version\s*=\s*32[\s\S]*migrationRows\.length\s*===\s*0\s*\)\s*return/,
      "a migration-31 database bypasses only the unavailable recovery-source authority barrier");
    const ownerRowsBinding = /const\s+ownerRows\s*=\s*await/.exec(deliveryBarrier);
    const reservationRowsBinding = /const\s+reservationRows\s*=\s*await/.exec(deliveryBarrier);
    const expectedRunRowsBinding = /const\s+expectedRunRows\s*=\s*await/.exec(deliveryBarrier);
    const activeRunRowsBinding = /const\s+activeRunRows\s*=\s*await/.exec(deliveryBarrier);
    assert.ok(ownerRowsBinding && reservationRowsBinding && expectedRunRowsBinding && activeRunRowsBinding,
      "the locking adapter projects all four inventories before invoking the shared pure classifier");
    const serializationLock = /await\s+lockInternalProduction(?:RecoverySourceBootstrapRun|WorkflowRun)InsertionFenceV1\(\s*sql\s*\)\s*;/.exec(deliveryBarrier);
    assert.ok(serializationLock && serializationLock.index < ownerRowsBinding.index,
      "the READ COMMITTED terminal caller serializes recovery-run insertion before projecting any H1 owner/run inventory");
    assert.ok(ownerRowsBinding.index < reservationRowsBinding.index && reservationRowsBinding.index < expectedRunRowsBinding.index && expectedRunRowsBinding.index < activeRunRowsBinding.index,
      "the terminal adapter's locked projection has one explicit owner/reservation/durable/active order");
    const ownerRowsQuery = deliveryBarrier.slice(ownerRowsBinding.index, reservationRowsBinding.index);
    const reservationRowsQuery = deliveryBarrier.slice(reservationRowsBinding.index, expectedRunRowsBinding.index);
    const expectedRunRowsQuery = deliveryBarrier.slice(expectedRunRowsBinding.index, activeRunRowsBinding.index);
    const activeRunRowsQuery = deliveryBarrier.slice(activeRunRowsBinding.index);
    staticCheck("owner inventory query order", () => assert.match(ownerRowsQuery, /internal_production_owner_admission_head_v1[\s\S]*internal_production_owner_admission_authorities_v1/,
      "the terminal adapter projects H1 and the full immutable authority inventory"));
    assert.doesNotMatch(ownerRowsQuery, /internal_production_owner_admission_authorities_v1[\s\S]*\bWHERE\b/i,
      "the terminal adapter cannot hide an unrelated immutable authority before classification");
    assert.match(ownerRowsQuery, /internal_production_owner_admission_head_v1[\s\S]*FOR\s+UPDATE/i,
      "the terminal adapter locks the singleton owner-admission head generation before classification");
    assert.match(reservationRowsQuery, /FROM\s+(?:public\.)?internal_production_owner_reservations_v1/i,
      "the terminal adapter projects the nonclosed reservation inventory");
    assert.doesNotMatch(reservationRowsQuery, /(?:reservation_ref|reservation_hash|owner_key|producer_implementation_id)\s*=\s*\$\{/i,
      "the terminal reservation inventory cannot prefilter the expected owner or producer");
    assert.doesNotMatch(reservationRowsQuery, /\bWHERE\b[\s\S]*(?:reservation_ref|reservation_hash|owner_key|producer_implementation_id|category)\s*(?:=|IN\b)/i,
      "terminal projection may narrow lifecycle state but leaves every identity and category to the pure validator");
    assert.match(reservationRowsQuery, /FOR\s+UPDATE/i,
      "the terminal adapter locks the complete nonclosed reservation inventory it authenticates");
    assert.match(expectedRunRowsQuery, /FROM\s+(?:public\.)?runs[\s\S]*(?:id|run_id)\s*=\s*\$\{expectedRunId\}/i,
      "the terminal adapter performs one separate deterministic expected-run lookup");
    assert.match(expectedRunRowsQuery, /FOR\s+UPDATE/i,
      "the deterministic expected run remains locked from H1 classification through the refusal frontier");
    assert.match(activeRunRowsQuery, /FROM\s+(?:public\.)?runs[\s\S]*status\s+IN\s*\(\s*["']running["']\s*,\s*["']resuming["']\s*,\s*["']cancelling["']\s*,\s*["']failing["']\s*\)/i,
      "the terminal adapter's global active census filters only the canonical active statuses");
    assert.doesNotMatch(activeRunRowsQuery, /(?:id|run_id)\s*=\s*\$\{/i,
      "the terminal active census cannot prefilter unrelated active work by run id");
    const specialOwnerEvidenceBinding = deliveryBarrier.indexOf("const specialOwnerEvidence");
    const expectedRunIdBinding = deliveryBarrier.indexOf("const expectedRunId");
    staticCheck("ordinary discriminator before deterministic run id", () => assert.ok(
      specialOwnerEvidenceBinding > reservationRowsBinding.index
      && expectedRunIdBinding > specialOwnerEvidenceBinding
      && expectedRunRowsBinding.index > expectedRunIdBinding
      && activeRunRowsBinding.index > expectedRunRowsBinding.index,
      "the ordinary-run discriminator consumes the unfiltered owner inventory before deriving a recovery-only deterministic run id"));
    const specialOwnerEvidenceRegion = deliveryBarrier.slice(
      specialOwnerEvidenceBinding,
      deliveryBarrier.indexOf("const specialContext", specialOwnerEvidenceBinding),
    );
    staticCheck("exact specialized run discriminator", () => assert.match(specialOwnerEvidenceRegion, /producerImplementationId\s*===\s*["']a-recovery-source-bootstrap-run-v1["'][\s\S]*category\s*===\s*["']run["'][\s\S]*ownerKey\s*===\s*input\.runId/,
      "only the exact specialized run reservation for the locked run marks terminalization as recovery-owned"));
    staticCheck("source history is not a special-run discriminator", () => assert.doesNotMatch(specialOwnerEvidenceRegion, /a-recovery-source-run-v1/,
      "a source reservation or closed recovery history for another run cannot poison an ordinary run discriminator"));
    const reconstructedOperationBinding = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*Object\.freeze\(\s*\{([\s\S]*?)\}\s*\)\s*;/.exec(deliveryBarrier.slice(activeRunRowsBinding.index));
    staticCheck("reconstructed operation binding", () => assert.ok(reconstructedOperationBinding,
      "the terminal adapter reconstructs one immutable recovery operation from locked expected-run and H1 owner truth"));
    const reconstructedOperationAlias = reconstructedOperationBinding?.[1] ?? "__missing_reconstructed_operation__";
    const reconstructedOperation = reconstructedOperationBinding?.[2] ?? "";
    for (const field of [
      "purpose", "repository", "workflow", "protocol", "promptManifestHash", "pendingInputRef", "pendingInputHash",
      "baseSourceSha", "baseSourceTreeHash", "buildHash", "activationPreflightHash", "releaseAdmissionHash",
      "targetSourceRunReservationRef", "targetSourceRunReservationHash", "targetRunReservationRef", "targetRunReservationHash",
      "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "startIntentRef", "startIntentHash",
      "startOutboxRef", "startOutboxHash", "operationRef", "operationHash",
    ] as const) staticCheck(`reconstructed operation field ${field}`, () => assert.match(reconstructedOperation, new RegExp(`\\b${field}\\b`), `${field}: terminal H1 reconstruction retains the complete immutable recovery operation body`));
    staticCheck("reconstructed operation input domains", () => assert.match(reconstructedOperation, /(?=[\s\S]*expectedRunContext)(?=[\s\S]*(?:ownerRows|activeFence|fence))(?=[\s\S]*(?:reservationRows|sourceReservation|runReservation))[\s\S]*/,
      "terminal authority reconstruction cross-binds exact durable context, H1 fence, and both specialized reservations"));
    const operationAuthorityBinding = new RegExp(`const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1\\(\\s*${reconstructedOperationAlias}\\s*\\)\\s*;`).exec(deliveryBarrier);
    staticCheck("operation authority constructor", () => assert.ok(operationAuthorityBinding,
      "the terminal adapter validates its reconstructed operation body/ref/hash through the same pure authority constructor as held resume"));
    const operationAuthorityAlias = operationAuthorityBinding?.[1] ?? "__missing_operation_authority__";
    const projectedRowsBinding = new RegExp(`const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*projectRecoverySourceBootstrapPersistenceRowsV1\\(\\s*${operationAuthorityAlias}\\s*,\\s*ownerRows\\s*,\\s*reservationRows\\s*\\)\\s*;`).exec(deliveryBarrier);
    staticCheck("unconditional raw-row projector", () => assert.ok(projectedRowsBinding,
      "the terminal adapter always enriches its raw SQL-shaped owner and reservation rows before pure classification"));
    staticCheck("no projected-row accommodation", () => assert.doesNotMatch(deliveryBarrier, /rowsContainPhysicalAuthorityBodies|ownerRowsAlreadyProjected|reservationRowsAlreadyProjected/,
      "production terminal classification cannot bypass raw-row enrichment for a test-shaped input"));
    const projectedRowsAlias = projectedRowsBinding?.[1] ?? "__missing_projected_rows__";
    staticCheck("released disposition and active or pair-closed refusal", () => assert.match(deliveryBarrier, new RegExp(`const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1\\(\\s*\\{[\\s\\S]*recoveryState:\\s*["']prepared["'][\\s\\S]*recoveryOperationAuthority:\\s*${operationAuthorityAlias}[\\s\\S]*ownerRows:\\s*${projectedRowsAlias}\\.ownerRows[\\s\\S]*reservationRows:\\s*${projectedRowsAlias}\\.reservationRows[\\s\\S]*expectedRunRows[\\s\\S]*activeRunRows[\\s\\S]*\\}\\s*\\)\\s*;[\\s\\S]*\\1\\.state\\s*===?\\s*["']released["'][\\s\\S]*return[\\s\\S]*\\1\\.state\\s*!==?\\s*["']active["'][\\s\\S]*&&[\\s\\S]*\\1\\.state\\s*!==?\\s*["']pair_closed["'][\\s\\S]*RECOVERY_SOURCE_BOOTSTRAP_TERMINAL_OWNER_CORRUPTION[\\s\\S]*throw\\s+new\\s+Error\\(\\s*["']RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING["']\\s*\\)`),
      "terminalization returns only for pure H4 released authority, refuses exact H1 active and H3 pair-closed authority with the same retryable delivery-pending code, and classifies every other state as corruption"));
    staticCheck("no head-version return alias", () => assert.doesNotMatch(deliveryBarrier, /Number\(\s*owner\.headVersion\s*\)\s*===?\s*4[\s\S]*return/,
      "an unvalidated head-version alias cannot bypass the pure released disposition"));
    assert.match(dbSource, /import\s*\{(?=[^}]*createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1)(?=[^}]*requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1)[^}]*\}\s*from\s*["']\.\/execution\/recovery-source-bootstrap-run-authority-v1\.js["']/,
      "the terminal and read-only database adapters share the exact authority constructor and validator import");
    assert.doesNotMatch(deliveryBarrier, /sql(?:<[^`>]*>)?\s*`\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b|closeInternalProduction|releaseInternalProduction/i,
      "the bound-H1 barrier is a strictly read-only precondition, never an ordinary close path");
    assert.deepEqual(staticFailures, [], `terminal barrier static contract failures:\n${staticFailures.join("\n")}`);
  });

  it("P4 recovery source bootstrap delivery barrier executes its unfiltered locked SQL adapter", async () => {
    const databaseSource = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
    const marker = "export async function assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(";
    const start = databaseSource.indexOf(marker);
    assert.ok(start >= 0, "db-pg exports the bound-H1 terminal delivery barrier");
    const end = databaseSource.indexOf("\nexport ", start + marker.length);
    assert.ok(end > start, "the terminal delivery barrier has one bounded copied-body region");
    const barrier = databaseSource.slice(start, end);
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-recovery-delivery-barrier-"));
    try {
      const modulePath = path.join(fixture, "barrier.ts");
      writeFileSync(modulePath, `
const g=globalThis as any;
type InternalProductionPgTransactionSql=any;
type InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1=any;
const isExactAppliedBootstrapMainClaimHandoffMigration32JournalRowV1=(value:any)=>value?.version===32&&value?.name==="contract-spine-bootstrap-main-claim-handoff-v1"&&value?.checksum==="d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d"&&value?.state==="applied";
const same=(left:any,right:any)=>JSON.stringify(left)===JSON.stringify(right);
const sameJsonValueV1=same;
const hashCanonicalJson=(value:any)=>{g.__p4BarrierHashInputs.push(value);if(value?.schema==="setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1"){if(value.pendingInputRef===undefined||value.pendingInputHash===undefined)throw new Error("RECOVERY_ONLY_HASH_INPUT_INVALID");return g.__p4BarrierInput.runId}return JSON.stringify(value)};
const canonicalJsonStringify=(value:any)=>JSON.stringify(value);
const strictCanonicalText=(value:string)=>JSON.parse(value);
const currentEntryFail=(message:string):never=>{throw new Error(message)};
const lockInternalProductionWorkflowRunInsertionFenceV1=async(sql:any)=>{if(sql!==g.__p4BarrierSql)throw new Error("BARRIER_LOCK_SQL_CROSSED");g.__p4BarrierEvents.push("lock")};
const lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1=lockInternalProductionWorkflowRunInsertionFenceV1;
const createInternalProductionRecoverySourceBootstrapRunOperationAuthorityV1=(value:any)=>{g.__p4BarrierEvents.push("authority");if(!same(value,g.__p4BarrierOperation))throw new Error("RECOVERY_SOURCE_BOOTSTRAP_OPERATION_AUTHORITY_CROSSED");g.__p4BarrierOperationAuthority=value;return value};
const projectRecoverySourceBootstrapPersistenceRowsV1=(operation:any,ownerRows:any,reservationRows:any)=>{g.__p4BarrierEvents.push("project");if(operation!==g.__p4BarrierOperationAuthority||ownerRows!==g.__p4BarrierRows.ownerRows||reservationRows!==g.__p4BarrierRows.reservationRows)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BARRIER_PROJECTION_CROSSED");return Object.freeze({ownerRows,reservationRows})};
const requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1=(input:any)=>{
  g.__p4BarrierEvents.push("validate");
  if(input.recoveryOperationAuthority!==g.__p4BarrierOperationAuthority||input.ownerRows!==g.__p4BarrierRows.ownerRows||input.reservationRows!==g.__p4BarrierRows.reservationRows||input.expectedRunRows!==g.__p4BarrierRows.expectedRunRows||input.activeRunRows!==g.__p4BarrierRows.activeRunRows)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BARRIER_ROWS_CROSSED");
  const authority=input.recoveryOperationAuthority;
  if(input.ownerRows.length===1&&input.ownerRows[0].headVersion===3){
    if(input.ownerRows[0].headHash!=="3".repeat(64)||input.ownerRows[0].activeFenceRef!==authority.ownerAdmissionFenceRef||input.ownerRows[0].activeFenceHash!==authority.ownerAdmissionFenceHash||input.ownerRows[0].allAuthorityRows.length!==7||input.reservationRows.length!==2||input.reservationRows.some((row:any)=>row.state!=="closed")||input.expectedRunRows.length!==1||input.expectedRunRows[0].id!==g.__p4BarrierInput.runId||input.expectedRunRows[0].context!==g.__p4BarrierInput.runContext||input.activeRunRows.length!==1||input.activeRunRows[0]!==input.expectedRunRows[0])throw new Error("RECOVERY_SOURCE_BOOTSTRAP_PAIR_CLOSED_OWNER_CROSSED");
    return {state:"pair_closed",workflowState:input.expectedRunRows[0].status,runId:g.__p4BarrierInput.runId,operationRunBindingHash:g.__p4BarrierContext.operationRunBindingHash,reciprocalRunOperationBindingHash:g.__p4BarrierContext.reciprocalRunOperationBindingHash,terminalOwnerRef:"setfarm://tests/p4/terminal-owner",terminalOwnerHash:"0".repeat(64),terminalSourceRunRef:"setfarm://tests/p4/terminal-source",terminalSourceRunHash:"1".repeat(64),terminalRunLaunchRef:"setfarm://tests/p4/terminal-run",terminalRunLaunchHash:"2".repeat(64),targetReservationPairCloseRef:"setfarm://tests/p4/pair-close",targetReservationPairCloseHash:"3".repeat(64)};
  }
  if(input.ownerRows.length===1&&input.ownerRows[0].headVersion===4){
    if(input.ownerRows[0].activeFenceRef!==null||input.ownerRows[0].activeFenceHash!==null||input.ownerRows[0].allAuthorityRows.length!==8||input.reservationRows.length!==2||input.reservationRows.some((row:any)=>row.state!=="closed")||input.expectedRunRows.length!==1||input.expectedRunRows[0].id!==g.__p4BarrierInput.runId||input.expectedRunRows[0].context!==g.__p4BarrierInput.runContext||input.activeRunRows.length!==1||input.activeRunRows[0]!==input.expectedRunRows[0])throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLOSED_OWNER_CROSSED");
    return {state:"released",workflowState:input.expectedRunRows[0].status,runId:g.__p4BarrierInput.runId,operationRunBindingHash:g.__p4BarrierContext.operationRunBindingHash,reciprocalRunOperationBindingHash:g.__p4BarrierContext.reciprocalRunOperationBindingHash,terminalOwnerRef:"setfarm://tests/p4/terminal-owner",terminalOwnerHash:"0".repeat(64),terminalSourceRunRef:"setfarm://tests/p4/terminal-source",terminalSourceRunHash:"1".repeat(64),terminalRunLaunchRef:"setfarm://tests/p4/terminal-run",terminalRunLaunchHash:"2".repeat(64),targetReservationPairCloseRef:"setfarm://tests/p4/pair-close",targetReservationPairCloseHash:"3".repeat(64),fenceReleaseRef:"setfarm://tests/p4/release",fenceReleaseHash:"4".repeat(64),sourceRunRef:"setfarm://tests/p4/receipt",sourceRunHash:"5".repeat(64)};
  }
  if(input.ownerRows.length!==1||input.ownerRows[0].headVersion!==1||input.ownerRows[0].headHash!==authority.ownerAdmissionFenceHash||input.ownerRows[0].activeFenceRef!==authority.ownerAdmissionFenceRef||input.ownerRows[0].activeFenceHash!==authority.ownerAdmissionFenceHash)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BOUND_OWNER_HEAD_CROSSED");
  const authorityRows=input.ownerRows[0].allAuthorityRows;
  if(authorityRows.length!==5||authorityRows[0].authorityRef!==authority.ownerAdmissionFenceRef||authorityRows[0].authorityHash!==authority.ownerAdmissionFenceHash||authorityRows[1].authorityRef!==authority.targetSourceRunReservationRef||authorityRows[1].authorityHash!==authority.targetSourceRunReservationHash||authorityRows[2].authorityRef!==authority.targetRunReservationRef||authorityRows[2].authorityHash!==authority.targetRunReservationHash||authorityRows[3].authorityKind!=="binding"||authorityRows[4].authorityKind!=="binding")throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BOUND_AUTHORITY_CROSSED");
  if(input.reservationRows.length!==2||input.reservationRows[0].state!=="bound"||input.reservationRows[0].reservationRef!==authority.targetSourceRunReservationRef||input.reservationRows[0].reservationHash!==authority.targetSourceRunReservationHash||input.reservationRows[1].state!=="bound"||input.reservationRows[1].reservationRef!==authority.targetRunReservationRef||input.reservationRows[1].reservationHash!==authority.targetRunReservationHash)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BOUND_RESERVATION_CROSSED");
  if(input.expectedRunRows.length!==1||input.expectedRunRows[0].id!==g.__p4BarrierInput.runId||input.expectedRunRows[0].context!==g.__p4BarrierInput.runContext||input.activeRunRows.length!==1||input.activeRunRows[0]!==input.expectedRunRows[0])throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BOUND_RUN_CROSSED");
  return {state:"active",workflowState:"running",runId:g.__p4BarrierInput.runId,operationRunBindingHash:g.__p4BarrierContext.operationRunBindingHash,reciprocalRunOperationBindingHash:g.__p4BarrierContext.reciprocalRunOperationBindingHash};
};
${barrier}
`, "utf8");
      const kernel = await import(`${pathToFileURL(modulePath).href}?barrier=${Date.now()}`) as any;
      const runtimeFailures: string[] = [];
      const runtimeCheck = (label: string, check: () => void): void => {
        try {
          check();
        } catch (error) {
          runtimeFailures.push(`${label}: ${String(error)}`);
        }
      };
      const sha = (member: string): string => member.repeat(64);
      const runId = sha("6");
      const operation = Object.freeze({
        schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1", purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3", promptManifestHash: sha("1"),
        pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: sha("2"), baseSourceSha: "3".repeat(40), baseSourceTreeHash: "4".repeat(40), buildHash: sha("5"), activationPreflightHash: sha("6"), releaseAdmissionHash: sha("7"),
        targetSourceRunReservationRef: "setfarm://tests/p4/source-reservation", targetSourceRunReservationHash: sha("8"), targetRunReservationRef: "setfarm://tests/p4/run-reservation", targetRunReservationHash: sha("9"), targetRunLaunchCompositeHash: sha("a"),
        ownerAdmissionFenceRef: "setfarm://tests/p4/fence", ownerAdmissionFenceHash: sha("b"), startIntentRef: "setfarm://tests/p4/intent", startIntentHash: sha("c"), startOutboxRef: "setfarm://tests/p4/outbox", startOutboxHash: sha("d"),
        operationRef: "setfarm://tests/p4/recovery-operation", operationHash: sha("e"),
      });
      const context = Object.freeze({ ...operation, schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1", operationRunBindingHash: sha("f"), reciprocalRunOperationBindingHash: sha("1") });
      const authorityRows = Object.freeze([
        Object.freeze({ authorityRef: operation.ownerAdmissionFenceRef, authorityHash: operation.ownerAdmissionFenceHash, authorityKind: "fence", predecessorHeadHash: sha("0"), successorHeadHash: operation.ownerAdmissionFenceHash }),
        Object.freeze({ authorityRef: operation.targetSourceRunReservationRef, authorityHash: operation.targetSourceRunReservationHash, authorityKind: "reservation", predecessorHeadHash: sha("0"), successorHeadHash: operation.ownerAdmissionFenceHash }),
        Object.freeze({ authorityRef: operation.targetRunReservationRef, authorityHash: operation.targetRunReservationHash, authorityKind: "reservation", predecessorHeadHash: sha("0"), successorHeadHash: operation.ownerAdmissionFenceHash }),
        Object.freeze({ authorityRef: "setfarm://tests/p4/source-binding", authorityHash: sha("1"), authorityKind: "binding", phaseKey: operation.targetSourceRunReservationRef, predecessorHeadHash: operation.ownerAdmissionFenceHash, successorHeadHash: operation.ownerAdmissionFenceHash }),
        Object.freeze({ authorityRef: "setfarm://tests/p4/run-binding", authorityHash: sha("2"), authorityKind: "binding", phaseKey: operation.targetRunReservationRef, predecessorHeadHash: operation.ownerAdmissionFenceHash, successorHeadHash: operation.ownerAdmissionFenceHash }),
      ]);
      const ownerRows = Object.freeze([Object.freeze({ headVersion: 1, headHash: operation.ownerAdmissionFenceHash, activeFenceRef: operation.ownerAdmissionFenceRef, activeFenceHash: operation.ownerAdmissionFenceHash, allAuthorityRows: authorityRows })]);
      const reservationRows = Object.freeze([
        Object.freeze({ category: "source-run", state: "bound", producerImplementationId: "a-recovery-source-run-v1", reservationRef: operation.targetSourceRunReservationRef, reservationHash: operation.targetSourceRunReservationHash, ownerKey: "source" }),
        Object.freeze({ category: "run", state: "bound", producerImplementationId: "a-recovery-source-bootstrap-run-v1", reservationRef: operation.targetRunReservationRef, reservationHash: operation.targetRunReservationHash, ownerKey: runId }),
      ]);
      const run = Object.freeze({ id: runId, runId, status: "running", state: "running", protocol: "v3", context: JSON.stringify(context), runContext: context });
      const baseRows = Object.freeze({ ownerRows, reservationRows, expectedRunRows: Object.freeze([run]), activeRunRows: Object.freeze([run]) });
      const input = Object.freeze({ runId, workflowState: "running", protocol: "v3", runContext: JSON.stringify(context) });
      const execute = async (rows: Readonly<Record<string, unknown>>, barrierInput: Readonly<Record<string, unknown>> = input, expectedOperation: Readonly<Record<string, unknown>> = operation): Promise<Readonly<{ outcome: string; message: string | null; events: readonly string[]; queries: readonly string[]; hashInputs: readonly unknown[] }>> => {
        const queries: string[] = [];
        const query = async (stringsOrQuery: TemplateStringsArray | string): Promise<unknown> => {
          const text = typeof stringsOrQuery === "string" ? stringsOrQuery : stringsOrQuery.join("?");
          queries.push(text);
          const normalized = text.replace(/\/\*[\s\S]*?\*\//g, " ").trimStart();
          if (/^(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(normalized)) throw new Error("BARRIER_WRITE_ATTEMPTED");
          if (/setfarm_schema_migrations/i.test(text) && /version\s*=\s*32/i.test(text)) return [AUTHENTIC_MIGRATION_32_JOURNAL_ROW];
          if (/internal_production_owner_reservations_v1/i.test(text)) return rows.reservationRows;
          if (/internal_production_owner_admission_(?:head|authorities)_v1/i.test(text)) return rows.ownerRows;
          if (/FROM\s+(?:public\.)?runs/i.test(text) && /running[\s\S]*resuming[\s\S]*cancelling[\s\S]*failing/i.test(text)) return rows.activeRunRows;
          if (/FROM\s+(?:public\.)?runs/i.test(text)) return rows.expectedRunRows;
          throw new Error(`UNEXPECTED_BARRIER_SQL:${text}`);
        };
        const sql = Object.assign(query, { unsafe: query });
        const barrierContext = typeof barrierInput.runContext === "string" ? JSON.parse(barrierInput.runContext) : barrierInput.runContext;
        Object.assign(globalThis as any, { __p4BarrierSql: sql, __p4BarrierEvents: [], __p4BarrierHashInputs: [], __p4BarrierRows: rows, __p4BarrierOperation: expectedOperation, __p4BarrierOperationAuthority: null, __p4BarrierInput: barrierInput, __p4BarrierContext: barrierContext });
        let outcome = "returned", message: string | null = null;
        try { await kernel.assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(sql, barrierInput); }
        catch (error) { outcome = "threw"; message = String(error); }
        return Object.freeze({ outcome, message, events: Object.freeze([...(globalThis as any).__p4BarrierEvents]), queries: Object.freeze(queries), hashInputs: Object.freeze([...(globalThis as any).__p4BarrierHashInputs]) });
      };
      const exact = await execute(baseRows);
      runtimeCheck("exact H1", () => {
        assert.equal(exact.outcome, "threw");
        assert.match(String(exact.message), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING/);
        assert.deepEqual(exact.events, ["lock", "authority", "project", "validate"], "exact H1 serializes, reconstructs, enriches the raw rows, and validates before its delivery-pending refusal");
        assert.equal(exact.queries.every((query) => !/^(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(query.replace(/\/\*[\s\S]*?\*\//g, " ").trimStart())), true, "the real barrier body issues no write SQL while retaining its SELECT FOR UPDATE locks");
      });
      const crossedContextRun = Object.freeze({ ...run, context: JSON.stringify({ ...context, buildHash: sha("9") }) });
      for (const crossed of [
        Object.freeze({ label: "context", expectedEvents: Object.freeze(["lock"]), rows: Object.freeze({ ...baseRows, expectedRunRows: Object.freeze([crossedContextRun]), activeRunRows: Object.freeze([crossedContextRun]) }) }),
        Object.freeze({ label: "fence", expectedEvents: Object.freeze(["lock", "authority"]), rows: Object.freeze({ ...baseRows, ownerRows: Object.freeze([Object.freeze({ ...ownerRows[0]!, activeFenceHash: sha("9") })]) }) }),
        Object.freeze({ label: "reservation", expectedEvents: Object.freeze(["lock", "authority"]), rows: Object.freeze({ ...baseRows, reservationRows: Object.freeze([Object.freeze({ ...reservationRows[0]!, reservationHash: sha("9") }), reservationRows[1]!]) }) }),
      ]) {
        const result = await execute(crossed.rows);
        runtimeCheck(`crossed H1 ${crossed.label}`, () => {
          assert.equal(result.outcome, "threw", `${crossed.label}: crossed locked H1 evidence is terminal`);
          assert.deepEqual(result.events, crossed.expectedEvents,
            `${crossed.label}: caller/SQL context is rejected before reconstruction, while fence/reservation crossings are rejected by the reconstructed retained pair`);
          assert.equal(result.events.includes("project") || result.events.includes("validate"), false,
            `${crossed.label}: no crossed H1 input reaches row projection or pure classification`);
          assert.doesNotMatch(String(result.message), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING$/,
            `${crossed.label}: corruption remains primary over the valid delivery-pending disposition`);
          assert.doesNotMatch(String(result.message), /BARRIER_WRITE_ATTEMPTED/,
            `${crossed.label}: rejection is caused by the crossed read authority, not a hidden adapter mutation`);
        });
      }
      const crossedSpecialInput = Object.freeze({
        ...input,
        runContext: JSON.stringify(Object.freeze({ schema: "setfarm.workflow-run-context.v1", task: "ordinary feature run", purpose: "ordinary-feature-delivery" })),
      });
      const crossedSpecial = await execute(baseRows, crossedSpecialInput);
      runtimeCheck("crossed special discriminator", () => {
        assert.equal(crossedSpecial.outcome, "threw",
          "exact special H1 owner/reservation evidence dominates a corrupted ordinary-looking run context and cannot fall through");
        assert.match(String(crossedSpecial.message), /CORRUPTION|INVALID|CROSSED|AUTHORITY|OWNER|RUN/i);
        assert.doesNotMatch(String(crossedSpecial.message), /BARRIER_WRITE_ATTEMPTED|RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING$/,
          "the corrupted special discriminator remains the read-authority primary without mutation or a valid H1 disposition");
      });
      const partial = await execute(Object.freeze({ ...baseRows, reservationRows: Object.freeze([reservationRows[0]!]) }));
      runtimeCheck("partial H1 reservation inventory", () => {
        assert.equal(partial.outcome, "threw");
        assert.match(String(partial.message), /CORRUPTION|INVALID|CROSSED/i);
        assert.doesNotMatch(String(partial.message), /BARRIER_WRITE_ATTEMPTED/);
      });
      const h4AuthorityRows = Object.freeze([
        ...authorityRows,
        Object.freeze({ authorityRef: "setfarm://tests/p4/source-close", authorityHash: sha("3"), authorityKind: "close", predecessorHeadHash: operation.ownerAdmissionFenceHash, successorHeadHash: sha("2") }),
        Object.freeze({ authorityRef: "setfarm://tests/p4/run-close", authorityHash: sha("4"), authorityKind: "close", predecessorHeadHash: sha("2"), successorHeadHash: sha("3") }),
        Object.freeze({ authorityRef: "setfarm://tests/p4/release", authorityHash: sha("5"), authorityKind: "release", predecessorHeadHash: sha("3"), successorHeadHash: sha("4") }),
      ]);
      const h3AuthorityRows = Object.freeze(h4AuthorityRows.slice(0, -1));
      const h3Rows = Object.freeze({
        ...baseRows,
        ownerRows: Object.freeze([Object.freeze({ headVersion: 3, headHash: sha("3"), activeFenceRef: operation.ownerAdmissionFenceRef, activeFenceHash: operation.ownerAdmissionFenceHash, allAuthorityRows: h3AuthorityRows })]),
        reservationRows: Object.freeze(reservationRows.map((row) => Object.freeze({ ...row, state: "closed" }))),
      });
      const h3 = await execute(h3Rows);
      runtimeCheck("exact H3", () => {
        assert.equal(h3.outcome, "threw", "exact H3 remains retryable until resume durably releases its retained fence");
        assert.match(String(h3.message), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING/);
        assert.deepEqual(h3.events, ["lock", "authority", "project", "validate"],
          "H3 is refused only after the real locked adapter enriches and validates the exact pair-closed authority");
        assert.equal(h3.queries.every((query) => !/^(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(query.replace(/\/\*[\s\S]*?\*\//g, " ").trimStart())), true,
          "the exact H3 retry refusal performs no database mutation");
      });
      const crossedH3 = await execute(Object.freeze({
        ...h3Rows,
        ownerRows: Object.freeze([Object.freeze({ ...h3Rows.ownerRows[0]!, allAuthorityRows: Object.freeze(h3AuthorityRows.slice(0, -1)) })]),
      }));
      runtimeCheck("crossed H3", () => {
        assert.equal(crossedH3.outcome, "threw", "partial H3 authority is corruption, never an ordinary or retryable terminal path");
        assert.match(String(crossedH3.message), /CORRUPTION|INVALID|CROSSED|MISSING/i);
        assert.doesNotMatch(String(crossedH3.message), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING$/,
          "only the exact pair-closed H3 disposition receives the retryable delivery-pending code");
        assert.deepEqual(crossedH3.events, ["lock", "authority", "project", "validate"]);
        assert.equal(crossedH3.queries.every((query) => !/^(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(query.replace(/\/\*[\s\S]*?\*\//g, " ").trimStart())), true);
      });
      const h4Rows = Object.freeze({
        ...baseRows,
        ownerRows: Object.freeze([Object.freeze({ headVersion: 4, headHash: sha("4"), activeFenceRef: null, activeFenceHash: null, allAuthorityRows: h4AuthorityRows })]),
        reservationRows: Object.freeze(reservationRows.map((row) => Object.freeze({ ...row, state: "closed" }))),
      });
      const h4 = await execute(h4Rows);
      runtimeCheck("exact H4", () => {
        assert.equal(h4.outcome, "returned", `exact H4 closed owner bypasses the H1 barrier (${String(h4.message)})`);
        assert.deepEqual(h4.events, ["lock", "authority", "project", "validate"],
          "H4 returns only after the same raw-row enrichment and pure released classification");
      });
      for (const crossedH4 of [
        Object.freeze({ ...h4Rows, ownerRows: Object.freeze([Object.freeze({ ...h4Rows.ownerRows[0]!, allAuthorityRows: Object.freeze(h4AuthorityRows.slice(0, 7)) })]) }),
        Object.freeze({ ...h4Rows, reservationRows: Object.freeze([Object.freeze({ ...reservationRows[0]!, state: "bound" }), h4Rows.reservationRows[1]!]) }),
      ]) {
        const result = await execute(crossedH4);
        runtimeCheck("crossed H4 authority", () => {
          assert.equal(result.outcome, "threw", "a special recovery run with partial H4 authority cannot fall through to ordinary terminal ownership");
          assert.match(String(result.message), /CORRUPTION|INVALID|CROSSED|MISSING/i);
          assert.doesNotMatch(String(result.message), /BARRIER_WRITE_ATTEMPTED/);
        });
      }
      const ordinaryContext = Object.freeze({ schema: "setfarm.workflow-run-context.v1", task: "ordinary-feature-run", repository: "setfarm" });
      const ordinaryInput = Object.freeze({ runId, workflowState: "running", protocol: "v3", runContext: JSON.stringify(ordinaryContext) });
      const ordinaryRun = Object.freeze({ ...run, context: ordinaryInput.runContext, runContext: ordinaryContext });
      const unrelatedRecoveryRunId = sha("7");
      const ordinaryOwnerRows = h4Rows.ownerRows;
      const ordinaryReservationRows = Object.freeze([
        h4Rows.reservationRows[0]!,
        Object.freeze({ ...h4Rows.reservationRows[1]!, ownerKey: unrelatedRecoveryRunId }),
      ]);
      const ordinary = await execute(Object.freeze({ ownerRows: ordinaryOwnerRows, reservationRows: ordinaryReservationRows, expectedRunRows: Object.freeze([ordinaryRun]), activeRunRows: Object.freeze([ordinaryRun]) }), ordinaryInput);
      runtimeCheck("ordinary run discriminator", () => {
        assert.equal(ordinary.outcome, "returned", `a non-special ordinary run remains eligible for its ordinary terminal owner (${String(ordinary.message)})`);
        assert.deepEqual(ordinary.events, ["lock"],
          "the ordinary discriminator reads global owner truth but never reconstructs, projects, or validates a recovery authority");
        assert.deepEqual(ordinary.hashInputs, [],
          "an ordinary run exits before deriving a recovery-only deterministic id from its intentionally absent recovery context");
      });
      assert.deepEqual(runtimeFailures, [], `terminal barrier runtime contract failures:\n${runtimeFailures.join("\n")}`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("P4 recovery source bootstrap persistence classifier enriches raw H1 and H4 SQL rows before validation", async () => {
    const databaseSource = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
    const projectionStart = databaseSource.indexOf("type RecoverySourceBootstrapOwnerProjectionRowV1");
    const classifierStart = databaseSource.indexOf("export async function classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1(", projectionStart);
    const classifierEnd = databaseSource.indexOf("\nexport async function assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(", classifierStart);
    assert.ok(projectionStart >= 0 && classifierStart > projectionStart && classifierEnd > classifierStart,
      "the raw-row projector and exported classifier form one bounded copied-source region");
    const copiedProjectionAndClassifier = databaseSource.slice(projectionStart, classifierEnd);
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-recovery-persistence-projection-"));
    try {
      const modulePath = path.join(fixture, "projection.ts");
      const canonicalJsonUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/product-compiler/canonical-json.ts")).href;
      const ownerAdmissionUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/internal-production/owner-admission-v1.ts")).href;
      writeFileSync(modulePath, `
import { hashCanonicalJson } from ${JSON.stringify(canonicalJsonUrl)};
import { validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1 } from ${JSON.stringify(ownerAdmissionUrl)};
const g=globalThis as any;
const OWNER_ADMISSION_REF_V1=new RegExp("^setfarm://[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$");
const OWNER_ADMISSION_SHA256_V1=/^[0-9a-f]{64}$/;
type InternalProductionPgTransactionSql=any;
type InternalProductionRecoverySourceBootstrapRunOperationAuthorityV1=any;
type InternalProductionRecoverySourceBootstrapRunPersistenceV1=any;
const requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1=(input:any)=>{
  g.__p4ProjectionEvents.push("validate");
  const expected=g.__p4ProjectionExpected;
  const owner=input.ownerRows[0];
  if(input.recoveryOperationAuthority!==g.__p4ProjectionOperation||input.ownerRows.length!==1||owner.unrelatedAuthorityCount!==0)throw new Error("RAW_PROJECTION_OWNER_CROSSED");
  if(owner.headVersion!==expected.version||owner.headHash!==expected.headHash||owner.headActiveFenceRef!==expected.activeFenceRef||owner.headActiveFenceHash!==expected.activeFenceHash)throw new Error("RAW_PROJECTION_HEAD_ALIAS_CROSSED");
  if(owner.headHistory.length!==expected.headHashes.length||owner.headHistory.some((head:any,index:number)=>head.headHash!==expected.headHashes[index]))throw new Error("RAW_PROJECTION_HEAD_HISTORY_CROSSED");
  const expectedAuthorityRows=expected.authorityRows??g.__p4ProjectionRows.ownerRows[0].allAuthorityRows;
  const expectedReservationRows=expected.reservationRows??g.__p4ProjectionRows.reservationRows;
  if(owner.authorityHistory.length!==expected.authorityHistoryLength||JSON.stringify(owner.allAuthorityRows)!==JSON.stringify(expectedAuthorityRows))throw new Error("RAW_PROJECTION_AUTHORITY_HISTORY_CROSSED");
  if(input.reservationRows.length!==expectedReservationRows.length||input.reservationRows.some((row:any,index:number)=>row.reservationRef!==expectedReservationRows[index].reservationRef||row.reservationHash!==expectedReservationRows[index].reservationHash||row.authorityRef!==expectedReservationRows[index].reservationRef||row.authorityHash!==expectedReservationRows[index].reservationHash||row.authorityBody!==g.__p4ProjectionRows.ownerRows[0].allAuthorityRows.find((authority:any)=>authority.authorityRef===row.reservationRef).authorityBody))throw new Error("RAW_PROJECTION_RESERVATION_AUTHORITY_CROSSED");
  if(expected.version>=3&&input.reservationRows.some((row:any)=>row.closeAuthority?.authorityRef!==row.closeRef||row.closeAuthority?.authorityHash!==row.closeHash))throw new Error("RAW_PROJECTION_CLOSE_AUTHORITY_CROSSED");
  if(JSON.stringify(input.expectedRunRows)!==JSON.stringify(g.__p4ProjectionExpectedRunRows)||JSON.stringify(input.activeRunRows)!==JSON.stringify(g.__p4ProjectionActiveRunRows))throw new Error("RAW_PROJECTION_RUN_ROWS_CROSSED");
  return g.__p4ProjectionDisposition;
};
${copiedProjectionAndClassifier}
`, "utf8");
      const kernel = await import(`${pathToFileURL(modulePath).href}?projection=${Date.now()}`) as any;
      const sha = (member: string): string => member.repeat(64);
      const migrationApplicationBody = Object.freeze({
        schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1",
        evidenceHash: sha("1"),
        authorizationRef: "setfarm://tests/p4/migration-authorization",
        authorizationHash: sha("2"),
        authorizationConsumptionRef: "setfarm://tests/p4/migration-consumption",
        authorizationConsumptionHash: sha("3"),
      });
      const migrationApplication = Object.freeze({ ...migrationApplicationBody, applicationHash: hashCanonicalJson(migrationApplicationBody) });
      const sourceReservationRef = "setfarm://internal-production/owner-reservations/" + sha("4");
      const sourceReservationHash = sha("4");
      const runReservationRef = "setfarm://internal-production/owner-reservations/" + sha("5");
      const runReservationHash = sha("5");
      const targetRunLaunchCompositeHash = sha("6");
      const pendingInputRef = "setfarm://tests/p4/pending";
      const pendingInputHash = sha("7");
      const targetFamily = Object.freeze({
        kind: "source-run-launch",
        targetFamilyHash: sha("8"),
        targetRunLaunchCompositeHash,
        sourceRunReservation: Object.freeze({ category: "source-run", producerImplementationId: "a-recovery-source-run-v1", ownerKeyHash: sha("9"), reservationRef: sourceReservationRef, reservationHash: sourceReservationHash }),
        runReservation: Object.freeze({ category: "run", producerImplementationId: "a-recovery-source-bootstrap-run-v1", ownerKeyHash: sha("a"), reservationRef: runReservationRef, reservationHash: runReservationHash }),
      });
      const fenceTransitionHash = hashCanonicalJson(Object.freeze({
        schema: "setfarm.internal-production-global-owner-admission-fence-transition.v1",
        purpose: "recovery-d-source-delivery-v1",
        pendingInputRef,
        pendingInputHash,
        targetFamilyHash: targetFamily.targetFamilyHash,
        ownerIdentitySetHash: sha("b"),
      }));
      const h1Payload = Object.freeze({
        schema: "setfarm.internal-production-owner-admission-head.v1",
        version: 1,
        predecessorHeadHash: sha("0"),
        transitionKind: "fence",
        transitionRef: `setfarm://internal-production/global-owner-admission-fence-transition/sha256/${fenceTransitionHash}`,
        transitionHash: fenceTransitionHash,
        migrationApplication,
      });
      const h1Hash = hashCanonicalJson(h1Payload);
      const fenceBody = Object.freeze({
        purpose: "recovery-d-source-delivery-v1",
        pendingInputRef,
        pendingInputHash,
        predecessorFenceHeadHash: sha("0"),
        ownerAdmissionHeadHash: h1Hash,
        ownerIdentitySetHash: sha("b"),
        targetFamily,
        fenceRef: "setfarm://internal-production/global-owner-admission-fence/sha256/" + sha("c"),
        fenceHash: sha("c"),
      });
      const sourceReservationBody = Object.freeze({ category: "source-run", reservationRef: sourceReservationRef, reservationHash: sourceReservationHash });
      const runReservationBody = Object.freeze({ category: "run", reservationRef: runReservationRef, reservationHash: runReservationHash });
      const sourceBindingHash = sha("d");
      const runBindingHash = sha("e");
      const authority = (input: Readonly<Record<string, unknown>>) => Object.freeze(input);
      const fenceAuthority = authority({ authorityRef: fenceBody.fenceRef, authorityHash: fenceBody.fenceHash, authorityKind: "fence", phaseKey: pendingInputRef, predecessorHeadHash: sha("0"), successorHeadHash: h1Hash, authorityBody: fenceBody });
      const sourceReservationAuthority = authority({ authorityRef: sourceReservationRef, authorityHash: sourceReservationHash, authorityKind: "reservation", phaseKey: sourceReservationRef, predecessorHeadHash: sha("0"), successorHeadHash: h1Hash, authorityBody: sourceReservationBody });
      const runReservationAuthority = authority({ authorityRef: runReservationRef, authorityHash: runReservationHash, authorityKind: "reservation", phaseKey: runReservationRef, predecessorHeadHash: sha("0"), successorHeadHash: h1Hash, authorityBody: runReservationBody });
      const sourceBindingAuthority = authority({ authorityRef: `setfarm://internal-production/bound-owner-reservations/${sourceBindingHash}`, authorityHash: sourceBindingHash, authorityKind: "binding", phaseKey: sourceReservationRef, predecessorHeadHash: h1Hash, successorHeadHash: h1Hash, authorityBody: Object.freeze({ schema: "setfarm.test.binding.v1", reservationRef: sourceReservationRef }) });
      const runBindingAuthority = authority({ authorityRef: `setfarm://internal-production/bound-owner-reservations/${runBindingHash}`, authorityHash: runBindingHash, authorityKind: "binding", phaseKey: runReservationRef, predecessorHeadHash: h1Hash, successorHeadHash: h1Hash, authorityBody: Object.freeze({ schema: "setfarm.test.binding.v1", reservationRef: runReservationRef }) });
      const operation = Object.freeze({
        pendingInputRef, pendingInputHash, targetSourceRunReservationRef: sourceReservationRef, targetSourceRunReservationHash: sourceReservationHash,
        targetRunReservationRef: runReservationRef, targetRunReservationHash: runReservationHash, targetRunLaunchCompositeHash,
        ownerAdmissionFenceRef: fenceBody.fenceRef, ownerAdmissionFenceHash: fenceBody.fenceHash,
      });
      const runId = hashCanonicalJson(Object.freeze({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1", pendingInputRef, pendingInputHash }));
      const run = Object.freeze({ runId, status: "running" });
      const baseReservationRows = Object.freeze([
        Object.freeze({ category: "source-run", state: "bound", reservationRef: sourceReservationRef, reservationHash: sourceReservationHash, reservationBody: sourceReservationBody, bindingHash: sourceBindingHash }),
        Object.freeze({ category: "run", state: "bound", reservationRef: runReservationRef, reservationHash: runReservationHash, reservationBody: runReservationBody, bindingHash: runBindingHash }),
      ]);
      const h1AuthorityRows = Object.freeze([fenceAuthority, sourceReservationAuthority, runReservationAuthority, sourceBindingAuthority, runBindingAuthority]);
      const h1OwnerRows = Object.freeze([Object.freeze({
        headVersion: 1, headHash: h1Hash, activeFenceRef: fenceBody.fenceRef, activeFenceHash: fenceBody.fenceHash,
        activeTargetFamilyHash: targetFamily.targetFamilyHash, migrationApplicationEvidenceHash: migrationApplication.evidenceHash,
        headPayload: h1Payload, allAuthorityRows: h1AuthorityRows,
      })]);
      const execute = async (
        rows: Readonly<{
          ownerRows: readonly Readonly<Record<string, unknown>>[];
          reservationRows: readonly Readonly<Record<string, unknown>>[];
          expectedRunRows?: readonly Readonly<Record<string, unknown>>[];
          activeRunRows?: readonly Readonly<Record<string, unknown>>[];
        }>,
        expected: Readonly<Record<string, unknown>>,
        disposition: Readonly<Record<string, unknown>>,
      ): Promise<Readonly<{ outcome: string; message: string | null; events: readonly string[]; queries: readonly string[]; value: unknown }>> => {
        const queries: string[] = [];
        const expectedRunRows = rows.expectedRunRows ?? Object.freeze([run]);
        const activeRunRows = rows.activeRunRows ?? Object.freeze([run]);
        const sql = async (strings: TemplateStringsArray): Promise<unknown> => {
          const text = strings.join("?");
          queries.push(text);
          if (/internal_production_owner_reservations_v1/i.test(text)) return rows.reservationRows;
          if (/internal_production_owner_admission_(?:head|authorities)_v1/i.test(text)) return rows.ownerRows;
          if (/FROM\s+(?:public\.)?runs/i.test(text) && /WHERE\s+id=/i.test(text)) return expectedRunRows;
          if (/FROM\s+(?:public\.)?runs/i.test(text) && /status\s+IN/i.test(text)) return activeRunRows;
          throw new Error(`UNEXPECTED_RAW_PROJECTION_SQL:${text}`);
        };
        Object.assign(globalThis as any, {
          __p4ProjectionEvents: [],
          __p4ProjectionExpected: expected,
          __p4ProjectionDisposition: disposition,
          __p4ProjectionOperation: operation,
          __p4ProjectionRows: rows,
          __p4ProjectionExpectedRunRows: expectedRunRows,
          __p4ProjectionActiveRunRows: activeRunRows,
        });
        let outcome = "returned", message: string | null = null, value: unknown;
        try { value = await kernel.classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1(sql, { recoveryState: "prepared", recoveryOperationAuthority: operation }); }
        catch (error) { outcome = "threw"; message = String(error); }
        return Object.freeze({ outcome, message, events: Object.freeze([...(globalThis as any).__p4ProjectionEvents]), queries: Object.freeze(queries), value });
      };
      const activeDisposition = Object.freeze({ state: "active", workflowState: "running", runId });
      const h1 = await execute(
        Object.freeze({ ownerRows: h1OwnerRows, reservationRows: baseReservationRows }),
        Object.freeze({ version: 1, headHash: h1Hash, activeFenceRef: fenceBody.fenceRef, activeFenceHash: fenceBody.fenceHash, headHashes: Object.freeze([h1Hash]), authorityHistoryLength: 3 }),
        activeDisposition,
      );
      assert.equal(h1.outcome, "returned", `raw H1 rows enrich before pure classification (${String(h1.message)})`);
      assert.deepEqual(h1.value, activeDisposition);
      assert.deepEqual(h1.events, ["validate"]);
      assert.equal(h1.queries.length, 4, "the exported classifier consumes one raw owner, reservation, expected-run, and active-run snapshot");

      const sourceTerminalRef = "setfarm://tests/p4/source-terminal";
      const sourceTerminalHash = sha("1");
      const sourceTransitionHash = hashCanonicalJson(Object.freeze({ schema: "setfarm.internal-production-owner-reservation-close-transition.v1", reservationRef: sourceReservationRef, reservationHash: sourceReservationHash, terminalOwnerRef: sourceTerminalRef, terminalOwnerHash: sourceTerminalHash }));
      const h2Payload = Object.freeze({ schema: "setfarm.internal-production-owner-admission-head.v1", version: 2, predecessorHeadHash: h1Hash, transitionKind: "close", transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${sourceTransitionHash}`, transitionHash: sourceTransitionHash, migrationApplication });
      const h2Hash = hashCanonicalJson(h2Payload);
      const sourceClose = Object.freeze({ reservationRef: sourceReservationRef, reservationHash: sourceReservationHash, terminalOwnerRef: sourceTerminalRef, terminalOwnerHash: sourceTerminalHash, ownerAdmissionHeadPredecessorHash: h1Hash, ownerAdmissionHeadSuccessorHash: h2Hash, closeRef: "setfarm://tests/p4/source-close", closeHash: sha("2") });
      const runTerminalRef = "setfarm://tests/p4/run-terminal";
      const runTerminalHash = sha("3");
      const runTransitionHash = hashCanonicalJson(Object.freeze({ schema: "setfarm.internal-production-owner-reservation-close-transition.v1", reservationRef: runReservationRef, reservationHash: runReservationHash, terminalOwnerRef: runTerminalRef, terminalOwnerHash: runTerminalHash }));
      const h3Payload = Object.freeze({ schema: "setfarm.internal-production-owner-admission-head.v1", version: 3, predecessorHeadHash: h2Hash, transitionKind: "close", transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${runTransitionHash}`, transitionHash: runTransitionHash, migrationApplication });
      const h3Hash = hashCanonicalJson(h3Payload);
      const runClose = Object.freeze({ reservationRef: runReservationRef, reservationHash: runReservationHash, terminalOwnerRef: runTerminalRef, terminalOwnerHash: runTerminalHash, ownerAdmissionHeadPredecessorHash: h2Hash, ownerAdmissionHeadSuccessorHash: h3Hash, closeRef: "setfarm://tests/p4/run-close", closeHash: sha("4") });
      const releaseAuthorityBody = Object.freeze({
        purpose: "recovery-d-source-delivery-v1",
        targetFamilyKind: "source-run-launch",
        terminalCoreRef: null,
        terminalCoreHash: null,
        targetSetCloseRef: null,
        targetSetCloseHash: null,
        occurrenceRef: null,
        occurrenceHash: null,
        headRef: null,
        headHash: null,
        targetReservationPairCloseRef: "setfarm://tests/p4/pair-close",
        targetReservationPairCloseHash: sha("5"),
        purposeTerminalKind: null,
        purposeTerminalRef: null,
        purposeTerminalHash: null,
      });
      const releaseTransitionHash = hashCanonicalJson(Object.freeze({
        schema: "setfarm.internal-production-global-owner-admission-fence-release-transition.v1",
        fenceRef: fenceBody.fenceRef,
        fenceHash: fenceBody.fenceHash,
        releaseAuthority: releaseAuthorityBody,
      }));
      const h4Payload = Object.freeze({ schema: "setfarm.internal-production-owner-admission-head.v1", version: 4, predecessorHeadHash: h3Hash, transitionKind: "release", transitionRef: `setfarm://internal-production/global-owner-admission-fence-release-transition/sha256/${releaseTransitionHash}`, transitionHash: releaseTransitionHash, migrationApplication });
      const h4Hash = hashCanonicalJson(h4Payload);
      const sourceCloseAuthority = authority({ authorityRef: sourceClose.closeRef, authorityHash: sourceClose.closeHash, authorityKind: "close", phaseKey: sourceReservationRef, predecessorHeadHash: h1Hash, successorHeadHash: h2Hash, authorityBody: sourceClose });
      const runCloseAuthority = authority({ authorityRef: runClose.closeRef, authorityHash: runClose.closeHash, authorityKind: "close", phaseKey: runReservationRef, predecessorHeadHash: h2Hash, successorHeadHash: h3Hash, authorityBody: runClose });
      const releaseProjection = Object.freeze({
        schema: "setfarm.internal-production-global-owner-admission-fence-release.v1",
        fenceRef: fenceBody.fenceRef,
        fenceHash: fenceBody.fenceHash,
        releaseAuthority: releaseAuthorityBody,
        ownerAdmissionHeadPredecessorHash: h3Hash,
        ownerAdmissionHeadSuccessorHash: h4Hash,
      });
      const releaseHash = hashCanonicalJson(releaseProjection);
      const releaseBody = Object.freeze({
        ...releaseProjection,
        releaseRef: `setfarm://internal-production/global-owner-admission-fence-release/sha256/${releaseHash}`,
        releaseHash,
      });
      const releaseAuthority = authority({ authorityRef: releaseBody.releaseRef, authorityHash: releaseBody.releaseHash, authorityKind: "release", phaseKey: fenceBody.fenceRef, predecessorHeadHash: h3Hash, successorHeadHash: h4Hash, authorityBody: releaseBody });
      const h4AuthorityRows = Object.freeze([...h1AuthorityRows, sourceCloseAuthority, runCloseAuthority, releaseAuthority]);
      const h4ReservationRows = Object.freeze([
        Object.freeze({ ...baseReservationRows[0]!, state: "closed", closeRef: sourceClose.closeRef, closeHash: sourceClose.closeHash, closeBody: sourceClose }),
        Object.freeze({ ...baseReservationRows[1]!, state: "closed", closeRef: runClose.closeRef, closeHash: runClose.closeHash, closeBody: runClose }),
      ]);
      const h3AuthorityRows = Object.freeze(h4AuthorityRows.filter((entry) => entry.authorityKind !== "release"));
      const h3OwnerRows = Object.freeze([Object.freeze({
        headVersion: 3, headHash: h3Hash, activeFenceRef: fenceBody.fenceRef, activeFenceHash: fenceBody.fenceHash,
        activeTargetFamilyHash: targetFamily.targetFamilyHash, migrationApplicationEvidenceHash: migrationApplication.evidenceHash,
        headPayload: h3Payload, allAuthorityRows: h3AuthorityRows,
      })]);
      const pairClosedDisposition = Object.freeze({ state: "pair_closed", workflowState: "running", runId });
      const h3ProjectionFailures: string[] = [];
      try {
        const h3 = await execute(
          Object.freeze({ ownerRows: h3OwnerRows, reservationRows: h4ReservationRows }),
          Object.freeze({ version: 3, headHash: h3Hash, activeFenceRef: fenceBody.fenceRef, activeFenceHash: fenceBody.fenceHash, headHashes: Object.freeze([h1Hash, h2Hash, h3Hash]), authorityHistoryLength: 5 }),
          pairClosedDisposition,
        );
        assert.equal(h3.outcome, "returned", `raw H3 rows enrich both close edges while retaining the active fence (${String(h3.message)})`);
        assert.deepEqual(h3.value, pairClosedDisposition);
        assert.deepEqual(h3.events, ["validate"]);
      } catch (error) {
        h3ProjectionFailures.push(`exact: ${String(error)}`);
      }
      try {
        const missingH3Close = await execute(
          Object.freeze({ ownerRows: Object.freeze([Object.freeze({ ...h3OwnerRows[0]!, allAuthorityRows: Object.freeze(h3AuthorityRows.slice(0, -1)) })]), reservationRows: h4ReservationRows }),
          Object.freeze({ version: 3 }),
          pairClosedDisposition,
        );
        assert.equal(missingH3Close.outcome, "threw");
        assert.match(String(missingH3Close.message), /RECOVERY_SOURCE_BOOTSTRAP_DATABASE_CLOSE_AUTHORITY_MISSING/,
          "raw H3 projection cannot manufacture a missing second close authority");
        assert.deepEqual(missingH3Close.events, []);
      } catch (error) {
        h3ProjectionFailures.push(`missing-close: ${String(error)}`);
      }
      const h4OwnerRows = Object.freeze([Object.freeze({ headVersion: 4, headHash: h4Hash, activeFenceRef: null, activeFenceHash: null, activeTargetFamilyHash: null, migrationApplicationEvidenceHash: migrationApplication.evidenceHash, headPayload: h4Payload, allAuthorityRows: h4AuthorityRows })]);
      const releasedDisposition = Object.freeze({ state: "released", workflowState: "running", runId });
      const h4 = await execute(
        Object.freeze({ ownerRows: h4OwnerRows, reservationRows: h4ReservationRows }),
        Object.freeze({ version: 4, headHash: h4Hash, activeFenceRef: null, activeFenceHash: null, headHashes: Object.freeze([h1Hash, h2Hash, h3Hash, h4Hash]), authorityHistoryLength: 6 }),
        releasedDisposition,
      );
      assert.equal(h4.outcome, "returned", `raw H4 rows enrich full close/release history before pure classification (${String(h4.message)})`);
      assert.deepEqual(h4.value, releasedDisposition);
      assert.deepEqual(h4.events, ["validate"]);

      const laterPendingInputRef = "setfarm://tests/p4/later-pending";
      const laterPendingInputHash = sha("7");
      const laterTargetFamilyHash = sha("9");
      const laterFenceTransitionHash = hashCanonicalJson(Object.freeze({
        schema: "setfarm.internal-production-global-owner-admission-fence-transition.v1",
        purpose: "recovery-d-source-delivery-v1",
        pendingInputRef: laterPendingInputRef,
        pendingInputHash: laterPendingInputHash,
        targetFamilyHash: laterTargetFamilyHash,
        ownerIdentitySetHash: sha("a"),
      }));
      const h5Payload = Object.freeze({
        schema: "setfarm.internal-production-owner-admission-head.v1",
        version: 5,
        predecessorHeadHash: h4Hash,
        transitionKind: "fence",
        transitionRef: `setfarm://internal-production/global-owner-admission-fence-transition/sha256/${laterFenceTransitionHash}`,
        transitionHash: laterFenceTransitionHash,
        migrationApplication,
      });
      const h5Hash = hashCanonicalJson(h5Payload);
      const laterFenceAuthority = authority({
        authorityRef: "setfarm://tests/p4/later-fence",
        authorityHash: sha("b"),
        authorityKind: "fence",
        phaseKey: laterPendingInputRef,
        predecessorHeadHash: h4Hash,
        successorHeadHash: h5Hash,
        authorityBody: Object.freeze({ schema: "setfarm.test.later-fence.v1" }),
      });
      const laterRun = Object.freeze({ runId: sha("f"), status: "running" });
      const historicalReleasedDisposition = Object.freeze({ state: "released", workflowState: "completed", runId });
      const historicalH4 = await execute(
        Object.freeze({
          ownerRows: Object.freeze([Object.freeze({
            headVersion: 5,
            headHash: h5Hash,
            activeFenceRef: laterFenceAuthority.authorityRef,
            activeFenceHash: laterFenceAuthority.authorityHash,
            activeTargetFamilyHash: laterTargetFamilyHash,
            migrationApplicationEvidenceHash: migrationApplication.evidenceHash,
            headPayload: h5Payload,
            allAuthorityRows: Object.freeze([...h4AuthorityRows, laterFenceAuthority]),
          })]),
          reservationRows: h4ReservationRows,
          expectedRunRows: Object.freeze([Object.freeze({ ...run, status: "completed" })]),
          activeRunRows: Object.freeze([laterRun]),
        }),
        Object.freeze({
          version: 4,
          headHash: h4Hash,
          activeFenceRef: null,
          activeFenceHash: null,
          headHashes: Object.freeze([h1Hash, h2Hash, h3Hash, h4Hash]),
          authorityHistoryLength: 6,
          authorityRows: h4AuthorityRows,
          reservationRows: h4ReservationRows,
        }),
        historicalReleasedDisposition,
      );
      assert.equal(historicalH4.outcome, "returned", `exact historical H4 survives a later legitimate owner generation and active run (${String(historicalH4.message)})`);
      assert.deepEqual(historicalH4.value, historicalReleasedDisposition);
      assert.deepEqual(historicalH4.events, ["validate"]);

      const ambiguousReleaseAuthority = authority({
        ...releaseAuthority,
        authorityRef: "setfarm://tests/p4/ambiguous-release",
        authorityHash: sha("e"),
      });
      const ambiguousHistoricalH4 = await execute(
        Object.freeze({
          ownerRows: Object.freeze([Object.freeze({
            ...h4OwnerRows[0]!,
            headVersion: 5,
            headHash: h5Hash,
            activeFenceRef: laterFenceAuthority.authorityRef,
            activeFenceHash: laterFenceAuthority.authorityHash,
            activeTargetFamilyHash: laterTargetFamilyHash,
            headPayload: h5Payload,
            allAuthorityRows: Object.freeze([...h4AuthorityRows, ambiguousReleaseAuthority, laterFenceAuthority]),
          })]),
          reservationRows: h4ReservationRows,
          expectedRunRows: Object.freeze([Object.freeze({ ...run, status: "completed" })]),
          activeRunRows: Object.freeze([laterRun]),
        }),
        Object.freeze({ version: 4 }),
        historicalReleasedDisposition,
      );
      assert.equal(ambiguousHistoricalH4.outcome, "threw", "historical H4 cannot choose among two release authorities for the same exact fence");
      assert.match(String(ambiguousHistoricalH4.message), /RECOVERY_SOURCE_BOOTSTRAP_DATABASE_H4_AUTHORITY_DUPLICATE/);
      assert.deepEqual(ambiguousHistoricalH4.events, []);

      const missingAuthorityRows = Object.freeze(h1AuthorityRows.filter((entry) => entry !== sourceReservationAuthority));
      const missing = await execute(
        Object.freeze({ ownerRows: Object.freeze([Object.freeze({ ...h1OwnerRows[0]!, allAuthorityRows: missingAuthorityRows })]), reservationRows: baseReservationRows }),
        Object.freeze({ version: 1 }),
        activeDisposition,
      );
      assert.equal(missing.outcome, "threw");
      assert.match(String(missing.message), /RECOVERY_SOURCE_BOOTSTRAP_DATABASE_RESERVATION_AUTHORITY_MISSING/,
        "a missing immutable reservation authority is rejected inside raw-row enrichment before pure validation");
      assert.deepEqual(missing.events, []);

      const crossedAlias = await execute(
        Object.freeze({ ownerRows: Object.freeze([Object.freeze({ ...h1OwnerRows[0]!, activeFenceHash: sha("f") })]), reservationRows: baseReservationRows }),
        Object.freeze({ version: 1, headHash: h1Hash, activeFenceRef: fenceBody.fenceRef, activeFenceHash: fenceBody.fenceHash, headHashes: Object.freeze([h1Hash]), authorityHistoryLength: 3 }),
        activeDisposition,
      );
      assert.equal(crossedAlias.outcome, "threw");
      assert.match(String(crossedAlias.message), /RAW_PROJECTION_HEAD_ALIAS_CROSSED/,
        "a crossed SQL head alias survives enrichment only to be rejected at the pure-validator boundary");
      assert.deepEqual(crossedAlias.events, ["validate"]);
      assert.deepEqual(h3ProjectionFailures, [], `raw H3 projection failures:\n${h3ProjectionFailures.join("\n")}`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("P4 recovery source bootstrap actual terminal executes exact31 closed-pair release and five-resolver proof", async () => {
    const production = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
    const transitionProduction = await readFile(new URL("../../src/execution/run-terminal-transition.ts", import.meta.url), "utf8");
    const storedStart = production.indexOf("async function resolveStoredWorkflowRunOwnerByPairInTransactionV1(");
    const storedEnd = production.indexOf("async function resolveLockedWorkflowRunOwnerByRunIdV1(", storedStart);
    const terminalStart = production.indexOf("export async function resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(");
    const terminalEnd = production.indexOf("export async function resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(", terminalStart);
    const transitionStart = transitionProduction.indexOf("export async function transitionRunToTerminalInTransaction(");
    const transitionEnd = transitionProduction.indexOf("export async function transitionRunToTerminal(", transitionStart + 1);
    assert.ok(storedStart >= 0 && storedEnd > storedStart && terminalStart > storedEnd && terminalEnd > terminalStart && transitionStart >= 0 && transitionEnd > transitionStart);
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-source-bootstrap-terminal-"));
    try {
      const sourceDir = path.join(fixture, "src");
      const internalDir = path.join(sourceDir, "internal-production");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(path.join(internalDir, "baseline-post-handoff-receipt-v1.ts"), `
const g=globalThis;
const crossed=(name,value)=>g.__p4TerminalCross===name?{...value,operationHash:"f".repeat(64)}:value;
export async function resolveInternalProductionRecoverySourceBootstrapPendingInputV1(pair){g.__p4TerminalCalls.push("pending");return g.__p4TerminalCross==="pending"?{...pair,pendingInputHash:"f".repeat(64)}:{...pair}}
export async function resolveInternalProductionRecoverySourceRunTerminalAuthorityV1(_pair){g.__p4TerminalCalls.push("source");return crossed("source",g.__p4SourceTerminal)}
export async function resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1(_pair){g.__p4TerminalCalls.push("run");return crossed("run",g.__p4RunTerminal)}
export async function resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1(_pair){g.__p4TerminalCalls.push("pair-close");return g.__p4TerminalCross==="pair-close"?{...g.__p4PairClose,targetReservationPairCloseHash:"f".repeat(64)}:g.__p4PairClose}
export async function resolveInternalProductionRecoverySourceBootstrapRunReceiptV1(pair){g.__p4TerminalCalls.push("receipt");const value={...g.__p4ReceiptBody,...pair};return g.__p4TerminalCross==="receipt"?{...value,runId:"crossed"}:value}
`, "utf8");
      const modulePath = path.join(sourceDir, "db-kernel.ts");
      writeFileSync(modulePath, `
import {createHash} from "node:crypto";
type InternalProductionPgTransactionSql=any; type OwnerReservationRowV1=any; type InternalProductionBoundOwnerReservationV1<T=any>=any; type OwnerAdmissionAuthorityRowV1=any; type WorkflowRunTerminalRowV1=any;
const g=globalThis as any;
const canonical=(v:any):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hashCanonicalJson=(v:any)=>createHash("sha256").update(canonical(v)).digest("hex");
const sameJsonValueV1=(a:any,b:any)=>canonical(a)===canonical(b);
const isExactAppliedBootstrapMainClaimHandoffMigration32JournalRowV1=(value:any)=>value?.version===32&&value?.name==="contract-spine-bootstrap-main-claim-handoff-v1"&&value?.checksum==="d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d"&&value?.state==="applied";
const exactObjectKeys=(v:any,keys:readonly string[],message:string)=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(v,k)))throw new Error(message)};
const strictCanonicalText=(v:string)=>JSON.parse(v);
const validateOwnerAdmissionPairV1=(input:any,refKey:string,hashKey:string)=>({[refKey]:input[refKey],[hashKey]:input[hashKey]});
const resolveOwnerReservationInTransactionV1=async(_sql:any,pair:any)=>pair.reservationRef===g.__p4RunReservation.reservationRef?g.__p4RunReservation:g.__p4SourceReservation;
const validateBoundOwnerReservationRowV1=async()=>g.__p4Bound;
const createInternalProductionWorkflowRunCanonicalOwnerIdentityV1=(runId:string)=>({ownerRef:"setfarm://run/"+runId,ownerHash:hashCanonicalJson({runId}),ownerKey:runId});
const validateInternalProductionOwnerReservationCloseV1=(v:any)=>v;
const createInternalProductionSourceRunLaunchTargetReservationPairCloseV1=(v:any)=>{const targetReservationPairCloseHash=hashCanonicalJson(v);return Object.freeze({...v,targetReservationPairCloseRef:"setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/"+targetReservationPairCloseHash,targetReservationPairCloseHash})};
const resolveGlobalOwnerAdmissionFenceReleaseInTransactionV1=async()=>g.__p4Release;
const createWorkflowRunTerminalAuthorityFromLockedRowsV1=(run:any,bound:any)=>({schema:"terminal",runId:run.id,status:run.status,reservationRef:bound.reservationRef,reservationHash:bound.reservationHash});
const deriveInternalProductionTerminalOwnerAuthorityPairV1=(authority:any)=>{const terminalAuthorityHash=hashCanonicalJson(authority);return {terminalAuthorityRef:"setfarm://internal-production/terminal-owner-authorities/sha256/"+terminalAuthorityHash,terminalAuthorityHash}};
const validateInternalProductionTerminalOwnerAuthorityPairV1=()=>undefined;
${production.slice(storedStart, storedEnd)}
${production.slice(terminalStart, terminalEnd)}
const readDatabaseWallClock=async()=>new Date("2026-08-26T12:00:00.000Z");
const normalizeTask5TerminalCompletionContractInTransactionV1=async()=>undefined;
const metaObject=(value:any)=>value&&typeof value==="object"&&!Array.isArray(value)?{...value}:{};
const canonicalJsonStringify=canonical;
const createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1=()=>{throw new Error("completion owner unexpected")};
const lockV3TerminalRecoveryChainInTransaction=async()=>{throw new Error("v3 unexpected")};
const settleV3TerminalRecoveryChainInTransaction=async()=>{throw new Error("v3 unexpected")};
const assertRuntimeCompletionManifestInTransactionV1=async()=>{throw new Error("completion unexpected")};
const authenticateTask5ClosedMandatoryEffectReplayInTransactionV1=async()=>{throw new Error("effect unexpected")};
const releaseRuntimeSessionForTerminalRunInTransactionV1=async()=>{throw new Error("runtime unexpected")};
const terminalizeRuntimeCompletionForRunInTransactionV1=async()=>{throw new Error("completion unexpected")};
const terminalizeRunTerminationRequestInTransactionV1=async()=>{throw new Error("termination unexpected")};
const resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1=async()=>{throw new Error("claim unexpected")};
const resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1=async()=>{throw new Error("attempt unexpected")};
const resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1=async()=>{throw new Error("runtime unexpected")};
const resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1=async()=>{throw new Error("completion unexpected")};
const resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1=async()=>{throw new Error("termination unexpected")};
const requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1=(input:any)=>{const actual=input.recoveryOperationAuthority,expected=g.__p4ExpectedDurableOwner;if(!sameJsonValueV1(actual,expected))throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BOUND_OWNER_CORRUPTION");const state=g.__p4OwnerPhase==="pair-closed"?"pair_closed":g.__p4OwnerPhase==="closed"?"released":"active";return {state,workflowState:"running",runId:actual.runId,operationRunBindingHash:actual.operationRunBindingHash,reciprocalRunOperationBindingHash:actual.reciprocalRunOperationBindingHash}};
const lockInternalProductionWorkflowRunInsertionFenceV1=async(sql:any)=>{if(sql!==g.__p4CurrentSql)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_INSERTION_FENCE_SQL_CROSSED");g.__p4TerminalLockOrder.push("insertion-fence")};
const assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1=async(sql:any,input:any)=>{g.__p4TerminalLockOrder.push("barrier");await lockInternalProductionWorkflowRunInsertionFenceV1(sql);g.__p4DeliveryPendingCalls+=1;if(sql!==g.__p4CurrentSql||input.runId!==g.__p4RunId||input.workflowState!==g.__p4RunStatus||input.protocol!=="legacy"||input.runContext!==g.__p4RunContext)throw new Error("RECOVERY_SOURCE_BOOTSTRAP_BARRIER_CALLER_CROSSED");if(!["bound","pair-closed","closed"].includes(g.__p4OwnerPhase))return;const disposition=requireExactInternalProductionRecoverySourceBootstrapRunPersistenceV1({recoveryState:"prepared",recoveryOperationAuthority:g.__p4DurableOwner,ownerRows:g.__p4DurableOwner.ownerRows,reservationRows:g.__p4DurableOwner.reservationRows,expectedRunRows:g.__p4DurableOwner.expectedRunRows,activeRunRows:g.__p4DurableOwner.activeRunRows});if(disposition.state==="released")return;if(disposition.state==="active"||disposition.state==="pair_closed")throw new Error("RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING");throw new Error("RECOVERY_SOURCE_BOOTSTRAP_TERMINAL_OWNER_CORRUPTION")};
const resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1=async()=>{g.__p4OrdinaryTerminalResolverCalls+=1;throw new Error("ordinary resolver forbidden")};
const closeInternalProductionOwnerReservationV1=async()=>{g.__p4OwnerCloseCalls+=1;throw new Error("second owner close forbidden")};
const resolveInternalProductionOwnerReservationCloseInTransactionV1=async()=>{g.__p4OwnerCloseReopenCalls+=1;throw new Error("owner close reopen forbidden")};
const enqueueOperationalOutboxEventInTransaction=async(_sql:any,input:any)=>{g.__p4OutboxCalls.push(input)};
${transitionProduction.slice(transitionStart, transitionEnd)}
export const p4PairClose=createInternalProductionSourceRunLaunchTargetReservationPairCloseV1;
`, "utf8");
      const kernel = await import(`${pathToFileURL(modulePath).href}?p4=${Date.now()}`) as any;
      const sha = (member: string) => member.repeat(64);
      const runId = "RUN_P4_RECOVERY_SOURCE_BOOTSTRAP_0001";
      const runReservation = { reservationRef: "setfarm://tests/p4/run-reservation", reservationHash: sha("1"), category: "run", producerImplementationId: "a-recovery-source-bootstrap-run-v1", ownerKey: runId };
      const sourceReservation = { reservationRef: "setfarm://tests/p4/source-reservation", reservationHash: sha("2"), category: "source-run", producerImplementationId: "a-recovery-source-run-v1", ownerKey: "source" };
      const bound = { reservationRef: runReservation.reservationRef, reservationHash: runReservation.reservationHash, category: "run", producerImplementationId: runReservation.producerImplementationId, ownerKey: runId, canonicalOwnerIdentity: { ownerRef: `setfarm://run/${runId}`, ownerHash: hashCanonicalJson({ runId }), ownerKey: runId } };
      const fenceRef = "setfarm://tests/p4/fence";
      const fenceHash = sha("3");
      const sourceTerminal = { operationRef: "setfarm://tests/p4/operation", operationHash: sha("4"), runId, operationRunBindingHash: sha("5"), reciprocalRunOperationBindingHash: sha("6"), terminalOwnerRef: "setfarm://tests/p4/source-terminal", terminalOwnerHash: sha("7"), terminalSourceRunRef: "setfarm://tests/p4/source-terminal", terminalSourceRunHash: sha("7") };
      const runTerminal = { operationRef: sourceTerminal.operationRef, operationHash: sourceTerminal.operationHash, runId, operationRunBindingHash: sourceTerminal.operationRunBindingHash, reciprocalRunOperationBindingHash: sourceTerminal.reciprocalRunOperationBindingHash, terminalOwnerRef: "setfarm://tests/p4/run-terminal", terminalOwnerHash: sha("8"), terminalRunLaunchRef: "setfarm://tests/p4/run-terminal", terminalRunLaunchHash: sha("8") };
      const sourceClose = { reservationRef: sourceReservation.reservationRef, reservationHash: sourceReservation.reservationHash, terminalOwnerRef: sourceTerminal.terminalSourceRunRef, terminalOwnerHash: sourceTerminal.terminalSourceRunHash, ownerAdmissionHeadPredecessorHash: sha("9"), ownerAdmissionHeadSuccessorHash: sha("a"), preservedFenceRef: fenceRef, preservedFenceHash: fenceHash };
      const runClose = { reservationRef: runReservation.reservationRef, reservationHash: runReservation.reservationHash, terminalOwnerRef: runTerminal.terminalRunLaunchRef, terminalOwnerHash: runTerminal.terminalRunLaunchHash, ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadSuccessorHash, ownerAdmissionHeadSuccessorHash: sha("b"), preservedFenceRef: fenceRef, preservedFenceHash: fenceHash };
      const context = {
        schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1", task: "task", purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3", promptManifestHash: sha("c"),
        baseSourceSha: "1".repeat(40), baseSourceTreeHash: "2".repeat(40), buildHash: sha("d"), activationPreflightHash: sha("e"), releaseAdmissionHash: sha("f"),
        pendingInputRef: "setfarm://tests/p4/pending", pendingInputHash: sha("1"), startIntentRef: "setfarm://tests/p4/intent", startIntentHash: sha("2"), startOutboxRef: "setfarm://tests/p4/outbox", startOutboxHash: sha("3"),
        operationRef: sourceTerminal.operationRef, operationHash: sourceTerminal.operationHash, targetSourceRunReservationRef: sourceReservation.reservationRef, targetSourceRunReservationHash: sourceReservation.reservationHash,
        targetRunReservationRef: runReservation.reservationRef, targetRunReservationHash: runReservation.reservationHash, targetRunLaunchCompositeHash: sha("4"), sourceRunOwnerRef: "setfarm://tests/p4/source-owner", sourceRunOwnerHash: sha("5"),
        runOwnerRef: bound.canonicalOwnerIdentity.ownerRef, runOwnerHash: bound.canonicalOwnerIdentity.ownerHash, operationRunBindingHash: sourceTerminal.operationRunBindingHash, reciprocalRunOperationBindingHash: sourceTerminal.reciprocalRunOperationBindingHash,
      };
      const pairClose = kernel.p4PairClose({ fenceRef, fenceHash, targetRunLaunchCompositeHash: context.targetRunLaunchCompositeHash, sourceRunReservationRef: sourceReservation.reservationRef, sourceRunReservationHash: sourceReservation.reservationHash, runReservationRef: runReservation.reservationRef, runReservationHash: runReservation.reservationHash, terminalSourceRunRef: sourceTerminal.terminalSourceRunRef, terminalSourceRunHash: sourceTerminal.terminalSourceRunHash, terminalRunLaunchRef: runTerminal.terminalRunLaunchRef, terminalRunLaunchHash: runTerminal.terminalRunLaunchHash, ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadPredecessorHash, ownerAdmissionHeadSuccessorHash: runClose.ownerAdmissionHeadSuccessorHash, preservedFenceRef: fenceRef, preservedFenceHash: fenceHash });
      const release = { releaseRef: "setfarm://tests/p4/release", releaseHash: sha("6"), fenceRef, fenceHash, releaseAuthority: { purpose: "recovery-d-source-delivery-v1", targetFamilyKind: "source-run-launch", targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef, targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash } };
      const receiptBody = { schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1", purpose: "recovery-d-source-delivery-v1", pendingInputRef: context.pendingInputRef, pendingInputHash: context.pendingInputHash, operationRef: context.operationRef, operationHash: context.operationHash, targetSourceRunReservationRef: context.targetSourceRunReservationRef, targetSourceRunReservationHash: context.targetSourceRunReservationHash, targetRunReservationRef: context.targetRunReservationRef, targetRunReservationHash: context.targetRunReservationHash, targetRunLaunchCompositeHash: context.targetRunLaunchCompositeHash, ownerAdmissionFenceRef: fenceRef, ownerAdmissionFenceHash: fenceHash, startIntentRef: context.startIntentRef, startIntentHash: context.startIntentHash, startOutboxRef: context.startOutboxRef, startOutboxHash: context.startOutboxHash, runId, operationRunBindingHash: context.operationRunBindingHash, reciprocalRunOperationBindingHash: context.reciprocalRunOperationBindingHash, terminalOwnerRef: sourceTerminal.terminalOwnerRef, terminalOwnerHash: sourceTerminal.terminalOwnerHash, terminalSourceRunRef: sourceTerminal.terminalSourceRunRef, terminalSourceRunHash: sourceTerminal.terminalSourceRunHash, terminalRunLaunchRef: runTerminal.terminalRunLaunchRef, terminalRunLaunchHash: runTerminal.terminalRunLaunchHash, targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef, targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash, fenceReleaseRef: release.releaseRef, fenceReleaseHash: release.releaseHash };
      const runRow = { ...runReservation, state: "closed", close_kind: "fence-target", close_payload: runClose };
      const sourceRow = { ...sourceReservation, state: "closed", close_kind: "fence-target", close_payload: sourceClose };
      Object.assign(globalThis as any, { __p4RunReservation: runReservation, __p4SourceReservation: sourceReservation, __p4Bound: bound, __p4SourceTerminal: sourceTerminal, __p4RunTerminal: runTerminal, __p4PairClose: pairClose, __p4Release: release, __p4ReceiptBody: receiptBody, __p4TerminalCross: null, __p4TerminalCalls: [] });
      const sql = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("?");
        if (query.includes("setfarm_schema_migrations") && query.includes("version=32")) return [AUTHENTIC_MIGRATION_32_JOURNAL_ROW];
        if (query.includes("producer_implementation_id='a-recovery-source-bootstrap-run-v1'")) return [{ reservation_ref: runReservation.reservationRef, reservation_hash: runReservation.reservationHash }];
        if (query.includes("SELECT *") && query.includes("FROM internal_production_owner_reservations_v1")) return values[0] === sourceReservation.reservationRef ? [sourceRow] : [runRow];
        if (query.includes("SELECT id,context,status FROM runs")) return [{ id: runId, context: JSON.stringify(context), status: "completed" }];
        if (query.includes("authority_kind='release'")) return [{ authority_ref: release.releaseRef, authority_hash: release.releaseHash }];
        if (query.includes("SELECT id,status FROM runs")) return [{ id: runId, status: "completed" }];
        throw new Error(`UNEXPECTED_SQL:${query}`);
      }, { unsafe: async () => { throw new Error("unsafe forbidden"); } });
      const terminal = await kernel.resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(sql, { runId });
      assert.equal(terminal.producerImplementationId, "a-recovery-source-bootstrap-run-v1");
      assert.deepEqual((globalThis as any).__p4TerminalCalls, ["pending", "source", "run", "pair-close", "receipt"]);
      for (const crossed of ["pending", "source", "run", "pair-close", "receipt"]) {
        (globalThis as any).__p4TerminalCross = crossed;
        (globalThis as any).__p4TerminalCalls = [];
        await assert.rejects(kernel.resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(sql, { runId }), /WORKFLOW_RUN_OWNER_CORRUPTION/);
        assert.ok((globalThis as any).__p4TerminalCalls.includes(crossed), `${crossed} resolver was executed before rollback`);
      }

      const durable = { status: "running" };
      const durableOwner = { sourceReservationRef: sourceReservation.reservationRef, sourceReservationHash: sourceReservation.reservationHash, sourceReservationState: "bound", runReservationRef: runReservation.reservationRef, runReservationHash: runReservation.reservationHash, runReservationState: "bound", runId, fenceRef, fenceHash, headVersion: 1, headHash: fenceHash, authorityCount: 5, operationRunBindingHash: context.operationRunBindingHash, reciprocalRunOperationBindingHash: context.reciprocalRunOperationBindingHash, terminalOutboxCount: 0 };
      const durablePairClosedOwner = { ...durableOwner, sourceReservationState: "closed", runReservationState: "closed", headVersion: 3, headHash: runClose.ownerAdmissionHeadSuccessorHash, authorityCount: 7 };
      const durableReleasedOwner = { ...durablePairClosedOwner, headVersion: 4, headHash: sha("c"), authorityCount: 8 };
      const createTransaction = () => {
        const staged = { status: durable.status };
        const tagged = async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const query = strings.join("?");
          if (query.includes("setfarm_schema_migrations") && query.includes("version=32")) return [AUTHENTIC_MIGRATION_32_JOURNAL_ROW];
          if (query.includes("producer_implementation_id='a-recovery-source-bootstrap-run-v1'")) return ["pair-closed", "closed"].includes((globalThis as any).__p4OwnerPhase) ? [{ reservation_ref: runReservation.reservationRef, reservation_hash: runReservation.reservationHash }] : [];
          if (query.includes("SELECT *") && query.includes("FROM internal_production_owner_reservations_v1")) return values[0] === sourceReservation.reservationRef ? [sourceRow] : [runRow];
          if (query.includes("SELECT id,context,status FROM runs")) return [{ id: runId, context: JSON.stringify(context), status: staged.status }];
          if (query.includes("authority_kind='release'")) return [{ authority_ref: release.releaseRef, authority_hash: release.releaseHash }];
          if (query.includes("SELECT id,status FROM runs")) return [{ id: runId, status: staged.status }];
          throw new Error(`UNEXPECTED_TAGGED_SQL:${query}`);
        };
        const unsafe = async (query: string, values: unknown[] = []) => {
          if (query.includes("FROM runs WHERE id = $1 FOR UPDATE")) { (globalThis as any).__p4TerminalLockOrder.push("run-row"); return [{ id: runId, status: staged.status, protocol: "legacy", context: JSON.stringify(context), packet_hash: null, accepted_candidate_hash: null, meta: {} }]; }
          if (query.includes("FROM run_termination_requests")) return [];
          if (query.includes("FROM runtime_sessions")) return [];
          if (query.includes("FROM execution_attempts")) return [];
          if (query.includes("FROM claim_log")) return [];
          if (query.includes("FROM runtime_completion_requests")) return [];
          if (query.includes("FROM runtime_completion_effects")) return [];
          if (query.includes("FROM internal_production_owner_reservations_v1")) return [];
          if (query.includes("SELECT") && query.includes("COUNT(*)::integer FROM steps")) return [{ steps: 0, stories: 0 }];
          if (query.includes("UPDATE runs") && query.includes("RETURNING id,status")) {
            staged.status = String(values[1]);
            return [{ id: runId, status: staged.status }];
          }
          throw new Error(`UNEXPECTED_UNSAFE_SQL:${query}`);
        };
        return {
          sql: Object.assign(tagged, { unsafe }),
          commit: () => { durable.status = staged.status; },
          staged,
        };
      };
      const executeTransition = async () => {
        const transaction = createTransaction();
        Object.assign(globalThis as any, { __p4CurrentSql: transaction.sql, __p4RunId: runId, __p4RunStatus: transaction.staged.status, __p4RunContext: JSON.stringify(context), __p4TerminalLockOrder: [] });
        const result = await kernel.transitionRunToTerminalInTransaction(transaction.sql, {
          runId,
          status: "completed",
          diagnostic: "p4 special terminal",
        });
        transaction.commit();
        return result;
      };
      Object.assign(globalThis as any, {
        __p4TerminalCross: null,
        __p4TerminalCalls: [],
        __p4OrdinaryTerminalResolverCalls: 0,
        __p4OwnerCloseCalls: 0,
        __p4OwnerCloseReopenCalls: 0,
        __p4OutboxCalls: [],
        __p4OwnerPhase: "bound",
        __p4DeliveryPendingCalls: 0,
        __p4ExpectedDurableOwner: durableOwner,
        __p4DurableOwner: structuredClone(durableOwner),
      });
      const boundOwnerBefore = structuredClone(durableOwner);
      await assert.rejects(executeTransition(), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING/);
      assert.deepEqual((globalThis as any).__p4TerminalLockOrder, ["insertion-fence", "run-row", "barrier", "insertion-fence"],
        "the transition pre-acquires the shared insertion fence before its run lock and the same-transaction barrier re-lock is idempotent");
      assert.equal(durable.status, "running", "a terminal attempt racing the bound H1 recovery pair is refused before the first status mutation");
      assert.deepEqual((globalThis as any).__p4DurableOwner, boundOwnerBefore, "terminal refusal preserves both bound reservations, H1, five authorities, and terminal-outbox absence");
      assert.deepEqual((globalThis as any).__p4TerminalCalls, [], "bound H1 cannot enter the closed-pair receipt proof");
      assert.equal((globalThis as any).__p4DeliveryPendingCalls, 1, "one exact bound-H1 barrier prevents generic terminal-owner fallback");
      assert.equal((globalThis as any).__p4OrdinaryTerminalResolverCalls, 0, "the generic runtime owner cannot adopt the specialized recovery reservation");
      assert.equal((globalThis as any).__p4OwnerCloseCalls, 0, "bound H1 rollback performs no ordinary specialized-owner close");
      assert.equal((globalThis as any).__p4OwnerCloseReopenCalls, 0);
      assert.equal((globalThis as any).__p4OutboxCalls.length, 0, "rollback publishes no terminal outbox event");

      for (const crossed of [
        { label: "active-fence", value: { ...durableOwner, fenceHash: sha("f") } },
        { label: "unrelated-run", value: { ...durableOwner, runId: "RUN_P4_UNRELATED" } },
      ]) {
        durable.status = "running";
        Object.assign(globalThis as any, {
          __p4DurableOwner: crossed.value,
          __p4DeliveryPendingCalls: 0,
          __p4OrdinaryTerminalResolverCalls: 0,
          __p4OwnerCloseCalls: 0,
          __p4OwnerCloseReopenCalls: 0,
          __p4OutboxCalls: [],
        });
        await assert.rejects(executeTransition(), /RECOVERY_SOURCE_BOOTSTRAP_BOUND_OWNER_CORRUPTION/);
        assert.equal(durable.status, "running", `${crossed.label}: crossed bound recovery authority is refused before terminal status mutation`);
        assert.equal((globalThis as any).__p4DeliveryPendingCalls, 1);
        assert.equal((globalThis as any).__p4OrdinaryTerminalResolverCalls, 0);
        assert.equal((globalThis as any).__p4OwnerCloseCalls, 0);
        assert.equal((globalThis as any).__p4OutboxCalls.length, 0);
      }

      durable.status = "running";
      Object.assign(globalThis as any, {
        __p4OwnerPhase: "pair-closed",
        __p4TerminalCross: null,
        __p4TerminalCalls: [],
        __p4OrdinaryTerminalResolverCalls: 0,
        __p4OwnerCloseCalls: 0,
        __p4OwnerCloseReopenCalls: 0,
        __p4OutboxCalls: [],
        __p4DeliveryPendingCalls: 0,
        __p4ExpectedDurableOwner: durablePairClosedOwner,
        __p4DurableOwner: structuredClone(durablePairClosedOwner),
      });
      const pairClosedOwnerBefore = structuredClone(durablePairClosedOwner);
      await assert.rejects(executeTransition(), /RECOVERY_SOURCE_BOOTSTRAP_DELIVERY_PENDING/);
      assert.deepEqual((globalThis as any).__p4TerminalLockOrder, ["insertion-fence", "run-row", "barrier", "insertion-fence"],
        "the H3 retry takes the same serialized pre-mutation barrier as H1");
      assert.equal(durable.status, "running", "terminalization cannot commit while the closed pair still retains its unreleased H3 fence");
      assert.deepEqual((globalThis as any).__p4DurableOwner, pairClosedOwnerBefore,
        "the retryable H3 refusal preserves both closed reservations, the seven-authority history, and the active fence");
      assert.deepEqual((globalThis as any).__p4TerminalCalls, [], "H3 refusal precedes the release-dependent receipt resolver");
      assert.equal((globalThis as any).__p4DeliveryPendingCalls, 1);
      assert.equal((globalThis as any).__p4OrdinaryTerminalResolverCalls, 0);
      assert.equal((globalThis as any).__p4OwnerCloseCalls, 0);
      assert.equal((globalThis as any).__p4OwnerCloseReopenCalls, 0);
      assert.equal((globalThis as any).__p4OutboxCalls.length, 0);

      Object.assign(globalThis as any, {
        __p4DurableOwner: { ...durablePairClosedOwner, authorityCount: 6 },
        __p4DeliveryPendingCalls: 0,
        __p4OrdinaryTerminalResolverCalls: 0,
        __p4OwnerCloseCalls: 0,
        __p4OwnerCloseReopenCalls: 0,
        __p4OutboxCalls: [],
      });
      await assert.rejects(executeTransition(), /RECOVERY_SOURCE_BOOTSTRAP_BOUND_OWNER_CORRUPTION/);
      assert.equal(durable.status, "running", "crossed H3 evidence is corruption before terminal status mutation");
      assert.equal((globalThis as any).__p4DeliveryPendingCalls, 1);
      assert.equal((globalThis as any).__p4OrdinaryTerminalResolverCalls, 0);
      assert.equal((globalThis as any).__p4OwnerCloseCalls, 0);
      assert.equal((globalThis as any).__p4OutboxCalls.length, 0);

      let resumeReleaseCalls = 0;
      const resumeReleasePairClosedOwner = (owner: typeof durablePairClosedOwner): typeof durableReleasedOwner => {
        assert.deepEqual(owner, pairClosedOwnerBefore,
          "the subsequent authentic resume starts from the unchanged H3 authority");
        resumeReleaseCalls += 1;
        return durableReleasedOwner;
      };
      const releasedByResume = resumeReleasePairClosedOwner(structuredClone(durablePairClosedOwner));
      Object.assign(globalThis as any, {
        __p4OwnerPhase: "closed",
        __p4TerminalCross: null,
        __p4TerminalCalls: [],
        __p4OrdinaryTerminalResolverCalls: 0,
        __p4OwnerCloseCalls: 0,
        __p4OwnerCloseReopenCalls: 0,
        __p4OutboxCalls: [],
        __p4DeliveryPendingCalls: 0,
        __p4ExpectedDurableOwner: durableReleasedOwner,
        __p4DurableOwner: structuredClone(releasedByResume),
      });
      const transition = await executeTransition();
      assert.deepEqual((globalThis as any).__p4TerminalLockOrder, ["insertion-fence", "run-row", "barrier", "insertion-fence"],
        "the H4 retry preserves the same global lock order before bypassing the H1 delivery barrier");
      assert.equal(transition.status, "completed");
      assert.equal(durable.status, "completed");
      assert.deepEqual((globalThis as any).__p4TerminalCalls, ["pending", "source", "run", "pair-close", "receipt"]);
      assert.equal((globalThis as any).__p4OrdinaryTerminalResolverCalls, 0);
      assert.equal((globalThis as any).__p4DeliveryPendingCalls, 1, "the pre-mutation barrier authenticates H4 once and returns without an H1 delivery-pending refusal");
      assert.equal((globalThis as any).__p4OwnerCloseCalls, 0, "the already-closed special target is never closed a second time");
      assert.equal((globalThis as any).__p4OwnerCloseReopenCalls, 0);
      assert.equal((globalThis as any).__p4OutboxCalls.length, 1);
      assert.equal(resumeReleaseCalls, 1, "one successful resume advances H3 to H4 before terminalization retries");

      for (const crossed of ["pending", "source", "run", "pair-close", "receipt"]) {
        durable.status = "running";
        Object.assign(globalThis as any, {
          __p4TerminalCross: crossed,
          __p4TerminalCalls: [],
          __p4OrdinaryTerminalResolverCalls: 0,
          __p4OwnerCloseCalls: 0,
          __p4OwnerCloseReopenCalls: 0,
          __p4OutboxCalls: [],
          __p4OwnerPhase: "closed",
          __p4DeliveryPendingCalls: 0,
          __p4ExpectedDurableOwner: durableReleasedOwner,
          __p4DurableOwner: structuredClone(durableReleasedOwner),
        });
        await assert.rejects(executeTransition(), /WORKFLOW_RUN_OWNER_CORRUPTION/);
        assert.equal(durable.status, "running", `${crossed} proof failure rolls back the preceding run terminal UPDATE`);
        assert.equal((globalThis as any).__p4OwnerCloseCalls, 0);
        assert.equal((globalThis as any).__p4OutboxCalls.length, 0);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("keeps attempt birth, recovery pair publication, m33 use, and terminal closes in the exact Task 4 inventory", async () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const productionPaths = [
      "../../src/execution/attempt-repository.ts",
      "../../src/execution/attempt-reconciler.ts",
      "../../src/execution/claim-attempt-transition.ts",
      "../../src/execution/pre-dispatch-withdrawal-authority.ts",
      "../../src/execution/run-terminal-transition.ts",
      "../../src/recovery/v3-downstream-evidence-publication.ts",
      "../../src/recovery/v3-evidence-only-publication.ts",
      "../../src/recovery/v3-evidence-only-worker.ts",
      "../../src/recovery/v3-recovery-lifecycle-reconciler.ts",
    ] as const;
    const sources = await Promise.all(productionPaths.map(async (relativePath) => ({
      relativePath,
      source: await readFile(path.resolve(testDirectory, relativePath), "utf8"),
    })));
    const writerInventory = [
      ["../../src/execution/attempt-repository.ts", "async complete(input:"],
      ["../../src/execution/attempt-reconciler.ts", "async function completeTerminalAttemptForRecovery("],
      ["../../src/execution/claim-attempt-transition.ts", "export async function closeClaimAndBoundAttemptInTransaction("],
      ["../../src/execution/claim-attempt-transition.ts", "export async function completeStoryClaimAndBoundAttempt("],
      ["../../src/execution/pre-dispatch-withdrawal-authority.ts", "export async function withdrawPreDispatchClaimInTransaction("],
      ["../../src/execution/run-terminal-transition.ts", "export async function transitionRunToTerminalInTransaction("],
      ["../../src/recovery/v3-downstream-evidence-publication.ts", "async complete(input:"],
      ["../../src/recovery/v3-evidence-only-publication.ts", "async completeAttempt(input:"],
      ["../../src/recovery/v3-evidence-only-worker.ts", "async function quarantineDelivery("],
      ["../../src/recovery/v3-recovery-lifecycle-reconciler.ts", "async function blockExpiredEvidenceAttempt("],
      ["../../src/recovery/v3-recovery-lifecycle-reconciler.ts", "async function blockExpiredModelAttempt("],
    ] as const;
    const terminalDispositionUpdate = /UPDATE execution_attempts[\s\S]{0,250}?SET disposition = (?:\$\d+|'(?:produced_delta|already_satisfied|verified|no_progress|failed|inconclusive)')/g;
    const resolverSite = /await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1\(/g;
    const assertExactInventory = (candidateSources: ReadonlyArray<Readonly<{
      relativePath: string;
      source: string;
    }>>): void => {
      assert.equal(
        candidateSources.reduce((total, item) => total + (item.source.match(resolverSite)?.length ?? 0), 0),
        11,
        "the declared Task 4 inventory is the total resolver-site authority",
      );
      assert.equal(
        candidateSources.reduce((total, item) => total + (item.source.match(terminalDispositionUpdate)?.length ?? 0), 0),
        11,
        "the declared Task 4 inventory is the total terminal disposition UPDATE authority",
      );
    };
    assertExactInventory(sources);
    for (const [relativePath, writerMarker] of writerInventory) {
      const source = sources.find((item) => item.relativePath === relativePath)?.source;
      assert.ok(source, relativePath);
      const writerStart = source.indexOf(writerMarker);
      assert.notEqual(writerStart, -1, `${relativePath}:${writerMarker}`);
      const nextWriter = source.indexOf("\nasync function ", writerStart + writerMarker.length);
      const nextExport = source.indexOf("\nexport async function ", writerStart + writerMarker.length);
      const boundaries = [nextWriter, nextExport].filter((value) => value > writerStart);
      const writerEnd = boundaries.length > 0 ? Math.min(...boundaries) : source.length;
      const body = source.slice(writerStart, writerEnd);
      assert.match(
        body,
        /await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1\(/,
        `${relativePath}:${writerMarker} must resolve its own terminal attempt owner`,
      );
      assert.match(
        body,
        /await closeInternalProductionOwnerReservationV1\(/,
        `${relativePath}:${writerMarker} must close its own terminal attempt owner`,
      );
    }
    const undeclaredUpdateOnly = sources.map((item, index) => index === 0 ? {
      ...item,
      source: `${item.source}\nasync function undeclaredUpdateOnly(transaction: PgTransactionSql) {\n  await transaction.unsafe(\`UPDATE execution_attempts SET disposition = 'already_satisfied' WHERE attempt_id = 'ATT_undeclared'\`);\n}\n`,
    } : item);
    assert.throws(
      () => assertExactInventory(undeclaredUpdateOnly),
      /total terminal disposition UPDATE authority/,
    );
    const undeclaredResolverOnly = sources.map((item, index) => index === 0 ? {
      ...item,
      source: `${item.source}\nasync function undeclaredResolverOnly(transaction: PgTransactionSql) {\n  await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(transaction, { attemptId: 'ATT_undeclared' });\n}\n`,
    } : item);
    assert.throws(
      () => assertExactInventory(undeclaredResolverOnly),
      /total resolver-site authority/,
    );
    const count = (source: string, expression: RegExp): number => source.match(expression)?.length ?? 0;
    assert.deepEqual(
      sources.filter((item) => item.source.includes("INSERT INTO execution_attempts"))
        .map((item) => item.relativePath),
      ["../../src/execution/attempt-repository.ts"],
    );
    assert.deepEqual(
      sources.filter((item) => /SET state = 'attempt_reserved',\s+claim_id =/m.test(item.source))
        .map((item) => item.relativePath),
      ["../../src/execution/attempt-repository.ts"],
    );
    assert.deepEqual(
      sources.filter((item) => item.source.includes("internal_production_v3_recovery_claim_publications_v1"))
        .map((item) => item.relativePath),
      [
        "../../src/execution/attempt-repository.ts",
        "../../src/recovery/v3-evidence-only-publication.ts",
        "../../src/recovery/v3-recovery-lifecycle-reconciler.ts",
      ],
    );
    const ordinary = sources.find((item) => item.relativePath.endsWith("v3-downstream-evidence-publication.ts"))!.source;
    assert.equal(ordinary.includes("recovery_dispatch_deliveries"), false);
    assert.equal(ordinary.includes("internal_production_v3_recovery_claim_publications_v1"), false);
    assert.equal(ordinary.includes("recoveryDispatchId:"), false);
    const evidenceOnly = sources.find((item) => item.relativePath.endsWith("v3-evidence-only-publication.ts"))!.source;
    assert.equal(count(evidenceOnly, /internal_production_v3_recovery_claim_publications_v1/g), 1);
    assert.match(evidenceOnly, /runtime_count[\s\S]*publication_count[\s\S]*reserveAttemptInTransaction/);
    const lifecycle = sources.find((item) => item.relativePath.endsWith("v3-recovery-lifecycle-reconciler.ts"))!.source;
    const expiryWriter = lifecycle.slice(
      lifecycle.indexOf("async function rollbackUnreservedPublication"),
      lifecycle.indexOf("async function advanceDeliveryRunning"),
    );
    assert.match(expiryWriter, /state = 'blocked'/);
    assert.equal(expiryWriter.includes("resetExpiredLease("), false);
    assert.match(expiryWriter, /claim_id IS NULL[\s\S]*attempt_id IS NULL|attempt_id IS NULL[\s\S]*claim_id IS NULL/);
  });

  it("terminal transition closes the authenticated run owner in the same transaction", async () => {
    const source = await readFile(path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/execution/run-terminal-transition.ts",
    ), "utf8");
    assert.equal(transitionRunToTerminal.length, 2);
    assert.equal(transitionRunToTerminalInTransaction.length, 2);
    assert.equal(/createInternalProduction(?:WorkflowRun)?TerminalOwnerAuthority/.test(source), false);
    const runLock = source.indexOf("FROM runs WHERE id = $1 FOR UPDATE");
    const terminationLock = source.indexOf("FROM run_termination_requests", runLock);
    const runtimeLock = source.indexOf("FROM runtime_sessions", terminationLock);
    const attemptLock = source.indexOf("FROM execution_attempts", runtimeLock);
    const recoveryLock = source.indexOf("lockV3TerminalRecoveryChainInTransaction", attemptLock);
    const claimLock = source.indexOf("FROM claim_log", recoveryLock);
    const completionLock = source.indexOf("FROM runtime_completion_requests", claimLock);
    const effectLock = source.indexOf("FROM runtime_completion_effects effect", completionLock);
    const effectPreflight = source.indexOf(
      "authenticateTask5ClosedMandatoryEffectReplayInTransactionV1(sql, mandatoryEffect)",
      effectLock,
    );
    const effectPreflightFact = source.indexOf(
      "authenticatedMandatoryEffectFacts.add(mandatoryEffectFact(effect))",
      effectPreflight,
    );
    assert.ok(
      runLock >= 0
      && terminationLock > runLock
      && runtimeLock > terminationLock
      && attemptLock > runtimeLock
      && recoveryLock > attemptLock
      && claimLock > recoveryLock
      && completionLock > claimLock
      && effectLock > completionLock,
      "compound terminalization must preserve the frozen lock chain",
    );
    const claimUpdate = source.indexOf("UPDATE claim_log");
    const attemptUpdate = source.indexOf("UPDATE execution_attempts", claimUpdate);
    const runtimeUpdate = source.indexOf(
      "releaseRuntimeSessionForTerminalRunInTransactionV1(",
      attemptUpdate,
    );
    const completionUpdate = source.indexOf(
      "terminalizeRuntimeCompletionForRunInTransactionV1(",
      runtimeUpdate,
    );
    const effectUpdate = source.indexOf("Mandatory-effect is an explicit Task-6 mutation no-op", completionUpdate);
    const terminationUpdate = source.indexOf(
      "terminalizeRunTerminationRequestInTransactionV1(",
      effectUpdate,
    );
    const runUpdate = source.indexOf("UPDATE runs\n          SET status = $2", terminationUpdate);
    const claimResolver = source.indexOf(
      "resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(",
      runUpdate,
    );
    const attemptResolver = source.indexOf(
      "resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(",
      claimResolver,
    );
    const runtimeResolver = source.indexOf(
      "resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1(",
      attemptResolver,
    );
    const completionResolver = source.indexOf(
      "resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(",
      runtimeResolver,
    );
    const effectPreflightFactConsumption = source.indexOf(
      "authenticatedMandatoryEffectFacts.delete(mandatoryEffectFact(effect))",
      completionResolver,
    );
    const terminationResolver = source.indexOf(
      "resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1(",
      completionResolver,
    );
    const runResolver = source.indexOf(
      "resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(",
      terminationResolver,
    );
    const firstClose = source.indexOf("closeInternalProductionOwnerReservationV1(", runResolver);
    assert.ok(
      effectPreflight > effectLock
      && effectPreflightFact > effectPreflight
      && claimUpdate > effectPreflight
      && attemptUpdate > claimUpdate
      && runtimeUpdate > attemptUpdate
      && completionUpdate > runtimeUpdate
      && effectUpdate > completionUpdate
      && terminationUpdate > effectUpdate
      && runUpdate > terminationUpdate
      && claimResolver > runUpdate
      && attemptResolver > claimResolver
      && runtimeResolver > attemptResolver
      && completionResolver > runtimeResolver
      && effectPreflightFactConsumption > completionResolver
      && terminationResolver > effectPreflightFactConsumption
      && runResolver > terminationResolver
      && firstClose > runResolver,
      "Task 6 must finish mutate-all and resolve-all in fixed category order before the first close",
    );
    assert.equal(source.match(/async function normalizeTask5TerminalCompletionContractInTransactionV1\(/g)?.length, 1);
    assert.equal(source.match(/await normalizeTask5TerminalCompletionContractInTransactionV1\(/g)?.length, 1);
    assert.equal(source.includes("export async function normalizeTask5TerminalCompletionContractInTransactionV1"), false);
    assert.equal(source.match(/async function authenticateTask5ClosedMandatoryEffectReplayInTransactionV1\(/g)?.length, 1);
    assert.equal(source.match(/await authenticateTask5ClosedMandatoryEffectReplayInTransactionV1\(sql, mandatoryEffect\)/g)?.length, 1);
    assert.equal(source.includes("export async function authenticateTask5ClosedMandatoryEffectReplayInTransactionV1"), false);
    const reconciledMutationGate = source.slice(
      source.indexOf("const reconciledMutations ="),
      source.indexOf("if (!alreadyTerminal)", source.indexOf("const reconciledMutations =")),
    );
    for (const exactCounter of [
      "closedClaims",
      "closedAttempts",
      "recoverySettlement.closedDeliveries",
      "recoverySettlement.closedRecoveryCases",
      "changedSteps",
      "changedStories",
      "completionMutations.length",
      "releasedRuntimeIds.length",
    ]) {
      assert.ok(
        reconciledMutationGate.includes(exactCounter),
        `historical reconciliation event gate must include ${exactCounter}`,
      );
    }
    const completionRepositorySource = await readFile(path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/execution/runtime-completion.ts",
    ), "utf8");
    const completionTerminalHelper = completionRepositorySource.slice(
      completionRepositorySource.indexOf("export async function terminalizeRuntimeCompletionForRunInTransactionV1("),
      completionRepositorySource.indexOf("/** Canonical run terminalization rejects", completionRepositorySource.indexOf(
        "export async function terminalizeRuntimeCompletionForRunInTransactionV1(",
      )),
    );
    assert.equal(completionTerminalHelper.includes("expectedState"), false);
    assert.equal(completionTerminalHelper.includes("expectedApplyPhase"), false);
    assert.equal(completionTerminalHelper.includes("resolution:"), false);
    assert.equal(completionTerminalHelper.includes("result?:"), false);
    assert.match(completionTerminalHelper, /terminalRunStatus: "completed" \| "failed" \| "cancelled"/);
    assert.equal(completionTerminalHelper.includes('terminalRunStatus === "cancelled"'), false);
    assert.equal(
      /completion\.state === "processing"[\s\S]{0,300}input\.status === "cancelled"/.test(source),
      false,
    );
    const phase0Call = source.indexOf("await normalizeTask5TerminalCompletionContractInTransactionV1(");
    assert.ok(phase0Call >= 0 && phase0Call < claimUpdate, "Task 5 normalization must finish before Task 6 mutation phases");
    const effectRepository = await readFile(path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/execution/runtime-completion-effect-repository.ts",
    ), "utf8");
    assert.equal(effectRepository.includes("terminalizeMandatoryEffectForRunInTransactionV1"), false);
    const db = await import("../../src/db-pg.js");
    assert.equal("createInternalProductionWorkflowRunTerminalOwnerAuthorityV1" in db, false);
  });

  it("rejects an already-terminal replay while any termination request remains open", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-replay-open-termination";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: identity,
        });
      });
      const requestId = "RTR_terminal-replay-open01";
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "task6-open-replay",
        diagnostic: "open termination must block terminal replay",
        requestId,
      });
      await database.sql`UPDATE runs SET status='failed' WHERE id=${runId}`;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "historical terminal replay",
        }),
        /RUN_TERMINAL_REPLAY_TERMINATION_OPEN/,
      );
      const state = await database.sql<Array<{ request_state: string; owner_state: string }>>`
        SELECT request.state AS request_state,owner.state AS owner_state
          FROM run_termination_requests request
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='termination' AND owner.owner_key=request.request_id
         WHERE request.request_id=${requestId}
      `;
      assert.deepEqual(state.map((row) => ({ ...row })), [{
        request_state: "requested",
        owner_state: "bound",
      }]);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a completed transition when any terminalized termination inventory exists", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completed-terminalized-termination";
      const requestId = "RTR_completed-terminalized-inventory";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: identity,
        });
      });
      await seedBoundDrainedTermination(database, {
        runId,
        requestId,
        targetStatus: "failed",
        diagnostic: "terminalized inventory must not disappear from completed classification",
      });
      await database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE run_termination_requests
              SET state='terminalized',terminalized_at=NOW(),updated_at=NOW()
            WHERE request_id=$1`,
          [requestId],
        );
        await transaction.unsafe(
          "UPDATE runs SET status='running',updated_at=NOW() WHERE id=$1",
          [runId],
        );
      });
      const before = (await database.sql<Array<{
        run_status: string;
        request_state: string;
        owner_state: string;
        terminal_event_count: number;
      }>>`
        SELECT run_row.status AS run_status,request.state AS request_state,
               owner.state AS owner_state,
               (SELECT COUNT(*)::integer FROM operational_outbox event
                 WHERE event.aggregate_type='run' AND event.aggregate_id=${runId}
                   AND event.event_type='run.terminal') AS terminal_event_count
          FROM runs run_row
          JOIN run_termination_requests request ON request.run_id=run_row.id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='termination' AND owner.owner_key=request.request_id
         WHERE run_row.id=${runId}
      `)[0]!;
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "completed must reject incompatible termination inventory",
        }),
        /RUN_TERMINAL_TERMINATION_INVENTORY_INVALID/,
      );
      const after = (await database.sql<Array<typeof before>>`
        SELECT run_row.status AS run_status,request.state AS request_state,
               owner.state AS owner_state,
               (SELECT COUNT(*)::integer FROM operational_outbox event
                 WHERE event.aggregate_type='run' AND event.aggregate_id=${runId}
                   AND event.event_type='run.terminal') AS terminal_event_count
          FROM runs run_row
          JOIN run_termination_requests request ON request.run_id=run_row.id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='termination' AND owner.owner_key=request.request_id
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...after }, { ...before });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes a historical reconciliation event for step and story residue only", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-historical-step-residue";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: identity,
        });
      });
      await database.sql`
        INSERT INTO steps
          (id,run_id,step_id,agent_id,step_index,input_template,expects,status,current_story_id)
        VALUES
          ('run-terminal-historical-step',${runId},'implement','feature-dev_developer',1,'','','running',
           'run-terminal-historical-story')
      `;
      await database.sql`
        INSERT INTO stories
          (id,run_id,story_index,story_id,title,status,claimed_by,claim_generation)
        VALUES
          ('run-terminal-historical-story',${runId},1,'US-001','Historical residue','running',
           'feature-dev_developer',1)
      `;
      await database.sql`UPDATE runs SET status='failed',updated_at=NOW() WHERE id=${runId}`;
      const reconciled = await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "reconcile only historical step and story residue",
      });
      assert.equal(reconciled.changedSteps, 1);
      assert.equal(reconciled.changedStories, 1);
      const events = await database.sql<Array<{
        reason_code: string;
        changed_steps: number;
        changed_stories: number;
      }>>`
        SELECT payload->>'reasonCode' AS reason_code,
               (payload->>'changedSteps')::integer AS changed_steps,
               (payload->>'changedStories')::integer AS changed_stories
          FROM operational_outbox
         WHERE aggregate_type='run' AND aggregate_id=${runId}
           AND event_type='run.terminal'
      `;
      assert.deepEqual(events.map((row) => ({ ...row })), [{
        reason_code: "historical_terminal_residue_reconciled",
        changed_steps: 1,
        changed_stories: 1,
      }]);
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "exact historical replay",
      });
      assert.equal((await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM operational_outbox
         WHERE aggregate_type='run' AND aggregate_id=${runId}
           AND event_type='run.terminal'
      `)[0]!.count, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("authenticates an applied Task 5 effect while atomically accepting its completion", async () => {
    const database = await createIsolatedTestDatabase();
    const postgresClient = (await import("postgres")).default;
    const blocker = postgresClient(database.url, { max: 1 });
    try {
      const runId = "run-terminal-completion-effect";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: identity,
        });
      });
      const seeded = await seedActiveStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-completion-effect",
        fenceToken: () => "8".repeat(64),
      });
      const attempt = await attempts.reserve(exactProductReservation({
        claimId: seeded.claimId,
        runId,
        storyId: "US-002",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${seeded.claimId}`],
      }));
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_run-terminal-completion-effect",
        runId,
        stepDbId: seeded.stepDbId,
        workflowStepId: "implement",
        storyDbId: seeded.storyDbId,
        storyId: "US-002",
        claimId: seeded.claimId,
        attemptId: attempt.attempt.attemptId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "terminal-completion-manager",
      });
      await sessions.markStarting({
        sessionId: session.sessionId,
        ownerInstanceId: "terminal-completion-manager",
      });
      await sessions.markRunning({
        sessionId: session.sessionId,
        ownerInstanceId: "terminal-completion-manager",
        sessionKey: "terminal-completion-session",
      });
      const envelope: ClaimEnvelopeV1 = {
        schema: "setfarm.claim-envelope.v1",
        protocol: "shadow",
        issuedAt: "2026-07-13T12:00:00.000Z",
        stepId: seeded.stepDbId,
        workflowStepId: "implement",
        runId,
        storyId: "US-002",
        storyDbId: seeded.storyDbId,
        claimId: seeded.claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        claimGeneration: 1,
        attempt: {
          attemptId: attempt.attempt.attemptId,
          generation: attempt.attempt.generation,
          fenceToken: attempt.attempt.fenceToken,
        },
      };
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope,
        output: "STATUS: done\nSUMMARY: terminal transition applies the effect",
        requestId: "RCR_run-terminal-completion-effect",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "terminal-completion-manager",
      });
      await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: "terminal-completion-manager",
        evidence: RUNTIME_DRAIN_EVIDENCE,
      });
      const processing = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "terminal-completion-manager",
      });
      assert.ok(processing.leaseExpiresAt);
      const terminalResult = {
        runStatus: "failed",
        advanced: false,
        runCompleted: false,
        runFailed: true,
      };
      await runWithRuntimeCompletionOwner({
        requestId: processing.requestId,
        ownerInstanceId: processing.ownerInstanceId!,
        leaseExpiresAt: processing.leaseExpiresAt!,
        ownerAttemptCount: processing.ownerAttemptCount,
      }, () => database.sql.begin((transaction) => markRuntimeCompletionOwnerCommittedInTransaction(
        transaction,
        {
          claimId: seeded.claimId,
          claimOutcome: "failed",
          plan: createSingleEffectCompletionPlanDescriptorV1({
            kind: "terminal_transition",
            continuation: { type: "terminal_finalize" },
            effectPayload: { runStatus: "failed" },
          }),
        },
      )));
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const leasedEffect = await effects.claimNext({
        requestId: processing.requestId,
        ownerInstanceId: "terminal-completion-manager",
      });
      assert.ok(leasedEffect?.leaseToken);
      await effects.settle({
        requestId: processing.requestId,
        effectKey: leasedEffect!.effectKey,
        ownerInstanceId: "terminal-completion-manager",
        leaseToken: leasedEffect!.leaseToken!,
        resolution: "applied",
        result: terminalResult,
        evidence: { schema: "setfarm.test-task6-terminal-effect.v1" },
      });
      await completions.markEffectsCommitted({
        requestId: processing.requestId,
        ownerInstanceId: "terminal-completion-manager",
        ownerAttemptCount: processing.ownerAttemptCount,
        result: terminalResult,
      });
      const terminationRequestId = "RTR_run-terminal-completion-effect";
      await seedBoundDrainedTermination(database, {
        runId,
        requestId: terminationRequestId,
        targetStatus: "failed",
        diagnostic: "terminal completion effect",
      });
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task6_completion_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='completion-owner' AND OLD.state='bound' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK6_COMPLETION_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task6_completion_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_task6_completion_close_v1()
      `);
      const terminate = (terminalSql: postgres.Sql = database.sql) => runWithRuntimeCompletionOwner({
        requestId: processing.requestId,
        ownerInstanceId: processing.ownerInstanceId!,
        leaseExpiresAt: processing.leaseExpiresAt!,
        ownerAttemptCount: processing.ownerAttemptCount,
      }, () => transitionRunToTerminal(terminalSql, {
        runId,
        status: "failed",
        diagnostic: "completion decided terminal failure",
        drainedTerminationRequestId: terminationRequestId,
      }));

      await database.sql.unsafe(`CREATE TABLE task6_mutation_failure_point_v1 (table_name text PRIMARY KEY)`);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task6_category_mutation_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF EXISTS (SELECT 1 FROM task6_mutation_failure_point_v1 point
                      WHERE point.table_name=TG_TABLE_NAME) THEN
            RAISE EXCEPTION 'TEST_TASK6_MUTATION_REJECTED:%',TG_TABLE_NAME;
          END IF;
          RETURN NEW;
        END $$
      `);
      for (const [triggerName, tableName, columnName] of [
        ["task6_claim_mutation_v1", "claim_log", "outcome"],
        ["task6_attempt_mutation_v1", "execution_attempts", "disposition"],
        ["task6_runtime_mutation_v1", "runtime_sessions", "state"],
        ["task6_completion_mutation_v1", "runtime_completion_requests", "state"],
        ["task6_termination_mutation_v1", "run_termination_requests", "state"],
        ["task6_run_mutation_v1", "runs", "status"],
      ] as const) {
        await database.sql.unsafe(
          `CREATE TRIGGER ${triggerName}
           BEFORE UPDATE OF ${columnName} ON ${tableName}
           FOR EACH ROW EXECUTE FUNCTION reject_task6_category_mutation_v1()`,
        );
      }
      for (const tableName of [
        "claim_log",
        "execution_attempts",
        "runtime_sessions",
        "runtime_completion_requests",
        "run_termination_requests",
        "runs",
      ]) {
        await database.sql`INSERT INTO task6_mutation_failure_point_v1 (table_name) VALUES (${tableName})`;
        await assert.rejects(terminate(), /TEST_TASK6_MUTATION_REJECTED/);
        await database.sql`DELETE FROM task6_mutation_failure_point_v1`;
        const prefix = (await database.sql<Array<{
          run_status: string;
          completion_state: string;
          termination_state: string;
        }>>`
          SELECT run_row.status AS run_status,completion.state AS completion_state,
                 termination.state AS termination_state
            FROM runs run_row
            JOIN runtime_completion_requests completion ON completion.run_id=run_row.id
            JOIN run_termination_requests termination ON termination.run_id=run_row.id
           WHERE run_row.id=${runId}
        `)[0]!;
        assert.deepEqual({ ...prefix }, {
          run_status: "failing",
          completion_state: "processing",
          termination_state: "drained",
        });
      }
      for (const [triggerName, tableName] of [
        ["task6_claim_mutation_v1", "claim_log"],
        ["task6_attempt_mutation_v1", "execution_attempts"],
        ["task6_runtime_mutation_v1", "runtime_sessions"],
        ["task6_completion_mutation_v1", "runtime_completion_requests"],
        ["task6_termination_mutation_v1", "run_termination_requests"],
        ["task6_run_mutation_v1", "runs"],
      ] as const) {
        await database.sql.unsafe(`DROP TRIGGER ${triggerName} ON ${tableName}`);
      }

      const compoundVisibilitySnapshot = async () => ({ ...(await database.sql<Array<{
        run_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        runtime_state: string;
        completion_state: string;
        termination_state: string;
        owner_rows: unknown;
        head_row: unknown;
        terminal_event_count: number;
      }>>`
        SELECT run_row.status AS run_status,claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,runtime.state AS runtime_state,
               completion.state AS completion_state,termination.state AS termination_state,
               (SELECT jsonb_agg(to_jsonb(owner) ORDER BY owner.category,owner.owner_key)
                  FROM internal_production_owner_reservations_v1 owner) AS owner_rows,
               (SELECT to_jsonb(head) FROM internal_production_owner_admission_head_v1 head
                 WHERE head.singleton) AS head_row,
               (SELECT COUNT(*)::integer FROM operational_outbox event
                 WHERE event.aggregate_type='run' AND event.aggregate_id=${runId}
                   AND event.event_type='run.terminal') AS terminal_event_count
          FROM runs run_row
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN runtime_sessions runtime ON runtime.run_id=run_row.id
          JOIN runtime_completion_requests completion ON completion.run_id=run_row.id
          JOIN run_termination_requests termination ON termination.run_id=run_row.id
         WHERE run_row.id=${runId}
      `)[0]! });
      const preCompoundVisibility = await compoundVisibilitySnapshot();
      const latchKey = 6_260_406;
      await database.sql.unsafe("CREATE SEQUENCE task6_after_cas_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task6_after_cas_latch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task6_after_cas_latch_v1');
          PERFORM pg_advisory_xact_lock(${latchKey});
          RETURN NEW;
        END $$
      `);
      const waitForAfterCasLatch = async () => {
        for (let attemptIndex = 0; attemptIndex < 200; attemptIndex += 1) {
          const state = await database.sql<Array<{ is_called: boolean }>>`
            SELECT is_called FROM task6_after_cas_latch_v1
          `;
          if (state[0]?.is_called) return;
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
        throw new Error("TEST_TASK6_AFTER_CAS_LATCH_TIMEOUT");
      };
      const exerciseAfterCasLatch = async (
        triggerName: string,
        tableName: string,
        columnName: string,
      ) => {
        await database.sql.unsafe(
          `CREATE TRIGGER ${triggerName}
             AFTER UPDATE OF ${columnName} ON ${tableName}
             FOR EACH ROW EXECUTE FUNCTION task6_after_cas_latch_v1()`,
        );
        let releaseBlocker!: () => void;
        let blockerAcquired!: () => void;
        const release = new Promise<void>((resolve) => { releaseBlocker = resolve; });
        const acquired = new Promise<void>((resolve) => { blockerAcquired = resolve; });
        const blocking = Promise.resolve(blocker.begin(async (transaction) => {
          await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [latchKey]);
          blockerAcquired();
          await release;
        }));
        await acquired;
        const transition = assert.rejects(terminate(), /TEST_TASK6_COMPLETION_CLOSE_REJECTED/);
        await waitForAfterCasLatch();
        assert.deepEqual(await compoundVisibilitySnapshot(), preCompoundVisibility);
        releaseBlocker();
        await blocking;
        await transition;
        await database.sql.unsafe(`DROP TRIGGER ${triggerName} ON ${tableName}`);
        await database.sql.unsafe("SELECT setval('task6_after_cas_latch_v1',1,false)");
      };
      for (const [triggerName, tableName, columnName] of [
        ["task6_after_claim_cas_v1", "claim_log", "outcome"],
        ["task6_after_attempt_cas_v1", "execution_attempts", "disposition"],
        ["task6_after_runtime_cas_v1", "runtime_sessions", "state"],
        ["task6_after_completion_cas_v1", "runtime_completion_requests", "state"],
        ["task6_after_termination_cas_v1", "run_termination_requests", "state"],
        ["task6_after_run_cas_v1", "runs", "status"],
      ] as const) {
        await exerciseAfterCasLatch(triggerName, tableName, columnName);
      }
      await database.sql.unsafe("DROP FUNCTION task6_after_cas_latch_v1()");
      await database.sql.unsafe("DROP SEQUENCE task6_after_cas_latch_v1");

      const originalEffect = (await database.sql<Array<{
        ordinal: number;
        effect_type: string;
        input_hash: string;
        payload: unknown;
      }>>`
        SELECT ordinal,effect_type,input_hash,payload
          FROM runtime_completion_effects
         WHERE request_id=${processing.requestId}
      `)[0]!;
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task6_first_mutation_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.outcome IS NULL AND NEW.outcome IS NOT NULL THEN
            RAISE EXCEPTION 'TEST_TASK6_FIRST_MUTATION_REACHED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task6_first_mutation_v1
        BEFORE UPDATE OF outcome ON claim_log
        FOR EACH ROW EXECUTE FUNCTION reject_task6_first_mutation_v1()
      `);
      const manifestDrifts = [
        {
          mutate: () => database.sql`
            UPDATE runtime_completion_effects SET ordinal=ordinal+7
             WHERE request_id=${processing.requestId}
          `,
        },
        {
          mutate: () => database.sql`
            UPDATE runtime_completion_effects SET effect_type='terminal_transition_tampered'
             WHERE request_id=${processing.requestId}
          `,
        },
        {
          mutate: () => database.sql`
            UPDATE runtime_completion_effects SET input_hash=${"0".repeat(64)}
             WHERE request_id=${processing.requestId}
          `,
        },
        {
          mutate: () => database.sql`
            UPDATE runtime_completion_effects
               SET payload=jsonb_set(payload,'{effect}',jsonb_build_object('runStatus','cancelled'))
             WHERE request_id=${processing.requestId}
          `,
        },
      ];
      for (const drift of manifestDrifts) {
        await database.sql.unsafe(`
          ALTER TABLE runtime_completion_effects
          DISABLE TRIGGER trg_runtime_completion_effect_manifest_guard_v1
        `);
        await drift.mutate();
        await database.sql.unsafe(`
          ALTER TABLE runtime_completion_effects
          ENABLE TRIGGER trg_runtime_completion_effect_manifest_guard_v1
        `);
        await assert.rejects(
          terminate(),
          /RUNTIME_COMPLETION_MANIFEST_(EFFECT_ORDER_INVALID|EFFECT_BINDING_INVALID)/,
        );
        await database.sql.unsafe(`
          ALTER TABLE runtime_completion_effects
          DISABLE TRIGGER trg_runtime_completion_effect_manifest_guard_v1
        `);
        await database.sql.unsafe(
          `UPDATE runtime_completion_effects
              SET ordinal=$2,effect_type=$3,input_hash=$4,payload=$5::text::jsonb
            WHERE request_id=$1`,
          [
            processing.requestId,
            originalEffect.ordinal,
            originalEffect.effect_type,
            originalEffect.input_hash,
            JSON.stringify(originalEffect.payload),
          ],
        );
        await database.sql.unsafe(`
          ALTER TABLE runtime_completion_effects
          ENABLE TRIGGER trg_runtime_completion_effect_manifest_guard_v1
        `);
      }
      for (const [effectState, extraSet] of [
        ["pending", "lease_token=NULL,lease_expires_at=NULL,applied_at=NULL"],
        [
          "leased",
          "lease_token='task6-open-lease',lease_expires_at=NOW()+INTERVAL '1 hour',applied_at=NULL",
        ],
        [
          "quarantined",
          "lease_token=NULL,lease_expires_at=NULL,applied_at=NULL,result=jsonb_build_object('diagnostic','task6 open quarantine')",
        ],
      ] as const) {
        await assert.rejects(
          runWithRuntimeCompletionOwner({
            requestId: processing.requestId,
            ownerInstanceId: processing.ownerInstanceId!,
            leaseExpiresAt: processing.leaseExpiresAt!,
            ownerAttemptCount: processing.ownerAttemptCount,
          }, () => database.sql.begin(async (transaction) => {
            await transaction.unsafe(
              `UPDATE runtime_completion_effects
                  SET state=$2,${extraSet},updated_at=NOW()
                WHERE request_id=$1`,
              [processing.requestId, effectState],
            );
            return transitionRunToTerminalInTransaction(transaction, {
              runId,
              status: "failed",
              diagnostic: `mandatory effect ${effectState} must block`,
              drainedTerminationRequestId: terminationRequestId,
            });
          })),
          /(RUNTIME_COMPLETION_MANDATORY_EFFECTS_PENDING|RUN_TERMINAL_EFFECT_(OPEN|QUARANTINED_OPEN))/,
        );
      }
      for (const corruptSidecar of [
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `DELETE FROM internal_production_owner_reservations_v1
            WHERE category='mandatory-effect'
              AND owner_key::jsonb->>'requestId'=$1`,
          [processing.requestId],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET state='bound',close_kind=NULL,terminal_owner_ref=NULL,
                  terminal_owner_hash=NULL,close_head_predecessor_hash=NULL,
                  close_head_successor_hash=NULL,preserved_fence_ref=NULL,
                  preserved_fence_hash=NULL,close_ref=NULL,close_hash=NULL,
                  close_payload=NULL
            WHERE category='mandatory-effect'
              AND owner_key::jsonb->>'requestId'=$1`,
          [processing.requestId],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1 run_owner
              SET reservation_payload=jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        run_owner.reservation_payload,
                        '{producerImplementationId}',
                        to_jsonb('a-mandatory-effect-v1'::text)
                      ),
                      '{ownerKey}',effect_owner.reservation_payload->'ownerKey'
                    ),
                    '{ownerKeyHash}',effect_owner.reservation_payload->'ownerKeyHash'
                  )
             FROM internal_production_owner_reservations_v1 effect_owner
            WHERE run_owner.category='run' AND run_owner.owner_key=$1
              AND effect_owner.category='mandatory-effect'
              AND effect_owner.owner_key::jsonb->>'requestId'=$2`,
          [runId, processing.requestId],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET close_hash=$2
            WHERE category='mandatory-effect'
              AND owner_key::jsonb->>'requestId'=$1`,
          [processing.requestId, "0".repeat(64)],
        ),
        (transaction: postgres.TransactionSql) => transaction.unsafe(
          `UPDATE internal_production_owner_reservations_v1
              SET producer_implementation_id='a-runtime-run-v1',
                  reservation_payload=jsonb_set(
                    reservation_payload,'{producerImplementationId}',
                    to_jsonb('a-runtime-run-v1'::text)
                  ),
                  binding_payload=jsonb_set(
                    binding_payload,'{producerImplementationId}',
                    to_jsonb('a-runtime-run-v1'::text)
                  )
            WHERE category='mandatory-effect'
              AND owner_key::jsonb->>'requestId'=$1`,
          [processing.requestId],
        ),
      ]) {
        await assert.rejects(
          runWithRuntimeCompletionOwner({
            requestId: processing.requestId,
            ownerInstanceId: processing.ownerInstanceId!,
            leaseExpiresAt: processing.leaseExpiresAt!,
            ownerAttemptCount: processing.ownerAttemptCount,
          }, () => database.sql.begin(async (transaction) => {
            await corruptSidecar(transaction);
            return transitionRunToTerminalInTransaction(transaction, {
              runId,
              status: "failed",
              diagnostic: "mandatory effect sidecar corruption",
              drainedTerminationRequestId: terminationRequestId,
            });
          })),
          /(RUN_TERMINAL_MANDATORY_EFFECT_(REPLAY|CLOSE)_INVALID|INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_UNAVAILABLE)/,
        );
      }
      await database.sql.unsafe(`
        DROP TRIGGER reject_task6_first_mutation_v1 ON claim_log
      `);

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            `UPDATE internal_production_owner_reservations_v1
                SET canonical_owner_identity=jsonb_set(
                      canonical_owner_identity,'{ownerKey}',to_jsonb('task6-corrupt-run-owner'::text)
                    ),
                    binding_payload=jsonb_set(
                      binding_payload,'{canonicalOwnerIdentity,ownerKey}',
                      to_jsonb('task6-corrupt-run-owner'::text)
                    )
              WHERE category='run' AND owner_key=$1`,
            [runId],
          );
          return transitionRunToTerminalInTransaction(transaction, {
            runId,
            status: "failed",
            diagnostic: "final resolver corruption must roll back every mutation",
            drainedTerminationRequestId: terminationRequestId,
          });
        }),
        /INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION/,
      );

      await assert.rejects(terminate(), /TEST_TASK6_COMPLETION_CLOSE_REJECTED/);
      const rolledBack = (await database.sql<Array<{
        run_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        completion_phase: string;
        completion_owner_state: string;
        effect_count: number;
      }>>`
        SELECT run_row.status AS run_status,claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,
               completion.apply_phase AS completion_phase,
               completion_owner.state AS completion_owner_state,
               (SELECT COUNT(*)::integer FROM runtime_completion_effects effect
                 WHERE effect.request_id=completion.request_id) AS effect_count
          FROM runs run_row
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN runtime_completion_requests completion ON completion.claim_id=claim.id
          JOIN internal_production_owner_reservations_v1 completion_owner
            ON completion_owner.category='completion-owner'
           AND completion_owner.owner_key=completion.request_id
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...rolledBack }, {
        run_status: "failing",
        claim_outcome: null,
        attempt_disposition: "running",
        completion_phase: "effects_committed",
        completion_owner_state: "bound",
        effect_count: 1,
      });

      await database.sql.unsafe(`
        DROP TRIGGER reject_task6_completion_close_v1
        ON internal_production_owner_reservations_v1
      `);

      const backendLossSql = new Proxy(database.sql, {
        get(target, property, receiver) {
          if (property !== "begin") return Reflect.get(target, property, receiver);
          return (callback: (transaction: postgres.TransactionSql) => Promise<unknown>) => (
            database.sql.begin(async (transaction) => {
              await callback(transaction);
              throw new Error("TEST_TASK6_BACKEND_LOST_BEFORE_COMMIT");
            })
          );
        },
      });
      await assert.rejects(
        terminate(backendLossSql),
        /TEST_TASK6_BACKEND_LOST_BEFORE_COMMIT/,
      );
      assert.deepEqual(await compoundVisibilitySnapshot(), preCompoundVisibility);

      let releasePreAck!: () => void;
      let preAckReached!: () => void;
      const holdPreAck = new Promise<void>((resolve) => { releasePreAck = resolve; });
      const preAckReady = new Promise<void>((resolve) => { preAckReached = resolve; });
      const preAckTransition = assert.rejects(
        runWithRuntimeCompletionOwner({
          requestId: processing.requestId,
          ownerInstanceId: processing.ownerInstanceId!,
          leaseExpiresAt: processing.leaseExpiresAt!,
          ownerAttemptCount: processing.ownerAttemptCount,
        }, () => database.sql.begin(async (transaction) => {
          await transitionRunToTerminalInTransaction(transaction, {
            runId,
            status: "failed",
            diagnostic: "pre-ack compound visibility",
            drainedTerminationRequestId: terminationRequestId,
          });
          preAckReached();
          await holdPreAck;
          throw new Error("TEST_TASK6_PRE_ACK_ROLLBACK");
        })),
        /TEST_TASK6_PRE_ACK_ROLLBACK/,
      );
      await preAckReady;
      assert.deepEqual(await compoundVisibilitySnapshot(), preCompoundVisibility);
      releasePreAck();
      await preAckTransition;

      await database.sql.unsafe("CREATE SEQUENCE task6_after_close_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task6_after_close_latch_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task6_after_close_latch_v1');
          PERFORM pg_advisory_xact_lock(${latchKey});
          RETURN NEW;
        END $$
      `);
      const waitForAfterCloseLatch = async () => {
        for (let attemptIndex = 0; attemptIndex < 200; attemptIndex += 1) {
          const state = await database.sql<Array<{ is_called: boolean }>>`
            SELECT is_called FROM task6_after_close_latch_v1
          `;
          if (state[0]?.is_called) return;
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }
        throw new Error("TEST_TASK6_AFTER_CLOSE_LATCH_TIMEOUT");
      };
      for (const category of [
        "claim",
        "execution-attempt",
        "runtime-session",
        "completion-owner",
        "termination",
        "run",
      ] as const) {
        const triggerName = `task6_after_${category.replaceAll("-", "_")}_close_v1`;
        await database.sql.unsafe(
          `CREATE TRIGGER ${triggerName}
             AFTER UPDATE OF state ON internal_production_owner_reservations_v1
             FOR EACH ROW
             WHEN (OLD.state='bound' AND NEW.state='closed' AND NEW.category='${category}')
             EXECUTE FUNCTION task6_after_close_latch_v1()`,
        );
        let releaseBlocker!: () => void;
        let blockerAcquired!: () => void;
        const release = new Promise<void>((resolve) => { releaseBlocker = resolve; });
        const acquired = new Promise<void>((resolve) => { blockerAcquired = resolve; });
        const blocking = Promise.resolve(blocker.begin(async (transaction) => {
          await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [latchKey]);
          blockerAcquired();
          await release;
        }));
        await acquired;
        const closeTransition = assert.rejects(
          runWithRuntimeCompletionOwner({
            requestId: processing.requestId,
            ownerInstanceId: processing.ownerInstanceId!,
            leaseExpiresAt: processing.leaseExpiresAt!,
            ownerAttemptCount: processing.ownerAttemptCount,
          }, () => database.sql.begin(async (transaction) => {
            await transitionRunToTerminalInTransaction(transaction, {
              runId,
              status: "failed",
              diagnostic: `after ${category} close visibility`,
              drainedTerminationRequestId: terminationRequestId,
            });
            throw new Error("TEST_TASK6_AFTER_CLOSE_ROLLBACK");
          })),
          /TEST_TASK6_AFTER_CLOSE_ROLLBACK/,
        );
        await waitForAfterCloseLatch();
        assert.deepEqual(await compoundVisibilitySnapshot(), preCompoundVisibility);
        releaseBlocker();
        await blocking;
        await closeTransition;
        await database.sql.unsafe(
          `DROP TRIGGER ${triggerName} ON internal_production_owner_reservations_v1`,
        );
        await database.sql.unsafe("SELECT setval('task6_after_close_latch_v1',1,false)");
      }
      await database.sql.unsafe("DROP FUNCTION task6_after_close_latch_v1()");
      await database.sql.unsafe("DROP SEQUENCE task6_after_close_latch_v1");

      await database.sql.unsafe(`CREATE TABLE task6_close_failure_point_v1 (category text PRIMARY KEY)`);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task6_category_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.state='bound' AND NEW.state='closed'
             AND EXISTS (SELECT 1 FROM task6_close_failure_point_v1 point
                          WHERE point.category=NEW.category) THEN
            RAISE EXCEPTION 'TEST_TASK6_CLOSE_REJECTED:%',NEW.category;
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task6_category_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_task6_category_close_v1()
      `);
      for (const category of [
        "claim",
        "execution-attempt",
        "runtime-session",
        "completion-owner",
        "termination",
        "run",
      ]) {
        await database.sql`INSERT INTO task6_close_failure_point_v1 (category) VALUES (${category})`;
        await assert.rejects(terminate(), /TEST_TASK6_CLOSE_REJECTED/);
        await database.sql`DELETE FROM task6_close_failure_point_v1`;
      }
      await database.sql.unsafe(`
        DROP TRIGGER reject_task6_category_close_v1
        ON internal_production_owner_reservations_v1
      `);
      const terminal = await terminate();
      assert.equal(terminal.status, "failed");
      const committed = (await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        completion_state: string;
        completion_phase: string;
        completion_owner_state: string;
        effect_state: string;
        effect_owner_state: string;
        effect_owner_updated_at: string;
      }>>`
        SELECT run_row.status AS run_status,claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,
               completion.state AS completion_state,
               completion.apply_phase AS completion_phase,
               completion_owner.state AS completion_owner_state,
               effect.state AS effect_state,effect_owner.state AS effect_owner_state,
               effect_owner.updated_at::text AS effect_owner_updated_at
          FROM runs run_row
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN runtime_completion_requests completion ON completion.claim_id=claim.id
          JOIN internal_production_owner_reservations_v1 completion_owner
            ON completion_owner.category='completion-owner'
           AND completion_owner.owner_key=completion.request_id
          JOIN runtime_completion_effects effect ON effect.request_id=completion.request_id
          JOIN internal_production_owner_reservations_v1 effect_owner
            ON effect_owner.category='mandatory-effect'
           AND effect_owner.owner_key::jsonb->>'requestId'=effect.request_id
           AND effect_owner.owner_key::jsonb->>'effectKey'=effect.effect_key
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...committed }, {
        run_status: "failed",
        claim_outcome: "failed",
        attempt_disposition: "failed",
        completion_state: "accepted",
        completion_phase: "effects_committed",
        completion_owner_state: "closed",
        effect_state: "applied",
        effect_owner_state: "closed",
        effect_owner_updated_at: committed.effect_owner_updated_at,
      });
      const replay = await terminate();
      assert.equal(replay.status, "failed");
      const afterReplay = (await database.sql<Array<{ effect_owner_updated_at: string }>>`
        SELECT owner.updated_at::text AS effect_owner_updated_at
          FROM internal_production_owner_reservations_v1 owner
         WHERE owner.category='mandatory-effect'
      `)[0]!;
      assert.equal(afterReplay.effect_owner_updated_at, committed.effect_owner_updated_at);
    } finally {
      await blocker.end({ timeout: 1 });
      await database.cleanup();
    }
  });

  it("refuses to erase active shadow owners without a drained failure request", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-failed";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-fail1",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "terminal quality failure",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      const state = await database.sql<Array<{
        run_status: string;
        step_status: string;
        story_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        meta: string;
      }>>`
        SELECT r.status AS run_status, s.status AS step_status,
               st.status AS story_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, r.meta
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({
        run_status: state[0]?.run_status,
        step_status: state[0]?.step_status,
        story_status: state[0]?.story_status,
        claim_outcome: state[0]?.claim_outcome,
        attempt_disposition: state[0]?.attempt_disposition,
      }, {
        run_status: "running",
        step_status: "running",
        story_status: "running",
        claim_outcome: null,
        attempt_disposition: "claimed",
      });
      assert.equal(state[0]!.meta, null);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a terminal run CAS whose trigger rewrites the returned run identity", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-rewritten-cas";
      const rewrittenRunId = `${runId}-rewritten`;
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: runId },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
        });
      });
      const { stepDbId, storyDbId, claimId } = await seedActiveStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-rewritten-cas",
        fenceToken: () => "6".repeat(64),
      });
      const attempt = await attempts.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const sessions = createRuntimeSessionRepository(database.sql);
      const sessionId = "RTS_run-terminal-rewritten-cas";
      await sessions.reserve({
        sessionId,
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-002",
        claimId,
        attemptId: attempt.attempt.attemptId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "feature-dev_developer",
        runtimeKind: "local_process",
        ownerInstanceId: "run-terminal-rewritten-cas-owner",
      });
      await database.sql`
        UPDATE runtime_sessions
           SET state='drained',drained_at=NOW(),updated_at=NOW()
         WHERE session_id=${sessionId}
      `;
      const terminationRequestId = "RTR_run-terminal-rewritten-cas";
      await seedBoundDrainedTermination(database, {
        runId,
        requestId: terminationRequestId,
        targetStatus: "failed",
        diagnostic: "rewritten terminal CAS fixture",
      });

      const snapshot = async () => ({ ...(await database.sql<Array<{
        run_rows: unknown;
        step_rows: unknown;
        story_rows: unknown;
        claim_rows: unknown;
        attempt_rows: unknown;
        runtime_rows: unknown;
        termination_rows: unknown;
        owner_rows: unknown;
        authority_rows: unknown;
        head_row: unknown;
        outbox_rows: unknown;
      }>>`
        SELECT
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
             FROM runs row WHERE row.id IN (${runId},${rewrittenRunId})) AS run_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
             FROM steps row WHERE row.run_id=${runId}) AS step_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
             FROM stories row WHERE row.run_id=${runId}) AS story_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
             FROM claim_log row WHERE row.run_id=${runId}) AS claim_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.attempt_id)
             FROM execution_attempts row WHERE row.run_id=${runId}) AS attempt_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.session_id)
             FROM runtime_sessions row WHERE row.run_id=${runId}) AS runtime_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.request_id)
             FROM run_termination_requests row WHERE row.run_id=${runId}) AS termination_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.category,row.owner_key)
             FROM internal_production_owner_reservations_v1 row) AS owner_rows,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.authority_ref)
             FROM internal_production_owner_admission_authorities_v1 row) AS authority_rows,
          (SELECT to_jsonb(row) FROM internal_production_owner_admission_head_v1 row
             WHERE row.singleton) AS head_row,
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.outbox_id)
             FROM operational_outbox row
            WHERE row.aggregate_type='run' AND row.aggregate_id IN (${runId},${rewrittenRunId})) AS outbox_rows
      `)[0]! });
      const before = await snapshot();

      await database.sql.unsafe("CREATE SEQUENCE task6_rewritten_run_cas_fired_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION task6_rewrite_terminal_run_id_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM nextval('task6_rewritten_run_cas_fired_v1');
          NEW.id := NEW.id || '-rewritten';
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER task6_rewrite_terminal_run_id_v1
        BEFORE UPDATE OF status ON runs
        FOR EACH ROW
        WHEN (OLD.id='${runId}' AND NEW.status='failed')
        EXECUTE FUNCTION task6_rewrite_terminal_run_id_v1()
      `);

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(`
            DO $$ DECLARE item record; BEGIN
              FOR item IN
                SELECT conrelid::regclass AS table_name,conname
                  FROM pg_constraint
                 WHERE contype='f' AND confrelid='runs'::regclass
              LOOP
                EXECUTE format(
                  'ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',
                  item.table_name,
                  item.conname
                );
              END LOOP;
            END $$
          `);
          await transaction.unsafe("SET CONSTRAINTS ALL DEFERRED");
          await transitionRunToTerminalInTransaction(transaction, {
            runId,
            status: "failed",
            diagnostic: "rewritten terminal CAS must fail closed",
            drainedTerminationRequestId: terminationRequestId,
          });
          throw new Error("TEST_TASK6_REWRITTEN_RUN_CAS_ACCEPTED");
        }),
        (error: unknown) => {
          assert.equal(error instanceof Error ? error.message : String(error), "RUN_TERMINAL_RUN_CAS_LOST");
          return true;
        },
      );
      const triggerState = (await database.sql<Array<{ is_called: boolean }>>`
        SELECT is_called FROM task6_rewritten_run_cas_fired_v1
      `)[0]!;
      assert.equal(triggerState.is_called, true);
      assert.deepEqual(await snapshot(), before);
    } finally {
      await database.cleanup();
    }
  });

  it("terminalizes a drained failure and rolls every owner mutation back when attempt close rejects", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-drained-owner-close";
      await database.insertRun(runId);
      await database.sql.begin(async (transaction) => {
        const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          { producerImplementationId: "a-runtime-run-v1", ownerKey: runId },
        );
        await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
          reservationRef: reservation.reservationRef,
          reservationHash: reservation.reservationHash,
          canonicalOwnerIdentity: createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
        });
      });
      const { stepDbId, storyDbId, claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-drained-owner-close",
        fenceToken: () => "9".repeat(64),
      });
      const reserved = await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.equal(reserved.status, "reserved");
      const sessionId = "RTS_run-terminal-drained-owner-close";
      const sessions = createRuntimeSessionRepository(database.sql);
      await sessions.reserve({
        sessionId,
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-002",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "feature-dev_developer",
        runtimeKind: "local_process",
        ownerInstanceId: "run-terminal-drained-owner",
      });
      await sessions.bindAttempt({
        sessionId,
        attemptId: reserved.attempt.attemptId,
        ownerInstanceId: "run-terminal-drained-owner",
      });
      await database.sql`
        UPDATE runtime_sessions
           SET state='drained', drained_at=NOW(), updated_at=NOW()
         WHERE session_id=${sessionId}
      `;
      const requestId = "RTR_run-terminal-drained-owner-close";
      await seedBoundDrainedTermination(database, {
        runId,
        requestId,
        targetStatus: "failed",
        diagnostic: "exact drained failure owner",
      });
      await database.sql.unsafe(`
        CREATE FUNCTION reject_run_terminal_attempt_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='execution-attempt' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_RUN_TERMINAL_ATTEMPT_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_run_terminal_attempt_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_run_terminal_attempt_close_v1()
      `);
      const terminate = (terminalSql: postgres.Sql = database.sql) => transitionRunToTerminal(terminalSql, {
        runId,
        status: "failed",
        diagnostic: "drained failure terminalization",
        drainedTerminationRequestId: requestId,
      });
      await assert.rejects(terminate(), /TEST_RUN_TERMINAL_ATTEMPT_CLOSE_REJECTED/);
      const rolledBack = (await database.sql<Array<{
        run_status: string;
        request_state: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        claim_owner_state: string;
        attempt_owner_state: string;
      }>>`
        SELECT run_row.status AS run_status,request.state AS request_state,
               claim.outcome AS claim_outcome,attempt.disposition AS attempt_disposition,
               claim_owner.state AS claim_owner_state,attempt_owner.state AS attempt_owner_state
          FROM runs run_row
          JOIN run_termination_requests request ON request.run_id=run_row.id
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN internal_production_owner_reservations_v1 claim_owner
            ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
          JOIN internal_production_owner_reservations_v1 attempt_owner
            ON attempt_owner.category='execution-attempt' AND attempt_owner.owner_key=attempt.attempt_id
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...rolledBack }, {
        run_status: "failing",
        request_state: "drained",
        claim_outcome: null,
        attempt_disposition: "claimed",
        claim_owner_state: "bound",
        attempt_owner_state: "bound",
      });
      await database.sql.unsafe(`
        DROP TRIGGER reject_run_terminal_attempt_close_v1
        ON internal_production_owner_reservations_v1
      `);
      await database.sql.unsafe(`
        CREATE FUNCTION reject_run_terminal_commit_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          RAISE EXCEPTION 'TEST_RUN_TERMINAL_COMMIT_REJECTED';
        END $$
      `);
      await database.sql.unsafe(`
        CREATE CONSTRAINT TRIGGER reject_run_terminal_commit_v1
        AFTER UPDATE OF status ON runs
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        WHEN (NEW.status IN ('completed','failed','cancelled'))
        EXECUTE FUNCTION reject_run_terminal_commit_v1()
      `);
      await assert.rejects(terminate(), /TEST_RUN_TERMINAL_COMMIT_REJECTED/);
      await database.sql.unsafe(`
        DROP TRIGGER reject_run_terminal_commit_v1 ON runs
      `);
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transitionRunToTerminalInTransaction(transaction, {
            runId,
            status: "failed",
            diagnostic: "compound callback rollback",
            drainedTerminationRequestId: requestId,
          });
          throw new Error("TEST_RUN_TERMINAL_CALLBACK_REJECTED");
        }),
        /TEST_RUN_TERMINAL_CALLBACK_REJECTED/,
      );
      const afterCallbackRollback = (await database.sql<Array<{
        run_status: string;
        request_state: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        claim_owner_state: string;
        attempt_owner_state: string;
      }>>`
        SELECT run_row.status AS run_status,request.state AS request_state,
               claim.outcome AS claim_outcome,attempt.disposition AS attempt_disposition,
               claim_owner.state AS claim_owner_state,attempt_owner.state AS attempt_owner_state
          FROM runs run_row
          JOIN run_termination_requests request ON request.run_id=run_row.id
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN internal_production_owner_reservations_v1 claim_owner
            ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
          JOIN internal_production_owner_reservations_v1 attempt_owner
            ON attempt_owner.category='execution-attempt' AND attempt_owner.owner_key=attempt.attempt_id
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...afterCallbackRollback }, { ...rolledBack });
      const ackLossSql = new Proxy(database.sql, {
        get(target, property, receiver) {
          if (property !== "begin") return Reflect.get(target, property, receiver);
          return async (callback: (transaction: postgres.TransactionSql) => Promise<unknown>) => {
            await database.sql.begin(callback);
            throw new Error("TEST_RUN_TERMINAL_ACK_LOST");
          };
        },
      });
      const [lostAck, competingTerminalizer, compositeCloser, withdrawer, attemptHeartbeat] = await Promise.allSettled([
        terminate(ackLossSql),
        terminate(),
        closeClaimAndBoundAttempt(database.sql, {
          claimId,
          runId,
          stepId: "implement",
          storyId: "US-002",
          agentId: "feature-dev_developer",
          outcome: "failed",
          diagnostic: "three-way Task 4 composite contender",
          attemptDisposition: "failed",
        }),
        database.sql.begin((transaction) => withdrawPreDispatchClaimInTransaction(transaction, {
          identity: {
            claimId,
            runId,
            workflowStepId: "implement",
            storyId: "US-002",
            claimAgentId: "feature-dev_developer",
          },
          outcome: "infra_retry",
          diagnostic: "three-way pre-dispatch withdrawal contender",
        })),
        repository.heartbeat({
          attemptId: reserved.attempt.attemptId,
          generation: reserved.attempt.generation,
          fenceToken: reserved.attempt.fenceToken,
        }),
      ]);
      assert.equal(lostAck.status, "rejected");
      assert.match(String(lostAck.status === "rejected" ? lostAck.reason : ""), /TEST_RUN_TERMINAL_ACK_LOST/);
      assert.equal(competingTerminalizer.status, "fulfilled");
      if (competingTerminalizer.status === "fulfilled") {
        assert.equal(competingTerminalizer.value.status, "failed");
      }
      if (compositeCloser.status === "fulfilled") {
        assert.equal(compositeCloser.value.status, "cas_lost");
      } else {
        assert.match(String(compositeCloser.reason), /CLAIM_MUTATION_(DURABLE_OWNER_ACTIVE|RUN_NOT_ACTIVE)/);
      }
      assert.equal(withdrawer.status, "rejected");
      if (withdrawer.status === "rejected") {
        assert.match(String(withdrawer.reason), /CLAIM_MUTATION_(DURABLE_OWNER_ACTIVE|CLAIM_TERMINAL|RUN_NOT_ACTIVE)/);
      }
      if (attemptHeartbeat.status === "fulfilled") {
        assert.equal(attemptHeartbeat.value.status, "stale_fence");
      } else {
        assert.match(String(attemptHeartbeat.reason), /ATTEMPT_(DATABASE_TIME_UNAVAILABLE|RUN_NOT_ACTIVE_COMPILER_OWNER)/);
      }
      const terminal = (await database.sql<Array<{
        run_status: string;
        request_state: string;
        claim_outcome: string;
        attempt_disposition: string;
        claim_owner_state: string;
        attempt_owner_state: string;
      }>>`
        SELECT run_row.status AS run_status,request.state AS request_state,
               claim.outcome AS claim_outcome,attempt.disposition AS attempt_disposition,
               claim_owner.state AS claim_owner_state,attempt_owner.state AS attempt_owner_state
          FROM runs run_row
          JOIN run_termination_requests request ON request.run_id=run_row.id
          JOIN claim_log claim ON claim.run_id=run_row.id
          JOIN execution_attempts attempt ON attempt.claim_id=claim.id
          JOIN internal_production_owner_reservations_v1 claim_owner
            ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
          JOIN internal_production_owner_reservations_v1 attempt_owner
            ON attempt_owner.category='execution-attempt' AND attempt_owner.owner_key=attempt.attempt_id
         WHERE run_row.id=${runId}
      `)[0]!;
      assert.deepEqual({ ...terminal }, {
        run_status: "failed",
        request_state: "terminalized",
        claim_outcome: "failed",
        attempt_disposition: "failed",
        claim_owner_state: "closed",
        attempt_owner_state: "closed",
      });
      const replayCensus = () => database.sql<Array<{
        head_version: string;
        reservation_count: number;
        close_count: number;
        event_count: number;
      }>>`
        SELECT head.head_version::text AS head_version,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_reservations_v1
                 WHERE state='closed') AS reservation_count,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_admission_authorities_v1
                 WHERE authority_kind='close') AS close_count,
               (SELECT COUNT(*)::integer
                  FROM operational_outbox
                 WHERE aggregate_type='run' AND aggregate_id=${runId}
                   AND event_type='run.terminal') AS event_count
          FROM internal_production_owner_admission_head_v1 head
         WHERE head.singleton
      `;
      const beforeReplay = (await replayCensus())[0]!;
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "unknown termination replay identity",
          drainedTerminationRequestId: "RTR_run-terminal-missing-replay1",
        }),
        /RUN_TERMINAL_REPLAY_TERMINATION_INVALID/,
      );
      const replay = await terminate();
      assert.equal(replay.status, "failed");
      assert.deepEqual({ ...(await replayCensus())[0] }, { ...beforeReplay });
    } finally {
      await database.cleanup();
    }
  });

  it("refuses successful completion while any claim or attempt owner is active", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-complete-blocked";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-open1",
        fenceToken: () => "a".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "pipeline complete",
        }),
        /RUN_TERMINAL_OPEN_OWNERS/,
      );
      const state = await database.sql<Array<{ status: string; outcome: string | null; disposition: string }>>`
        SELECT r.status, cl.outcome, ea.disposition
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", outcome: null, disposition: "claimed" });
    } finally {
      await database.cleanup();
    }
  });

  it("fails closed on a pre-owner-admission cancelled run without erasing its fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-cancel-reconcile";
      await database.insertRun(runId);
      const { claimId } = await seedActiveStory(database, runId);
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-leak1",
        fenceToken: () => "b".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = ${runId}`;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "cancelled",
          diagnostic: "Workflow cancelled by user",
        }),
        /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
      );
      const attempt = await repository.findById("ATT_run-terminal-leak1");
      assert.equal(attempt?.disposition, "claimed");
      assert.equal(attempt?.evidenceRefs.includes("setfarm://run-terminal/cancelled"), false);
    } finally {
      await database.cleanup();
    }
  });

  it("refuses terminal replay while a historical runtime may still be executing", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-replay-live-runtime";
      await database.insertRun(runId);
      const { stepDbId, storyDbId, claimId } = await seedActiveStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-replay-live",
        fenceToken: () => "c".repeat(64),
      });
      const reserved = await attempts.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      assert.equal(reserved.status, "reserved");
      const sessionId = "RTS_run-terminal-replay-live-runtime";
      const sessions = createRuntimeSessionRepository(database.sql);
      await sessions.reserve({
        sessionId,
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-002",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "feature-dev_developer",
        runtimeKind: "local_process",
        ownerInstanceId: "historical-live-owner",
      });
      await sessions.bindAttempt({
        sessionId,
        attemptId: reserved.attempt.attemptId,
        ownerInstanceId: "historical-live-owner",
      });
      await database.sql`
        UPDATE runtime_sessions SET state = 'running' WHERE session_id = ${sessionId}
      `;
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = ${runId}`;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "cancelled",
          diagnostic: "must not erase a potentially live historical owner",
        }),
        /RUN_TERMINAL_REPLAY_RUNTIME_NOT_DRAINED:1/,
      );
      const rows = await database.sql<Array<{
        claim_outcome: string | null;
        attempt_disposition: string;
        runtime_state: string;
      }>>`
        SELECT claim.outcome AS claim_outcome,
               attempt.disposition AS attempt_disposition,
               runtime.state AS runtime_state
          FROM claim_log claim
          JOIN execution_attempts attempt ON attempt.claim_id = claim.id
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
         WHERE claim.id = ${claimId}
      `;
      assert.deepEqual({ ...rows[0]! }, {
        claim_outcome: null,
        attempt_disposition: "claimed",
        runtime_state: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not treat exact packet-bound v3 owners as failure drain proof", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          'run-terminal-v3', 'feature-dev', 'v3 terminal', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      const { claimId } = await seedActiveStory(database, "run-terminal-v3");
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_run-terminal-v3-01",
        fenceToken: () => "4".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId: "run-terminal-v3",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId: "run-terminal-v3",
          status: "failed",
          diagnostic: "native v3 terminal owner",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      assert.equal((await repository.findById("ATT_run-terminal-v3-01"))?.disposition, "claimed");
    } finally {
      await database.cleanup();
    }
  });

  it("refuses successful v3 terminalization without an AcceptedCandidate", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-no-candidate";
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, packet_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 missing candidate', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${HASH_A}, ${releaseAdmissionHash}
        )
      `;
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "must not self-certify success",
        }),
        /RUN_TERMINAL_V3_ACCEPTED_CANDIDATE_REQUIRED/,
      );
      const rows = await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `;
      assert.equal(rows[0]?.status, "running");
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back a pre-owner-admission bootstrap terminal update", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-legacy-bootstrap";
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol
        ) VALUES (
          ${runId}, 'feature-dev', 'legacy bootstrap terminal', 'running', 'legacy'
        )
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          ('run-terminal-legacy-bootstrap-step', ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'pending')
      `;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "cron setup failed before claims",
          unclaimedBootstrapFailure: true,
        }),
        /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
      );
      const state = await database.sql<Array<{ run_status: string; step_status: string }>>`
        SELECT r.status AS run_status, s.status AS step_status
          FROM runs r JOIN steps s ON s.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { run_status: "running", step_status: "pending" });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects bootstrap terminalization once any claim owner exists", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-bootstrap-owned";
      const releaseSha = "d".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'v3 bootstrap owned', 'running', 'v3',
          ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
        )
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          ('run-terminal-v3-bootstrap-owned-step', ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'running')
      `;
      await database.sql`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'plan', NULL, 'feature-dev_planner', NOW())
      `;

      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "must not steal an owner",
          unclaimedBootstrapFailure: true,
        }),
        /RUN_TERMINAL_BOOTSTRAP_OWNER_EXISTS/,
      );
      const state = await database.sql<Array<{ status: string; outcome: string | null }>>`
        SELECT r.status, cl.outcome
          FROM runs r JOIN claim_log cl ON cl.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, { status: "running", outcome: null });
    } finally {
      await database.cleanup();
    }
  });

  it("preserves active recovery residue on a pre-owner-admission terminal run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-recovery-residue";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "failed" });
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "reconcile historical terminal recovery owner",
        }),
        /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
      );

      const delivery = await createRecoveryDeliveryRepository(database.sql)
        .findDelivery(fixture.dispatchId);
      assert.equal(delivery?.schema, "setfarm.recovery-dispatch-delivery.v1");
      assert.equal(delivery?.state, "authorized");
      assert.equal(
        (await createFindingRecoveryRepository(database.sql)
          .findRecoveryCase(fixture.recoveryCaseId))?.status,
        "repairing",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("refuses to erase an active recovery owner from a completed v3 run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-v3-complete-recovery";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "completed" });
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "completed",
          diagnostic: "must preserve unresolved recovery evidence",
        }),
        /RUN_TERMINAL_ACTIVE_RECOVERY/,
      );
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.state,
        "authorized",
      );
      assert.equal(
        (await createFindingRecoveryRepository(database.sql)
          .findRecoveryCase(fixture.recoveryCaseId))?.status,
        "repairing",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("keeps ordinary migration 31 terminalization available while guarded migration 32 is pending", async () => {
    const database = await createIsolatedMigration31TestDatabase();
    try {
      const runId = "run-terminal-migration31-ordinary";
      await database.sql`
        INSERT INTO runs (id, workflow_id, task, status, protocol)
        VALUES (${runId}, 'feature-dev', 'migration 31 ordinary terminal', 'running', 'legacy')
      `;
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
        VALUES
          ('run-terminal-migration31-ordinary-step', ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'pending')
      `;

      await transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "ordinary migration 31 bootstrap failure",
        unclaimedBootstrapFailure: true,
      });

      const rows = await database.sql<Array<{ runStatus: string; stepStatus: string }>>`
        SELECT run.status AS "runStatus",step.status AS "stepStatus"
          FROM runs run
          JOIN steps step ON step.run_id=run.id
         WHERE run.id=${runId}
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { runStatus: "failed", stepStatus: "failed" },
      ]);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects ordinary terminalization when the migration 32 journal identity is unauthenticated", async () => {
    const corruptions = [
      {
        label: "adopted guarded migration",
        apply: async (database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>) => {
          await database.sql`UPDATE setfarm_schema_migrations SET state='adopted' WHERE version=32`;
        },
      },
      {
        label: "crossed migration name",
        apply: async (database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>) => {
          await database.sql`UPDATE setfarm_schema_migrations SET name='crossed-bootstrap-main-claim-handoff-v1' WHERE version=32`;
        },
      },
      {
        label: "crossed migration checksum",
        apply: async (database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>) => {
          await database.sql`UPDATE setfarm_schema_migrations SET checksum=${"0".repeat(64)} WHERE version=32`;
        },
      },
    ] as const;
    const failures: string[] = [];

    for (const corruption of corruptions) {
      const database = await createIsolatedTestDatabase();
      try {
        const runId = `run-terminal-migration32-${corruption.label.replaceAll(" ", "-")}`;
        await database.sql`
          INSERT INTO runs (id, workflow_id, task, status, protocol)
          VALUES (${runId}, 'feature-dev', ${corruption.label}, 'running', 'legacy')
        `;
        await database.sql`
          INSERT INTO steps
            (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
          VALUES
            (${`${runId}-step`}, ${runId}, 'plan', 'feature-dev_planner', 0, '', '', 'pending')
        `;
        await corruption.apply(database);

        try {
          await assert.rejects(
            transitionRunToTerminal(database.sql, {
              runId,
              status: "failed",
              diagnostic: "migration 32 identity must be authenticated before owner access",
              unclaimedBootstrapFailure: true,
            }),
            /^Error: RUN_TERMINAL_OWNER_ADMISSION_MIGRATION32_JOURNAL_INVALID$/,
            corruption.label,
          );
        } catch (error) {
          failures.push(`${corruption.label} terminal: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          await assert.rejects(
            assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1(
              database.sql as PgTransactionSql,
              {
                runId,
                workflowState: "running",
                protocol: "legacy",
                runContext: {},
              },
            ),
            /^Error: RECOVERY_SOURCE_BOOTSTRAP_MIGRATION32_JOURNAL_INVALID$/,
            `${corruption.label} delivery barrier`,
          );
        } catch (error) {
          failures.push(`${corruption.label} barrier: ${error instanceof Error ? error.message : String(error)}`);
        }

        const rows = await database.sql<Array<{ runStatus: string; stepStatus: string }>>`
          SELECT run.status AS "runStatus",step.status AS "stepStatus"
            FROM runs run
            JOIN steps step ON step.run_id=run.id
           WHERE run.id=${runId}
        `;
        assert.deepEqual(rows.map((row) => ({ ...row })), [
          { runStatus: "running", stepStatus: "pending" },
        ]);
      } finally {
        await database.cleanup();
      }
    }
    assert.deepEqual(failures, []);
  });

  it("downgrades migration 20 terminal rows to the exact v19 reader contract", async () => {
    const database = await createIsolatedMigration31TestDatabase();
    try {
      const runId = "run-terminal-v19-binary-rollback";
      const fixture = await seedActiveRecovery(database, {
        runId,
        runStatus: "failed",
        findingPublication: "migration31",
      });
      const targetReleaseSha = "7".repeat(40);
      await rollbackCurrentToV21(database);
      await rollbackOperationalFailureCauseSealToV20(database.sql, {
        targetReleaseSha: "6".repeat(40),
      });
      await assert.rejects(
        rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, { targetReleaseSha }),
        /Migration 20 rollback requires zero active owners/,
      );
      await database.sql.begin(async (transaction) => {
        const snapshot = await lockV3TerminalRecoveryChainInTransaction(transaction, runId);
        const clock = await transaction.unsafe<Array<{ now: Date }>>("SELECT clock_timestamp() AS now");
        await settleV3TerminalRecoveryChainInTransaction(transaction, {
          runId,
          status: "failed",
          diagnostic: "create a lease-free v2 terminal row before binary rollback",
          transitionTime: clock[0]!.now,
          snapshot,
        });
      });
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.schema,
        "setfarm.recovery-dispatch-delivery.v2",
      );
      const rollback = await rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, {
        targetReleaseSha,
      });
      assert.match(rollback.rollbackId, /^RBK_[a-f0-9]{64}$/);
      assert.equal(rollback.rowsRewritten, 1);
      assert.equal(rollback.targetVersion, 19);
      const legacyReadable = await createRecoveryDeliveryRepository(database.sql)
        .findDelivery(fixture.dispatchId);
      assert.equal(legacyReadable?.schema, "setfarm.recovery-dispatch-delivery.v1");
      assert.equal(legacyReadable?.ownerInstanceId, "setfarm-v19-rollback");
      assert.match(legacyReadable?.leaseToken ?? "", /^ROLLBACK_[a-f0-9]{32}$/);

      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((migration) => migration.version === 20)?.state, "pending");
      const attestation = await readContractSpineMigrationAttestation(database.sql);
      assert.equal(attestation.status, "attested");
      assert.equal(attestation.verifiedReleaseSha, targetReleaseSha);

      const reapplied = await applyContractSpineMigrations(database.sql, {
        releaseSha: "8".repeat(40),
      });
      assert.deepEqual(reapplied.applied, [
        "020_recovery_terminal_lease_identity",
        "021_operational_failure_cause_seal",
        "022_product_compilation_attempt_ledger",
        "023_artifact_publication_batch_ledger",
        "024_artifact_store_authority_ledger",
        "025_v3_preparation_authority_v2_ledger",
        "026_artifact_publication_batch_plan_ledger",
        "027_platform_release_store_record_ledger_v3",
        "028_runtime_completion_manifest_authority",
        "029_v3_story_claim_runtime_binding_v1",
        "030_operational_failure_cause_authority_v2",
        "031_operational_failure_cause_authority_v3",
      ]);
      assert.equal(
        (await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatchId))?.schema,
        "setfarm.recovery-dispatch-delivery.v1",
      );
      await rollbackCurrentToV21(database);
      await rollbackOperationalFailureCauseSealToV20(database.sql, {
        targetReleaseSha: "9".repeat(40),
      });
      const repeated = await rollbackRecoveryTerminalLeaseIdentityToV19(database.sql, {
        targetReleaseSha,
      });
      assert.match(repeated.rollbackId, /^RBK_[a-f0-9]{64}$/);
      assert.notEqual(repeated.rollbackId, rollback.rollbackId);
      assert.equal(repeated.rowsRewritten, 0);
      assert.equal(repeated.targetReleaseSha, targetReleaseSha);
      const receipts = await database.sql<Array<{ rollback_id: string }>>`
        SELECT rollback_id
          FROM setfarm_schema_migration_rollbacks
         WHERE target_release_sha = ${targetReleaseSha}
         ORDER BY applied_at, rollback_id
      `;
      assert.deepEqual(
        new Set(receipts.map((receipt) => receipt.rollback_id)),
        new Set([rollback.rollbackId, repeated.rollbackId]),
      );
      assert.equal(
        (await planContractSpineMigrations(database.sql)).migrations
          .find((migration) => migration.version === 20)?.state,
        "pending",
      );
    } finally {
      await database.cleanup();
    }
  });
});
