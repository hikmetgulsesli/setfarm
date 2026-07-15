import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "./test-database.js";
import {
  createV3ImplementationContextV1,
  V3ImplementationClaimHandoffV1Schema,
} from "../../src/execution/v3-implementation-handoff.js";
import { createV3ReleaseAdmissionV1 } from "../../src/execution/v3-release-admission.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { RuntimeCompletionPlanV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { buildClaimSummary, buildPreclaimedPrompt } from "../../src/spawner-prompt.js";

const RELEASE_SHA = "c".repeat(40);
const EVIDENCE_HASH = "d".repeat(64);
const WORKFLOW_ID = "feature-dev-v3-recovery-claim";
const RUN_ID = "run-v3-recovery-claim-integration";
const STEP_DB_ID = "step-v3-recovery-claim-integration";
const STORY_DB_ID = "story-v3-recovery-claim-integration";
const STORY_ID = "US-001";
const AGENT_ID = `${WORKFLOW_ID}_supervisor`;
const PRIOR_AGENT_ID = `${WORKFLOW_ID}_developer`;
const OWNER_INSTANCE_ID = "claim-step-v3-recovery-owner";
const COMPLETION_OWNER_INSTANCE_ID = "claim-step-v3-recovery-completion-owner";
const SESSION_ID = "RTS_claim-step-v3-recovery-0001";

