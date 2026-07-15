import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { createV3RecoveryWorkRouter } from "../../src/recovery/v3-recovery-work-router.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const PACKET_HASH = "a".repeat(64);
const CONTRACT_SLICE_HASH = "b".repeat(64);
const EVIDENCE_HASH = "c".repeat(64);
const SOURCE_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);

type DispatchClass = "product_implementation" | "supervisor_repair" | "evidence_only";

function finding(runId: string, storyId: string) {
  return createFindingSetV1({
    runId,
    storyId,
    packetHash: PACKET_HASH,
    sliceHash: CONTRACT_SLICE_HASH,
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

function recoveryDraft(
  findingSet: ReturnType<typeof finding>,
  dispatchClass: DispatchClass,
): RecoveryCaseDraftV1 {
  const sourceRepair = dispatchClass !== "evidence_only";
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((item) => item.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner: dispatchClass === "product_implementation"
      ? "implement"
      : dispatchClass === "supervisor_repair"
        ? "supervisor"
        : "infrastructure",
    expectedDelta: sourceRepair
      ? {
          kind: "source_change",
          invariantRefs: ["INV_SAVE_RELOAD"],
          requiredPaths: ["src/App.tsx"],
        }
      : {
          kind: "evidence_refresh",
          predicateRefs: ["EVID_SAVE_RELOAD"],
        },
    allowedPaths: sourceRepair ? ["src/App.tsx"] : [],
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

describe("v3 recovery work router", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  async function setup(input: Readonly<{
    workflowId: string;
    dispatchClass?: DispatchClass;
    runStatus?: "running" | "resuming";
    stepStatus?: "pending" | "running";
  }>) {
    sequence += 1;
    const dispatchClass = input.dispatchClass ?? "product_implementation";
    const runId = `run-v3-work-router-${sequence}`;
    const storyId = `US-ROUTER-${sequence}`;
    const storyDbId = `story-v3-work-router-${sequence}`;
    const stepDbId = `step-v3-work-router-${sequence}`;
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, $2, 'recovery work router test', $3, 'v3', 1, $4, $5, $6, $7)`,
      [
        runId,
        input.workflowId,
        input.runStatus ?? "running",
        releaseSha,
        PACKET_HASH,
        "e".repeat(64),
        releaseAdmissionHash,
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, loop_config, retry_count, output
       ) VALUES ($1, $2, 'implement', 'developer', 6, 'implement {{story_id}}',
                 'STATUS: done', $3, 'loop', '{"over":"stories"}', 2, 'prior loop output')`,
      [stepDbId, runId, input.stepStatus ?? "pending"],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, description,
         acceptance_criteria, status, output, retry_count, max_retries,
         abandoned_count, claim_generation, scope_files, shared_files,
         implementation_contract, story_screens, story_branch
       ) VALUES (
         $1, $2, 1, $3, $4, 'failed implementation story', '["save and reload"]',
         'failed', 'typed evidence failure', 1, 3, 0, 4, '["src/App.tsx"]', '[]',
         '{"schema":"test"}', '["screen-main"]', $5
       )`,
      [storyDbId, runId, storyId, `Router story ${sequence}`, `branch-router-${sequence}`],
    );

    const findingSet = finding(runId, storyId);
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase(recoveryDraft(findingSet, dispatchClass), {
      now: new Date("2026-07-13T08:00:00.000Z"),
    });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass,
    });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected recovery authorization");
    return {
      workflowId: input.workflowId,
      dispatchClass,
      runId,
      storyId,
      storyDbId,
      stepDbId,
      findingSet,
      recoveryCase: opened.recoveryCase,
      revision,
      dispatch: authorized.dispatch,
      delivery: authorized.delivery,
    };
  }

  it("selects the oldest exact candidate and filters product from supervisor work", async () => {
    const workflowId = "workflow-router-filtering";
    const oldestProduct = await setup({
      workflowId,
      dispatchClass: "product_implementation",
      stepStatus: "running",
    });
    await setup({
      workflowId,
      dispatchClass: "product_implementation",
    });
    const supervisor = await setup({
      workflowId,
      dispatchClass: "supervisor_repair",
      runStatus: "resuming",
    });
    const router = createV3RecoveryWorkRouter(database.sql);

    const productWork = await router.acquireNext({
      workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-product-worker",
      leaseMs: 60_000,
    });
    assert.ok(productWork);
    assert.equal(productWork.handoff.dispatchId, oldestProduct.dispatch.dispatchId);
    assert.equal(productWork.handoff.dispatchClass, "product_implementation");
    assert.equal(productWork.step.id, oldestProduct.stepDbId);
    assert.equal(productWork.step.step_id, "implement");
    assert.equal(productWork.step.type, "loop");
    assert.equal(productWork.step.step_status, "running");
    assert.equal(productWork.step.input_template, "implement {{story_id}}");
    assert.equal(productWork.story.id, oldestProduct.storyDbId);
    assert.equal(productWork.story.story_id, oldestProduct.storyId);
    assert.equal(productWork.story.status, "failed");
    assert.equal(productWork.story.claim_generation, 4);
    assert.equal(productWork.story.scope_files, '["src/App.tsx"]');

    const supervisorWork = await router.acquireNext({
      workflowId,
      dispatchClass: "supervisor_repair",
      ownerInstanceId: "router-supervisor-worker",
    });
    assert.ok(supervisorWork);
    assert.equal(supervisorWork.handoff.dispatchId, supervisor.dispatch.dispatchId);
    assert.equal(supervisorWork.handoff.dispatchClass, "supervisor_repair");
    assert.equal(supervisorWork.handoff.recoveryOwner, "supervisor");

    assert.equal(await router.acquireNext({
      workflowId: "different-workflow",
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-no-work",
    }), undefined);
  });

  it("never exposes evidence-only or caller-mismatched model work", async () => {
    const workflowId = "workflow-router-evidence-only";
    const fixture = await setup({ workflowId, dispatchClass: "evidence_only" });
    const router = createV3RecoveryWorkRouter(database.sql);

    assert.equal(await router.acquireNext({
      workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-product-worker",
    }), undefined);
    assert.equal(await router.acquireNext({
      workflowId,
      dispatchClass: "supervisor_repair",
      ownerInstanceId: "router-supervisor-worker",
    }), undefined);
    await assert.rejects(router.acquireNext({
      workflowId,
      dispatchClass: "evidence_only",
      ownerInstanceId: "router-forged-class",
    }));

    const deliveryRows = await database.sql.unsafe<Array<{
      state: string;
      owner_instance_id: string | null;
    }>>(
      "SELECT state, owner_instance_id FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    assert.equal(deliveryRows[0]?.state, "authorized");
    assert.equal(deliveryRows[0]?.owner_instance_id, null);
  });

  it("returns exactly one handoff for concurrent routers", async () => {
    const workflowId = "workflow-router-concurrency";
    const fixture = await setup({ workflowId, dispatchClass: "product_implementation" });
    const router = createV3RecoveryWorkRouter(database.sql);
    const raced = await Promise.all([
      router.acquireNext({
        workflowId,
        dispatchClass: "product_implementation",
        ownerInstanceId: "router-racer-a",
        leaseMs: 60_000,
      }),
      router.acquireNext({
        workflowId,
        dispatchClass: "product_implementation",
        ownerInstanceId: "router-racer-b",
        leaseMs: 60_000,
      }),
    ]);
    const acquired = raced.filter((item) => item !== undefined);
    assert.equal(acquired.length, 1);
    assert.equal(acquired[0]!.handoff.dispatchId, fixture.dispatch.dispatchId);
    assert.ok(["router-racer-a", "router-racer-b"].includes(acquired[0]!.handoff.lease.ownerInstanceId));
  });

  it("takes over only an expired lease through canonical claim authority", async () => {
    const workflowId = "workflow-router-expired-lease";
    const fixture = await setup({ workflowId, dispatchClass: "product_implementation" });
    const oldLease = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: "expired-router-owner",
      leaseMs: 60_000,
    }, { now: new Date("2020-01-01T00:00:00.000Z") });

    const router = createV3RecoveryWorkRouter(database.sql);
    assert.equal(await router.acquireNext({
      workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "takeover-router-owner",
      leaseMs: 60_000,
    }), undefined, "caller clock skew must not expire a database-owned lease");
    await database.sql.unsafe(
      `UPDATE recovery_dispatch_deliveries
          SET lease_expires_at = clock_timestamp() - INTERVAL '1 second'
        WHERE dispatch_id = $1`,
      [fixture.dispatch.dispatchId],
    );

    const work = await router.acquireNext({
      workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "takeover-router-owner",
      leaseMs: 60_000,
    });
    assert.ok(work);
    assert.equal(work.handoff.status, "lease_acquired");
    assert.equal(work.handoff.lease.ownerInstanceId, "takeover-router-owner");
    assert.notEqual(work.handoff.lease.leaseToken, oldLease.lease.leaseToken);
  });

  it("fails closed when a delivery no longer forms the exact story chain", async () => {
    const workflowId = "workflow-router-forged-chain";
    const fixture = await setup({ workflowId, dispatchClass: "product_implementation" });
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET story_id = $2 WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId, `${fixture.storyId}-forged`],
    );

    const work = await createV3RecoveryWorkRouter(database.sql).acquireNext({
      workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-forged-chain-worker",
    });
    assert.equal(work, undefined);

    const deliveryRows = await database.sql.unsafe<Array<{
      state: string;
      owner_instance_id: string | null;
    }>>(
      "SELECT state, owner_instance_id FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    assert.equal(deliveryRows[0]?.state, "authorized");
    assert.equal(deliveryRows[0]?.owner_instance_id, null);
  });

  it("requires an active v3 run, one failed story and an active implement loop", async () => {
    const inactiveRun = await setup({ workflowId: "workflow-router-inactive-run" });
    await database.sql.unsafe("UPDATE runs SET status = 'failed' WHERE id = $1", [inactiveRun.runId]);
    assert.equal(await createV3RecoveryWorkRouter(database.sql).acquireNext({
      workflowId: inactiveRun.workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-inactive-run-worker",
    }), undefined);

    const nonFailedStory = await setup({ workflowId: "workflow-router-nonfailed-story" });
    await database.sql.unsafe("UPDATE stories SET status = 'done' WHERE id = $1", [nonFailedStory.storyDbId]);
    assert.equal(await createV3RecoveryWorkRouter(database.sql).acquireNext({
      workflowId: nonFailedStory.workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-nonfailed-story-worker",
    }), undefined);

    const inactiveStep = await setup({ workflowId: "workflow-router-inactive-step" });
    await database.sql.unsafe("UPDATE steps SET status = 'waiting' WHERE id = $1", [inactiveStep.stepDbId]);
    assert.equal(await createV3RecoveryWorkRouter(database.sql).acquireNext({
      workflowId: inactiveStep.workflowId,
      dispatchClass: "product_implementation",
      ownerInstanceId: "router-inactive-step-worker",
    }), undefined);
  });
});
