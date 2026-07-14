import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { createV3DownstreamEvidencePublication } from "../../src/recovery/v3-downstream-evidence-publication.js";
import { V3DownstreamEvidenceRouteResultV1Schema } from "../../src/recovery/v3-downstream-evidence-router.js";
import {
  commitV3DownstreamEvidenceDecision,
  createV3DownstreamOperationalDecision,
} from "../../src/recovery/v3-downstream-recovery-transition.js";
import { createV3RecoveryCoordinator } from "../../src/recovery/v3-recovery-coordinator.js";
import { createV3RecoveryWorkRouter } from "../../src/recovery/v3-recovery-work-router.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const SOURCE = Object.freeze({ sha: "1".repeat(40), treeHash: "2".repeat(40) });
const NOW = new Date("2026-07-13T10:00:00.000Z");

describe("v3 downstream recovery transition", () => {
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
    const values = buildMinimalValidContracts();
    values.implementationSlice.sourceRevision = { baseSha: SOURCE.sha, treeHash: SOURCE.treeHash };
    const slice = ImplementationSliceV1Schema.parse(values.implementationSlice);
    const sliceHash = hashCanonicalJson({ schema: "setfarm.test-downstream-slice.v1", sequence });
    const plan = compileEvidencePlanV1({ slice, sliceHash });
    const planArtifactHash = hashCanonicalJson({ schema: "setfarm.test-downstream-plan.v1", plan });
    const runId = `run-v3-downstream-transition-${sequence}`;
    const storyDbId = `story-v3-downstream-transition-${sequence}`;
    const implementStepDbId = `implement-v3-downstream-transition-${sequence}`;
    const qaStepDbId = `qa-v3-downstream-transition-${sequence}`;
    const finalStepDbId = `final-v3-downstream-transition-${sequence}`;
    const context = { repo: "/tmp/v3-downstream-transition", branch: "main", marker: sequence };
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'v3 downstream transition', 'running', $2,
                 'v3', 1, $3, $4, $5, $6)`,
      [runId, JSON.stringify(context), releaseSha, slice.packetHash, "4".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, loop_config, retry_count
       ) VALUES
         ($1, $2, 'implement', 'developer', 6, 'implement', 'STATUS: done',
          'done', 'loop', '{"over":"stories"}', 0),
         ($3, $2, 'qa-test', 'qa-tester', 9, 'qa', 'STATUS: done',
          'running', 'single', NULL, 0),
         ($4, $2, 'final-test', 'final-tester', 10, 'final', 'STATUS: done',
          'pending', 'single', NULL, 0)`,
      [implementStepDbId, runId, qaStepDbId, finalStepDbId],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, output, retry_count,
         max_retries, scope_files, resolved_scope_files, story_branch, pr_url, merge_status
       ) VALUES ($1, $2, 1, $3, 'Sealed story', 'done', 'sealed story output', 0,
                 3, '["src/App.tsx"]', '["src/App.tsx"]', 'story/us-001',
                 'https://github.com/example/project/pull/1', 'merged')`,
      [storyDbId, runId, slice.storyId],
    );
    const parentRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'qa-test', NULL, 'qa-tester', $2)
       RETURNING id::text`,
      [runId, new Date("2026-07-13T09:59:00.000Z")],
    );
    const parentClaimId = Number(parentRows[0]!.id);
    const envelope = ClaimEnvelopeV1Schema.parse({
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: NOW.toISOString(),
      stepId: qaStepDbId,
      workflowStepId: "qa-test",
      runId,
      claimId: parentClaimId,
      claimAgentId: "qa-tester",
      runtimeAgentId: "iris",
    });
    return {
      runId,
      storyDbId,
      implementStepDbId,
      qaStepDbId,
      finalStepDbId,
      parentClaimId,
      context,
      slice,
      sliceHash,
      plan,
      planArtifactHash,
      envelope,
    };
  }

  function failureEvidence(input: Awaited<ReturnType<typeof setup>>, attemptId: string) {
    const flow = input.plan.flows[0]!;
    const beforeHash = hashCanonicalJson({ run: input.runId, artifact: "before" });
    const afterHash = hashCanonicalJson({ run: input.runId, artifact: "after" });
    const control = {
      kind: "control" as const,
      owner: "setfarm-orchestrator" as const,
      actionRef: flow.actionRef,
      controlRef: flow.controlRef!,
      beforeArtifactHash: beforeHash,
      afterArtifactHash: afterHash,
      startedAt: "2026-07-13T10:00:01.000Z",
      completedAt: "2026-07-13T10:00:02.000Z",
    };
    const commands = input.plan.commands.map((command, index) => {
      const stdoutArtifactHash = hashCanonicalJson({ run: input.runId, command: command.commandRef });
      const observation = {
        kind: "command" as const,
        owner: "setfarm-orchestrator" as const,
        commandRef: command.commandRef,
        exitCode: 0,
        stdoutArtifactHash,
        startedAt: `2026-07-13T10:00:0${index + 3}.000Z`,
        completedAt: `2026-07-13T10:00:0${index + 3}.500Z`,
      };
      return { command, observation, stdoutArtifactHash };
    });
    const productPredicate = input.slice.requiredEvidence[0]!;
    const bundle = createEvidenceBundleV2({
      runId: input.runId,
      storyId: input.slice.storyId,
      packetHash: input.slice.packetHash,
      sliceHash: input.sliceHash,
      sourceRevision: SOURCE,
      attemptId,
      predicates: [{
        invariantRef: `INV_${productPredicate.kind.toUpperCase()}`,
        predicateRef: productPredicate.id,
        actionRef: flow.actionRef,
        controlRef: flow.controlRef,
        required: true,
        verdict: "fail",
        observationRefs: [computeObservationRef(control)],
      }, ...commands.map(({ command, observation }) => ({
        invariantRef: `INV_COMMAND_${command.kind.toUpperCase()}`,
        predicateRef: `EVID_COMMAND_${command.commandRef}`,
        required: true as const,
        verdict: "pass" as const,
        observationRefs: [computeObservationRef(observation)],
      }))],
      observations: [control, ...commands.map(({ observation }) => observation)],
      artifacts: [
        { hash: beforeHash, mediaType: "application/json", locator: "evidence/before.json" },
        { hash: afterHash, mediaType: "application/json", locator: "evidence/after.json" },
        ...commands.map(({ command, stdoutArtifactHash }) => ({
          hash: stdoutArtifactHash,
          mediaType: "text/plain",
          locator: `evidence/${command.commandRef}.stdout`,
        })),
      ],
      runner: { id: "setfarm-v3-downstream-transition-test", version: "1", environmentHash: "5".repeat(64) },
      startedAt: "2026-07-13T10:00:01.000Z",
      completedAt: "2026-07-13T10:00:08.000Z",
    });
    const bundleHash = computeEvidenceBundleHash(bundle);
    const findingSet = createFindingSetV1({
      runId: input.runId,
      storyId: input.slice.storyId,
      packetHash: input.slice.packetHash,
      sliceHash: input.sliceHash,
      sourceRevision: SOURCE,
      findings: [{
        origin: "runtime",
        classification: "structured",
        invariantRef: `INV_${productPredicate.kind.toUpperCase()}`,
        sourceLocators: input.slice.files
          .filter((file) => file.role === "owned" || file.role === "shared_writable")
          .map((file) => ({ path: file.path, contentHash: "6".repeat(64) })),
        observedEvidenceRefs: [bundleHash],
        expectedPredicateRef: productPredicate.id,
        status: "open",
      }],
    });
    return { bundle, bundleHash, findingSet };
  }

  it("atomically returns only the dispatched sealed story to the existing recovery work router", async () => {
    const value = await setup();
    const publication = createV3DownstreamEvidencePublication(database.sql);
    const authority = {
      schema: "setfarm.v3-downstream-evidence-authority.v1" as const,
      runId: value.runId,
      stepDbId: value.qaStepDbId,
      workflowStepId: "qa-test" as const,
      phase: "qa" as const,
      parentClaimId: value.parentClaimId,
      storyDbId: value.storyDbId,
      storyId: value.slice.storyId,
      packetHash: value.slice.packetHash,
    };
    const reserved = await publication.reserve(authority, {
      runId: value.runId,
      stepId: "qa-test",
      storyId: value.slice.storyId,
      attemptClass: "evidence_only",
      packetHash: value.slice.packetHash,
      compilationReportHash: "7".repeat(64),
      sliceHash: value.sliceHash,
      sourceBefore: SOURCE,
      role: "downstream-evidence-orchestrator",
      agentId: "setfarm-downstream-evidence-orchestrator",
      branch: "main",
      worktree: "/tmp/v3-downstream-transition",
      evidenceRefs: [`setfarm://artifact/${value.planArtifactHash}`],
    }, { now: NOW });
    assert.equal(reserved.status, "reserved");
    const running = await publication.markRunning({ authority, attempt: reserved.attempt, now: NOW });
    const evidence = failureEvidence(value, running.attemptId);
    const terminal = await publication.complete({
      authority,
      attempt: running,
      disposition: "no_progress",
      bundle: evidence.bundle,
      findingSet: evidence.findingSet,
      now: new Date("2026-07-13T10:00:09.000Z"),
    });
    const coordinated = await createV3RecoveryCoordinator(database.sql).coordinate({
      kind: "initial_evidence",
      slice: value.slice,
      sliceHash: value.sliceHash,
      evidencePlan: value.plan,
      evidencePlanArtifactHash: value.planArtifactHash,
      evidenceBundle: evidence.bundle,
      findingSet: evidence.findingSet,
      failureClass: "product",
      downstreamAuthority: authority,
    }, { now: new Date("2026-07-13T10:00:10.000Z") });
    assert.equal(coordinated.status, "dispatched");
    if (coordinated.status !== "dispatched") throw new Error("expected dispatch");
    const crashReplay = await publication.reserve(authority, {
      runId: value.runId,
      stepId: "qa-test",
      storyId: value.slice.storyId,
      attemptClass: "evidence_only",
      packetHash: value.slice.packetHash,
      compilationReportHash: "7".repeat(64),
      sliceHash: value.sliceHash,
      sourceBefore: SOURCE,
      role: "downstream-evidence-orchestrator",
      agentId: "setfarm-downstream-evidence-orchestrator",
      branch: "main",
      worktree: "/tmp/v3-downstream-transition",
      evidenceRefs: [`setfarm://artifact/${value.planArtifactHash}`],
    }, { now: new Date("2026-07-13T10:00:10.500Z") });
    assert.equal(crashReplay.status, "duplicate", "failed-story crash replay must not allocate another attempt");
    assert.equal(crashReplay.attempt.attemptId, terminal.attemptId);
    const route = V3DownstreamEvidenceRouteResultV1Schema.parse({
      schema: "setfarm.v3-downstream-evidence-route.v1",
      status: "recovery_routed",
      runId: value.runId,
      phase: "qa",
      packetHash: value.slice.packetHash,
      sourceRevision: SOURCE,
      stories: [{
        storyDbId: value.storyDbId,
        storyId: value.slice.storyId,
        attemptId: terminal.attemptId,
        sliceHash: value.sliceHash,
        evidencePlanArtifactHash: value.planArtifactHash,
        evidenceBundleHash: evidence.bundleHash,
        aggregateVerdict: "fail",
        execution: "executed",
        coordinator: coordinated,
      }],
      routedStoryIds: [value.slice.storyId],
    });
    const committed = await commitV3DownstreamEvidenceDecision(database.sql, {
      envelope: value.envelope,
      route,
      now: new Date("2026-07-13T10:00:11.000Z"),
    });
    assert.equal(committed.decision.outcome, "recovery_routed");
    assert.equal(committed.decision.storyEvidence[0]!.evidencePlanArtifactHash, value.planArtifactHash);
    assert.equal(committed.completionPlan.effects[0]!.effectType, "v3.downstream-recovery.routed");

    const state = await database.sql.unsafe<Array<{
      story_status: string;
      story_output: string;
      story_retry_count: number;
      scope_files: string;
      resolved_scope_files: string;
      implement_status: string;
      qa_status: string;
      final_status: string;
      parent_outcome: string;
      run_context: string;
      qa_fix_count: number;
      delivery_state: string;
    }>>(
      `SELECT story.status AS story_status,
              story.output AS story_output,
              story.retry_count AS story_retry_count,
              story.scope_files,
              story.resolved_scope_files,
              implement.status AS implement_status,
              qa.status AS qa_status,
              final.status AS final_status,
              parent.outcome AS parent_outcome,
              run_row.context AS run_context,
              (SELECT COUNT(*)::integer FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%') AS qa_fix_count,
              delivery.state AS delivery_state
         FROM stories story
         JOIN steps implement ON implement.id = $2
         JOIN steps qa ON qa.id = $3
         JOIN steps final ON final.id = $4
         JOIN claim_log parent ON parent.id = $5
         JOIN runs run_row ON run_row.id = $1
         JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = $6
        WHERE story.id = $7`,
      [
        value.runId,
        value.implementStepDbId,
        value.qaStepDbId,
        value.finalStepDbId,
        value.parentClaimId,
        coordinated.dispatchId,
        value.storyDbId,
      ],
    );
    assert.deepEqual({ ...state[0] }, {
      story_status: "failed",
      story_output: "sealed story output",
      story_retry_count: 0,
      scope_files: '["src/App.tsx"]',
      resolved_scope_files: '["src/App.tsx"]',
      implement_status: "pending",
      qa_status: "waiting",
      final_status: "waiting",
      parent_outcome: "completed",
      run_context: JSON.stringify(value.context),
      qa_fix_count: 0,
      delivery_state: "authorized",
    });

    const routed = await createV3RecoveryWorkRouter(database.sql).acquireNext({
      workflowId: "feature-dev",
      dispatchClass: "product_implementation",
      ownerInstanceId: "downstream-transition-test-owner",
      leaseMs: 60_000,
    });
    assert.equal(routed?.story.id, value.storyDbId);
    assert.equal(routed?.story.story_id, value.slice.storyId);
    assert.equal(routed?.story.scope_files, '["src/App.tsx"]');
    assert.equal(routed?.handoff.dispatchId, coordinated.dispatchId);
  });

  it("fails closed with a versioned packet amendment and zero invented retry work", async () => {
    const value = await setup();
    const route = V3DownstreamEvidenceRouteResultV1Schema.parse({
      schema: "setfarm.v3-downstream-evidence-route.v1",
      status: "packet_amendment_required",
      runId: value.runId,
      phase: "qa",
      packetHash: value.slice.packetHash,
      sourceRevision: SOURCE,
      stories: [],
      reasonCode: "sealed_story_evidence_unavailable",
      requiredArtifact: "setfarm.product-build-packet.v.next",
      unavailableStoryId: value.slice.storyId,
      compilerReasonCode: "V3_SLICE_COMPILATION_REJECTED",
    });
    const committed = await commitV3DownstreamEvidenceDecision(database.sql, {
      envelope: value.envelope,
      route,
      now: new Date("2026-07-13T11:00:00.000Z"),
    });
    assert.equal(committed.decision.outcome, "packet_amendment_required");
    assert.equal(committed.completionPlan.effects[0]!.effectType, "v3.downstream-recovery.terminal");
    const rows = await database.sql.unsafe<Array<{
      run_status: string;
      qa_status: string;
      parent_outcome: string;
      story_status: string;
      story_retry_count: number;
      scope_files: string;
      context: string;
      termination_state: string;
      target_status: string;
      required_artifact: string;
      qa_fix_count: number;
      recovery_count: number;
    }>>(
      `SELECT run_row.status AS run_status,
              qa.status AS qa_status,
              parent.outcome AS parent_outcome,
              story.status AS story_status,
              story.retry_count AS story_retry_count,
              story.scope_files,
              run_row.context,
              termination.state AS termination_state,
              termination.target_status,
              termination.evidence->>'requiredArtifact' AS required_artifact,
              (SELECT COUNT(*)::integer FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%') AS qa_fix_count,
              (SELECT COUNT(*)::integer FROM recovery_revision_dispatches dispatch
                JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id = dispatch.recovery_case_id
               WHERE recovery_case.run_id = $1) AS recovery_count
         FROM runs run_row
         JOIN steps qa ON qa.id = $2
         JOIN claim_log parent ON parent.id = $3
         JOIN stories story ON story.id = $4
         JOIN run_termination_requests termination ON termination.run_id = run_row.id
        WHERE run_row.id = $1`,
      [value.runId, value.qaStepDbId, value.parentClaimId, value.storyDbId],
    );
    assert.deepEqual({ ...rows[0] }, {
      run_status: "failing",
      qa_status: "failed",
      parent_outcome: "failed",
      story_status: "done",
      story_retry_count: 0,
      scope_files: '["src/App.tsx"]',
      context: JSON.stringify(value.context),
      termination_state: "requested",
      target_status: "failed",
      required_artifact: "setfarm.product-build-packet.v.next",
      qa_fix_count: 0,
      recovery_count: 0,
    });
  });

  it("never converts an accepted final-source candidate into a recovery transition", async () => {
    const value = await setup();
    const route = V3DownstreamEvidenceRouteResultV1Schema.parse({
      schema: "setfarm.v3-downstream-evidence-route.v1",
      status: "accepted_candidate_ready",
      runId: value.runId,
      phase: "final",
      packetHash: value.slice.packetHash,
      sourceRevision: SOURCE,
      stories: [{
        storyDbId: value.storyDbId,
        storyId: value.slice.storyId,
        attemptId: "ATT_accepted-candidate-transition-0001",
        sliceHash: value.sliceHash,
        evidencePlanArtifactHash: value.planArtifactHash,
        evidenceBundleHash: "8".repeat(64),
        aggregateVerdict: "pass",
        execution: "replayed",
        coordinator: {
          status: "verified",
          evidenceBundleHash: "8".repeat(64),
          attemptId: "ATT_accepted-candidate-transition-0001",
        },
      }],
    });
    const finalEnvelope = ClaimEnvelopeV1Schema.parse({
      ...value.envelope,
      stepId: value.finalStepDbId,
      workflowStepId: "final-test",
    });
    assert.throws(
      () => createV3DownstreamOperationalDecision({ envelope: finalEnvelope, route }),
      /V3_DOWNSTREAM_ACCEPTED_CANDIDATE_NOT_FAILURE/,
    );
  });
});
