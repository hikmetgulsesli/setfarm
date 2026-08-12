import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createAcceptedCandidateV1 } from "../../src/evidence/accepted-candidate-v1.js";
import {
  createV3DeployReceiptRepository,
  V3DeployReceiptRepositoryError,
} from "../../src/execution/v3-deploy-receipt-repository.js";
import { operationalOutboxIdForEventKey } from "../../src/execution/operational-outbox-repository.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import {
  createV3BuildArtifactV1,
  createV3DeployReceiptV1,
} from "../../src/execution/schemas/v3-deploy-receipt-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { buildNoVolumeRuntimeAuthorityFixture } from "./fixtures/v3-runtime-authority.js";

const PACKET_HASH = "1".repeat(64);
const SOURCE = Object.freeze({ sha: "2".repeat(40), treeHash: "3".repeat(64) });
const COMMIT_TIME = new Date("2026-07-13T13:00:30.000Z");

const candidate = createAcceptedCandidateV1({
  runId: "placeholder",
  packetHash: PACKET_HASH,
  storyPlanHash: "4".repeat(64),
  sourceRevision: SOURCE,
  storyEvidence: [{
    storyId: "US-001",
    attemptId: "ATT_1234567890abcdef",
    sliceHash: "5".repeat(64),
    evidencePlanHash: "6".repeat(64),
    evidencePlanArtifactHash: "7".repeat(64),
    evidenceBundleHash: "8".repeat(64),
    evidenceId: `EVB_${"8".repeat(64)}`,
    predicateRefs: ["EVID_RUNTIME_HEALTH"],
  }],
  acceptor: {
    id: "setfarm-final-tree-acceptor",
    version: "1.0.0",
    codeSha: "9".repeat(40),
    environmentHash: "a".repeat(64),
  },
});

function candidateForRun(runId: string) {
  return createAcceptedCandidateV1({
    runId,
    packetHash: candidate.packetHash,
    storyPlanHash: candidate.storyPlanHash,
    sourceRevision: candidate.sourceRevision,
    storyEvidence: candidate.storyEvidence,
    acceptor: candidate.acceptor,
  });
}

