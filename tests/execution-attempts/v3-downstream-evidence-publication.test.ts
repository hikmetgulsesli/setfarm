import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import {
  createV3DownstreamEvidencePublication,
  V3DownstreamEvidenceAuthorityV1Schema,
  type V3DownstreamEvidencePreparedAttemptV1,
} from "../../src/recovery/v3-downstream-evidence-publication.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const COMPILATION_REPORT_HASH = "c".repeat(64);
const SOURCE = Object.freeze({ sha: "1".repeat(40), treeHash: "2".repeat(40) });
const CLAIMED_AT = new Date("2026-07-13T09:59:00.000Z");
const RESERVED_AT = new Date("2026-07-13T10:00:00.000Z");
const COMPLETED_AT = new Date("2026-07-13T10:00:05.000Z");

describe("v3 downstream evidence publication", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    await database.cleanup();
  });

  async function setup() {
    sequence += 1;
    const runId = `run-v3-downstream-publication-${sequence}`;
    const stepDbId = `step-v3-downstream-publication-${sequence}`;
    const storyDbId = `story-v3-downstream-publication-${sequence}`;
    const originalContext = { repo: "/tmp/downstream-publication", marker: sequence };
    const originalScope = ["src/App.tsx"];
    const originalResolvedScope = ["src/App.tsx"];
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'downstream publication test', 'running', $2,
                 'v3', 1, $3, $4, $5, $6)`,
      [runId, JSON.stringify(originalContext), releaseSha, PACKET_HASH, "4".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, retry_count
       ) VALUES ($1, $2, 'qa-test', 'qa-tester', 9, 'qa', 'STATUS: done',
                 'running', 'single', 0)`,
      [stepDbId, runId],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, output,
         retry_count, max_retries, scope_files, resolved_scope_files
       ) VALUES ($1, $2, 1, 'US-001', 'Sealed story', 'done', 'sealed output',
                 0, 3, $3, $4)`,
      [storyDbId, runId, JSON.stringify(originalScope), JSON.stringify(originalResolvedScope)],
    );
    const parentRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'qa-test', NULL, 'qa-tester', $2)
       RETURNING id::text`,
      [runId, CLAIMED_AT],
    );
    const parentClaimId = Number(parentRows[0]!.id);
    const authority = V3DownstreamEvidenceAuthorityV1Schema.parse({
      schema: "setfarm.v3-downstream-evidence-authority.v1",
      runId,
      stepDbId,
      workflowStepId: "qa-test",
      phase: "qa",
      parentClaimId,
      storyDbId,
      storyId: "US-001",
      packetHash: PACKET_HASH,
    });
    const prepared: V3DownstreamEvidencePreparedAttemptV1 = {
      runId,
      stepId: "qa-test",
      storyId: "US-001",
      attemptClass: "evidence_only",
      packetHash: PACKET_HASH,
      compilationReportHash: COMPILATION_REPORT_HASH,
      sliceHash: SLICE_HASH,
      sourceBefore: SOURCE,
      role: "downstream-evidence-orchestrator",
      agentId: "setfarm-downstream-evidence-orchestrator",
      branch: "run/downstream-publication",
      worktree: "/tmp/downstream-publication",
      evidenceRefs: [
        `setfarm://artifact/${PACKET_HASH}`,
        `setfarm://artifact/${SLICE_HASH}`,
      ],
    };
    return {
      runId,
      stepDbId,
      storyDbId,
      parentClaimId,
      authority,
      prepared,
      originalContext,
      originalScope,
      originalResolvedScope,
    };
  }

  it("atomically owns one story-bound child attempt, publishes typed evidence, and replays unchanged source", async () => {
    const value = await setup();
    const publication = createV3DownstreamEvidencePublication(database.sql);
    const concurrent = await Promise.all([
      publication.reserve(value.authority, value.prepared, { now: RESERVED_AT }),
      publication.reserve(value.authority, value.prepared, { now: RESERVED_AT }),
    ]);
    assert.deepEqual(concurrent.map((item) => item.status).sort(), ["active_conflict", "reserved"]);
    assert.equal(concurrent[0]!.attempt.attemptId, concurrent[1]!.attempt.attemptId);
    const reserved = concurrent.find((item) => item.status === "reserved")!.attempt;
    assert.equal(reserved.claimId === value.parentClaimId, false, "the single-step parent claim cannot be reused");
    assert.equal(reserved.attemptClass, "evidence_only");
    assert.equal(reserved.recoveryDispatchId, undefined);
    assert.equal(reserved.storyId, "US-001");

    const running = await publication.markRunning({
      authority: value.authority,
      attempt: reserved,
      now: new Date("2026-07-13T10:00:01.000Z"),
    });
    assert.equal(running.disposition, "running");
    const runtimeArtifactHash = "d".repeat(64);
    const observation = {
      kind: "runtime" as const,
      owner: "setfarm-orchestrator" as const,
      runtimeSessionId: "runtime-v3-downstream-publication",
      runtimeArtifactHash,
      startedAt: "2026-07-13T10:00:01.000Z",
      completedAt: "2026-07-13T10:00:03.000Z",
    };
    const bundle = createEvidenceBundleV2({
      runId: value.runId,
      storyId: "US-001",
      packetHash: PACKET_HASH,
      sliceHash: SLICE_HASH,
      sourceRevision: SOURCE,
      attemptId: reserved.attemptId,
      predicates: [{
        invariantRef: "INV_PERSISTENCE_ROUND_TRIP",
        predicateRef: "EVID_SAVE_RELOAD",
        required: true,
        verdict: "fail",
        observationRefs: [computeObservationRef(observation)],
      }],
      observations: [observation],
      artifacts: [{ hash: runtimeArtifactHash, mediaType: "application/json", locator: "evidence/runtime.json" }],
      runner: { id: "setfarm-downstream-publication-test", version: "1", environmentHash: "e".repeat(64) },
      startedAt: "2026-07-13T10:00:01.000Z",
      completedAt: "2026-07-13T10:00:04.000Z",
    });
    const bundleHash = computeEvidenceBundleHash(bundle);
    const findingSet = createFindingSetV1({
      runId: value.runId,
      storyId: "US-001",
      packetHash: PACKET_HASH,
      sliceHash: SLICE_HASH,
      sourceRevision: SOURCE,
      findings: [{
        origin: "runtime",
        classification: "structured",
        invariantRef: "INV_PERSISTENCE_ROUND_TRIP",
        sourceLocators: [{ path: "src/App.tsx", contentHash: "f".repeat(64) }],
        observedEvidenceRefs: [bundleHash],
        expectedPredicateRef: "EVID_SAVE_RELOAD",
        status: "open",
      }],
    });
    const completed = await publication.complete({
      authority: value.authority,
      attempt: running,
      disposition: "no_progress",
      bundle,
      findingSet,
      now: COMPLETED_AT,
    });
    assert.equal(completed.disposition, "no_progress");
    assert.equal(completed.outputHash, bundleHash);
    assert.deepEqual(completed.sourceAfter, SOURCE);

    const replay = await publication.reserve(value.authority, value.prepared, {
      now: new Date("2026-07-13T10:00:06.000Z"),
    });
    assert.equal(replay.status, "duplicate");
    assert.equal(replay.attempt.attemptId, completed.attemptId);

    const rows = await database.sql.unsafe<Array<{
      attempt_count: number;
      child_claim_count: number;
      child_claim_outcome: string;
      parent_claim_outcome: string | null;
      parent_claim_story_id: string | null;
      attempt_disposition: string;
      attempt_class: string;
      recovery_dispatch_id: string | null;
      story_status: string;
      story_output: string;
      story_retry_count: number;
      scope_files: string;
      resolved_scope_files: string;
      run_context: string;
      qa_fix_count: number;
      evidence_bundle_count: number;
      finding_set_count: number;
    }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id = $1) AS attempt_count,
         (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = $1 AND story_id = 'US-001') AS child_claim_count,
         child.outcome AS child_claim_outcome,
         parent.outcome AS parent_claim_outcome,
         parent.story_id AS parent_claim_story_id,
         attempt.disposition AS attempt_disposition,
         attempt.attempt_class,
         attempt.recovery_dispatch_id,
         story.status AS story_status,
         story.output AS story_output,
         story.retry_count AS story_retry_count,
         story.scope_files,
         story.resolved_scope_files,
         run_row.context AS run_context,
         (SELECT COUNT(*)::integer FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%') AS qa_fix_count,
         (SELECT COUNT(*)::integer FROM evidence_bundles WHERE run_id = $1) AS evidence_bundle_count,
         (SELECT COUNT(*)::integer FROM finding_sets WHERE run_id = $1) AS finding_set_count
       FROM execution_attempts attempt
       JOIN claim_log child ON child.id = attempt.claim_id
       JOIN claim_log parent ON parent.id = $2
       JOIN stories story ON story.id = $3
       JOIN runs run_row ON run_row.id = $1
       WHERE attempt.attempt_id = $4`,
      [value.runId, value.parentClaimId, value.storyDbId, completed.attemptId],
    );
    assert.deepEqual({ ...rows[0] }, {
      attempt_count: 1,
      child_claim_count: 1,
      child_claim_outcome: "completed",
      parent_claim_outcome: null,
      parent_claim_story_id: null,
      attempt_disposition: "no_progress",
      attempt_class: "evidence_only",
      recovery_dispatch_id: null,
      story_status: "done",
      story_output: "sealed output",
      story_retry_count: 0,
      scope_files: JSON.stringify(value.originalScope),
      resolved_scope_files: JSON.stringify(value.originalResolvedScope),
      run_context: JSON.stringify(value.originalContext),
      qa_fix_count: 0,
      evidence_bundle_count: 1,
      finding_set_count: 1,
    });
  });

  it("adopts one expired unchanged-source owner with a new fence instead of allocating duplicate work", async () => {
    const value = await setup();
    const publication = createV3DownstreamEvidencePublication(database.sql);
    const first = await publication.reserve(value.authority, value.prepared, {
      now: new Date("2999-01-01T00:00:00.000Z"),
      leaseMs: 1_000,
    });
    assert.equal(first.status, "reserved");
    const running = await publication.markRunning({
      authority: value.authority,
      attempt: first.attempt,
      now: new Date("1900-01-01T00:00:00.000Z"),
    });
    const liveReplay = await publication.reserve(value.authority, value.prepared, {
      now: new Date("2999-01-01T00:00:00.000Z"),
      leaseMs: 1_000,
    });
    assert.equal(liveReplay.status, "active_conflict");

    await database.sql.unsafe(
      `UPDATE execution_attempts
          SET lease_acquired_at = clock_timestamp() - interval '2 seconds',
              heartbeat_at = clock_timestamp() - interval '2 seconds',
              lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE attempt_id = $1`,
      [running.attemptId],
    );
    const adopted = await publication.reserve(value.authority, value.prepared, {
      now: new Date("1900-01-01T00:00:00.000Z"),
      leaseMs: 1_000,
    });
    assert.equal(adopted.status, "reserved");
    assert.equal(adopted.attempt.attemptId, running.attemptId);
    assert.equal(adopted.attempt.claimId, running.claimId);
    assert.equal(adopted.attempt.generation, running.generation + 1);
    assert.notEqual(adopted.attempt.fenceToken, running.fenceToken);
    assert.equal(adopted.attempt.disposition, "claimed");

    await assert.rejects(
      publication.markRunning({
        authority: value.authority,
        attempt: running,
        now: new Date("2999-01-01T00:00:00.000Z"),
      }),
      /V3_DOWNSTREAM_EVIDENCE_RUNNING_CAS_LOST/,
    );
    const adoptedRunning = await publication.markRunning({
      authority: value.authority,
      attempt: adopted.attempt,
      now: new Date("2999-01-01T00:00:00.000Z"),
    });
    assert.equal(adoptedRunning.disposition, "running");

    const counts = await database.sql.unsafe<Array<{ attempts: number; children: number }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id = $1) AS attempts,
         (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = $1 AND story_id = 'US-001') AS children`,
      [value.runId],
    );
    assert.deepEqual({ ...counts[0] }, { attempts: 1, children: 1 });
  });

  it("rejects a story-bound parent claim before allocating any child owner", async () => {
    const value = await setup();
    await database.sql.unsafe("UPDATE claim_log SET story_id = 'US-001' WHERE id = $1", [value.parentClaimId]);
    const publication = createV3DownstreamEvidencePublication(database.sql);
    await assert.rejects(
      publication.reserve(value.authority, value.prepared, { now: RESERVED_AT }),
      /V3_DOWNSTREAM_EVIDENCE_AUTHORITY_MISMATCH/,
    );
    const rows = await database.sql.unsafe<Array<{ count: number }>>(
      "SELECT COUNT(*)::integer AS count FROM execution_attempts WHERE run_id = $1",
      [value.runId],
    );
    assert.equal(rows[0]!.count, 0);
  });
});
