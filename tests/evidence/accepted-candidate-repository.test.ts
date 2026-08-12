import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import {
  AcceptedCandidateRepositoryError,
  createAcceptedCandidateRepository,
} from "../../src/evidence/accepted-candidate-repository.js";
import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  IndexedArtifactPublisher,
  bootstrapArtifactIndex,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { createPostgresConvergencePort } from "../../src/evals/convergence-runner.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import {
  assertV3DeployAuthority,
  V3DeployAuthorityError,
} from "../../src/execution/v3-deploy-authority.js";
import { buildTaskIntentOracleFixture } from "../evals/fixtures/task-intent-oracle-fixture.js";
import { buildRunOperationalSnapshot } from "../../src/server/run-operational-snapshot.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

const RELEASE_SHA = "c".repeat(40);
const limits = {
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 8 * 1024 * 1024,
  minFreeBytes: 0,
};

describe("accepted candidate repository", () => {
  let database: TestDatabase;
  const roots: string[] = [];

  before(async () => { database = await createIsolatedTestDatabase(); });
  after(async () => database.cleanup());
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });
  beforeEach(async () => {
    await database.reset();
  });

  async function fixture(options: Readonly<{ forgedBundleHash?: boolean }> = {}) {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-accepted-candidate-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits });
    const index = createArtifactIndex(database.sql);
    await bootstrapArtifactIndex({
      index,
      store,
      quotaBytes: limits.rootQuotaBytes,
      maxPayloadBytes: limits.maxPayloadBytes,
    });
    const runId = "accepted-candidate-run";
    const intent = buildTaskIntentOracleFixture(runId);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, compiler_release_sha,
         activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', $2, 'running', 'v3', $3, $4, $5)`,
      [runId, intent.task, RELEASE_SHA, "d".repeat(64), releaseAdmissionHash],
    );
    const contracts = intent.contracts;
    const producer = { pass: "accepted-candidate-test", codeSha: RELEASE_SHA, toolVersions: {} };
    const compiler = { version: "3.0.0", codeSha: RELEASE_SHA };
    const publisher = new IndexedArtifactPublisher({
      index,
      store,
      ownerInstanceId: "accepted-candidate-compiler",
    });
    const compiled = await compileProductBuildPacket({
      productSpec: contracts.productSpec,
      designGraph: contracts.designGraph,
      buildTopology: contracts.buildTopology,
      storyPlan: contracts.storyPlan,
      designSource: contracts.designSource,
      compiler,
      producer,
      protocol: "v3",
      artifactStore: publisher,
    });
    assert.equal(compiled.status, "sealed");
    assert.ok(compiled.packetHash);
    await index.activateProductPacket({
      runId,
      packetHash: compiled.packetHash,
      compiler,
      artifactRefs: {
        PRODUCT_SPEC: compiled.artifactHashes.productSpec!,
        DESIGN_GRAPH: compiled.artifactHashes.designGraph!,
        BUILD_TOPOLOGY: compiled.artifactHashes.buildTopology!,
        STORY_PLAN: compiled.artifactHashes.storyPlan!,
        DESIGN_SOURCE_CLOSURE: compiled.artifactHashes.designSourceClosure!,
        PRODUCT_BUILD_PACKET: compiled.packetHash,
        COMPILATION_REPORT: compiled.reportHash,
      },
    });
    const packetHash = compiled.packetHash;
    await database.sql.unsafe(
      `INSERT INTO stories (id, run_id, story_index, story_id, title, status)
       VALUES ('story-accepted-candidate-us-001', $1, 0, 'US-001', 'Save task', 'done')`,
      [runId],
    );
    const sourceRevision = { sha: "3".repeat(40), treeHash: "4".repeat(40) };
    const slice = ImplementationSliceV1Schema.parse({
      ...contracts.implementationSlice,
      packetHash,
      sourceRevision: { baseSha: sourceRevision.sha, treeHash: sourceRevision.treeHash },
    });
    const slicePublication = await publisher.put({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.implementation-slice.v1",
      producer,
      payload: slice,
    });
    const plan = compileEvidencePlanV1({ slice, sliceHash: slicePublication.hash });
    const planPublication = await publisher.put({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.evidence-plan.v1",
      producer,
      payload: plan,
    });
    await index.addRunArtifactRef({
      runId,
      refKey: `SLICE_US_001_${slicePublication.hash.slice(0, 16).toUpperCase()}`,
      artifactHash: slicePublication.hash,
    });
    await index.addRunArtifactRef({
      runId,
      refKey: `EVIDENCE_PLAN_US_001_${planPublication.hash.slice(0, 16).toUpperCase()}`,
      artifactHash: planPublication.hash,
    });

    const startedAt = "2026-07-13T12:00:00.000Z";
    const completedAt = "2026-07-13T12:00:10.000Z";
    const beforeHash = hashCanonicalJson({ state: "before" });
    const afterHash = hashCanonicalJson({ state: "after" });
    const controlObservation = {
      kind: "control" as const,
      owner: "setfarm-orchestrator" as const,
      actionRef: "ACT_SAVE_TASK",
      controlRef: "CTRL_SAVE_TASK",
      beforeArtifactHash: beforeHash,
      afterArtifactHash: afterHash,
      startedAt,
      completedAt,
    };
    const commandObservations = plan.commands.map((command, indexValue) => {
      const stdoutArtifactHash = hashCanonicalJson({ command: command.commandRef, index: indexValue });
      return {
        observation: {
          kind: "command" as const,
          owner: "setfarm-orchestrator" as const,
          commandRef: command.commandRef,
          exitCode: 0,
          stdoutArtifactHash,
          startedAt,
          completedAt,
        },
        stdoutArtifactHash,
      };
    });
    const attemptId = "ATT_00000000-0000-0000-0000-000000000777";
    const bundle = createEvidenceBundleV2({
      runId,
      storyId: "US-001",
      packetHash,
      sliceHash: slicePublication.hash,
      sourceRevision,
      attemptId,
      predicates: [
        {
          invariantRef: "INV_PERSISTENCE_ROUND_TRIP",
          predicateRef: "EVID_SAVE_RELOAD",
          actionRef: "ACT_SAVE_TASK",
          controlRef: "CTRL_SAVE_TASK",
          required: true,
          verdict: "pass",
          observationRefs: [computeObservationRef(controlObservation)],
        },
        {
          invariantRef: "INV_OBSERVABLE_OUTCOME",
          predicateRef: "EVID_SAVE_OBSERVABLE",
          actionRef: "ACT_SAVE_TASK",
          controlRef: "CTRL_SAVE_TASK",
          required: true,
          verdict: "pass",
          observationRefs: [computeObservationRef(controlObservation)],
        },
        ...commandObservations.map(({ observation }) => ({
          invariantRef: `INV_COMMAND_${plan.commands.find((command) => command.commandRef === observation.commandRef)!.kind.toUpperCase()}`,
          predicateRef: `EVID_COMMAND_${observation.commandRef}`,
          required: true,
          verdict: "pass" as const,
          observationRefs: [computeObservationRef(observation)],
        })),
      ],
      observations: [controlObservation, ...commandObservations.map(({ observation }) => observation)],
      artifacts: [
        { hash: beforeHash, mediaType: "application/json", locator: "evidence/before.json" },
        { hash: afterHash, mediaType: "application/json", locator: "evidence/after.json" },
        ...commandObservations.map(({ observation, stdoutArtifactHash }) => ({
          hash: stdoutArtifactHash,
          mediaType: "text/plain",
          locator: `evidence/${observation.commandRef}.txt`,
        })),
      ],
      runner: {
        id: "setfarm-canonical-evidence-runner",
        version: "1.0.0",
        environmentHash: "5".repeat(64),
      },
      startedAt,
      completedAt,
    });
    const canonicalBundleHash = computeEvidenceBundleHash(bundle);
    const evidenceBundleHash = options.forgedBundleHash ? "9".repeat(64) : canonicalBundleHash;
    const evidenceRefs = [
      `setfarm://artifact/${packetHash}`,
      `setfarm://artifact/${slicePublication.hash}`,
      `setfarm://artifact/${planPublication.hash}`,
      `setfarm://evidence-bundle/${evidenceBundleHash}`,
    ].sort();
    await database.sql.unsafe(
      `INSERT INTO execution_attempts (
         attempt_id, run_id, step_id, story_id, generation, fence_token,
         attempt_class, packet_hash, compilation_report_hash, slice_hash,
         source_before_sha, source_before_tree_hash, source_after_sha,
         source_after_tree_hash, role, agent_id, lease_acquired_at,
         lease_expires_at, heartbeat_at, disposition, output_hash,
         evidence_refs, created_at, updated_at
       ) VALUES (
         $1, $2, 'final-test', 'US-001', 1, $3, 'evidence_only', $4, $5, $6,
         $7, $8, $7, $8, 'tester', 'feature-dev_tester', $9, $10, $10,
         'verified', $11, $12, $9, $10
       )`,
      [
        attemptId,
        runId,
        "6".repeat(64),
        packetHash,
        compiled.reportHash,
        slicePublication.hash,
        sourceRevision.sha,
        sourceRevision.treeHash,
        new Date(startedAt),
        new Date(completedAt),
        evidenceBundleHash,
        JSON.stringify(evidenceRefs),
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO evidence_bundles (
         evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash,
         slice_hash, source_sha, source_tree_hash, attempt_id,
         aggregate_verdict, payload, created_at
       ) VALUES ($1, $2, $3, 'US-001', $4, $5, $6, $7, $8, 'pass', $9::text::jsonb, $10)`,
      [
        evidenceBundleHash,
        bundle.evidenceId,
        runId,
        packetHash,
        slicePublication.hash,
        sourceRevision.sha,
        sourceRevision.treeHash,
        attemptId,
        JSON.stringify(bundle),
        new Date(completedAt),
      ],
    );
    const repository = createAcceptedCandidateRepository({
      sql: database.sql,
      artifactRoot,
      artifactLimits: limits,
    });
    const storyEvidence = [{
      storyId: "US-001",
      attemptId,
      evidencePlanArtifactHash: planPublication.hash,
      evidenceBundleHash,
    }];
    return { runId, repository, sourceRevision, storyEvidence, artifactRoot, intent };
  }

  it("atomically seals one exact final-tree candidate and replays it after terminalization", async () => {
    const test = await fixture();
    const first = await test.repository.publish({
      runId: test.runId,
      sourceRevision: test.sourceRevision,
      storyEvidence: test.storyEvidence,
      now: new Date("2026-07-13T12:01:00.000Z"),
    });
    assert.equal(first.created, true);
    const rows = await database.sql<Array<{
      accepted_candidate_hash: string | null;
      candidates: number;
      stories: number;
    }>>`
      SELECT accepted_candidate_hash,
             (SELECT COUNT(*)::integer FROM accepted_candidates WHERE run_id = r.id) AS candidates,
             (SELECT COUNT(*)::integer FROM accepted_candidate_story_evidence
               WHERE candidate_hash = r.accepted_candidate_hash) AS stories
        FROM runs r WHERE id = ${test.runId}
    `;
    assert.deepEqual({ ...rows[0] }, {
      accepted_candidate_hash: first.candidate.candidateHash,
      candidates: 1,
      stories: 1,
    });
    const storyProjection = await database.sql<Array<{ status: string }>>`
      SELECT status FROM stories WHERE run_id = ${test.runId} AND story_id = 'US-001'
    `;
    assert.equal(storyProjection[0]?.status, "verified");
    const deployAuthority = await assertV3DeployAuthority({
      sql: database.sql,
      runId: test.runId,
      worktree: "/not-read-by-test-double",
      captureSource: async () => test.sourceRevision,
    });
    assert.equal(deployAuthority.status, "authorized");
    await assert.rejects(
      assertV3DeployAuthority({
        sql: database.sql,
        runId: test.runId,
        worktree: "/not-read-by-test-double",
        captureSource: async () => ({ ...test.sourceRevision, treeHash: "f".repeat(40) }),
      }),
      (error: unknown) => error instanceof V3DeployAuthorityError
        && error.code === "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
    );
    const terminal = await transitionRunToTerminal(database.sql, {
      runId: test.runId,
      status: "completed",
      diagnostic: "canonical AcceptedCandidate sealed",
    });
    assert.equal(terminal.status, "completed");
    const replay = await test.repository.publish({
      runId: test.runId,
      sourceRevision: test.sourceRevision,
      storyEvidence: test.storyEvidence,
    });
    assert.equal(replay.created, false);
    assert.equal(replay.candidate.candidateHash, first.candidate.candidateHash);
    const snapshot = await buildRunOperationalSnapshot(database.sql, test.runId);
    assert.ok(snapshot);
    assert.equal(snapshot.source.capabilities.acceptedCandidate, true);
    assert.equal(snapshot.acceptedCandidate?.ref, `setfarm://accepted-candidate/${first.candidate.candidateHash}`);
    assert.deepEqual(snapshot.acceptedCandidate?.candidate, first.candidate);
    assert.deepEqual(snapshot.invariants, []);
    const convergence = await createPostgresConvergencePort(database.sql, {
      artifactRoot: test.artifactRoot,
      artifactLimits: limits,
    }).collectRun(test.runId, {
      task: test.intent.task,
      oracle: test.intent.oracle,
    });
    assert.equal(convergence.canonical.acceptance.candidateHash, first.candidate.candidateHash);
    assert.deepEqual(convergence.canonical.invariantCodes, []);
    await assert.rejects(
      database.sql`UPDATE accepted_candidates SET source_tree_hash = ${"8".repeat(40)} WHERE run_id = ${test.runId}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
  });

  it("refuses incomplete StoryPlan coverage before writing acceptance state", async () => {
    const test = await fixture();
    await assert.rejects(
      test.repository.publish({
        runId: test.runId,
        sourceRevision: test.sourceRevision,
        storyEvidence: [],
      }),
      (error: unknown) => error instanceof AcceptedCandidateRepositoryError
        && error.code === "ACCEPTED_CANDIDATE_STORY_SET_MISMATCH",
    );
    assert.equal((await test.repository.findByRun(test.runId)), undefined);
  });

  it("refuses a failed story projection even when final-source evidence passes", async () => {
    const test = await fixture();
    await database.sql`UPDATE stories SET status = 'failed' WHERE run_id = ${test.runId}`;
    await assert.rejects(
      test.repository.publish({
        runId: test.runId,
        sourceRevision: test.sourceRevision,
        storyEvidence: test.storyEvidence,
      }),
      (error: unknown) => error instanceof AcceptedCandidateRepositoryError
        && error.code === "ACCEPTED_CANDIDATE_STORY_STATUS_INVALID",
    );
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM accepted_candidates WHERE run_id = ${test.runId}
    `;
    assert.equal(rows[0]?.count, 0);
  });

  it("rejects a DB row whose declared bundle hash does not match canonical evidence bytes", async () => {
    const test = await fixture({ forgedBundleHash: true });
    await assert.rejects(
      test.repository.publish({
        runId: test.runId,
        sourceRevision: test.sourceRevision,
        storyEvidence: test.storyEvidence,
      }),
      (error: unknown) => error instanceof AcceptedCandidateRepositoryError
        && error.code === "ACCEPTED_CANDIDATE_EVIDENCE_INVALID",
    );
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM accepted_candidates WHERE run_id = ${test.runId}
    `;
    assert.equal(rows[0]?.count, 0);
  });
});
