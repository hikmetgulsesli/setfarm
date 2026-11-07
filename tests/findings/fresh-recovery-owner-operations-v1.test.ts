import assert from "node:assert/strict";
import { it } from "node:test";
import type postgres from "postgres";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";

const findingSet = () => createFindingSetV1({ runId: "unit-owner-run", storyId: "US-001", packetHash: "a".repeat(64),
  sliceHash: "b".repeat(64), sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) }, findings: [{
    origin: "runtime", classification: "structured", invariantRef: "INV_UNIT_OBSERVABLE", status: "open",
    sourceLocators: [{ path: "src/App.tsx", contentHash: "c".repeat(64) }],
    expectedPredicateRef: "EVID_UNIT_OBSERVABLE", observedEvidenceRefs: ["d".repeat(64)],
  }] });

// Real repository entry and schema; an inert SQL boundary is required because
// author unit work must not connect/create any database. This does not certify
// PostgreSQL role enforcement (Root's rollback-only production check does).
it("forged recovery owner context refuses before the ordinary repository database is touched", async () => {
  const sql = { begin: async () => { throw Error("permission denied for table finding_sets"); } } as unknown as postgres.Sql;
  await assert.rejects(async () => {
    const repository = Reflect.apply(createFindingRecoveryRepository, undefined, [sql,
      { writeSql: sql, operation: Object.freeze({}) }]);
    await repository.putFindingSet(findingSet());
  }, /RECOVERY_OWNER_.*(?:REFUSED|INVALID)/);
});

it("ordinary finding reads keep their restricted SQL client", async () => {
  const value = findingSet();
  const sql = { unsafe: async (query: string, values: unknown[]) => {
    assert.match(query, /^SELECT finding_set_hash, payload FROM finding_sets/);
    assert.deepEqual(values, [value.findingSetHash]);
    return [{ finding_set_hash: value.findingSetHash, payload: value }];
  } } as unknown as postgres.Sql;
  assert.deepEqual(await createFindingRecoveryRepository(sql).findFindingSet(value.findingSetHash), value);
});

