import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const owner = new URL("../deployment-cutover-default-context.mjs", import.meta.url);
function run(fault = "") {
  assert.ok(fs.existsSync(owner), "default owning composition must exist");
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-default-owner-")));
  try {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.mkdirSync(path.join(root, "dist/internal-production"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    fs.writeFileSync(path.join(root, "scripts/deployment-cutover-default-context.mjs"), fs.readFileSync(owner));
    for (const [file, name, kind] of [
      ["scripts/build-generation-retention.mjs", "holdSelectedSetfarmDeploymentBuildV1", "selected"],
      ["scripts/deployment-cutover-retained-profile.mjs", "holdDeploymentCutoverRetainedProfileV1", "retained"],
      ["dist/internal-production/baseline-deployment-cutover-env-absence-v1.js", "holdDeploymentCutoverDefaultEnvAbsenceV1", "absence"],
      ["dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js", "holdDeploymentCutoverDefaultLauncherV1", "launcher"],
      ["dist/internal-production/baseline-deployment-cutover-helper-observation-v1.js", "holdDeploymentCutoverAbsentHelperHistoryV1", "helper"],
    ]) fs.writeFileSync(path.join(root, file), `export const ${name}=()=>globalThis.hold(${JSON.stringify(kind)});`);
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
      const root=${JSON.stringify(root)},fault=${JSON.stringify(fault)},events=[],home=root+'/home';
      const identity=os.userInfo();os.userInfo=()=>{if(fault==='account')throw Error('PRIVATE_SENTINEL');return {...identity,homedir:home}};syncBuiltinESMExports();
      const cli={cliLinkPath:home+'/.local/bin/setfarm',checkoutPath:root+'/old',cliLinkObservationHash:'cli'};
      const observations={helper:{accountHome:home,accountUid:identity.uid,accountGid:identity.gid},selected:{selectedDeploymentObservationHash:'selected',cli,buildSource:{sha:'source'}},
        retained:{selectedDeploymentObservationHash:'selected',sourceSha:'source',profileHash:'profile'},
        absence:{cliObservationHash:'cli',selectedCheckoutPath:cli.checkoutPath,currentCheckoutPath:root,
          candidates:[root+'/old',root,home+'/.openclaw/setfarm'].flatMap(base=>['.env','.env.local'].map(name=>({path:base+'/'+name})))},
        launcher:{accountHome:home,uid:identity.uid,gid:identity.gid,launchers:[{launchArguments:[cli.cliLinkPath,'spawner','start']},{launchArguments:[cli.cliLinkPath,'dashboard','start','--port','3333']}]}};
      if(fault==='selected-cross')observations.retained.selectedDeploymentObservationHash='crossed';
      if(fault==='cli-cross')observations.absence.cliObservationHash='crossed';
      if(fault==='home-cross')observations.launcher.accountHome=home+'/crossed';
      if(fault==='helper-home-cross')observations.helper.accountHome=home+'/crossed';
      if(fault==='root-cross')observations.absence.currentCheckoutPath=root+'/crossed';
      if(fault==='candidate-cross')observations.absence.candidates[0].path+='.crossed';
      if(fault==='launcher-cli-cross')observations.launcher.launchers[0].launchArguments[0]+='.crossed';
      let sampled=false,queried=false,closed=[],checkCount=0;
      globalThis.hold=kind=>{if(fault.startsWith('acquire-cleanup-')&&kind==='launcher'){const error=Error('PRIVATE_SENTINEL');Object.defineProperty(error,'cutoverCleanupFailed',
        fault==='acquire-cleanup-accessor'?{get(){process.stdout.write('PRIVATE_SENTINEL');throw Error('PRIVATE_SENTINEL')}}:{value:['acquire-cleanup-loss','acquire-cleanup-retry'].includes(fault)?true:fault==='acquire-cleanup-false'?false:'PRIVATE_SENTINEL'});throw error}
        if((fault==='partial-acquire'&&kind==='absence')||fault==='acquire-'+kind)throw Error('PRIVATE_SENTINEL');events.push('hold:'+kind);return {observation:observations[kind],
        recheck(){events.push('check:'+kind);if(kind==='selected')checkCount++;if((fault==='prequalify'&&checkCount===2||fault==='final-recheck'&&checkCount===5)||(fault==='sample-drift'&&sampled||fault==='db-drift'&&queried)&&kind==='absence'||fault==='helper-drift'&&sampled&&kind==='helper')throw Error('PRIVATE_SENTINEL')},
        close(){events.push('close:'+kind);closed.push(kind);if(['close-loss','close-retry','sample-close-loss'].includes(fault)&&kind==='launcher'||fault==='acquire-cleanup-outer-loss'&&kind==='absence')throw Error('PRIVATE_SENTINEL')},
        resolveModules(){events.push('resolve');if(fault==='resolution')throw Error('PRIVATE_SENTINEL');return {profileHash:fault==='resolution-cross'?'crossed':'profile',selectedDeploymentObservationHash:'selected',contexts:[{home:'account'},{home:'absent'}]}},
        async qualifyPassiveHome(){events.push('sample');await Promise.resolve();sampled=true;if(['sample','sample-close-loss'].includes(fault))throw Error('PRIVATE_SENTINEL');
          if(fault.startsWith('launcher-stage-')){const error=Error('PRIVATE_SENTINEL');Object.defineProperty(error,'cutoverLauncherStage',
            fault==='launcher-stage-accessor'?{get(){process.stdout.write('PRIVATE_SENTINEL');throw Error('PRIVATE_SENTINEL')}}:{value:fault==='launcher-stage-valid'?'measure':fault.startsWith('launcher-stage-sampled-')?fault.slice('launcher-stage-'.length):'PRIVATE_SENTINEL'});throw error}
          return {samples:[],processObservation:{families:[],listener:null}}},
        async census(){events.push('db');await Promise.resolve();queried=true;if(fault==='db')throw Error('PRIVATE_SENTINEL');return {activeRunCount:fault==='nonzero'?1:fault==='malformed-count'?'0':0,openClaimCount:0,executionAttemptCount:0,activeRuntimeSessionCount:0,activeCompletionOwnerCount:0,unsettledMandatoryEffectCount:0,artifactReservationCount:0,publicationBatchCount:0,artifactPublicationCount:0,terminationOwnerCount:0,findingOwnerCount:0,recoveryOwnerCount:0,operationalDeliveryCount:0,legacyFindingPublicationInventory:{entries:[]}}}
      }};
      try{const module=await import(${JSON.stringify(`file://${root}/scripts/deployment-cutover-default-context.mjs`)});
        if(fault==='concurrent'){
          const results=await Promise.allSettled([module.observeDeploymentCutoverDefaultContextV1(),module.observeDeploymentCutoverDefaultContextV1()]);
          process.stdout.write(JSON.stringify({states:results.map(item=>item.status),events,closed}));process.exit(0);
        }
        if(['close-retry','acquire-cleanup-retry'].includes(fault)){
          let refusals=0;const diagnostics=[];for(let index=0;index<2;index++)try{await module.observeDeploymentCutoverDefaultContextV1()}catch(error){if(error.message!=='DEPLOYMENT_CUTOVER_DEFAULT_CONTEXT_REFUSED')throw error;refusals++;diagnostics.push(error.cutoverRefusal)}
          process.stdout.write(JSON.stringify({refusals,diagnostics,events,closed}));process.exit(0);
        }
        const value=await module.observeDeploymentCutoverDefaultContextV1(...(fault==='input'?[{}]:[]));
        process.stdout.write(JSON.stringify({value,events,closed}));
      }catch(error){process.stdout.write(JSON.stringify({error:String(error),diagnostic:error.cutoverRefusal,events,closed}))}
    `], { encoding: "utf8", env: {}, timeout: 15000 });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("default owner holds all conjunctions across sample and database awaits", () => {
  const result = run();
  assert.equal(result.value?.schema, "setfarm.internal-production-deployment-cutover-default-context.v1", JSON.stringify(result));
  assert.ok(result.events.indexOf("resolve") < result.events.indexOf("sample"));
  assert.ok(result.events.indexOf("sample") < result.events.indexOf("db"));
  for (const kind of ["selected", "retained", "absence", "launcher", "helper"]) {
    assert.ok(result.events.indexOf(`hold:${kind}`) < result.events.indexOf("sample"));
    assert.ok(result.events.lastIndexOf(`check:${kind}`) > result.events.indexOf("db"));
    assert.ok(result.events.indexOf(`close:${kind}`) > result.events.indexOf("db"));
  }
  assert.equal(result.closed.length, 5);
  assert.ok(result.value.blockers.includes("controller-ownership-not-acquired"));
  assert.ok(result.value.blockers.includes("filesystem-helper-phase-zero-owner-not-observed"));
});
for (const [fault, stage, ownerContext] of [["helper-home-cross", "crossbind", "bind"], ["helper-drift", "postqualify", "helper"], ["acquire-helper", "acquire-helper", null]]) {
  test(`helper owner ${fault} refuses before database census`, () => {
    const result = run(fault);
    assert.equal(result.value, undefined);
    assert.deepEqual(result.diagnostic, { scope: "default-owner", stage, ownerContext, launcherStage: null, cleanupFailed: fault === "acquire-helper" ? null : false });
    assert.equal(result.events.includes("db"), false);
  });
}
for (const fault of ["input", "selected-cross", "cli-cross", "home-cross", "root-cross", "candidate-cross", "launcher-cli-cross", "partial-acquire", "resolution", "resolution-cross", "sample", "sample-drift", "db", "db-drift", "close-loss", "malformed-count"]) {
  test(`default owner ${fault} refuses and drains without secret output`, () => {
    const result = run(fault);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_DEFAULT_CONTEXT_REFUSED/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
    assert.equal(result.value, undefined);
    if (!["db", "db-drift", "close-loss", "malformed-count"].includes(fault)) assert.equal(result.events.includes("db"), false);
    assert.equal(result.closed.length, result.events.filter(event => event.startsWith("hold:")).length);
  });
}
test("default owner reports nonzero census as a blocker, never as zero-owner", () => {
  const result = run("nonzero");
  assert.ok(result.value?.blockers.includes("database-nonzero-owner-observed"), JSON.stringify(result));
});
test("default owner concurrent call cannot acquire a second set of resources", () => {
  const result = run("concurrent");
  assert.deepEqual(result.states, ["fulfilled", "rejected"]);
  assert.equal(result.closed.length, 5);
  assert.equal(result.events.filter(event => event === "db").length, 1);
});
test("default owner close uncertainty refuses a fresh call before acquiring anything", () => {
  const result = run("close-retry");
  assert.equal(result.refusals, 2);
  assert.equal(result.closed.length, 5);
  assert.equal(result.events.filter(event => event.startsWith("hold:")).length, 5);
  assert.equal(result.diagnostics[1].stage, "entry");
  assert.equal(result.diagnostics[1].cleanupFailed, true);
  assert.equal(result.diagnostics[1].ownerContext, null);
});

for (const [fault, stage, ownerContext = null] of [["input", "entry"], ["account", "account"], ["acquire-selected", "acquire-selected"], ["acquire-retained", "acquire-retained"],
  ["acquire-launcher", "acquire-launcher"], ["partial-acquire", "acquire-absence"], ["selected-cross", "crossbind", "bind"], ["prequalify", "prequalify", "selected"], ["final-recheck", "final-recheck", "selected"],
  ["resolution", "resolve"], ["resolution-cross", "resolution-bind"], ["sample", "qualify"],
  ["sample-drift", "postqualify", "absence"], ["db", "census"], ["db-drift", "postcensus", "absence"],
  ["malformed-count", "census-shape"], ["close-loss", "cleanup"]]) {
  test(`default owner reports only finite refusal stage for ${fault}`, () => {
    const result = run(fault);
    assert.deepEqual(result.diagnostic, { scope: "default-owner", stage, ownerContext, launcherStage: null, cleanupFailed: stage.startsWith("acquire-") ? null : fault === "close-loss" });
    assert.doesNotMatch(JSON.stringify(result.diagnostic), /PRIVATE_SENTINEL|\/home|stack|cause/);
  });
}

test("default owner preserves original refusal when cleanup also fails", () => {
  const result = run("sample-close-loss");
  assert.deepEqual(result.diagnostic, { scope: "default-owner", stage: "qualify", ownerContext: null, launcherStage: null, cleanupFailed: true });
  assert.deepEqual(result.closed, ["helper", "launcher", "absence", "retained", "selected"]);
  assert.equal(result.events.includes("db"), false);
});
test("default owner propagates nested acquisition cleanup loss before the holder returns", () => {
  const result = run("acquire-cleanup-loss");
  assert.deepEqual(result.diagnostic, { scope: "default-owner", stage: "acquire-launcher", ownerContext: null, launcherStage: null, cleanupFailed: true });
  assert.deepEqual(result.closed, ["absence", "retained", "selected"]);
  assert.equal(result.events.includes("db"), false);
});
for (const kind of ["accessor", "false", "unknown"]) test(`default owner cannot certify nested cleanup through ${kind}`, () => {
  const result = run(`acquire-cleanup-${kind}`);
  assert.deepEqual(result.diagnostic, { scope: "default-owner", stage: "acquire-launcher", ownerContext: null, launcherStage: null, cleanupFailed: null });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
});
test("default owner outer cleanup failure overrides unknown nested cleanup", () => {
  const result = run("acquire-cleanup-outer-loss");
  assert.deepEqual(result.diagnostic, { scope: "default-owner", stage: "acquire-launcher", ownerContext: null, launcherStage: null, cleanupFailed: true });
  assert.deepEqual(result.closed, ["absence", "retained", "selected"]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
});
test("default owner retains nested cleanup failure on reentry before reacquiring", () => {
  const result = run("acquire-cleanup-retry");
  assert.equal(result.refusals, 2);
  assert.deepEqual(result.diagnostics.map(value => [value.stage, value.cleanupFailed]), [["acquire-launcher", true], ["entry", true]]);
  assert.deepEqual(result.closed, ["absence", "retained", "selected"]);
  assert.equal(result.events.filter(event => event.startsWith("hold:")).length, 3);
});
for (const kind of ["valid", "accessor", "unknown", "sampled-snapshot", "sampled-generation", "sampled-native", "sampled-bind", "sampled-postcheck"]) test(`default owner sanitizes launcher ${kind} stage`, () => {
  const result = run(`launcher-stage-${kind}`);
  assert.deepEqual(result.diagnostic, { scope: "default-owner", stage: "qualify", ownerContext: null, launcherStage: kind === "valid" ? "measure" : kind.startsWith("sampled-") ? kind : null, cleanupFailed: false });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
  assert.equal(result.events.includes("db"), false);
});
