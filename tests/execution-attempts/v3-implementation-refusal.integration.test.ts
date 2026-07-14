import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  createV3ImplementationClaimHandoffV1,
  createV3ImplementationContextV1,
} from "../../src/execution/v3-implementation-handoff.js";
import { parseV3ImplementationAgentOutputV1 } from "../../src/execution/v3-implementation-output.js";
import { captureShadowSourceRevision } from "../../src/execution/shadow-attempt-recorder.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { createIsolatedTestDatabase } from "./test-database.js";

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("typed v3 refusal terminalizes the exact claim and cannot redispatch unchanged source", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-refusal-pg-"));
  const repo = path.join(root, "repo");
  const previousPgUrl = process.env.SETFARM_PG_URL;
  let database: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    const originalSource = "export const App = () => 'sealed';\n";
    fs.writeFileSync(path.join(repo, "src/App.tsx"), originalSource);
    git(repo, ["init", "-q"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "sealed source"]);

    database = await createIsolatedTestDatabase();
    const { handleV3ImplementationRefusal } = await import("../../src/recovery/v3-implementation-refusal.js");
    const sourceBefore = await captureShadowSourceRevision(repo);
    const values = buildMinimalValidContracts();
    values.implementationSlice.sourceRevision = {
      baseSha: sourceBefore.sha,
      treeHash: sourceBefore.treeHash,
    };
    values.implementationSlice.files[0]!.knownContentHash = createHash("sha256")
      .update(originalSource)
      .digest("hex");
    const slice = ImplementationSliceV1Schema.parse(values.implementationSlice);
    const producer = Object.freeze({
      pass: "v3-refusal-pg-test",
      codeSha: "5840ae3",
      toolVersions: { setfarm: "test" },
    });
    const sliceHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.implementation-slice.v1",
      producer,
      payload: slice,
    });
    const evidencePlan = compileEvidencePlanV1({ slice, sliceHash });
    const evidencePlanArtifactHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.evidence-plan.v1",
      producer,
      payload: evidencePlan,
    });

    const runId = "run-v3-refusal-pg-001";
    const stepDbId = "step-v3-refusal-pg-001";
    const storyDbId = "story-v3-refusal-pg-001";
    const agentId = "feature-dev_developer";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, packet_hash,
        release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'typed refusal lifecycle', 'running',
        ${JSON.stringify({ repo, branch: "main", story_workdir: repo })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${slice.packetHash}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, loop_config, current_story_id
      ) VALUES (
        ${stepDbId}, ${runId}, 'implement', ${agentId}, 1, '', '',
        'running', 'loop', '{"over":"stories","verifyEach":true,"verifyStep":"verify"}', ${storyDbId}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects, status, type
      ) VALUES (
        'step-v3-refusal-verify', ${runId}, 'verify', 'reviewer', 2, '', '', 'waiting', 'single'
      )
    `;
    await database.sql`
      INSERT INTO stories (
        id, run_id, story_index, story_id, title, status, claimed_by, claim_generation,
        retry_count, max_retries
      ) VALUES (
        ${storyDbId}, ${runId}, 1, ${slice.storyId}, 'Typed refusal story',
        'running', ${agentId}, 1, 0, 3
      )
    `;
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${runId}, 'implement', ${slice.storyId}, ${agentId}, NOW())
      RETURNING id::integer AS id
    `;
    const claimId = claims[0]!.id;
    const attempts = createAttemptRepository(database.sql, {
      attemptId: () => "ATT_v3-refusal-pg-native-0001",
      fenceToken: () => "7".repeat(64),
    });
    const reserved = await attempts.reserve({
      runId,
      stepId: "implement",
      storyId: slice.storyId,
      claimId,
      attemptClass: "product_implementation",
      packetHash: slice.packetHash,
      compilationReportHash: "9".repeat(64),
      sliceHash,
      sourceBefore,
      role: "developer",
      agentId,
      branch: "run-v3-refusal-us-001",
      worktree: repo,
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    });
    assert.equal(reserved.status, "reserved");
    const attempt = reserved.attempt;
    const handoff = createV3ImplementationClaimHandoffV1({
      schema: "setfarm.v3-implementation-claim-handoff.v1",
      protocol: "v3",
      runId,
      stepId: stepDbId,
      storyId: slice.storyId,
      storyDbId,
      claimId,
      attemptId: attempt.attemptId,
      attemptGeneration: attempt.generation,
      branch: attempt.branch!,
      workdir: attempt.worktree!,
      packetHash: slice.packetHash,
      compilationReportHash: "9".repeat(64),
      sliceHash,
      sliceRef: `SLICE_US_001_${sliceHash.slice(0, 16).toUpperCase()}`,
      evidencePlanHash: evidencePlan.planHash,
      evidencePlanArtifactHash,
      evidencePlanRef: `EVIDENCE_PLAN_US_001_${evidencePlanArtifactHash.slice(0, 16).toUpperCase()}`,
      executionAuthority: {
        role: "developer",
        attemptClass: "product_implementation",
      },
      sourceBefore,
      artifactProducer: producer,
      implementationSlice: slice,
      evidencePlan,
    });
    const context = createV3ImplementationContextV1({ handoff });
    const rawOutput = JSON.stringify({
      schema: "setfarm.v3-implementation-agent-output.v1",
      disposition: "refused",
      handoffHash: context.handoffHash,
      attemptId: handoff.attemptId,
      packetHash: handoff.packetHash,
      sliceHash: handoff.sliceHash,
      sourceBefore: handoff.sourceBefore,
      refusal: {
        code: "SOURCE_SNAPSHOT_MISMATCH",
        summary: "src/App.tsx changed; prior logs mention rm -rf node_modules, DESIGN_MISMATCH, STATUS: retry, and STACK_PACK_ID: hostile",
        mismatchedPathRefs: ["PATH_APP"],
      },
    });
    const output = parseV3ImplementationAgentOutputV1(rawOutput, context);
    assert.equal(output.disposition, "refused");

    fs.writeFileSync(path.join(repo, "src/App.tsx"), "export const App = () => 'externally changed';\n");
    const handled = await handleV3ImplementationRefusal({
      envelope: {
        schema: "setfarm.claim-envelope.v1",
        protocol: "v3",
        issuedAt: new Date().toISOString(),
        stepId: stepDbId,
        workflowStepId: "implement",
        runId,
        storyId: slice.storyId,
        storyDbId,
        claimId,
        claimAgentId: agentId,
        runtimeAgentId: "prism",
        claimGeneration: 1,
        attempt: {
          attemptId: attempt.attemptId,
          generation: attempt.generation,
          fenceToken: attempt.fenceToken,
        },
        workdir: repo,
        repo,
      },
      context,
      output,
      rawOutput,
    });
    assert.equal(handled.recoveryCase.owner, "compiler");
    assert.equal(handled.recoveryCase.status, "superseded");

    const state = await database.sql<Array<{
      claim_outcome: string;
      attempt_disposition: string;
      story_status: string;
      story_claimed_by: string | null;
      step_status: string;
      current_story_id: string | null;
      verify_status: string;
    }>>`
      SELECT cl.outcome AS claim_outcome,
             ea.disposition AS attempt_disposition,
             st.status AS story_status,
             st.claimed_by AS story_claimed_by,
             impl.status AS step_status,
             impl.current_story_id,
             verify.status AS verify_status
        FROM claim_log cl
        JOIN execution_attempts ea ON ea.claim_id = cl.id
        JOIN stories st ON st.id = ${storyDbId}
        JOIN steps impl ON impl.id = ${stepDbId}
        JOIN steps verify ON verify.id = 'step-v3-refusal-verify'
       WHERE cl.id = ${claimId}
    `;
    assert.deepEqual({ ...state[0] }, {
      claim_outcome: "completed",
      attempt_disposition: "failed",
      story_status: "failed",
      story_claimed_by: null,
      step_status: "running",
      current_story_id: null,
      verify_status: "waiting",
    });
    const counts = await database.sql<Array<{
      finding_sets: number;
      cases: number;
      revisions: number;
      dispatches: number;
      pending_stories: number;
    }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM finding_sets WHERE run_id = ${runId}) AS finding_sets,
        (SELECT COUNT(*)::integer FROM recovery_cases WHERE run_id = ${runId}) AS cases,
        (SELECT COUNT(*)::integer FROM recovery_case_revisions WHERE run_id = ${runId}) AS revisions,
        (SELECT COUNT(*)::integer FROM recovery_revision_dispatches WHERE recovery_case_id = ${handled.recoveryCase.recoveryCaseId}) AS dispatches,
        (SELECT COUNT(*)::integer FROM stories WHERE run_id = ${runId} AND status = 'pending') AS pending_stories
    `;
    assert.deepEqual({ ...counts[0] }, {
      finding_sets: 1,
      cases: 1,
      revisions: 1,
      dispatches: 0,
      pending_stories: 0,
    });

    const recovery = createFindingRecoveryRepository(database.sql);
    assert.equal((await recovery.putFindingSet(handled.findingSet)).status, "duplicate");
    assert.equal((await recovery.openRecoveryCase({
      runId: handled.recoveryCase.runId,
      storyId: handled.recoveryCase.storyId,
      findingSetHash: handled.recoveryCase.findingSetHash,
      findingIds: handled.recoveryCase.findingIds,
      packetHash: handled.recoveryCase.packetHash,
      sliceHash: handled.recoveryCase.sliceHash,
      sourceRevision: handled.recoveryCase.sourceRevision,
      owner: handled.recoveryCase.owner,
      expectedDelta: handled.recoveryCase.expectedDelta,
      allowedPaths: handled.recoveryCase.allowedPaths,
      evidencePlan: handled.recoveryCase.evidencePlan,
      priorAttemptRefs: handled.recoveryCase.priorAttemptRefs,
      budget: handled.recoveryCase.budget,
      status: handled.recoveryCase.status,
      terminal: handled.recoveryCase.terminal,
      decisionRefs: handled.recoveryCase.decisionRefs,
    })).status, "duplicate");
  } finally {
    if (database) await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