// Full compiled module bodies, with only external operational admission and the
// SQL engine replaced at the boundary. These fixtures cannot admit production.
async function component(relative: string, overrides: Record<string, unknown> = {}) {
  const [{ readFileSync }, ts] = await Promise.all([import("node:fs"), import("typescript")]);
  const location = new URL(relative, import.meta.url);
  const source = readFileSync(location, "utf8");
  const tree = ts.default.createSourceFile(location.pathname, source, ts.default.ScriptTarget.ESNext, true);
  const dependencies: Record<string, unknown> = {};
  for (const statement of tree.statements) {
    if (!ts.default.isImportDeclaration(statement) || !ts.default.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier in overrides) dependencies[specifier] = overrides[specifier];
    else dependencies[specifier] = await import(specifier.startsWith(".")
      ? new URL(specifier.replace(/\.js$/, ".ts"), location).href : specifier);
  }
  const componentSource=source.replace('await import("../db-pg.js")','await Promise.resolve(require("../db-pg.js"))');
  const output = ts.default.transpileModule(componentSource, { compilerOptions: {
    module: ts.default.ModuleKind.CommonJS, target: ts.default.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} as any };
  new Function("require", "exports", "module", output)((name: string) => {
    if (!(name in dependencies)) throw Error("UNEXPECTED_COMPONENT_IMPORT:" + name);
    return dependencies[name];
  }, module.exports, module);
  return module.exports;
}

async function ownerRepositoryFixture(kind="lifecycle") {
  let current = true, role = "setrox", pending: unknown, stored: unknown, writes = 0;
  const selected = { assertUnchanged() { if (!current) throw Error("RECOVERY_OWNER_AUTHORITY_REFUSED"); },
    catalogHash: "fixture-catalog", state: { ownerOid:2,runtimeOid:3,origin: { ownerRole: "sf_owner_fixture", runtimeRole: "sf_runtime_fixture",
      databaseName: "fixture", databaseOid: 42, systemIdentifier: "123" } } };
  const authority = await component("../../src/recovery/v3-owner-recovery-authority-v1.ts", {
    "../installation/fresh-installation-selection-v1.js": { freshInstallationSelectionV1: selected, assertFreshInstallationSelectionUnchangedV1: selected.assertUnchanged },
    "../installation/fresh-installation-entry-v1.js": { assertFreshInstallationOperationalEntryV1: selected.assertUnchanged },
    "../server/fresh-installation-service-controls-v1.js": { assertHeldFreshServiceCurrentV1: selected.assertUnchanged },
    "../installation/fresh-installation-catalog-v1.js": { readFreshInstallationCatalogHashV1: async () => "fixture-catalog" },
  });
  let afterFindingRead: (() => void) | undefined;
  let casePending: any, caseStored: any, commits=0;
  let sqlHook:((query:string,values:unknown[])=>unknown)|undefined;
  let probeClaimEntry = false, leaseCurrent = true;
  const value = findingSet();
  const transaction = { unsafe: async (query: string, values: unknown[] = []) => {
    const hooked=await sqlHook?.(query,values);if(hooked!==undefined)return hooked;
    if (query.startsWith("SET LOCAL ROLE")) { role = "sf_owner_fixture"; return []; }
    if (query.startsWith("SET LOCAL")) return [];
    if (query.includes("AS valid")) return [{ valid: role === "sf_owner_fixture" && (!query.includes("delivery.lease_expires_at") || leaseCurrent) }];
    if (query.includes("clock_timestamp()")) return [{ wall_clock: new Date("2026-11-07T00:00:00Z") }];
    if (query.includes("pg_advisory_xact_lock")) {
      if (probeClaimEntry) {
        if (role !== "sf_owner_fixture") throw Error("permission denied for table recovery_dispatch_deliveries");
        throw Error("FIXTURE_REACHED_CANONICAL_STORY_LOCK_AS_OWNER");
      }
      return [];
    }
    if (query.includes("FROM runs WHERE")) return [{ protocol: "v3", status: "running" }];
    if (query.includes("FROM run_termination_requests")) return [];
    if (query.startsWith("SELECT * FROM recovery_cases")) return caseStored ? [caseStored] : [];
    if (query.startsWith("SELECT finding_set_hash, payload FROM finding_sets")) {
      if (role !== "sf_owner_fixture") throw Error("permission denied for table finding_sets");
      afterFindingRead?.(); return [{ finding_set_hash: value.findingSetHash, payload: value }];
    }
    if (query.startsWith("SELECT evidence_bundle_hash, payload")) return stored ? [{ payload: stored }] : [];
    if (/^\s*INSERT INTO evidence_bundles/.test(query)) {
      if (role !== "sf_owner_fixture") throw Error("permission denied for table evidence_bundles");
      writes++; pending = JSON.parse(values[10] as string); return [];
    }
    if (/^\s*INSERT INTO recovery_cases/.test(query)) {
      writes++; if(!current)throw Error("WRITE_AFTER_CUSTODY_LOST");
      const columns="recovery_case_id,dedupe_key,run_id,story_id,finding_set_hash,finding_ids,packet_hash,slice_hash,source_sha,source_tree_hash,owner,expected_delta,allowed_paths,evidence_plan,prior_attempt_refs,max_implement,max_supervisor_repair,max_evidence_only,used_implement,used_supervisor_repair,used_evidence_only,status,terminal,decision_refs,state_version,created_at".split(",");
      casePending=Object.fromEntries(columns.map((key,index)=>[key,values[index]]));
      for(const key of ["finding_ids","expected_delta","allowed_paths","evidence_plan","prior_attempt_refs","terminal","decision_refs"])if(typeof casePending[key]==="string")casePending[key]=JSON.parse(casePending[key]);
      casePending.updated_at=casePending.created_at;casePending.current_revision_id=null;return [casePending];
    }
    if (/^\s*INSERT INTO recovery_case_revisions/.test(query)) {writes++;return [];}
    if (/^\s*UPDATE recovery_cases/.test(query)) {writes++;casePending.current_revision_id=values[1];return []; }
    throw Error("UNEXPECTED_COMPONENT_SQL:" + query.slice(0, 100));
  } };
  const writer = { begin: async (body: (tx: unknown) => Promise<unknown>) => {
    role = "setrox"; pending = undefined;casePending=undefined;
    try { const result = await body(transaction); stored = pending ?? stored;caseStored=casePending??caseStored;commits++; return result; }
    finally { pending = undefined;casePending=undefined; role = "setrox"; }
  } };
  const restricted = { begin: async (body: (tx: unknown) => Promise<unknown>) => {
    role = "sf_runtime_fixture"; try { return await body(transaction); } finally { role = "setrox"; }
  } };
  const access = authority.createOwnerRecoveryAccessV1({ held: {}, writeSql: writer, kind,
    adminRole: "setrox", adminOid: "1", ownerOid: "2", runtimeOid: "3" });
  const repository = await component("../../src/recovery/finding-recovery-repository.ts", {
    "./v3-owner-recovery-authority-v1.js": authority,
  });
  return { authority, access, restricted, writer, transaction,
    setSqlHook(hook:typeof sqlHook){sqlHook=hook;},get commits(){return commits;},
    expireLease() { leaseCurrent = false; },
    probeClaimEntry() { probeClaimEntry = true; },
    owner: repository.createFindingRecoveryRepository(restricted, access),
    ordinary: repository.createFindingRecoveryRepository(restricted), value,
    loseAfterFindingRead() { afterFindingRead = () => { current = false; }; },
    get writes() { return writes; }, get role() { return role; }, get stored() { return stored; } };
}

it("owner case publication rechecks custody after finding row lock before its first case write", async () => {
  const fixture = await ownerRepositoryFixture(), value = fixture.value;
  fixture.loseAfterFindingRead();
  await assert.rejects(fixture.owner.openRecoveryCase({ runId: value.runId, storyId: value.storyId,
    findingSetHash: value.findingSetHash, findingIds: value.findings.map(f => f.findingId),
    packetHash: value.packetHash, sliceHash: value.sliceHash, sourceRevision: value.sourceRevision,
    owner: "implement", expectedDelta: { kind: "source_change", invariantRefs: ["INV_UNIT_OBSERVABLE"], requiredPaths: ["src/App.tsx"] },
    allowedPaths: ["src/App.tsx"], evidencePlan: ["EVID_UNIT_OBSERVABLE"], priorAttemptRefs: [],
    budget: { limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 }, used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 } },
    status: "open", decisionRefs: [] }), /RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.equal(fixture.writes, 0);
  assert.equal(fixture.role, "setrox");
});

