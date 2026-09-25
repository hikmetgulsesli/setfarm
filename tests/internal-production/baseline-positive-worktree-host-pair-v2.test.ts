import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createLegacyFindingPublicationInventoryValueV1 } from "../../src/findings/legacy-finding-publication-inventory-v1.js";
import { observePositiveWorktreeHostPairWithPortsV2,
  observePositiveWorktreePre32HostPairWithPortsV4 } from "../../src/internal-production/baseline-positive-worktree-host-pair-v2.js";

function catalog(blockedRoot: string) {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-physical-catalog.v2" as const,
    status: "unresolved" as const,
    observerPidExcluded: 1234,
    entries: Object.freeze([]),
    absentBases: Object.freeze([]),
    incidentalFiles: Object.freeze([]),
    blockers: Object.freeze([Object.freeze({ root: blockedRoot, reason: "prunable-git-worktree" })]),
  });
  return Object.freeze({ ...body, catalogHash: hashCanonicalJson(body) });
}

function database() {
  const body = Object.freeze({
    schema: "setfarm.internal-production-positive-worktree-active-rows.v2" as const,
    authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    activeRuns: Object.freeze([]),
    openClaims: Object.freeze([]),
    activeAttempts: Object.freeze([]),
    activeSessions: Object.freeze([]),
    counts: Object.freeze({ runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 }),
  });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

function pre32(activeRows = database()) {
  const legacyCensus = Object.freeze({ activeRunCount: 0, openClaimCount: 0, executionAttemptCount: 0,
    activeRuntimeSessionCount: 0, activeCompletionOwnerCount: 0, unsettledMandatoryEffectCount: 0,
    artifactReservationCount: 0, publicationBatchCount: 0, artifactPublicationCount: 0,
    terminationOwnerCount: 0, findingOwnerCount: 0, recoveryOwnerCount: 0, operationalDeliveryCount: 0,
    legacyFindingPublicationInventory: createLegacyFindingPublicationInventoryValueV1([]) });
  const body = Object.freeze({ schema: "setfarm.internal-production-pre32-active-owner-snapshot.v4" as const,
    authority: "diagnostic-only" as const, legacyCensus, activeRows });
  return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
}

test("V4 pairs the complete pre32 snapshot inside one held physical callback without filtering blockers", async () => {
  const events: string[] = [];
  let calls = 0;
  const physical = catalog("/retained/prunable");
  const combined = pre32();
  const result = await observePositiveWorktreePre32HostPairWithPortsV4(async (betweenPasses) => {
    events.push("physical-first");
    await betweenPasses();
    events.push("physical-second");
    return physical;
  }, async () => { calls += 1; events.push("database"); return combined; });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(calls, 1);
  assert.equal(result.schema, "setfarm.internal-production-pre32-physical-database-pair.v4");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.heldPair.physicalCatalog, physical);
  assert.deepEqual(result.heldPair.physicalCatalog.blockers, physical.blockers);
  assert.equal(result.pre32Database, combined);
  assert.equal(result.heldPair.databaseSnapshot, combined.activeRows);
  const { pairHash, ...body } = result;
  assert.equal(pairHash, hashCanonicalJson(body));
  assert.equal(Object.isFrozen(result), true);
});

