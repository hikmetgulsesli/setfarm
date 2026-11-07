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