it("owner publication commits and replays the real evidence repository while ordinary publication remains denied", async () => {
  const { createEvidenceBundleV2, computeObservationRef } = await import("../../src/evidence/evidence-bundle-v2.js");
  const fixture = await ownerRepositoryFixture();
  const observation = { kind: "runtime" as const, owner: "setfarm-orchestrator" as const,
    runtimeSessionId: "unit-session", runtimeArtifactHash: "e".repeat(64),
    startedAt: "2026-11-07T00:00:00.000Z", completedAt: "2026-11-07T00:00:01.000Z" };
  const bundle = createEvidenceBundleV2({ runId: "unit-owner-run", storyId: "US-001", packetHash: "a".repeat(64),
    sliceHash: "b".repeat(64), sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
    predicates: [{ invariantRef: "INV_UNIT_OBSERVABLE", predicateRef: "EVID_UNIT_OBSERVABLE", required: true,
      verdict: "fail", observationRefs: [computeObservationRef(observation)] }], observations: [observation],
    artifacts: [{ hash: "e".repeat(64), mediaType: "application/json", locator: "evidence/runtime.json" }],
    runner: { id: "fixture", version: "1", environmentHash: "f".repeat(64) },
    startedAt: observation.startedAt, completedAt: observation.completedAt });
  await assert.rejects(fixture.ordinary.putEvidenceBundle(bundle), /permission denied for table evidence_bundles/);
  assert.equal(fixture.stored, undefined);
  assert.equal((await fixture.owner.putEvidenceBundle(bundle)).status, "inserted");
  assert.deepEqual(fixture.stored, bundle);
  assert.equal((await fixture.owner.putEvidenceBundle(bundle)).status, "duplicate");
  assert.equal(fixture.writes, 1);
  assert.equal(fixture.role, "setrox");
});