test("V4 refuses malformed combined evidence, extra callback and DB failure", async () => {
  const held = async (betweenPasses: () => Promise<void>) => {
    await betweenPasses(); return catalog("/retained/prunable");
  };
  const valid = pre32();
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => Object.freeze({ ...valid, snapshotHash: "a".repeat(64) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => Object.freeze({ ...valid, extra: true })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  const falseRows = Object.freeze({ ...valid.activeRows, snapshotHash: "b".repeat(64) });
  const falseRowsBody = { schema: valid.schema, authority: valid.authority,
    legacyCensus: valid.legacyCensus, activeRows: falseRows };
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => Object.freeze({ ...falseRowsBody, snapshotHash: hashCanonicalJson(falseRowsBody) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  const nonzeroBody = { schema: valid.schema, authority: valid.authority,
    legacyCensus: Object.freeze({ ...valid.legacyCensus, activeRunCount: 1 }), activeRows: valid.activeRows };
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => Object.freeze({ ...nonzeroBody, snapshotHash: hashCanonicalJson(nonzeroBody) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  const crossedRowsBody = { schema: valid.activeRows.schema, authority: valid.activeRows.authority,
    physicalIdentityProvenance: valid.activeRows.physicalIdentityProvenance,
    activeRuns: valid.activeRows.activeRuns, openClaims: valid.activeRows.openClaims,
    activeAttempts: valid.activeRows.activeAttempts, activeSessions: valid.activeRows.activeSessions,
    counts: Object.freeze({ ...valid.activeRows.counts, runCount: 1 }) };
  const crossedRows = Object.freeze({ ...crossedRowsBody, snapshotHash: hashCanonicalJson(crossedRowsBody) });
  const crossedBody = { schema: valid.schema, authority: valid.authority,
    legacyCensus: valid.legacyCensus, activeRows: crossedRows };
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => Object.freeze({ ...crossedBody, snapshotHash: hashCanonicalJson(crossedBody) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID/);
  let calls = 0;
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(async () => catalog("/retained/prunable"),
    async () => { calls += 1; return valid; }), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  assert.equal(calls, 0);
  let releaseLate: ((value: ReturnType<typeof pre32>) => void) | undefined;
  const late = new Promise<ReturnType<typeof pre32>>((resolve) => { releaseLate = resolve; });
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(async (betweenPasses) => {
    void betweenPasses();
    return catalog("/retained/prunable");
  }, async () => late), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  releaseLate!(valid);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(async (betweenPasses) => {
    await betweenPasses();
    try { await betweenPasses(); } catch { /* Faulty observer swallows callback refusal. */ }
    return catalog("/retained/prunable");
  }, async () => valid), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreePre32HostPairWithPortsV4(held,
    async () => { throw Error("DB_LOST"); }), /DB_LOST/);
});

test("zero-input V4 composition keeps the launcher held and closes on physical refusal", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pre32-host-pair-")));
  try {
    const original = new URL("../../src/internal-production/baseline-positive-worktree-host-pair-v2.ts", import.meta.url);
    let source = fs.readFileSync(original, "utf8");
    const physical = path.join(root, "physical.mjs");
    const workspace = path.join(root, "workspace.mjs");
    const launcher = path.join(root, "launcher.mjs");
    fs.writeFileSync(physical, `export async function observeHeldPositiveWorktreePhysicalCatalogV2(scope,callback){
      if(!scope.ownerHomeRoot||!scope.workspaceRoot)throw Error('SCOPE_MISSING');
      globalThis.events.push('physical-first');
      if(process.env.FAKE_FIRST_FAILURE==='1')throw Error('PRIVATE_PHYSICAL_FIRST');
      try{await callback()}catch{throw Error('PHYSICAL_WRAPPED_DB')}
      globalThis.events.push('physical-second');
      if(process.env.FAKE_PHYSICAL_FAILURE==='1'){
        if(process.env.FAKE_PHYSICAL_POINT==='1'||process.env.FAKE_BAD_POINT==='1'||process.env.FAKE_CROSSED_POINT==='1'){
          const error=Error('INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID');
          const point=Object.freeze({schema:'setfarm.internal-production-positive-worktree-physical-refusal-point.v1',
            operation:process.env.FAKE_CROSSED_POINT==='1'?'candidate-lsof':'candidate-recheck-lsof',
            candidateOrdinal:process.env.FAKE_BAD_POINT==='1'?999:3});
          Object.defineProperty(error,'physicalFailurePoint',{value:point});throw Object.freeze(error);
        }
        throw Error('PHYSICAL_DRIFT');
      }
      if(process.env.FAKE_PAIR_FAILURE==='1')return Object.freeze({...globalThis.catalog,catalogHash:'a'.repeat(64)});
      return globalThis.catalog;
    }`);
    fs.writeFileSync(workspace, `export const resolveInternalProductionBaselineWorkspaceRootV1=()=>'/fixture/ai/setrox';`);
    fs.writeFileSync(launcher, `export function holdDeploymentCutoverDefaultLauncherV1(){
      globalThis.events.push('launcher-acquire');
      return {qualifyPassiveHome:async()=>{globalThis.events.push('qualified');
          if(process.env.FAKE_QUALIFY_FAILURE==='1')throw Error('PRIVATE_QUALIFY')},
        recheck:()=>{globalThis.events.push('recheck');
          if(process.env.FAKE_POSTCHECK_FAILURE==='1'&&globalThis.events.filter(x=>x==='recheck').length===2)throw Error('PRIVATE_POSTCHECK')},
        censusAndActiveRows:async()=>{globalThis.events.push('database');
          if(process.env.FAKE_DATABASE_FAILURE==='1')throw Error('PRIVATE_DATABASE_PASSWORD');return globalThis.combined},
        close:()=>{globalThis.events.push('close');if(process.env.FAKE_CLOSE_FAILURE==='1')throw Error('PRIVATE_CLOSE')}};
    }`);
    for (const [specifier, replacement] of [
      ["../product-compiler/canonical-json.js", new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href],
      ["../findings/legacy-finding-publication-inventory-v1.js", new URL("../../src/findings/legacy-finding-publication-inventory-v1.ts", import.meta.url).href],
      ["./baseline-positive-worktree-physical-catalog-v2.js", pathToFileURL(physical).href],
      ["./baseline-workspace-authority-path-v1.js", pathToFileURL(workspace).href],
      ["./baseline-deployment-cutover-launcher-observation-v1.js", pathToFileURL(launcher).href],
    ]) {
      assert.ok(source.includes(specifier), specifier);
      source = source.replaceAll(specifier, replacement);
    }
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "host-pair.ts"); fs.writeFileSync(file, source);
    const script = `
      globalThis.events=[];
      const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
      globalThis.catalog=freeze(${JSON.stringify(catalog("/retained/prunable"))});
      globalThis.combined=freeze(${JSON.stringify(pre32())});
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});
      let result,error,phase,hasCause,physicalPoint;
      try{result=await module.observeCodeOwnedPositiveWorktreePre32HostPairV4()}catch(caught){
        error=caught.message;phase=Object.getOwnPropertyDescriptor(caught,'pre32PairPhase')?.value;
        hasCause=Object.hasOwn(caught,'cause');physicalPoint=Object.getOwnPropertyDescriptor(caught,'pre32PhysicalPoint')?.value}
      process.stdout.write(JSON.stringify({schema:result?.schema,blockers:result?.heldPair.physicalCatalog.blockers,
        error,phase,hasCause,physicalPoint,events:globalThis.events}));
    `;
    const success = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
      { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(success.status, 0, success.stderr);
    assert.deepEqual(JSON.parse(success.stdout), { schema: "setfarm.internal-production-pre32-physical-database-pair.v4",
      blockers: [{ root: "/retained/prunable", reason: "prunable-git-worktree" }],
      events: ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second",
        "recheck", "close"] });
    const refused = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
      { encoding: "utf8", timeout: 15000, env: { FAKE_PHYSICAL_FAILURE: "1" } });
    assert.equal(refused.status, 0, refused.stderr);
    assert.deepEqual(JSON.parse(refused.stdout), { error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID",
      phase: "physical-second-pass", hasCause: false,
      events: ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second", "close"] });
    for (const [env, expectedPoint] of [
      [{ FAKE_PHYSICAL_FAILURE: "1", FAKE_PHYSICAL_POINT: "1" }, {
        schema: "setfarm.internal-production-positive-worktree-physical-refusal-point.v1",
        operation: "candidate-recheck-lsof", candidateOrdinal: 3,
      }],
      [{ FAKE_PHYSICAL_FAILURE: "1", FAKE_BAD_POINT: "1" }, undefined],
      [{ FAKE_PHYSICAL_FAILURE: "1", FAKE_CROSSED_POINT: "1" }, undefined],
    ] as const) {
      const observed = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 15000, env });
      assert.equal(observed.status, 0, observed.stderr);
      assert.deepEqual(JSON.parse(observed.stdout), { error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID",
        phase: "physical-second-pass", hasCause: false, ...(expectedPoint ? { physicalPoint: expectedPoint } : {}),
        events: ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second", "close"] });
    }
    for (const [env, phase, events] of [
      [{ FAKE_QUALIFY_FAILURE: "1" }, "passive-qualification", ["launcher-acquire", "qualified", "close"]],
      [{ FAKE_FIRST_FAILURE: "1" }, "physical-first-pass", ["launcher-acquire", "qualified", "recheck", "physical-first", "close"]],
      [{ FAKE_DATABASE_FAILURE: "1" }, "database-callback", ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "close"]],
      [{ FAKE_PAIR_FAILURE: "1" }, "pair-validation", ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second", "close"]],
      [{ FAKE_POSTCHECK_FAILURE: "1" }, "post-pair-recheck", ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second", "recheck", "close"]],
      [{ FAKE_PHYSICAL_FAILURE: "1", FAKE_CLOSE_FAILURE: "1" }, "launcher-cleanup", ["launcher-acquire", "qualified", "recheck", "physical-first", "database", "physical-second", "close"]],
    ] as const) {
      const observed = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 15000, env });
      assert.equal(observed.status, 0, observed.stderr);
      assert.deepEqual(JSON.parse(observed.stdout), { error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID",
        phase, hasCause: false, events });
      assert.doesNotMatch(observed.stdout, /PRIVATE_/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("database evidence is captured inside the held physical interval without hiding unresolved blockers", async () => {
  const events: string[] = [];
  let databaseCalls = 0;
  const physical = catalog("/Users/setrox/projects/example/.worktrees/missing");
  const rows = database();
  const pair = await observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    events.push("physical-first");
    await betweenPasses();
    events.push("physical-second");
    return physical;
  }, async () => {
    databaseCalls += 1;
    events.push("database");
    return rows;
  });
  assert.deepEqual(events, ["physical-first", "database", "physical-second"]);
  assert.equal(databaseCalls, 1);
  assert.equal(pair.schema, "setfarm.internal-production-positive-worktree-host-pair.v2");
  assert.equal(pair.authority, "diagnostic-only");
  assert.equal(pair.physicalIdentityProvenance, "unverified");
  assert.equal(pair.physicalCatalog, physical);
  assert.equal(pair.databaseSnapshot, rows);
  assert.deepEqual(pair.physicalCatalog.blockers, [
    { root: "/Users/setrox/projects/example/.worktrees/missing", reason: "prunable-git-worktree" },
  ]);
  assert.deepEqual(pair.databaseSnapshot.counts, { runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 });
  assert.match(pair.pairHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(pair), true);

  const changed = await observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return catalog("/Users/setrox/projects/example/.worktrees/another-missing");
  }, async () => database());
  assert.notEqual(pair.pairHash, changed.pairHash);
});

test("a second callback cannot produce a pair with two database epochs", async () => {
  let calls = 0;
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    await betweenPasses();
    return catalog("/missing");
  }, async () => { calls += 1; return database(); }),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  assert.equal(calls, 1);
});

test("a physical observer cannot swallow a duplicate callback error and return a pair", async () => {
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    try { await betweenPasses(); } catch { /* Simulate an observer swallowing a callback error. */ }
    return catalog("/missing");
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("a well-formed but false producer hash cannot be paired", async () => {
  const physical = catalog("/missing");
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return Object.freeze({ ...physical, catalogHash: "a".repeat(64) });
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  const rows = database();
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => Object.freeze({ ...rows, snapshotHash: "b".repeat(64) })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("mutable nested producer evidence refuses before pairHash can become stale", async () => {
  const original = catalog("/missing");
  const mutableBlockers = [{ root: "/missing", reason: "prunable-git-worktree" }];
  const body = { schema: original.schema, status: original.status,
    observerPidExcluded: original.observerPidExcluded, entries: original.entries,
    absentBases: original.absentBases, incidentalFiles: original.incidentalFiles,
    blockers: mutableBlockers };
  const mutable = { ...body, catalogHash: hashCanonicalJson(body) };
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return mutable;
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
});

test("missing callback and early physical return refuse rather than pairing late database rows", async () => {
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async () => catalog("/missing"),
    async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  let release: ((value: ReturnType<typeof database>) => void) | undefined;
  const late = new Promise<ReturnType<typeof database>>((resolve) => { release = resolve; });
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    void betweenPasses();
    return catalog("/missing");
  }, async () => late), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  release!(database());
});

test("late database rejection after early physical return is handled, not orphaned", async () => {
  let rejectLate: ((reason: Error) => void) | undefined;
  const late = new Promise<ReturnType<typeof database>>((_resolve, reject) => { rejectLate = reject; });
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    void betweenPasses();
    return catalog("/missing");
  }, async () => late), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  rejectLate!(new Error("late-database-loss"));
  await new Promise<void>((resolve) => setImmediate(resolve));
});

test("malformed producer labels and observer errors never become empty evidence", async () => {
  const physical = catalog("/missing");
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return Object.freeze({ ...physical, schema: "wrong-schema" as typeof physical.schema });
  }, async () => database()), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  const rows = database();
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => Object.freeze({ ...rows, authority: "cutover" as typeof rows.authority })),
  /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID/);
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async () => {
    throw new Error("physical-lost");
  }, async () => rows), /physical-lost/);
  await assert.rejects(observePositiveWorktreeHostPairWithPortsV2(async (betweenPasses) => {
    await betweenPasses();
    return physical;
  }, async () => { throw new Error("database-lost"); }), /database-lost/);
});

test("importing the fixture module does not load runtime environment configuration", () => {
  const script = `const before = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    await import("./src/internal-production/baseline-positive-worktree-host-pair-v2.js");
    const after = JSON.stringify(Object.keys(process.env).sort().map(k => [k, process.env[k]]));
    process.exitCode = before === after ? 0 : 91;`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: process.cwd(), env: { ...process.env, PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(child.status, 0);
});