function receiptForRun(runId: string, candidateValue = candidateForRun(runId), port = 45321) {
  const projectId = `prod-ledger-${candidateValue.candidateHash.slice(0, 12)}`;
  const healthUrl = `http://127.0.0.1:${port}/`;
  const buildArtifact = createV3BuildArtifactV1({
    schema: "setfarm.v3-build-artifact.v1",
    runId,
    outputPaths: ["dist"],
    files: [{
      path: "dist/index.html",
      byteLength: 7,
      contentHash: "e".repeat(64),
      executable: false,
    }],
    totalBytes: 7,
  });
  const sealedRuntimeManifestHash = "8".repeat(64);
  const sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidateValue.candidateHash}/${buildArtifact.artifactHash}/${sealedRuntimeManifestHash}`;
  const ownerProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: port,
    processStartedAt: "2026-07-13T12:59:00.000Z",
    processGroupId: port,
    source: "observed_os" as const,
  };
  const runtimeAuthority = buildNoVolumeRuntimeAuthorityFixture({
    runId,
    projectId,
    candidateHash: candidateValue.candidateHash,
    buildArtifactHash: buildArtifact.artifactHash,
    ownerProcess,
    checkedAt: "2026-07-13T13:00:20.000Z",
  });
  return createV3DeployReceiptV1({
    schema: "setfarm.v3-deploy-receipt.v1",
    runId,
    candidateId: candidateValue.candidateId,
    candidateHash: candidateValue.candidateHash,
    packetHash: candidateValue.packetHash,
    project: {
      schema: "setfarm.v3-deploy-project.v1",
      productId: "PROD_LEDGER",
      projectId,
      displayName: "Receipt Ledger",
      summary: "Publish one exact deploy receipt atomically.",
    },
    stack: {
      schema: "setfarm.v3-deploy-stack.v1",
      stackPackId: "vite-react-web-app",
      stackPackVersion: "1.1.0",
      stackPackContentHash: "b".repeat(64),
      platform: "web",
      techStack: "vite-react",
    },
    buildCommandId: "CMD_BUILD",
    previewCommandId: "CMD_PREVIEW",
    sourceBefore: SOURCE,
    sourceAfter: SOURCE,
    buildArtifact,
    runtime: {
      schema: "setfarm.v3-runtime-deployment.v1",
      mode: "local",
      projectId,
      serviceId: `process:${port}`,
      host: "127.0.0.1",
      port,
      healthUrl,
      deployUrl: `http://127.0.0.1:${port}/`,
      evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}`,
      buildArtifactHash: buildArtifact.artifactHash,
      buildArtifactEvidenceRef: buildArtifact.evidenceRef,
      sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${runId}/${candidateValue.candidateHash}/${buildArtifact.artifactHash}`,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      sealAuthorityHash: runtimeAuthority.sealAuthorityHash,
      sealAuthorityEvidenceRef: runtimeAuthority.sealAuthorityEvidenceRef,
      runtimeDataContractHash: runtimeAuthority.runtimeDataContractHash,
      volumeProvisioning: runtimeAuthority.volumeProvisioning,
      runtimeIsolation: runtimeAuthority.runtimeIsolation,
    },
    health: {
      schema: "setfarm.v3-deploy-health-proof.v1",
      status: "pass",
      httpStatus: 200,
      checkedAt: "2026-07-13T13:00:20.000Z",
      evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/health`,
      buildArtifactHash: buildArtifact.artifactHash,
      buildArtifactEvidenceRef: buildArtifact.evidenceRef,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      listenerOwnership: {
        schema: "setfarm.v3-listener-ownership.v1",
        ownerProcess,
        listenerPids: [port],
        listenerProcesses: [ownerProcess],
        host: "127.0.0.1",
        port,
        checkedAt: "2026-07-13T13:00:20.000Z",
        evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/listener/${ownerProcess.pid}`,
      },
      runtimeIsolation: runtimeAuthority.runtimeIsolationProof,
    },
    terminalProjectProjection: {
      schema: "setfarm.v3-terminal-project-projection.v1",
      owner: "mission-control-terminal-projector",
      state: "pending_terminal_projection",
      runId,
      candidateHash: candidateValue.candidateHash,
      projectId,
      serviceId: `process:${port}`,
      port,
      healthUrl,
      evidenceRef: `setfarm://run/${runId}/deploy-receipt`,
      buildArtifactHash: buildArtifact.artifactHash,
    },
    environmentNames: ["DATABASE_URL"],
    completedAt: "2026-07-13T13:00:25.000Z",
  });
}