it("actual recovery claim transaction enters owner before canonical story and delivery locks", async () => {
  const fixture = await ownerRepositoryFixture();
  const module = await component("../../src/recovery/v3-recovery-claim-authority.ts", {
    "./v3-owner-recovery-authority-v1.js": fixture.authority,
  });
  fixture.probeClaimEntry();
  await assert.rejects(module.createV3RecoveryClaimAuthority(fixture.restricted, fixture.access).acquireRecoveryClaim({
    runId: "unit-owner-run", storyId: "US-001", ownerInstanceId: "unit-owner",
  }), /FIXTURE_REACHED_CANONICAL_STORY_LOCK_AS_OWNER/);
  assert.equal(fixture.role, "setrox");
});


it("an owner transaction rolls back when its pinned delivery lease expires before commit", async () => {
  const f=await ownerRepositoryFixture();
  await assert.rejects(f.writer.begin(async()=>{
    const fence=await f.authority.enterOwnerRecoveryTransactionV1(f.transaction,f.access);
    await f.authority.pinOwnerRecoveryDeliveryLeaseV1(f.transaction,{
      dispatchId:"unit-dispatch",revisionId:"unit-revision",ownerInstanceId:"unit-owner",leaseToken:"unit-token",
    });
    f.expireLease();
    await f.authority.assertOwnerRecoveryTransactionBeforeCommitV1(f.transaction,fence);
  }),/RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.equal(f.role,"setrox");
  assert.equal(f.stored,undefined);
});


it("owner opens the actual finding-backed recovery case once and replays without another revision",async()=>{
  const fixture=await ownerRepositoryFixture(),value=fixture.value;
  const draft={runId:value.runId,storyId:value.storyId,findingSetHash:value.findingSetHash,
    findingIds:value.findings.map(f=>f.findingId),packetHash:value.packetHash,sliceHash:value.sliceHash,sourceRevision:value.sourceRevision,
    owner:"implement",expectedDelta:{kind:"source_change",invariantRefs:["INV_UNIT_OBSERVABLE"],requiredPaths:["src/App.tsx"]},
    allowedPaths:["src/App.tsx"],evidencePlan:["EVID_UNIT_OBSERVABLE"],priorAttemptRefs:[],
    budget:{limits:{implement:1,supervisorRepair:1,evidenceOnly:2},used:{implement:0,supervisorRepair:0,evidenceOnly:0}},status:"open",decisionRefs:[]};
  await assert.rejects(fixture.ordinary.openRecoveryCase(draft),/permission denied for table finding_sets/);
  const opened=await fixture.owner.openRecoveryCase(draft),replay=await fixture.owner.openRecoveryCase(draft);
  assert.equal(opened.status,"opened");assert.equal(replay.status,"duplicate");
  assert.deepEqual(replay.recoveryCase,opened.recoveryCase);
  assert.equal(fixture.writes,3);
  assert.deepEqual(replay.recoveryCase.budget.used,{implement:0,supervisorRepair:0,evidenceOnly:0});
});


it("actual terminal evidence claim body rolls back when its original delivery lease expires during close",async()=>{
  const f=await ownerRepositoryFixture("evidence");
  const {ExecutionAttemptV1Schema}=await import("../../src/execution/schemas/execution-attempt-v1.js");
  const now="2026-11-07T00:00:00.000Z",expires="2026-11-07T00:01:00.000Z";let clock=now;
  const attempt=ExecutionAttemptV1Schema.parse({schema:"setfarm.execution-attempt.v1",attemptId:"ATT_unit-terminal-claim-0001",
    claimId:1,runId:"unit-owner-run",stepId:"implement",storyId:"US-001",generation:1,fenceToken:"a".repeat(64),
    attemptClass:"evidence_only",packetHash:"b".repeat(64),compilationReportHash:"c".repeat(64),sliceHash:"d".repeat(64),
    sourceBefore:{sha:"1".repeat(40),treeHash:"2".repeat(40)},role:"evidence-orchestrator",agentId:"setfarm-evidence-orchestrator",
    lease:{acquiredAt:now,heartbeatAt:now,expiresAt:expires},disposition:"verified",evidenceRefs:["setfarm://claim-log/1"],createdAt:now,updatedAt:now});
  f.setSqlHook(query=>{
    if(query==="SELECT clock_timestamp() AS wall_clock")return [{wall_clock:new Date(clock)}];
    if(query.includes("SELECT attempt.disposition,"))return [{disposition:"verified",claim_id:"1",delivery_attempt_id:attempt.attemptId,
      delivery_claim_id:"1",delivery_lease_expires_at:new Date(expires),outcome:null,run_status:"running",run_protocol:"v3",run_packet_hash:"b".repeat(64)}];
    if(/^\s*UPDATE claim_log/.test(query))return [{id:"1"}];
    return undefined;
  });
  const publication=await component("../../src/recovery/v3-evidence-only-publication.ts",{
    "./v3-owner-recovery-authority-v1.js":f.authority,
    "../db-pg.js":{resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1:async()=>{clock="2026-11-07T00:01:01.000Z";return {};},closeInternalProductionOwnerReservationV1:async()=>{}},
  });
  await assert.rejects(publication.createV3EvidenceOnlyPublication(f.restricted,f.access).completeClaim({attempt,diagnostic:"fixture",lease:{
    runId:"unit-owner-run",storyId:"US-001",dispatchId:"unit-dispatch",revisionId:"unit-revision",recoveryCaseId:"unit-case",
    ownerInstanceId:"unit-owner",leaseToken:"unit-token",packetHash:"b".repeat(64),
  }}),/RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.equal(f.commits,0);assert.equal(f.role,"setrox");
});

async function freshProducerAdmissionFixture(f:Awaited<ReturnType<typeof ownerRepositoryFixture>>,afterVerification?:()=>void) {
  const [{readFileSync},ts]=await Promise.all([import("node:fs"),import("typescript")]);
  const file=new URL("../../src/db-pg.ts",import.meta.url),source=readFileSync(file,"utf8");
  const tree=ts.default.createSourceFile(file.pathname,source,ts.default.ScriptTarget.ESNext,true);
  const declaration=tree.statements.find(n=>ts.default.isFunctionDeclaration(n)&&n.name?.text==="requireWorkflowRunAdmissionReadyV1");
  assert.ok(declaration);
  const hash="a".repeat(64),node={receipt:{phase:"A",orderedPlans:["A"],orderedManifestHashes:[hash]},head:{headRef:"fixture-head"}};
  const resolution={nodes:[node],current:{receipt:node.receipt,head:node.head}};
  const selected={activation:{prepared:{current:resolution.current}},state:{},assertUnchanged(){}};
  const modes:string[]=[];
  const ports={freshInstallationSelectionV1:selected,requireSelectedFreshDatabaseV1(){},
    WORKFLOW_RUN_MANIFEST_A_HASH_V1:hash,INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1:{manifestHash:hash},
    sameJsonValueV1:(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),ownerAuthority:f.authority,
    verifier:{verifyFreshInstallationActivatedDatabaseOnTransactionV1:async(_tx:unknown,_activation:unknown,_base:unknown,mode:string)=>{
      modes.push(mode);
      if(mode!==(f.role==="sf_owner_fixture"?"owner":"runtime"))throw Error("FRESH_INSTALLATION_ACTIVATED_DATABASE_UNVERIFIED");
      await Promise.resolve();afterVerification?.();
    }}};
  // Fixed dynamic module imports are the disclosed external verifier/authority
  // boundaries. The actual admission function and actual WeakMaps execute.
  const body=declaration.getText(tree)
    .replace('await import("./installation/fresh-installation-activation-verifier-v1.js")','await Promise.resolve(verifier)')
    .replace('await import("./recovery/v3-owner-recovery-authority-v1.js")','await Promise.resolve(ownerAuthority)');
  const compiled=ts.default.transpileModule(body,{compilerOptions:{module:ts.default.ModuleKind.ESNext,target:ts.default.ScriptTarget.ES2022}}).outputText;
  const requireAdmission=new Function(...Object.keys(ports),compiled+";return requireWorkflowRunAdmissionReadyV1;")(...Object.values(ports));
  return {run:()=>requireAdmission(f.transaction,resolution),modes};
}

it("fresh producer admission verifies an actually entered owner transaction as owner",async()=>{
  const f=await ownerRepositoryFixture("terminal"),admission=await freshProducerAdmissionFixture(f);
  await f.authority.enterOwnerRecoveryTransactionV1(f.transaction,f.access);
  await admission.run();
  assert.deepEqual(admission.modes,["owner"]);
});

it("fresh producer admission keeps unowned runtime and forged owner-like transactions on runtime verification",async()=>{
  const ordinary=await ownerRepositoryFixture("terminal"),runtime=await freshProducerAdmissionFixture(ordinary);
  await ordinary.restricted.begin(()=>runtime.run());assert.deepEqual(runtime.modes,["runtime"]);
  const forged=await ownerRepositoryFixture("terminal"),admission=await freshProducerAdmissionFixture(forged);
  Object.assign(forged.transaction,{owner:true,ownerRecoveryFence:Object.freeze({})});
  await forged.transaction.unsafe('SET LOCAL ROLE "sf_owner_fixture"');
  await assert.rejects(admission.run(),/FRESH_INSTALLATION_ACTIVATED_DATABASE_UNVERIFIED/);
  assert.deepEqual(admission.modes,["runtime"]);
});

it("fresh producer admission refuses a closed registered owner rather than falling back to runtime",async()=>{
  const f=await ownerRepositoryFixture("terminal"),admission=await freshProducerAdmissionFixture(f);
  await f.authority.enterOwnerRecoveryTransactionV1(f.transaction,f.access);
  f.authority.closeOwnerRecoveryAccessV1(f.access);
  await assert.rejects(admission.run(),/RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.deepEqual(admission.modes,[]);
});

it("fresh producer admission revalidates a registered owner lease after the verifier await",async()=>{
  const f=await ownerRepositoryFixture("heartbeat"),admission=await freshProducerAdmissionFixture(f,()=>f.expireLease());
  await f.authority.enterOwnerRecoveryTransactionV1(f.transaction,f.access);
  await f.authority.pinOwnerRecoveryDeliveryLeaseV1(f.transaction,{dispatchId:"unit-dispatch",revisionId:"unit-revision",ownerInstanceId:"unit-owner",leaseToken:"unit-token"});
  await assert.rejects(admission.run(),/RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.deepEqual(admission.modes,["owner"]);
});

// Mutation caught: acquireNext leases as owner, then its exact joined row-lock
// read escapes back to the restricted client and cannot hand work to the caller.
async function routedWorkOwnerFixture(options: Readonly<{
  ordinary?: boolean; missing?: boolean; wrongHandoff?: boolean; expired?: boolean;
  closeAfterRowWait?: boolean; loseLeaseBeforeCommit?: boolean;
}> = {}) {
  const f = await ownerRepositoryFixture("claim");
  const claimModule = await import("../../src/recovery/v3-recovery-claim-authority.js");
  const candidate = { run_id: "unit-owner-run", story_id: "US-001", story_db_id: "story-db",
    step_db_id: "step-db", dispatch_id: "RDISP_" + "1".repeat(64) };
  const handoff = claimModule.V3RecoveryClaimHandoffV1Schema.parse({
    schema: "setfarm.v3-recovery-claim-handoff.v1", status: "lease_acquired",
    runId: candidate.run_id, storyId: candidate.story_id, recoveryCaseId: "RCV_" + "2".repeat(64),
    revisionId: "RREV_" + "3".repeat(64), dispatchId: candidate.dispatch_id,
    dispatchClass: "product_implementation", recoveryOwner: "implement",
    lease: { ownerInstanceId: "unit-spawner", leaseToken: "owned-nonsecret-fixture-token", expiresAt: "2026-11-07T00:10:00.000Z" },
    directive: { packetHash: "a".repeat(64), contractSliceHash: "b".repeat(64),
      sourceRevision: { sha: "1".repeat(40), treeHash: "2".repeat(40) }, findingSetHash: "c".repeat(64),
      findingIds: ["FIND_" + "d".repeat(64)], expectedDelta: { kind: "source_change", invariantRefs: ["INV_UNIT_OBSERVABLE"], requiredPaths: ["src/App.tsx"] },
      allowedPaths: ["src/App.tsx"], evidencePlan: ["EVID_UNIT_OBSERVABLE"] },
    reservationBoundary: { leaseAndAttemptAtomicInThisModule: false, state: "lease_acquired_attempt_not_reserved",
      reconcileRequired: true, requiredNextOperation: "attempt_repository.reserve_exact_recovery_handoff" },
  });
  const row = { ...candidate, step_workflow_id: "implement", step_agent_id: "feature-dev_developer", step_index: 5,
    step_input_template: "owned input", step_type: "loop", step_loop_config: null, step_status: "running",
    step_current_story_id: null, step_retry_count: 0, step_output: null,
    story_index: 0, story_title: "Owned story", story_description: "Owned description", story_acceptance_criteria: "[]",
    story_status: "failed", story_output: "canonical failure", story_retry_count: 0, story_max_retries: 2,
    story_abandoned_count: 0, story_claimed_by: null, story_claimed_at: null, story_claim_generation: 1,
    story_started_at: null, story_depends_on: null, story_scope_files: "[]", story_shared_files: null,
    story_scope_targets: null, story_requested_dependencies: null, story_shared_edit_requests: null,
    story_resolved_scope_files: null, story_scope_description: null, story_file_skeletons: null,
    story_implementation_contract: null, story_screens: null, story_branch: null, story_pr_url: null,
    story_merge_status: null, story_quality_failure_fingerprint: null,
    story_created_at: "2026-11-07T00:00:00.000Z", story_updated_at: "2026-11-07T00:00:00.000Z" };
  let acquired = false, admitted = false, exactReads = 0, leaseChecks = 0;
  const readRoles: string[] = [];
  f.setSqlHook((query, values) => {
    if (query.includes("FOR UPDATE OF delivery SKIP LOCKED")) {
      assert.equal(f.role, "sf_runtime_fixture", "discovery keeps the restricted client");
      return [candidate];
    }
    if (query.includes("FOR KEY SHARE OF run_row, story_row, step_row, recovery_case, revision, dispatch, delivery")) {
      exactReads++; readRoles.push(f.role);
      assert.ok(acquired && admitted);
      assert.deepEqual(values, ["feature-dev", candidate.run_id, candidate.story_db_id, candidate.story_id,
        candidate.step_db_id, "product_implementation", candidate.dispatch_id, handoff.lease.ownerInstanceId,
        handoff.lease.leaseToken, handoff.lease.expiresAt]);
      if (!options.ordinary && f.role !== "sf_owner_fixture") throw Error("permission denied for table recovery_revision_dispatches");
      if (options.closeAfterRowWait) f.authority.closeOwnerRecoveryAccessV1(f.access);
      return options.missing ? [] : [row];
    }
    if (query.includes("AS valid") && query.includes("delivery.lease_expires_at")) {
      leaseChecks++;
      if (options.loseLeaseBeforeCommit && leaseChecks === 2) return [{ valid: false }];
    }
    if (options.expired && query.includes("SELECT clock_timestamp()")) return [{ wall_clock: new Date("2026-11-07T00:11:00.000Z") }];
    return undefined;
  });
  const routerModule = await component("../../src/recovery/v3-recovery-work-router.ts", {
    "./v3-owner-recovery-authority-v1.js": f.authority,
    "./v3-recovery-claim-authority.js": { ...claimModule,
      createV3RecoveryClaimAuthority: (_sql: unknown, access: unknown) => ({ acquireRecoveryClaim: async () => {
        assert.ok(admitted);
        assert.equal(access, options.ordinary ? undefined : f.access);
        if (!options.ordinary) await f.writer.begin(async (tx: unknown) => {
          const fence = await f.authority.enterOwnerRecoveryTransactionV1(tx, f.access);
          await f.authority.assertOwnerRecoveryTransactionBeforeCommitV1(tx, fence);
        });
        acquired = true;
        return options.wrongHandoff ? { ...handoff, dispatchId: "RDISP_" + "9".repeat(64) } : handoff;
      } }),
    },
  });
  const router = routerModule.createV3RecoveryWorkRouter(f.restricted, { admitCandidate: async (value: unknown) => {
    assert.deepEqual(value, { runId: candidate.run_id, storyId: candidate.story_id, storyDbId: candidate.story_db_id,
      stepDbId: candidate.step_db_id, dispatchId: candidate.dispatch_id });
    assert.equal(f.role, "setrox", "candidate policy runs after discovery and before owner BEGIN"); admitted = true;
  } }, options.ordinary ? undefined : f.access);
  return { f, handoff, readRoles, get acquired() { return acquired; }, get exactReads() { return exactReads; },
    get leaseChecks() { return leaseChecks; }, run: () => router.acquireNext({
      workflowId: "feature-dev", dispatchClass: "product_implementation", ownerInstanceId: "unit-spawner" }) };
}

it("router retains owner transaction for exact routed work after its acquired owner lease", async () => {
  const f = await routedWorkOwnerFixture();
  const work = await f.run();
  assert.deepEqual(work.handoff, f.handoff);
  assert.equal(work.story.id, "story-db");
  assert.deepEqual(f.readRoles, ["sf_owner_fixture"]);
  assert.equal(f.leaseChecks, 2, "exact lease is pinned and revalidated before commit");
  assert.equal(f.f.role, "setrox");
});

it("unselected router keeps its ordinary exact routed-work transaction", async () => {
  const f = await routedWorkOwnerFixture({ ordinary: true });
  assert.deepEqual((await f.run()).handoff, f.handoff);
  assert.deepEqual(f.readRoles, ["sf_runtime_fixture"]);
  assert.equal(f.f.commits, 0);
});

it("router rejects a different acquired handoff before reading routed work", async () => {
  const f = await routedWorkOwnerFixture({ wrongHandoff: true });
  await assert.rejects(f.run(), /V3_RECOVERY_WORK_ROUTER_HANDOFF_MISMATCH/);
  assert.equal(f.acquired, true);
  assert.equal(f.exactReads, 0);
});

it("router refuses missing exact rows after lease acquisition", async () => {
  const f = await routedWorkOwnerFixture({ missing: true });
  await assert.rejects(f.run(), /V3_RECOVERY_WORK_ROUTER_POST_LEASE_IDENTITY_MISMATCH/);
  assert.equal(f.leaseChecks, 0);
});

it("router refuses a handoff expired at its canonical post-lock database clock", async () => {
  const f = await routedWorkOwnerFixture({ expired: true });
  await assert.rejects(f.run(), /V3_RECOVERY_WORK_ROUTER_POST_LEASE_IDENTITY_MISMATCH/);
  assert.equal(f.leaseChecks, 0);
});

it("router refuses owner access closed during the exact row-lock wait", async () => {
  const f = await routedWorkOwnerFixture({ closeAfterRowWait: true });
  await assert.rejects(f.run(), /RECOVERY_OWNER_AUTHORITY_REFUSED/);
});

it("router refuses its pinned delivery lease lost before post-lock transaction commit", async () => {
  const f = await routedWorkOwnerFixture({ loseLeaseBeforeCommit: true });
  await assert.rejects(f.run(), /RECOVERY_OWNER_AUTHORITY_REFUSED/);
  assert.equal(f.leaseChecks, 2);
});
