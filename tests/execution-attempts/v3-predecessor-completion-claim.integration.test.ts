import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { it } from "node:test";
import ts from "typescript";
import type postgres from "postgres";

import { completeSingleStepClaimAndState } from "../../src/execution/claim-attempt-transition.js";
import { publishSingleClaimRuntime, publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeCompletionRepository, requestRuntimeCompletion, quarantineExpiredRuntimeCompletionForRecoveryInTransaction } from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

// This test deliberately does not import the new barrier module. On old Source
// the real publication must fail the no-birth oracle, not module resolution.
const RELEASE_SHA = "4".repeat(40);
const DESIGN_AGENT = "feature-dev_designer";
function runtimeIntent(sessionId: string) {
  return { schema: "setfarm.runtime-claim-intent.v1" as const, sessionId,
    runtimeAgentId: "predecessor-test-runtime", runtimeKind: "openclaw_session" as const,
    ownerInstanceId: "predecessor-test-owner", sessionKey: `key:${sessionId}` };
}

async function seedRun(database: TestDatabase, runId: string) {
  const admission = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
  await database.sql`
    INSERT INTO runs (id,workflow_id,task,status,context,protocol,
      compiler_release_sha,activation_preflight_hash,release_admission_hash)
    VALUES (${runId},'feature-dev','predecessor completion race','running','{}','v3',
      ${RELEASE_SHA},${"e".repeat(64)},${admission})
  `;
  await database.sql`
    INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
    VALUES (${`${runId}-plan`},${runId},'plan','feature-dev_planner',1,'','','pending','single'),
      (${`${runId}-design`},${runId},'design',${DESIGN_AGENT},2,'','','pending','single')
  `;
}

async function prepareCompletedPredecessor(database: TestDatabase, runId: string) {
  const token = createHash("sha256").update(runId).digest("hex").slice(0,24);
  const intent = runtimeIntent(`RTS_predecessor-${token}`);
  const publication = await publishSingleClaimRuntime(database.sql, {
    runId, stepDbId: `${runId}-plan`, workflowStepId: "plan",
    claimAgentId: "feature-dev_planner", runtimeIntent: intent,
  });
  assert.ok(publication);
  const sessions = createRuntimeSessionRepository(database.sql);
  await sessions.markStarting({ sessionId: intent.sessionId, ownerInstanceId: intent.ownerInstanceId });
  await sessions.markRunning({ sessionId: intent.sessionId, ownerInstanceId: intent.ownerInstanceId,
    sessionKey: intent.sessionKey });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: new Date().toISOString(),
    runId, stepId: `${runId}-plan`, workflowStepId: "plan", claimId: publication.claimId,
    claimAgentId: "feature-dev_planner", runtimeAgentId: intent.runtimeAgentId,
  };
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope, output: "STATUS: done", requestId: `RCR_predecessor-${token}`,
  });
  assert.equal(requested.status,"requested");
  if (requested.status !== "requested") throw new Error("predecessor request missing");
  const completions = createRuntimeCompletionRepository(database.sql);
  await completions.claim({ requestId: requested.request.requestId, ownerInstanceId: intent.ownerInstanceId });
  await sessions.markDrained({ sessionId: intent.sessionId, ownerInstanceId: intent.ownerInstanceId,
    evidence: { schema: "setfarm.runtime-drain-evidence.v1", observedAt: new Date().toISOString(),
      localProcessAbsent: true, openClawTaskAbsent: true, workspaceProcessAbsent: true,
      stableObservations: 2, evidenceRefs: ["setfarm://tests/predecessor-completion/isolated-runtime-drain"] } });
  const processing = await completions.markProcessing({ requestId: requested.request.requestId,
    ownerInstanceId: intent.ownerInstanceId });
  assert.ok(processing.ownerInstanceId && processing.leaseExpiresAt);
  await runWithRuntimeCompletionOwner({ requestId: processing.requestId,
    ownerInstanceId: processing.ownerInstanceId, leaseExpiresAt: processing.leaseExpiresAt,
    ownerAttemptCount: processing.ownerAttemptCount }, () => completeSingleStepClaimAndState(database.sql, {
      envelope, stepStatus: "done", stepOutput: "STATUS: done", requireRuntimeCompletionOwner: true,
    }));
  const result = { advanced: false, runCompleted: false };
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const effect = await effects.claimNext({ requestId: processing.requestId, ownerInstanceId: intent.ownerInstanceId });
  assert.ok(effect?.leaseToken);
  await effects.settle({ requestId: processing.requestId, effectKey: effect.effectKey,
    ownerInstanceId: intent.ownerInstanceId, leaseToken: effect.leaseToken, resolution: "applied", result,
    evidence: { source: "predecessor-completion-real-api-component" } });
  await completions.markEffectsCommitted({ requestId: processing.requestId, ownerInstanceId: intent.ownerInstanceId,
    ownerAttemptCount: processing.ownerAttemptCount, result });
  const rows = await database.sql<Array<{ state: string; apply_phase: string; outcome: string }>>`
    SELECT c.state,c.apply_phase,cl.outcome FROM runtime_completion_requests c
    JOIN claim_log cl ON cl.id=c.claim_id WHERE c.request_id=${processing.requestId}
  `;
  assert.deepEqual({ ...rows[0] }, { state: "processing", apply_phase: "effects_committed", outcome: "completed" });
  return { processing, intent, completions, result };
}

