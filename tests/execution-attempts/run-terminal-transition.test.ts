import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

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
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import {
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
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
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

async function seedActiveRecovery(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; runStatus: "failed" | "completed" }>,
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
  await findings.putFindingSet(findingSet);
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
    const runUpdate = source.indexOf("UPDATE runs\n          SET status = $2");
    const terminalPair = source.indexOf("resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(", runUpdate);
    const close = source.indexOf("closeInternalProductionOwnerReservationV1(ownerAdmissionSql", terminalPair);
    const reopen = source.indexOf("resolveInternalProductionOwnerReservationCloseInTransactionV1(ownerAdmissionSql", close);
    assert.ok(runUpdate >= 0 && terminalPair > runUpdate && close > terminalPair && reopen > close);
    const attemptUpdate = source.indexOf("UPDATE execution_attempts");
    const claimUpdate = source.indexOf("UPDATE claim_log", attemptUpdate);
    const attemptResolver = source.indexOf(
      "resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(",
      claimUpdate,
    );
    const claimResolver = source.indexOf(
      "resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(",
      attemptResolver,
    );
    const attemptClose = source.indexOf("for (const terminalClose of attemptCloses)", claimResolver);
    const claimClose = source.indexOf("for (const terminalClose of claimCloses)", attemptClose);
    assert.ok(
      attemptUpdate >= 0
      && claimUpdate > attemptUpdate
      && attemptResolver > claimUpdate
      && claimResolver > attemptResolver
      && attemptClose > claimResolver
      && claimClose > attemptClose,
      "claim and attempt must both be terminal before either resolver and both closes must precede commit",
    );
    const effectUpdate = source.indexOf("UPDATE runtime_completion_effects");
    const effectResolver = source.indexOf(
      "resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1(",
      effectUpdate,
    );
    const effectClose = source.indexOf("closeInternalProductionOwnerReservationV1(", effectResolver);
    const manifest = source.indexOf("assertRuntimeCompletionManifestInTransactionV1", effectClose);
    const effectsCommitted = source.indexOf("SET apply_phase = 'effects_committed'", manifest);
    assert.ok(
      effectUpdate >= 0
      && effectResolver > effectUpdate
      && effectClose > effectResolver
      && manifest > effectClose
      && effectsCommitted > manifest,
      "terminal-run effect must mutate, resolve, and close before manifest proof and effects_committed",
    );
    assert.equal(
      source.slice(effectUpdate, effectsCommitted).includes(
        "resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1",
      ),
      false,
      "the effects_committed completion remains bound for Task 6",
    );
    const db = await import("../../src/db-pg.js");
    assert.equal("createInternalProductionWorkflowRunTerminalOwnerAuthorityV1" in db, false);
  });

  it("atomically closes an applied terminal-run effect while its completion remains bound", async () => {
    const database = await createIsolatedTestDatabase();
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
      await database.sql`UPDATE runs SET status='failing' WHERE id=${runId}`;
      const terminationRequestId = "RTR_run-terminal-completion-effect";
      await database.sql`
        INSERT INTO run_termination_requests (
          request_id,run_id,target_status,state,requested_by,requested_at,drained_at,
          diagnostic,evidence,created_at,updated_at
        ) VALUES (
          ${terminationRequestId},${runId},'failed','drained','task5-test',NOW(),NOW(),
          'terminal completion effect','{}'::jsonb,NOW(),NOW()
        )
      `;
      await database.sql.unsafe(`
        CREATE FUNCTION reject_task5_effect_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.category='mandatory-effect' AND OLD.state='bound' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_TASK5_EFFECT_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_task5_effect_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_task5_effect_close_v1()
      `);
      const terminate = () => runWithRuntimeCompletionOwner({
        requestId: processing.requestId,
        ownerInstanceId: processing.ownerInstanceId!,
        leaseExpiresAt: processing.leaseExpiresAt!,
        ownerAttemptCount: processing.ownerAttemptCount,
      }, () => transitionRunToTerminal(database.sql, {
        runId,
        status: "failed",
        diagnostic: "completion decided terminal failure",
        drainedTerminationRequestId: terminationRequestId,
      }));

      await assert.rejects(terminate(), /TEST_TASK5_EFFECT_CLOSE_REJECTED/);
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
        completion_phase: "executing",
        completion_owner_state: "bound",
        effect_count: 0,
      });

      await database.sql.unsafe(`
        DROP TRIGGER reject_task5_effect_close_v1
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
        completion_state: "processing",
        completion_phase: "effects_committed",
        completion_owner_state: "bound",
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
      await database.sql`UPDATE runs SET status='failing' WHERE id=${runId}`;
      await database.sql`
        INSERT INTO run_termination_requests (
          request_id,run_id,target_status,state,requested_by,requested_at,drained_at,
          diagnostic,evidence,created_at,updated_at
        ) VALUES (
          ${requestId},${runId},'failed','drained','task4-test',NOW(),NOW(),
          'exact drained failure owner','{}'::jsonb,NOW(),NOW()
        )
      `;
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
      const terminate = () => transitionRunToTerminal(database.sql, {
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
      const result = await terminate();
      assert.equal(result.status, "failed");
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

  it("downgrades migration 20 terminal rows to the exact v19 reader contract", async () => {
    const database = await createIsolatedMigration31TestDatabase();
    try {
      const runId = "run-terminal-v19-binary-rollback";
      const fixture = await seedActiveRecovery(database, { runId, runStatus: "failed" });
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