const ARTIFACT_LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 32 * 1024 * 1024,
  minFreeBytes: 0,
});

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function restoreEnvironment(previous: Readonly<Record<string, string | undefined>>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("claimStep publishes and completes one exact bounded supervisor repair without legacy fallback", async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), "setfarm-claim-step-v3-recovery-"));
  const repo = path.join(root, "repo");
  const artifactRoot = path.join(root, "artifacts", "sha256");
  const runtimePath = path.join(root, "runtime", "setfarm.db");
  const previousEnvironment = Object.freeze({
    SETFARM_PG_URL: process.env.SETFARM_PG_URL,
    SETFARM_PRODUCT_ARTIFACT_DIR: process.env.SETFARM_PRODUCT_ARTIFACT_DIR,
    SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES: process.env.SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES,
    SETFARM_ARTIFACT_ROOT_QUOTA_BYTES: process.env.SETFARM_ARTIFACT_ROOT_QUOTA_BYTES,
    SETFARM_ARTIFACT_MIN_FREE_BYTES: process.env.SETFARM_ARTIFACT_MIN_FREE_BYTES,
    SETFARM_DB_PATH: process.env.SETFARM_DB_PATH,
    SETFARM_AGENT_RUNTIME: process.env.SETFARM_AGENT_RUNTIME,
    SETFARM_IMPLEMENT_EVIDENCE_GATE: process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE,
    SETFARM_VISUAL_EVIDENCE_GATE: process.env.SETFARM_VISUAL_EVIDENCE_GATE,
  });
  process.env.SETFARM_PRODUCT_ARTIFACT_DIR = artifactRoot;
  process.env.SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES = String(ARTIFACT_LIMITS.maxPayloadBytes);
  process.env.SETFARM_ARTIFACT_ROOT_QUOTA_BYTES = String(ARTIFACT_LIMITS.rootQuotaBytes);
  process.env.SETFARM_ARTIFACT_MIN_FREE_BYTES = "0";
  process.env.SETFARM_DB_PATH = runtimePath;
  process.env.SETFARM_AGENT_RUNTIME = "codex";
  process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
  process.env.SETFARM_VISUAL_EVIDENCE_GATE = "off";

  let database: TestDatabase | undefined;
  let productionDb: typeof import("../../src/db-pg.js") | undefined;
  let removeRecoveryWorktree:
    | ((repoPath: string, branch: string, agentId?: string) => void)
    | undefined;
  let recoveryBranch = "";

  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    const appSource = "export const App = () => 'canonical recovery source';\n";
    fs.writeFileSync(path.join(repo, "src", "App.tsx"), appSource, "utf8");
    fs.writeFileSync(
      path.join(repo, "verify.cjs"),
      [
        "const fs = require('node:fs');",
        "const source = fs.readFileSync('src/App.tsx', 'utf8');",
        "if (!source.includes('PERSIST_SAVE_IMPLEMENTED')) {",
        "  console.error('sealed save/reload implementation marker missing');",
        "  process.exit(1);",
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(repo, "preview.cjs"),
      [
        "const fs = require('node:fs');",
        "const http = require('node:http');",
        "const args = process.argv.slice(2);",
        "const valueAfter = (flag, fallback) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : fallback; };",
        "const host = valueAfter('--host', '127.0.0.1');",
        "const port = Number(valueAfter('--port', '4173'));",
        "const implemented = fs.readFileSync('src/App.tsx', 'utf8').includes('PERSIST_SAVE_IMPLEMENTED');",
        "const html = implemented ? [",
        "  '<div id=\"root\"><button data-action-id=\"save-task-1\" onclick=\"localStorage.setItem(&quot;title&quot;,globalThis.__SETFARM_TEST_BRIDGE__.states.STATE_EDITOR.title);this.textContent=&quot;Saved&quot;\">Save</button></div><script>',",
        "  'const title=localStorage.getItem(\"title\")||\"Task from state\";',",
        "  'if(localStorage.getItem(\"title\"))document.querySelector(\"[data-action-id=save-task-1]\").textContent=\"Saved\";',",
        "  'globalThis.__SETFARM_TEST_BRIDGE__={states:{STATE_EDITOR:{title}},invokeAction(actionRef,inputValues){if(actionRef!==\"ACT_SAVE_TASK\")throw new Error(\"unknown action\");this.states.STATE_EDITOR={...this.states.STATE_EDITOR,...inputValues}}};',",
        "  '</script>',",
        "].join('') : '<main>save/reload not implemented</main>';",
        "http.createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end(html); }).listen(port, host);",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(repo, "package.json"),
      JSON.stringify({
        name: "v3-recovery-claim-fixture",
        private: true,
        scripts: {
          build: "node verify.cjs",
          test: "node verify.cjs",
          preview: "node preview.cjs",
        },
      }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(repo, ".gitignore"), ".worktrees/\n.setfarm/\n", "utf8");
    git(repo, ["init", "-q"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["add", "."]);
    git(repo, ["commit", "-qm", "canonical recovery source"]);
    git(repo, ["branch", "-M", "main"]);
    const origin = path.join(root, "origin.git");
    fs.mkdirSync(origin, { recursive: true });
    git(origin, ["init", "--bare", "-q"]);
    git(repo, ["remote", "add", "origin", origin]);
    git(repo, ["push", "-qu", "origin", "main"]);

    database = await createIsolatedTestDatabase();

    const [
      runtimePacketModule,
      artifactIndexModule,
      artifactStoreModule,
      artifactPublisherModule,
      contractFixtureModule,
      implementationAttemptModule,
      attemptRepositoryModule,
      sourceRevisionModule,
      findingSetModule,
      findingRecoveryModule,
      recoveryDeliveryModule,
      stepOpsModule,
      worktreeModule,
      dbModule,
      runtimeCompletionModule,
      runtimeSessionModule,
      runtimeEffectRepositoryModule,
      runtimeEffectRunnerModule,
      recoveryEffectModule,
      spawnerModule,
    ] = await Promise.all([
      import("../../src/product-compiler/runtime-packet-compiler.js"),
      import("../../src/product-compiler/artifact-index.js"),
      import("../../src/product-compiler/artifact-store.js"),
      import("../../src/product-compiler/indexed-artifact-publisher.js"),
      import("../product-compiler/fixtures/minimal-valid-contract.js"),
      import("../../src/execution/v3-implementation-attempt.js"),
      import("../../src/execution/attempt-repository.js"),
      import("../../src/execution/shadow-attempt-recorder.js"),
      import("../../src/findings/finding-set.js"),
      import("../../src/recovery/finding-recovery-repository.js"),
      import("../../src/recovery/recovery-delivery-repository.js"),
      import("../../src/installer/step-ops.js"),
      import("../../src/installer/worktree-ops.js"),
      import("../../src/db-pg.js"),
      import("../../src/execution/runtime-completion.js"),
      import("../../src/execution/runtime-session-repository.js"),
      import("../../src/execution/runtime-completion-effect-repository.js"),
      import("../../src/execution/runtime-completion-effect-runner.js"),
      import("../../src/recovery/v3-recovery-effect.js"),
      import("../../src/spawner.js"),
    ]);
    productionDb = dbModule;
    removeRecoveryWorktree = worktreeModule.removeStoryWorktree;

    const sourceRevision = await sourceRevisionModule.captureShadowSourceRevision(repo);
    const sourceTreeObject = git(repo, ["rev-parse", "HEAD^{tree}"]);
    const appContentHash = createHash("sha256").update(appSource).digest("hex");
    const contracts = contractFixtureModule.buildMinimalValidV3Contracts();
    contracts.buildTopology.repo.baseSha = sourceRevision.sha;
    contracts.buildTopology.repo.treeHash = sourceTreeObject;
    contracts.buildTopology.pathBindings[0]!.knownContentHash = appContentHash;

    const runContext = {
      run_id: RUN_ID,
      workflow_id: WORKFLOW_ID,
      task: "Exercise one exact Product Compiler v3 recovery claim.",
      repo,
      branch: "main",
      base_branch: "main",
      project_name: "V3 Recovery Claim Fixture",
      project_slug: "v3-recovery-claim-fixture",
    };
    const releaseSuiteHash = "1".repeat(64);
    const releaseResultHash = "2".repeat(64);
    const releaseGateHash = "3".repeat(64);
    const activationPreflightHash = "e".repeat(64);
    const releaseResultRef = `sha256/${releaseResultHash.slice(0, 2)}/${releaseResultHash}.json`;
    const releaseGateRef = `sha256/${releaseGateHash.slice(0, 2)}/${releaseGateHash}.json`;
    const releaseAdmission = createV3ReleaseAdmissionV1({
      schema: "setfarm.v3-release-admission.v1",
      kind: "release_go",
      releaseSha: RELEASE_SHA,
      suiteHash: releaseSuiteHash,
      result: { hash: releaseResultHash, ref: releaseResultRef },
      gate: { hash: releaseGateHash, ref: releaseGateRef },
      preflightHash: activationPreflightHash,
      slots: [],
      issuedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: null,
    });
    await database.sql.unsafe(
      `INSERT INTO v3_release_admissions (
         admission_hash, kind, release_sha, suite_hash,
         result_hash, result_ref, gate_hash, gate_ref,
         expires_at, payload, created_at
       ) VALUES ($1, 'release_go', $2, $3, $4, $5, $6, $7, NULL, $8::text::jsonb, $9)`,
      [
        releaseAdmission.admissionHash,
        releaseAdmission.releaseSha,
        releaseAdmission.suiteHash,
        releaseAdmission.result.hash,
        releaseAdmission.result.ref,
        releaseAdmission.gate.hash,
        releaseAdmission.gate.ref,
        JSON.stringify(releaseAdmission),
        releaseAdmission.issuedAt,
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, $2, $3, 'running', $4, 'v3', 1, $5, $6, $7)`,
      [
        RUN_ID,
        WORKFLOW_ID,
        runContext.task,
        JSON.stringify(runContext),
        RELEASE_SHA,
        activationPreflightHash,
        releaseAdmission.admissionHash,
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, loop_config, retry_count, output
       ) VALUES (
         $1, $2, 'implement', $3, 6, 'legacy template must not be authority',
         'STATUS: done', 'pending', 'loop', '{"over":"stories","parallel":1}',
         2, 'prior loop output'
       )`,
      [STEP_DB_ID, RUN_ID, AGENT_ID],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, description,
         acceptance_criteria, status, output, retry_count, max_retries,
         abandoned_count, claim_generation, depends_on, scope_files,
         shared_files, implementation_contract, story_screens
       ) VALUES (
         $1, $2, 1, $3, 'Implement exact save behavior',
         'The sealed packet, not this prose, owns behavior.', '["save and reload"]',
         'running', NULL, 2, 3, 0, 5, '[]', '["src/App.tsx"]', '[]',
         '{"schema":"setfarm.test-implementation-contract.v1"}', '[]'
       )`,
      [STORY_DB_ID, RUN_ID, STORY_ID],
    );

    const artifactIndex = artifactIndexModule.createArtifactIndex(database.sql);
    const artifactStore = new artifactStoreModule.ContentAddressedArtifactStore(
      artifactRoot,
      { limits: ARTIFACT_LIMITS },
    );
    await artifactPublisherModule.bootstrapArtifactIndex({
      index: artifactIndex,
      store: artifactStore,
      quotaBytes: ARTIFACT_LIMITS.rootQuotaBytes,
      maxPayloadBytes: ARTIFACT_LIMITS.maxPayloadBytes,
    });
    const producer = {
      pass: "product-packet-compiler",
      codeSha: RELEASE_SHA,
      toolVersions: { zod: "4.4.3" },
    } as const;
    const packetCompilation = await runtimePacketModule.createRuntimePacketCompiler({
      sql: database.sql,
      artifactRoot,
      artifactLimits: ARTIFACT_LIMITS,
      ownerInstanceId: "claim-step-recovery-packet-compiler",
    }).compile({
      runId: RUN_ID,
      expectedMode: "v3",
      productSpec: contracts.productSpec,
      designGraph: contracts.designGraph,
      buildTopology: contracts.buildTopology,
      storyPlan: contracts.storyPlan,
      compiler: { version: "3.0.0", codeSha: RELEASE_SHA },
      producer,
    });
    assert.equal(packetCompilation.activation, "activated", JSON.stringify(packetCompilation));
    assert.equal(packetCompilation.compilation.status, "sealed", JSON.stringify(packetCompilation));
    const packetHash = packetCompilation.compilation.packetHash;
    assert.ok(packetHash);

    const priorClaims = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
       VALUES ($1, 'implement', $2, $3)
       RETURNING id::text AS id`,
      [RUN_ID, STORY_ID, PRIOR_AGENT_ID],
    );
    const priorClaimId = Number(priorClaims[0]!.id);
    const prior = await implementationAttemptModule.reserveV3ImplementationAttempt({
      runId: RUN_ID,
      stepId: "implement",
      storyId: STORY_ID,
      claimId: priorClaimId,
      role: "developer",
      agentId: PRIOR_AGENT_ID,
      branch: "main",
      worktree: repo,
    });
    assert.equal(prior.packetHash, packetHash);
    assert.deepEqual(prior.sourceBefore, sourceRevision);
    assert.equal(prior.slice.recovery, undefined);

    const priorTerminal = await attemptRepositoryModule.createAttemptRepository(database.sql).complete({
      attemptId: prior.attempt.attemptId,
      generation: prior.attempt.generation,
      fenceToken: prior.attempt.fenceToken,
      disposition: "failed",
      sourceAfter: sourceRevision,
      evidenceRefs: [EVIDENCE_HASH],
    });
    assert.equal(priorTerminal.status, "completed");
    assert.equal(priorTerminal.status === "completed" && priorTerminal.attempt.disposition, "failed");
    await database.sql.unsafe(
      `UPDATE claim_log SET outcome = 'failed', abandoned_at = NOW(), diagnostic = 'typed evidence failure'
        WHERE id = $1`,
      [priorClaimId],
    );
    await database.sql.unsafe(
      `UPDATE stories
          SET status = 'failed', output = 'typed evidence failure',
              claimed_by = $2, claimed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [STORY_DB_ID, PRIOR_AGENT_ID],
    );

    const findingSet = findingSetModule.createFindingSetV1({
      runId: RUN_ID,
      storyId: STORY_ID,
      packetHash,
      sliceHash: prior.sliceHash,
      sourceRevision,
      findings: [{
        origin: "runtime",
        classification: "structured",
        invariantRef: "INV_SAVE_RELOAD",
        sourceLocators: [{ path: "src/App.tsx", contentHash: appContentHash }],
        observedEvidenceRefs: [EVIDENCE_HASH],
        expectedPredicateRef: "EVID_SAVE_RELOAD",
        status: "open",
      }],
    });
    const findings = findingRecoveryModule.createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase({
      runId: RUN_ID,
      storyId: STORY_ID,
      findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      packetHash,
      sliceHash: prior.sliceHash,
      sourceRevision,
      owner: "supervisor",
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_SAVE_RELOAD"],
        requiredPaths: ["src/App.tsx"],
      },
      allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_SAVE_RELOAD"],
      priorAttemptRefs: [prior.attempt.attemptId],
      budget: {
        limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
      },
      status: "open",
      decisionRefs: [],
    });
    const deliveries = recoveryDeliveryModule.createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorization = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: "supervisor_repair",
    });
    assert.equal(authorization.status, "authorized");
    if (authorization.status !== "authorized") throw new Error("expected recovery authorization");
    assert.equal(authorization.delivery.state, "authorized");
    assert.deepEqual(authorization.dispatch.sourceRevision, sourceRevision);
    assert.equal(authorization.dispatch.contractSliceHash, prior.sliceHash);

    const beforeClaim = await database.sql.unsafe<Array<{
      status: string;
      retry_count: number;
      output: string | null;
      claim_generation: number;
    }>>(
      "SELECT status, retry_count, output, claim_generation FROM stories WHERE id = $1",
      [STORY_DB_ID],
    );
    assert.deepEqual(beforeClaim[0], {
      status: "failed",
      retry_count: 2,
      output: "typed evidence failure",
      claim_generation: 5,
    });

    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1" as const,
      sessionId: SESSION_ID,
      runtimeAgentId: "openclaw-v3-recovery-runtime",
      runtimeKind: "openclaw_session" as const,
      ownerInstanceId: OWNER_INSTANCE_ID,
      sessionKey: "agent:v3-recovery:supervisor-test",
      transcriptPath: path.join(root, "runtime", "recovery-transcript.jsonl"),
    };
    await assert.rejects(
      stepOpsModule.claimStep(
        PRIOR_AGENT_ID,
        undefined,
        runtimeIntent,
        {
          workflowId: WORKFLOW_ID,
          recoveryDispatchClass: "supervisor_repair",
        },
      ),
      /V3_RECOVERY_CLAIM_ROLE_MISMATCH/,
    );
    const untouchedDelivery = await database.sql.unsafe<Array<{
      state: string;
      owner_instance_id: string | null;
      attempt_count: number;
    }>>(
      `SELECT state, owner_instance_id, attempt_count
         FROM recovery_dispatch_deliveries
        WHERE dispatch_id = $1`,
      [authorization.dispatch.dispatchId],
    );
    assert.deepEqual(untouchedDelivery[0], {
      state: "authorized",
      owner_instance_id: null,
      attempt_count: 0,
    });

    const claim = await stepOpsModule.claimStep(
      AGENT_ID,
      undefined,
      runtimeIntent,
      {
        workflowId: WORKFLOW_ID,
        recoveryDispatchClass: "supervisor_repair",
      },
    );

    assert.equal(claim.found, true);
    assert.equal(claim.protocol, "v3");
    assert.equal(claim.runId, RUN_ID);
    assert.equal(claim.storyId, STORY_ID);
    assert.equal(claim.storyDbId, STORY_DB_ID);
    assert.equal(claim.recoveryDispatchId, authorization.dispatch.dispatchId);
    assert.equal(claim.recoveryRevisionId, revision.revisionId);
    assert.equal(claim.runtimeSessionId, SESSION_ID);
    assert.equal(claim.runtimeOwnerInstanceId, OWNER_INSTANCE_ID);
    assert.equal(claim.claimGeneration, 6);
    assert.ok(claim.claimId);
    assert.ok(claim.attempt);
    assert.ok(claim.resolvedInput);
    assert.equal(claim.resolvedInput.includes("[missing:"), false);
    const structuredHandoff = V3ImplementationClaimHandoffV1Schema.parse(claim.v3ImplementationHandoff);

    const slice = structuredHandoff.implementationSlice;
    const promptFindingSet = structuredHandoff.findingSet;
    assert.ok(promptFindingSet);
    assert.doesNotMatch(claim.resolvedInput, /BEGIN_CANONICAL_IMPLEMENTATION_SLICE_V1/);
    assert.doesNotMatch(claim.resolvedInput, /BEGIN_CANONICAL_FINDING_SET_V1|STATUS: done/);
    assert.equal(slice.packetHash, packetHash);
    assert.equal(slice.storyId, STORY_ID);
    assert.deepEqual(structuredHandoff.implementationSlice, slice);
    assert.deepEqual(structuredHandoff.findingSet, promptFindingSet);
    assert.equal(structuredHandoff.claimId, claim.claimId);
    assert.equal(structuredHandoff.attemptId, claim.attempt.attemptId);
    assert.equal(structuredHandoff.sliceHash, structuredHandoff.evidencePlan.sliceHash);
    assert.deepEqual(structuredHandoff.executionAuthority, {
      role: "supervisor",
      attemptClass: "supervisor_repair",
    });
    assert.deepEqual(slice.sourceRevision, {
      baseSha: sourceRevision.sha,
      treeHash: sourceRevision.treeHash,
    });
    assert.deepEqual(slice.recovery, {
      schema: "setfarm.implementation-recovery-directive.v1",
      recoveryCaseRevisionId: revision.revisionId,
      recoveryDispatchId: authorization.dispatch.dispatchId,
      dispatchClass: "supervisor_repair",
      findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      contractSliceHash: prior.sliceHash,
      sourceRevision: {
        baseSha: sourceRevision.sha,
        treeHash: sourceRevision.treeHash,
      },
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_SAVE_RELOAD"],
        requiredPaths: ["src/App.tsx"],
      },
      allowedPaths: ["src/App.tsx"],
    });
    assert.deepEqual(promptFindingSet, findingSet);
    assert.match(claim.resolvedInput, new RegExp(`PACKET_HASH: ${packetHash}`));
    assert.match(claim.resolvedInput, new RegExp(`FINDING_SET_HASH: ${findingSet.findingSetHash}`));
    assert.match(claim.resolvedInput, new RegExp(`RECOVERY_DISPATCH_ID: ${authorization.dispatch.dispatchId}`));

    const attempts = await database.sql.unsafe<Array<{
      attempt_id: string;
      claim_id: string;
      generation: number;
      disposition: string;
      slice_hash: string;
      source_before_sha: string;
      source_before_tree_hash: string;
      finding_set_hash: string | null;
      recovery_case_revision_id: string | null;
      recovery_dispatch_id: string | null;
      attempt_class: string;
      role: string;
      agent_id: string | null;
      worktree: string | null;
    }>>(
      `SELECT attempt_id, claim_id::text AS claim_id, generation, disposition,
              slice_hash, source_before_sha, source_before_tree_hash,
              finding_set_hash, recovery_case_revision_id, recovery_dispatch_id,
              attempt_class, role, agent_id, worktree
         FROM execution_attempts
        WHERE run_id = $1 AND story_id = $2
        ORDER BY generation`,
      [RUN_ID, STORY_ID],
    );
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0]!.attempt_id, prior.attempt.attemptId);
    assert.equal(attempts[0]!.disposition, "failed");
    const recoveryAttempt = attempts[1]!;
    assert.equal(recoveryAttempt.attempt_id, claim.attempt!.attemptId);
    assert.equal(recoveryAttempt.claim_id, String(claim.claimId));
    assert.equal(recoveryAttempt.generation, 2);
    assert.equal(recoveryAttempt.disposition, "claimed");
    assert.match(recoveryAttempt.slice_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(recoveryAttempt.slice_hash, prior.sliceHash);
    assert.equal(recoveryAttempt.source_before_sha, sourceRevision.sha);
    assert.equal(recoveryAttempt.source_before_tree_hash, sourceRevision.treeHash);
    assert.equal(recoveryAttempt.finding_set_hash, findingSet.findingSetHash);
    assert.equal(recoveryAttempt.recovery_case_revision_id, revision.revisionId);
    assert.equal(recoveryAttempt.recovery_dispatch_id, authorization.dispatch.dispatchId);
    assert.equal(recoveryAttempt.attempt_class, "supervisor_repair");
    assert.equal(recoveryAttempt.role, "supervisor");
    assert.equal(recoveryAttempt.agent_id, AGENT_ID);
    assert.ok(recoveryAttempt.worktree);
    assert.notEqual(recoveryAttempt.worktree, repo);
    assert.deepEqual(
      await sourceRevisionModule.captureShadowSourceRevision(recoveryAttempt.worktree!),
      sourceRevision,
    );

    await database.sql.unsafe(
      "UPDATE execution_attempts SET role = 'developer' WHERE attempt_id = $1",
      [recoveryAttempt.attempt_id],
    );
    await assert.rejects(
      implementationAttemptModule.loadV3ImplementationAttemptContext({
        runId: RUN_ID,
        storyId: STORY_ID,
        attemptId: recoveryAttempt.attempt_id,
      }),
      (error: unknown) => error instanceof implementationAttemptModule.V3ImplementationAttemptError
        && error.code === "V3_ATTEMPT_CONTEXT_EXECUTION_AUTHORITY_MISMATCH",
    );
    await database.sql.unsafe(
      "UPDATE execution_attempts SET role = 'supervisor' WHERE attempt_id = $1",
      [recoveryAttempt.attempt_id],
    );

    const storedRecoverySlice = await artifactStore.get(recoveryAttempt.slice_hash);
    assert.equal(storedRecoverySlice.envelope.artifactType, "setfarm.implementation-slice.v1");
    assert.deepEqual(storedRecoverySlice.envelope.payload, slice);

    const deliveryRows = await database.sql.unsafe<Array<{
      state: string;
      owner_instance_id: string | null;
      lease_token: string | null;
      lease_expires_at: Date | string | null;
      claim_id: string | null;
      attempt_id: string | null;
      execution_slice_hash: string | null;
    }>>(
      `SELECT state, owner_instance_id, lease_token, lease_expires_at,
              claim_id::text AS claim_id, attempt_id, execution_slice_hash
         FROM recovery_dispatch_deliveries WHERE dispatch_id = $1`,
      [authorization.dispatch.dispatchId],
    );
    assert.equal(deliveryRows.length, 1);
    assert.equal(deliveryRows[0]!.state, "attempt_reserved");
    assert.equal(deliveryRows[0]!.owner_instance_id, OWNER_INSTANCE_ID);
    assert.match(deliveryRows[0]!.lease_token || "", /^[a-f0-9]{64}$/);
    assert.ok(deliveryRows[0]!.lease_expires_at);
    assert.ok(new Date(deliveryRows[0]!.lease_expires_at!).getTime() > Date.now());
    assert.equal(deliveryRows[0]!.claim_id, String(claim.claimId));
    assert.equal(deliveryRows[0]!.attempt_id, claim.attempt!.attemptId);
    assert.equal(deliveryRows[0]!.execution_slice_hash, recoveryAttempt.slice_hash);

    const operationalRows = await database.sql.unsafe<Array<{
      story_status: string;
      story_retry_count: number;
      story_output: string | null;
      story_claim_generation: number;
      step_status: string;
      step_retry_count: number;
      step_output: string | null;
      claim_outcome: string | null;
      runtime_state: string;
      runtime_attempt_id: string | null;
      runtime_claim_id: string;
      runtime_owner_instance_id: string;
    }>>(
      `SELECT story.status AS story_status,
              story.retry_count AS story_retry_count,
              story.output AS story_output,
              story.claim_generation AS story_claim_generation,
              step.status AS step_status,
              step.retry_count AS step_retry_count,
              step.output AS step_output,
              claim.outcome AS claim_outcome,
              runtime.state AS runtime_state,
              runtime.attempt_id AS runtime_attempt_id,
              runtime.claim_id::text AS runtime_claim_id,
              runtime.owner_instance_id AS runtime_owner_instance_id
         FROM stories story
         JOIN steps step ON step.id = $2 AND step.run_id = story.run_id
         JOIN claim_log claim ON claim.id = $3
         JOIN runtime_sessions runtime ON runtime.session_id = $4
        WHERE story.id = $1`,
      [STORY_DB_ID, STEP_DB_ID, claim.claimId, SESSION_ID],
    );
    assert.deepEqual(operationalRows[0], {
      story_status: "running",
      story_retry_count: 2,
      story_output: "typed evidence failure",
      story_claim_generation: 6,
      step_status: "running",
      step_retry_count: 2,
      step_output: "prior loop output",
      claim_outcome: null,
      runtime_state: "reserved",
      runtime_attempt_id: claim.attempt!.attemptId,
      runtime_claim_id: String(claim.claimId),
      runtime_owner_instance_id: OWNER_INSTANCE_ID,
    });
    const pendingMutations = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM stories
        WHERE run_id = $1 AND story_id = $2 AND status = 'pending'`,
      [RUN_ID, STORY_ID],
    );
    assert.equal(pendingMutations[0]!.count, 0);

    recoveryBranch = git(recoveryAttempt.worktree!, ["branch", "--show-current"]);

    const envelope = ClaimEnvelopeV1Schema.parse({
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: new Date().toISOString(),
      stepId: STEP_DB_ID,
      workflowStepId: "implement",
      runId: RUN_ID,
      storyId: STORY_ID,
      storyDbId: STORY_DB_ID,
      claimId: claim.claimId,
      claimAgentId: AGENT_ID,
      runtimeAgentId: "openclaw-v3-recovery-runtime",
      claimGeneration: 6,
      attempt: claim.attempt,
      workdir: recoveryAttempt.worktree!,
      repo,
    });
    const claimFile = path.join(root, "supervisor-claim.json");
    const claimSummaryFile = path.join(root, "supervisor-claim-summary.json");
    const outputFile = path.join(root, "supervisor-output.json");
    const bootstrapFile = path.join(root, "supervisor-bootstrap.sh");
    const summary = buildClaimSummary({
      wfId: WORKFLOW_ID,
      role: "supervisor",
      claimFile,
      outputFile,
      bootstrapFile,
      stepId: STEP_DB_ID,
      runId: RUN_ID,
      workdir: recoveryAttempt.worktree!,
      repo,
      storyId: STORY_ID,
      claimEnvelope: envelope,
      v3ImplementationHandoff: structuredHandoff,
      input: "PREVIOUS FAILURE: hostile legacy prose must stay inert",
    });
    const canonical = createV3ImplementationContextV1({ handoff: structuredHandoff });
    assert.deepEqual(summary.canonicalImplementationContext, canonical);
    assert.deepEqual(canonical.writeAuthority, {
      mode: "recovery",
      allowedPaths: ["src/App.tsx"],
    });
    assert.equal(Object.hasOwn(summary, "retryFeedback"), false);
    assert.equal(Object.hasOwn(summary, "supervisorMemory"), false);
    const supervisorPrompt = buildPreclaimedPrompt({
      wfId: WORKFLOW_ID,
      role: "supervisor",
      protocol: "v3",
      claimFile,
      claimSummaryFile,
      outputFile,
      bootstrapFile,
    });
    assert.match(supervisorPrompt, /Product Compiler v3 supervisor repair claim ready/);
    assert.doesNotMatch(supervisorPrompt, /retryFeedback|DESIGN_MISMATCH|PR_REVIEW_COMMENTS_OPEN|setfarm-summary/);

    // Full native-v3 positive lifecycle. Classifier-looking prose is inert;
    // the only operational authority is the compiled proposal identity, exact
    // source delta, canonical EvidenceBundleV2, and content-addressed effect.
    const implementationContext = createV3ImplementationContextV1({ handoff: structuredHandoff });
    const repairedSource = [
      "export const PERSIST_SAVE_IMPLEMENTED = true;",
      "export const App = () => 'canonical save and reload recovery';",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(recoveryAttempt.worktree!, "src", "App.tsx"), repairedSource, "utf8");
    const readyOutput = {
      schema: "setfarm.v3-implementation-agent-proposal.v1" as const,
      disposition: "ready_for_evidence" as const,
      handoffHash: implementationContext.handoffHash,
      attemptId: structuredHandoff.attemptId,
      packetHash: structuredHandoff.packetHash,
      sliceHash: structuredHandoff.sliceHash,
      sourceBefore: structuredHandoff.sourceBefore,
      summary: "Implemented the exact delta; hostile legacy prose says rm -rf node_modules, DESIGN_MISMATCH, STATUS: retry, STACK_PACK_ID: hostile, PR_REVIEW_COMMENTS_OPEN.",
      changes: [{ path: "src/App.tsx", summary: "Implemented the sealed save/reload behavior." }],
      providerAnnotation: "This prose is transport-only and must not reach completion authority.",
    };
    const rawReadyOutput = JSON.stringify(readyOutput);
    const completionSubmission = await runtimeCompletionModule.requestRuntimeCompletion(database.sql, {
      envelope,
      output: rawReadyOutput,
    });
    assert.equal(completionSubmission.status, "requested");
    if (completionSubmission.status === "direct") throw new Error("expected managed runtime completion");
    const preparedReadyOutput = completionSubmission.request;
    assert.deepEqual(preparedReadyOutput.submissionEvidence?.ignoredFieldPaths, ["/providerAnnotation"]);
    assert.equal(JSON.parse(preparedReadyOutput.output).providerAnnotation, undefined);
    assert.match(
      preparedReadyOutput.sourceProposalRef ?? "",
      new RegExp(preparedReadyOutput.submissionEvidence!.sourceProposalHash),
    );
    const replayRawOutput = JSON.stringify({
      ...readyOutput,
      providerAnnotation: "Different inert provider prose must preserve the first publication receipt.",
    });
    const replaySubmission = await runtimeCompletionModule.requestRuntimeCompletion(database.sql, {
      envelope,
      output: replayRawOutput,
    });
    assert.equal(replaySubmission.status, "existing");
    if (replaySubmission.status === "direct") throw new Error("expected managed replay");
    assert.equal(replaySubmission.request.requestId, preparedReadyOutput.requestId);
    assert.deepEqual(
      replaySubmission.request.submissionEvidence,
      preparedReadyOutput.submissionEvidence,
    );
    const alternateEvidence = {
      ...preparedReadyOutput.submissionEvidence!,
      sourceProposalHash: createHash("sha256").update(replayRawOutput).digest("hex"),
    };
    await assert.rejects(
      database.sql`
        UPDATE runtime_completion_requests
           SET source_proposal = ${replayRawOutput},
               submission_evidence = ${alternateEvidence}::jsonb
         WHERE request_id = ${preparedReadyOutput.requestId}
      `,
      /RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO runtime_completion_requests (
          request_id, runtime_session_id, claim_id, run_id, step_db_id,
          workflow_step_id, story_db_id, story_id, attempt_id,
          claim_envelope, output, output_hash, state, requested_by, requested_at
        )
        SELECT 'RCR_missing-compiler-evidence', runtime_session_id, claim_id,
               run_id, step_db_id, workflow_step_id, story_db_id, story_id,
               attempt_id, claim_envelope, output, output_hash, 'requested',
               requested_by, requested_at
          FROM runtime_completion_requests
         WHERE request_id = ${preparedReadyOutput.requestId}
      `,
      /RUNTIME_COMPLETION_V3_IMPLEMENTATION_COMPILER_EVIDENCE_REQUIRED/,
    );
    const completionRepository = runtimeCompletionModule.createRuntimeCompletionRepository(database.sql);
    const completionRequestId = completionSubmission.request.requestId;
    const ownedCompletion = await completionRepository.claim({
      requestId: completionRequestId,
      ownerInstanceId: COMPLETION_OWNER_INSTANCE_ID,
    });
    assert.equal(ownedCompletion?.state, "draining");
    const runtimeSessions = runtimeSessionModule.createRuntimeSessionRepository(database.sql);
    const drained = await runtimeSessions.markDrained({
      sessionId: SESSION_ID,
      ownerInstanceId: OWNER_INSTANCE_ID,
      evidence: {
        schema: "setfarm.runtime-drain-evidence.v1",
        observedAt: new Date().toISOString(),
        localProcessAbsent: true,
        openClawTaskAbsent: true,
        workspaceProcessAbsent: true,
        stableObservations: 2,
        evidenceRefs: ["setfarm://test/supervisor-runtime-drained"],
      },
    });
    assert.equal(drained.state, "drained");
    const processingCompletion = await completionRepository.markProcessing({
      requestId: completionRequestId,
      ownerInstanceId: COMPLETION_OWNER_INSTANCE_ID,
    });
    assert.equal(processingCompletion.state, "processing");
    assert.equal(processingCompletion.applyPhase, "executing");

    assert.deepEqual(
      await stepOpsModule.completeStep(STEP_DB_ID, preparedReadyOutput.output, envelope, {
        deferContinuationToEffectLedger: true,
      }),
      { advanced: false, runCompleted: false },
    );

    const ownerCommitted = await completionRepository.findById(completionRequestId);
    assert.equal(ownerCommitted?.state, "processing");
    assert.equal(ownerCommitted?.applyPhase, "owner_committed");
    assert.equal(ownerCommitted?.claimOutcome, "completed");
    const completionPlan = RuntimeCompletionPlanV1Schema.parse(ownerCommitted?.completionPlan);
    assert.equal(completionPlan.kind, "story_completion");
    assert.equal(completionPlan.continuation.type, "story_direct_merge");
    assert.deepEqual(completionPlan.subject?.storyDbId, STORY_DB_ID);
    assert.equal(completionPlan.effects.length, 1);
    assert.equal(completionPlan.effects[0]!.effectType, "v3.recovery.coordinate");
    assert.equal(completionPlan.effects[0]!.payload.attemptId, structuredHandoff.attemptId);
    assert.equal(completionPlan.effects[0]!.payload.sliceHash, structuredHandoff.sliceHash);
    const evidenceBundleHash = String(completionPlan.effects[0]!.payload.evidenceBundleHash || "");
    assert.match(evidenceBundleHash, /^[a-f0-9]{64}$/);
    assert.equal(
      completionPlan.outputHash,
      createHash("sha256").update(preparedReadyOutput.output).digest("hex"),
    );

    const passingEvidence = await findings.findEvidenceBundle(evidenceBundleHash);
    assert.ok(passingEvidence);
    assert.equal(passingEvidence.aggregateVerdict, "pass", JSON.stringify(passingEvidence));
    assert.equal(passingEvidence.attemptId, structuredHandoff.attemptId);
    assert.equal(passingEvidence.packetHash, structuredHandoff.packetHash);
    assert.equal(passingEvidence.sliceHash, structuredHandoff.sliceHash);
    assert.deepEqual(
      passingEvidence.predicates
        .map((predicate): [string, string] => [predicate.predicateRef, predicate.verdict])
        .sort(([left], [right]) => left.localeCompare(right)),
      [
        ["EVID_COMMAND_CMD_BUILD", "pass"],
        ["EVID_COMMAND_CMD_TEST", "pass"],
        ["EVID_SAVE_CONFIRMATION", "pass"],
        ["EVID_SAVE_RELOAD", "pass"],
      ],
    );

    // Keep the loop open for a hypothetical next packet story so this test
    // exercises the exact recovery continuation without invoking unrelated
    // final-candidate/deploy gates.
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, description,
         acceptance_criteria, status, retry_count, max_retries,
         abandoned_count, claim_generation, depends_on, scope_files,
         shared_files, implementation_contract, story_screens
       ) VALUES (
         'story-v3-recovery-next-integration', $1, 2, 'US-002',
         'Next unrelated packet story', 'Continuation sentinel only.', '[]',
         'pending', 0, 3, 0, 0, '[]', '[]', '[]', '{}', '[]'
       )`,
      [RUN_ID],
    );

    const effectRepository = runtimeEffectRepositoryModule.createRuntimeCompletionEffectRepository(database.sql);
    const pendingEffects = await effectRepository.listForRequest(completionRequestId);
    assert.equal(pendingEffects.length, 1);
    assert.equal(pendingEffects[0]!.state, "pending");
    assert.equal(pendingEffects[0]!.effectType, "v3.recovery.coordinate");
    let coordinateCalls = 0;
    let continuationCalls = 0;
    let genericReconcileCalls = 0;
    const ledgerResult = await runtimeEffectRunnerModule.runRuntimeCompletionEffectLedger({
      requestId: completionRequestId,
      ownerInstanceId: COMPLETION_OWNER_INSTANCE_ID,
      repository: effectRepository,
      heartbeatIntervalMs: 100,
      handler: {
        reconcile: async ({ effect }) => {
          genericReconcileCalls += 1;
          assert.equal(effect.effectType, "v3.recovery.coordinate");
          return undefined;
        },
        apply: async ({ input: effectInput, effect, assertLease }) => {
          assert.equal(effect.effectType, "v3.recovery.coordinate");
          return spawnerModule.executeV3RecoveryRuntimeCompletionEffect({
            completionRequestId,
            effectKey: effect.effectKey,
            planHash: effectInput.planHash,
            assertLease,
            coordinate: async () => {
              coordinateCalls += 1;
              return recoveryEffectModule.createPostgresV3RecoveryEffectHandler(database!.sql)
                .coordinate(effectInput.effect);
            },
            resumeCanonicalContinuation: async () => {
              continuationCalls += 1;
              return stepOpsModule.resumeRuntimeCompletionEffects({
                runId: RUN_ID,
                stepDbId: STEP_DB_ID,
                workflowStepId: "implement",
                output: rawReadyOutput,
                storyDbId: STORY_DB_ID,
                storyId: STORY_ID,
                completionPlan: effectInput.plan,
              });
            },
          });
        },
      },
    });
    assert.deepEqual(ledgerResult, {
      advanced: false,
      runCompleted: false,
      effectCount: 1,
      effectKeys: [completionPlan.effects[0]!.effectKey],
    });
    assert.equal(genericReconcileCalls, 1);
    assert.equal(coordinateCalls, 1);
    assert.equal(continuationCalls, 1);

    const effectsCommitted = await completionRepository.markEffectsCommitted({
      requestId: completionRequestId,
      ownerInstanceId: COMPLETION_OWNER_INSTANCE_ID,
      result: ledgerResult,
    });
    assert.equal(effectsCommitted.applyPhase, "effects_committed");
    const acceptedCompletion = await completionRepository.acceptAndRelease({
      requestId: completionRequestId,
      ownerInstanceId: COMPLETION_OWNER_INSTANCE_ID,
      result: ledgerResult,
    });
    assert.equal(acceptedCompletion.state, "accepted");
    assert.equal(acceptedCompletion.applyPhase, "effects_committed");
    assert.deepEqual(
      acceptedCompletion.submissionEvidence,
      preparedReadyOutput.submissionEvidence,
    );
    assert.equal(acceptedCompletion.sourceProposalRef, preparedReadyOutput.sourceProposalRef);
    assert.equal(Object.hasOwn(acceptedCompletion.result, "submissionEvidence"), false);

    const settledEffects = await effectRepository.listForRequest(completionRequestId);
    assert.equal(settledEffects.length, 1);
    assert.equal(settledEffects[0]!.state, "applied");
    assert.equal(settledEffects[0]!.attemptCount, 1);
    assert.equal(settledEffects[0]!.result.recoveryStatus, "resolved");
    assert.equal(settledEffects[0]!.evidence.continuationApplied, true);

    const resolvedCase = await findings.findRecoveryCase(opened.recoveryCase.recoveryCaseId);
    assert.ok(resolvedCase);
    assert.equal(resolvedCase.status, "resolved");
    assert.equal(resolvedCase.owner, "supervisor");
    assert.deepEqual(resolvedCase.budget, {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
      used: { implement: 0, supervisorRepair: 1, evidenceOnly: 0 },
    });
    assert.deepEqual(resolvedCase.terminal, {
      owner: "supervisor",
      outcome: "resolved",
      reasonCode: "evidence_satisfied",
      evidenceBundleHashes: [evidenceBundleHash],
    });

    const terminalRows = await database.sql.unsafe<Array<{
      claim_outcome: string;
      attempt_disposition: string;
      attempt_class: string;
      attempt_role: string;
      source_after_sha: string;
      source_after_tree_hash: string;
      evidence_refs: string[];
      story_status: string;
      step_status: string;
      step_current_story_id: string | null;
      delivery_state: string;
      case_status: string;
      runtime_state: string;
      completion_state: string;
      completion_apply_phase: string;
      context_stack_pack_id: string | null;
      context_status: string | null;
      dispatch_count: number;
      attempt_count: number;
      recovery_case_count: number;
      active_deliveries: number;
    }>>(
      `SELECT claim.outcome AS claim_outcome,
              attempt.disposition AS attempt_disposition,
              attempt.attempt_class,
              attempt.role AS attempt_role,
              attempt.source_after_sha,
              attempt.source_after_tree_hash,
              attempt.evidence_refs,
              story.status AS story_status,
              step.status AS step_status,
              step.current_story_id AS step_current_story_id,
              delivery.state AS delivery_state,
              recovery.status AS case_status,
              runtime.state AS runtime_state,
              completion.state AS completion_state,
              completion.apply_phase AS completion_apply_phase,
              run.context::jsonb ->> 'stack_pack_id' AS context_stack_pack_id,
              run.context::jsonb ->> 'status' AS context_status,
              (SELECT COUNT(*)::integer FROM recovery_revision_dispatches dispatch
                WHERE dispatch.recovery_case_id = $7) AS dispatch_count,
              (SELECT COUNT(*)::integer FROM execution_attempts all_attempts
                WHERE all_attempts.run_id = $1 AND all_attempts.story_id = $2) AS attempt_count,
              (SELECT COUNT(*)::integer FROM recovery_cases all_cases
                WHERE all_cases.run_id = $1 AND all_cases.story_id = $2) AS recovery_case_count,
              (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries active
                WHERE active.run_id = $1 AND active.story_id = $2
                  AND active.state IN ('authorized','leased','attempt_reserved','running')) AS active_deliveries
         FROM claim_log claim
         JOIN execution_attempts attempt ON attempt.attempt_id = $3
         JOIN stories story ON story.id = $4
         JOIN steps step ON step.id = $5
         JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = $6
         JOIN recovery_cases recovery ON recovery.recovery_case_id = $7
         JOIN runtime_sessions runtime ON runtime.session_id = $8
         JOIN runtime_completion_requests completion ON completion.request_id = $9
         JOIN runs run ON run.id = story.run_id
        WHERE claim.id = $10`,
      [
        RUN_ID,
        STORY_ID,
        structuredHandoff.attemptId,
        STORY_DB_ID,
        STEP_DB_ID,
        authorization.dispatch.dispatchId,
        opened.recoveryCase.recoveryCaseId,
        SESSION_ID,
        completionRequestId,
        claim.claimId,
      ],
    );
    assert.equal(terminalRows.length, 1);
    const terminal = terminalRows[0]!;
    assert.equal(terminal.claim_outcome, "completed");
    assert.equal(terminal.attempt_disposition, "verified");
    assert.equal(terminal.attempt_class, "supervisor_repair");
    assert.equal(terminal.attempt_role, "supervisor");
    assert.notEqual(terminal.source_after_sha, sourceRevision.sha);
    assert.notEqual(terminal.source_after_tree_hash, sourceRevision.treeHash);
    assert.deepEqual(passingEvidence.sourceRevision, {
      sha: terminal.source_after_sha,
      treeHash: terminal.source_after_tree_hash,
    });
    assert.equal(
      git(recoveryAttempt.worktree!, ["show", `${terminal.source_after_sha}:src/App.tsx`]),
      repairedSource.trim(),
    );
    assert.ok(terminal.evidence_refs.includes(`setfarm://evidence-bundle/${evidenceBundleHash}`));
    assert.ok(terminal.evidence_refs.includes(`setfarm://artifact/${structuredHandoff.evidencePlanArtifactHash}`));
    assert.equal(terminal.story_status, "done");
    assert.equal(terminal.step_status, "running");
    assert.equal(terminal.step_current_story_id, null);
    assert.equal(terminal.delivery_state, "succeeded");
    assert.equal(terminal.case_status, "resolved");
    assert.equal(terminal.runtime_state, "released");
    assert.equal(terminal.completion_state, "accepted");
    assert.equal(terminal.completion_apply_phase, "effects_committed");
    assert.notEqual(terminal.context_stack_pack_id, "hostile");
    assert.equal(terminal.context_status, null);
    assert.equal(terminal.dispatch_count, 1);
    assert.equal(terminal.attempt_count, 2);
    assert.equal(terminal.recovery_case_count, 1);
    assert.equal(terminal.active_deliveries, 0);
  } finally {
    if (removeRecoveryWorktree && recoveryBranch && fs.existsSync(repo)) {
      removeRecoveryWorktree(repo, recoveryBranch, AGENT_ID);
    }
    if (productionDb) await productionDb.pgClose().catch(() => {});
    if (database) await database.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
    restoreEnvironment(previousEnvironment);
  }
});