describe("v3 deploy receipt ledger", () => {
  let database: TestDatabase;

  before(async () => { database = await createIsolatedTestDatabase(); });
  after(async () => database.cleanup());
  beforeEach(async () => {
    await database.reset();
  });

  async function seed(runId: string) {
    const candidateValue = candidateForRun(runId);
    const stepDbId = `${runId}-deploy-step`;
    const releaseSha = "c".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO semantic_artifacts (
         artifact_hash, artifact_type, byte_length, producer_metadata
       ) VALUES ($1, 'setfarm.product-build-packet.v1', 1, $2::text::jsonb)`,
      [
        PACKET_HASH,
        JSON.stringify({ pass: "deploy-ledger-test", codeSha: "c".repeat(40), toolVersions: {} }),
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, compiler_release_sha,
         activation_preflight_hash, packet_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'deploy ledger test', 'running', 'v3', $2, $3, $4, $5)`,
      [runId, releaseSha, "d".repeat(64), PACKET_HASH, releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
       VALUES ($1, $2, $3::text::jsonb)`,
      [runId, PACKET_HASH, JSON.stringify({ version: "3.0.0", codeSha: "c".repeat(40) })],
    );
    await database.sql.unsafe(
      `INSERT INTO accepted_candidates (
         candidate_hash, candidate_id, run_id, packet_hash, story_plan_hash,
         source_sha, source_tree_hash, integration_evidence_hash, payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb)`,
      [
        candidateValue.candidateHash,
        candidateValue.candidateId,
        runId,
        candidateValue.packetHash,
        candidateValue.storyPlanHash,
        candidateValue.sourceRevision.sha,
        candidateValue.sourceRevision.treeHash,
        candidateValue.integrationEvidenceHash,
        JSON.stringify(candidateValue),
      ],
    );
    await database.sql.unsafe(
      "UPDATE runs SET accepted_candidate_hash = $2 WHERE id = $1",
      [runId, candidateValue.candidateHash],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects, status
       ) VALUES ($1, $2, 'deploy', 'deployer', 11, '', '', 'running')`,
      [stepDbId, runId],
    );
    const claims = await database.sql.unsafe<Array<{ id: number }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'deploy', NULL, 'deployer', NOW())
       RETURNING id::integer AS id`,
      [runId],
    );
    const claimId = claims[0]!.id;
    const envelope = ClaimEnvelopeV1Schema.parse({
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-13T13:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "deploy",
      runId,
      claimId,
      claimAgentId: "deployer",
      runtimeAgentId: "setfarm-v3-deploy-executor",
    });
    const receipt = receiptForRun(runId, candidateValue);
    return {
      runId,
      stepDbId,
      claimId,
      candidate: candidateValue,
      receipt,
      completion: {
        envelope,
        stepStatus: "done" as const,
        stepOutput: `STATUS: done\nDEPLOY_RECEIPT_HASH: ${receipt.receiptHash}`,
        now: COMMIT_TIME,
      },
    };
  }

  it("installs an immutable v14 ledger with an exact run pointer", async () => {
    const journal = await database.sql<Array<{ name: string }>>`
      SELECT name FROM setfarm_schema_migrations WHERE version = 14
    `;
    assert.equal(journal[0]?.name, "014_v3_deploy_receipt_ledger");
    const test = await seed("run-deploy-ledger-shape");
    await createV3DeployReceiptRepository(database.sql).publishAndComplete({
      receipt: test.receipt,
      completion: test.completion,
    });
    await assert.rejects(
      database.sql`UPDATE v3_deploy_receipts SET port = 49999 WHERE run_id = ${test.runId}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await database.sql`UPDATE runs SET deploy_receipt_hash = deploy_receipt_hash WHERE id = ${test.runId}`;
    await assert.rejects(
      database.sql`UPDATE runs SET deploy_receipt_hash = NULL WHERE id = ${test.runId}`,
      /SETFARM_DEPLOY_RECEIPT_POINTER_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`UPDATE runs SET deploy_receipt_hash = ${"f".repeat(64)} WHERE id = ${test.runId}`,
      /SETFARM_DEPLOY_RECEIPT_POINTER_IMMUTABLE/,
    );
  });

  it("commits receipt, run pointer, exact claim/step state, and outbox atomically", async () => {
    const test = await seed("run-deploy-ledger-atomic");
    const repository = createV3DeployReceiptRepository(database.sql);
    const result = await repository.publishAndComplete({
      receipt: test.receipt,
      completion: test.completion,
    });
    assert.equal(result.status, "committed");
    const state = await database.sql<Array<{
      deploy_receipt_hash: string;
      step_status: string;
      step_output: string;
      claim_outcome: string;
      receipts: number;
      outbox: number;
    }>>`
      SELECT run.deploy_receipt_hash, step.status AS step_status,
             step.output AS step_output, claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM v3_deploy_receipts receipt
               WHERE receipt.run_id = run.id) AS receipts,
             (SELECT COUNT(*)::integer FROM operational_outbox event
               WHERE event.event_type = 'v3.deploy_receipt_committed'
                 AND event.aggregate_id = run.id
                 AND event.payload->>'receiptHash' = run.deploy_receipt_hash) AS outbox
        FROM runs run
        JOIN steps step ON step.run_id = run.id AND step.step_id = 'deploy'
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = 'deploy'
       WHERE run.id = ${test.runId}
    `;
    assert.deepEqual({ ...state[0] }, {
      deploy_receipt_hash: test.receipt.receiptHash,
      step_status: "done",
      step_output: test.completion.stepOutput,
      claim_outcome: "completed",
      receipts: 1,
      outbox: 1,
    });
    assert.deepEqual(await repository.findByRunId(test.runId), test.receipt);
  });

  it("uses the database clock for receipt, run, claim, step, and outbox lifecycle timestamps", async () => {
    const test = await seed("run-deploy-ledger-database-clock");
    const hostileCallerTime = new Date("2999-01-01T00:00:00.000Z");
    await createV3DeployReceiptRepository(database.sql).publishAndComplete({
      receipt: test.receipt,
      completion: { ...test.completion, now: hostileCallerTime },
    });
    const rows = await database.sql<Array<{
      receipt_created_at: Date;
      run_updated_at: Date;
      step_updated_at: Date;
      claim_duration_ms: number;
      outbox_created_at: Date;
    }>>`
      SELECT receipt.created_at AS receipt_created_at,
             run.updated_at AS run_updated_at,
             step.updated_at AS step_updated_at,
             claim.duration_ms AS claim_duration_ms,
             event.created_at AS outbox_created_at
        FROM v3_deploy_receipts receipt
        JOIN runs run ON run.id = receipt.run_id
        JOIN steps step ON step.run_id = run.id AND step.step_id = 'deploy'
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = 'deploy'
        JOIN operational_outbox event
          ON event.aggregate_id = run.id
         AND event.event_type = 'v3.deploy_receipt_committed'
       WHERE receipt.run_id = ${test.runId}
    `;
    assert.equal(rows.length, 1);
    assert.ok(rows[0]!.claim_duration_ms >= 0);
    assert.ok(rows[0]!.claim_duration_ms < 86_400_000);
    for (const value of [
      rows[0]!.receipt_created_at,
      rows[0]!.run_updated_at,
      rows[0]!.step_updated_at,
      rows[0]!.outbox_created_at,
    ]) {
      assert.ok(new Date(value).getTime() < hostileCallerTime.getTime());
    }
  });

  it("is idempotent under concurrent identical publication and rejects a changed receipt", async () => {
    const test = await seed("run-deploy-ledger-idempotent");
    const repository = createV3DeployReceiptRepository(database.sql);
    const results = await Promise.all([
      repository.publishAndComplete({ receipt: test.receipt, completion: test.completion }),
      repository.publishAndComplete({ receipt: test.receipt, completion: test.completion }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["committed", "existing"]);
    const changed = receiptForRun(test.runId, test.candidate, test.receipt.runtime.port + 1);
    await assert.rejects(
      repository.publishAndComplete({ receipt: changed, completion: test.completion }),
      (error: unknown) => error instanceof V3DeployReceiptRepositoryError
        && error.code === "V3_DEPLOY_RECEIPT_CONFLICT",
    );
    const counts = await database.sql<Array<{ receipts: number; outbox: number }>>`
      SELECT (SELECT COUNT(*)::integer FROM v3_deploy_receipts) AS receipts,
             (SELECT COUNT(*)::integer FROM operational_outbox
               WHERE event_type = 'v3.deploy_receipt_committed') AS outbox
    `;
    assert.deepEqual({ ...counts[0] }, { receipts: 1, outbox: 1 });
  });

  it("rolls back receipt, pointer, claim, and step when canonical outbox publication conflicts", async () => {
    const test = await seed("run-deploy-ledger-rollback");
    const eventKey = `v3-deploy/${test.runId}/${test.receipt.receiptHash}/committed`;
    await database.sql.unsafe(
      `INSERT INTO operational_outbox (
         outbox_id, request_id, event_key, event_type, aggregate_type,
         aggregate_id, payload, state, created_at, updated_at
       ) VALUES ($1, NULL, $2, 'conflicting.event', 'run', $3,
         '{"schema":"setfarm.conflicting-event.v1"}'::jsonb,
         'pending', NOW(), NOW())`,
      [operationalOutboxIdForEventKey(eventKey), eventKey, test.runId],
    );
    await assert.rejects(
      createV3DeployReceiptRepository(database.sql).publishAndComplete({
        receipt: test.receipt,
        completion: test.completion,
      }),
      (error: unknown) => error instanceof V3DeployReceiptRepositoryError
        && error.code === "V3_DEPLOY_RECEIPT_PUBLICATION_FAILED",
    );
    const state = await database.sql<Array<{
      deploy_receipt_hash: string | null;
      step_status: string;
      claim_outcome: string | null;
      receipts: number;
    }>>`
      SELECT run.deploy_receipt_hash, step.status AS step_status,
             claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM v3_deploy_receipts) AS receipts
        FROM runs run
        JOIN steps step ON step.run_id = run.id AND step.step_id = 'deploy'
        JOIN claim_log claim ON claim.run_id = run.id AND claim.step_id = 'deploy'
       WHERE run.id = ${test.runId}
    `;
    assert.deepEqual({ ...state[0] }, {
      deploy_receipt_hash: null,
      step_status: "running",
      claim_outcome: null,
      receipts: 0,
    });
  });
});