async function publicationSnapshot(sql: postgres.Sql, runId: string) {
  const rows = await sql<Array<{ status: string; claims: number; sessions: number; reservations: number }>>`
    SELECT s.status,
      (SELECT COUNT(*)::integer FROM claim_log WHERE run_id=${runId}) AS claims,
      (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id=${runId}) AS sessions,
      (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1) AS reservations
    FROM steps s WHERE s.id=${`${runId}-design`}
  `;
  const sequence = await sql.unsafe<Array<{ last_value: string; is_called: boolean }>>(
    "SELECT last_value::text,is_called FROM claim_log_id_seq",
  );
  return { ...rows[0], sequence: { ...sequence[0] } };
}

// Parse only string/template DATA, never eval/import the giant step-ops module.
// Executing its exact candidate SELECT also catches a missing candidate filter
// while allowing another ready run to win LIMIT 1.
function candidateSqlFromActualSource(): string {
  const files = [new URL("../../src/installer/step-ops.ts", import.meta.url),
    new URL("../../src/execution/v3-predecessor-completion-claim-barrier-v1.ts", import.meta.url)];
  const definitions = new Map<string,ts.Expression>();
  const candidates: ts.Expression[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const source = ts.createSourceFile(file.pathname,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        definitions.set(node.name.text,node.initializer);
        const initializer=ts.isAwaitExpression(node.initializer)
          ? node.initializer.expression : node.initializer;
        if (node.name.text==="step" && ts.isCallExpression(initializer)
          && ts.isIdentifier(initializer.expression) && initializer.expression.text==="pgGet") {
          const query=initializer.arguments[0];
          if (query && ts.isTemplateExpression(query)
            && query.head.text.startsWith("SELECT s.id, s.step_id, s.run_id, s.step_index")) candidates.push(query);
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
  }
  assert.equal(candidates.length,1,"one exact ordinary claimStep candidate SELECT");
  const active = new Set<string>();
  const read = (expression: ts.Expression): string => {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (ts.isTemplateExpression(expression)) return expression.head.text+expression.templateSpans.map(
      span=>read(span.expression)+span.literal.text).join("");
    if (ts.isIdentifier(expression)) {
      assert.equal(active.has(expression.text),false,"no recursive SQL constants");
      const declaration=definitions.get(expression.text);
      assert.ok(declaration,`literal SQL declaration ${expression.text}`);
      active.add(expression.text); const value=read(declaration); active.delete(expression.text); return value;
    }
    throw new Error(`Non-literal SQL expression refused: ${expression.kind}`);
  };
  return read(candidates[0]!);
}

it("waits before real single and loop publication without consuming a claim sequence, CAS, runtime or owner", { timeout: 180_000 }, async () => {
  const database=await createIsolatedTestDatabase();
  try {
    const runId="run-predecessor-processing-publication";
    await seedRun(database,runId);
    const managed=await prepareCompletedPredecessor(database,runId);
    const singleInput={ runId,stepDbId:`${runId}-design`,workflowStepId:"design",claimAgentId:DESIGN_AGENT,
      runtimeIntent:runtimeIntent("RTS_predecessor-design-waits") };
    const before=await publicationSnapshot(database.sql,runId);
    assert.equal(await publishSingleClaimRuntime(database.sql,singleInput),undefined,
      "effects committed is not accepted: new successor must wait normally");
    assert.deepEqual(await publicationSnapshot(database.sql,runId),before,"no step/claim/runtime/owner/sequence effect");
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
      VALUES (${`${runId}-loop`},${runId},'work-loop','feature-dev_worker',3,'','','pending','loop')
    `;
    await database.sql`
      INSERT INTO stories (id,run_id,story_index,story_id,title,status,claim_generation)
      VALUES (${`${runId}-story`},${runId},1,'US-001','Isolated loop boundary','pending',0)
    `;
    const loopInput={ runId,stepDbId:`${runId}-loop`,workflowStepId:"work-loop",storyDbId:`${runId}-story`,
      storyId:"US-001",claimAgentId:"feature-dev_worker",parallelLimit:2,
      runtimeIntent:runtimeIntent("RTS_predecessor-loop-waits") };
    assert.equal(await publishLoopClaimRuntime(database.sql,loopInput),undefined,"initial pending loop also waits");
    assert.deepEqual(await publicationSnapshot(database.sql,runId),before);
    const pending = await database.sql<Array<{ step_status: string; story_status: string; claim_generation: number }>>`
      SELECT s.status AS step_status,st.status AS story_status,st.claim_generation FROM steps s
      JOIN stories st ON st.run_id=s.run_id WHERE s.id=${loopInput.stepDbId} AND st.id=${loopInput.storyDbId}
    `;
    assert.deepEqual({...pending[0]},{step_status:"pending",story_status:"pending",claim_generation:0});
    await managed.completions.acceptAndRelease({ requestId:managed.processing.requestId,
      ownerInstanceId:managed.intent.ownerInstanceId,ownerAttemptCount:managed.processing.ownerAttemptCount,result:managed.result });
    const publication=await publishSingleClaimRuntime(database.sql,singleInput);
    assert.ok(publication,"actual accepted predecessor permits new publication");
    assert.deepEqual(await publishSingleClaimRuntime(database.sql,singleInput),publication,"exact committed single replay unchanged");
    const loop=await publishLoopClaimRuntime(database.sql,loopInput);
    assert.ok(loop,"actual accepted predecessor permits initial loop publication");
    assert.deepEqual(await publishLoopClaimRuntime(database.sql,loopInput),loop,"exact committed loop replay unchanged");
  } finally { await database.cleanup(); }
});

it("does not fence an already committed running claim behind a subsequently completed predecessor", {timeout:180_000}, async()=>{
  const database=await createIsolatedTestDatabase();
  try {
    const runId="run-predecessor-existing-reissue";
    await seedRun(database,runId);
    const input={runId,stepDbId:`${runId}-design`,workflowStepId:"design",claimAgentId:DESIGN_AGENT,
      runtimeIntent:runtimeIntent("RTS_predecessor-existing-reissue")};
    const published=await publishSingleClaimRuntime(database.sql,input); assert.ok(published);
    await prepareCompletedPredecessor(database,runId);
    const before=await publicationSnapshot(database.sql,runId);
    assert.deepEqual(await publishSingleClaimRuntime(database.sql,input),published);
    assert.deepEqual(await publicationSnapshot(database.sql,runId),before);
  } finally { await database.cleanup(); }
});

it("selects another ready run and confines the wait to exact lower single nonstory completion bindings", {timeout:180_000}, async(t)=>{
  const database=await createIsolatedTestDatabase();
  try {
    const query=candidateSqlFromActualSource();
    // Isolated, plain DATA relations exercise the actual production SELECT.
    // They are not production completion capabilities or a compiled readiness fixture.
    await database.sql.begin(async(tx)=>{
      await tx.unsafe(`CREATE TEMP TABLE runs (id text,status text,protocol text,context text,assigned_developer text) ON COMMIT DROP`);
      await tx.unsafe(`CREATE TEMP TABLE steps (id text,step_id text,run_id text,agent_id text,step_index integer,
        input_template text,type text,loop_config text,status text,current_story_id text,retry_count integer,output text) ON COMMIT DROP`);
      await tx.unsafe(`CREATE TEMP TABLE stories (run_id text,status text,pr_url text,story_id text,retry_count integer,output text) ON COMMIT DROP`);
      await tx.unsafe(`CREATE TEMP TABLE claim_log (id bigint,run_id text,step_id text,story_id text,outcome text) ON COMMIT DROP`);
      await tx.unsafe(`CREATE TEMP TABLE runtime_completion_requests (claim_id bigint,run_id text,step_db_id text,
        workflow_step_id text,story_db_id text,story_id text,attempt_id text,state text) ON COMMIT DROP`);
      const cases: Array<{name:string; change?:string; want:string}>= [
        {name:"requested",want:"ready-target"}, {name:"draining",change:"UPDATE runtime_completion_requests SET state='draining'",want:"ready-target"},
        {name:"processing",change:"UPDATE runtime_completion_requests SET state='processing'",want:"ready-target"},
        {name:"quarantined",change:"UPDATE runtime_completion_requests SET state='quarantined'",want:"ready-target"},
        {name:"accepted",change:"UPDATE runtime_completion_requests SET state='accepted'",want:"blocked-target"},
        {name:"rejected",change:"UPDATE runtime_completion_requests SET state='rejected'",want:"blocked-target"},
        {name:"legacy run",change:"UPDATE runs SET protocol='legacy' WHERE id='blocked'",want:"blocked-target"},
        {name:"shadow run",change:"UPDATE runs SET protocol='shadow' WHERE id='blocked'",want:"blocked-target"},
        {name:"running reissue",change:"UPDATE steps SET status='running' WHERE id='blocked-target'",want:"blocked-target"},
        {name:"current index",change:"UPDATE steps SET step_index=2 WHERE id='predecessor'",want:"blocked-target"},
        {name:"later index",change:"UPDATE steps SET step_index=4 WHERE id='predecessor'",want:"blocked-target"},
        {name:"loop predecessor",change:"UPDATE steps SET type='loop' WHERE id='predecessor'",want:"blocked-target"},
        {name:"story claim",change:"UPDATE claim_log SET story_id='US-001'",want:"blocked-target"},
        {name:"story completion",change:"UPDATE runtime_completion_requests SET story_db_id='story-db',story_id='US-001'",want:"blocked-target"},
        {name:"attempt completion",change:"UPDATE runtime_completion_requests SET attempt_id='ATT_other'",want:"blocked-target"},
        {name:"not completed",change:"UPDATE claim_log SET outcome='failed'",want:"blocked-target"},
        {name:"unrelated run",change:"UPDATE claim_log SET run_id='ready'",want:"blocked-target"},
        {name:"wrong completion run",change:"UPDATE runtime_completion_requests SET run_id='ready'",want:"blocked-target"},
        {name:"wrong completion step",change:"UPDATE runtime_completion_requests SET step_db_id='other'",want:"blocked-target"},
        {name:"wrong completion workflow",change:"UPDATE runtime_completion_requests SET workflow_step_id='other'",want:"blocked-target"},
        {name:"wrong completion claim",change:"UPDATE runtime_completion_requests SET claim_id=2",want:"blocked-target"},
        {name:"pending loop target",change:"UPDATE steps SET type='loop',step_id='work-loop' WHERE id='blocked-target'",want:"ready-target"},
      ];
      for(const c of cases) await t.test(c.name,async()=>{
        await tx.unsafe("TRUNCATE pg_temp.runtime_completion_requests,pg_temp.claim_log,pg_temp.steps,pg_temp.runs");
        await tx.unsafe("INSERT INTO runs VALUES ('blocked','running','v3','{}',NULL),('ready','running','v3','{}',NULL)");
        await tx.unsafe(`INSERT INTO steps (id,step_id,run_id,agent_id,step_index,status,type)
          VALUES ('predecessor','plan','blocked','feature-dev_planner',1,'done','single'),
          ('blocked-target','design','blocked','feature-dev_designer',2,'pending','single'),
          ('ready-target','design','ready','feature-dev_designer',3,'pending','single')`);
        await tx.unsafe("INSERT INTO claim_log VALUES (1,'blocked','plan',NULL,'completed')");
        await tx.unsafe("INSERT INTO runtime_completion_requests VALUES (1,'blocked','predecessor','plan',NULL,NULL,NULL,'requested')");
        if(c.change) await tx.unsafe(c.change);
        const rows=await tx.unsafe<Array<{id:string}>>(query,[DESIGN_AGENT,null,60_000]);
        assert.equal(rows[0]?.id,c.want,c.name);
      });
    });
  } finally { await database.cleanup(); }
});


it("keeps a genuinely quarantined completed predecessor behind both public publication barriers", {timeout:180_000}, async(t)=>{
  const database=await createIsolatedTestDatabase();
  try {
    const runId="run-predecessor-quarantined-publication";
    await seedRun(database,runId);
    const managed=await prepareCompletedPredecessor(database,runId);
    // Existing isolated-PG expiry fixture pattern: change only this mutable
    // lease, then require the real recovery API's owner/version/phase checks.
    // This is not an elapsed live lease or a production recovery qualification.
    const expiredRows=await database.sql.unsafe<Array<{request_id:string}>>(
      `UPDATE runtime_completion_requests
          SET lease_expires_at = date_trunc('milliseconds', clock_timestamp()) - INTERVAL '1 second'
        WHERE request_id = $1 AND state = 'processing' AND apply_phase = 'effects_committed'
        RETURNING request_id`, [managed.processing.requestId],
    );
    assert.equal(expiredRows.length,1,"expire only the exact isolated completion fixture");
    const expired=await managed.completions.findById(managed.processing.requestId);
    assert.ok(expired?.ownerInstanceId && expired.leaseExpiresAt);
    const quarantined=await database.sql.begin(transaction=>quarantineExpiredRuntimeCompletionForRecoveryInTransaction(
      transaction, {
        requestId:expired.requestId,
        expectedOwnerInstanceId:expired.ownerInstanceId!,
        expectedLeaseExpiresAt:expired.leaseExpiresAt!,
        expectedUpdatedAt:expired.updatedAt,
        expectedApplyPhase:expired.applyPhase,
        diagnostic:"isolated predecessor quarantine barrier regression",
      },
    ));
    assert.equal(quarantined.state,"quarantined");
    const rows=await database.sql<Array<{state:string;apply_phase:string;outcome:string;step_status:string;runtime_state:string}>>`
      SELECT c.state,c.apply_phase,cl.outcome,s.status AS step_status,runtime.state AS runtime_state
      FROM runtime_completion_requests c JOIN claim_log cl ON cl.id=c.claim_id
      JOIN steps s ON s.id=c.step_db_id AND s.run_id=c.run_id
      JOIN runtime_sessions runtime ON runtime.session_id=c.runtime_session_id AND runtime.claim_id=c.claim_id
      WHERE c.request_id=${quarantined.requestId}
    `;
    assert.deepEqual({...rows[0]},{state:"quarantined",apply_phase:"effects_committed",outcome:"completed",step_status:"done",runtime_state:"drained"});
    await database.sql`
      INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status,type)
      VALUES (${`${runId}-loop`},${runId},'work-loop','feature-dev_worker',3,'','','pending','loop')
    `;
    await database.sql`
      INSERT INTO stories (id,run_id,story_index,story_id,title,status,claim_generation)
      VALUES (${`${runId}-story`},${runId},1,'US-001','Quarantined predecessor boundary','pending',0)
    `;
    await t.test("single publication waits with no sequence, CAS, claim, runtime or reservation",async()=>{
      const before=await publicationSnapshot(database.sql,runId);
      assert.equal(await publishSingleClaimRuntime(database.sql,{
        runId,stepDbId:`${runId}-design`,workflowStepId:"design",claimAgentId:DESIGN_AGENT,
        runtimeIntent:runtimeIntent("RTS_predecessor-quarantined-design"),
      }),undefined,"quarantined is still unaccepted; wait until explicit resolution or termination");
      assert.deepEqual(await publicationSnapshot(database.sql,runId),before);
    });
    await t.test("initial loop publication also waits without changing its pending story",async()=>{
      const before=await publicationSnapshot(database.sql,runId);
      assert.equal(await publishLoopClaimRuntime(database.sql,{
        runId,stepDbId:`${runId}-loop`,workflowStepId:"work-loop",storyDbId:`${runId}-story`,
        storyId:"US-001",claimAgentId:"feature-dev_worker",parallelLimit:2,
        runtimeIntent:runtimeIntent("RTS_predecessor-quarantined-loop"),
      }),undefined,"initial loop cannot bypass the same unaccepted predecessor");
      assert.deepEqual(await publicationSnapshot(database.sql,runId),before);
      const pending=await database.sql<Array<{step_status:string;story_status:string;claim_generation:number}>>`
        SELECT s.status AS step_status,st.status AS story_status,st.claim_generation FROM steps s
        JOIN stories st ON st.run_id=s.run_id WHERE s.id=${`${runId}-loop`} AND st.id=${`${runId}-story`}
      `;
      assert.deepEqual({...pending[0]},{step_status:"pending",story_status:"pending",claim_generation:0});
    });
  } finally { await database.cleanup(); }
});
