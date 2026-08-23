import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
