import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const RUNNER=new URL('../run-evidence-tests.mjs',import.meta.url);
const ROOT=new URL('../../',import.meta.url);
const OWNER='accepted-candidate-repository.test.ts';
const PURE=[
  'accepted-candidate-v1.test.ts','candidate-invocation-evidence-v2.test.ts',
  'canonical-evidence-runner.test.ts','command-runner-v2.test.ts',
  'evidence-adapter-definition-catalog-v2.test.ts','evidence-adapter-registry-v1.test.ts',
  'evidence-plan-v1.test.ts','evidence-receipt-v2.test.ts','implement-prompt-runtime-abi.test.ts',
  'invocation-evidence-evaluator-v2.test.ts','invocation-evidence-runner-execution-v2.test.ts',
  'invocation-runner-abi-v2.test.ts','observable-outcomes-v1.test.ts',
  'produced-predicate-semantics.test.ts','runtime-evidence-contract-producer-v1.test.ts',
  'stack-runtime-evidence-driver.test.ts','supported-profile-evidence-plan.test.ts',
];
const entries=()=>[OWNER,...PURE].map(name=>({name,source:name===OWNER
  ?'import {createIsolatedTestDatabase} from "../execution-attempts/test-database.js";'
  :'import assert from "node:assert/strict";'}));
const isolated=['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
  '--import','tsx','--test','--test-concurrency=1','tests/evidence/'+OWNER];
async function planner(){
  assert.ok(existsSync(RUNNER),'evidence owner dispatcher implementation missing');
  return (await import(RUNNER.href)).planEvidenceTestsV1;
}

test('evidence planner dispatches seventeen raw files and one genuine P3 file exactly once',async()=>{
  const plan=await planner();
  assert.deepEqual(plan(entries()),[
    ['--import','tsx','--test',...PURE.map(name=>'tests/evidence/'+name)],isolated,
  ]);
});
for(const [name,change] of [
  ['unknown file',list=>[...list,{name:'new-database.test.ts',source:''}]],
  ['missing owner',list=>list.filter(row=>row.name!==OWNER)],
  ['missing raw file',list=>list.filter(row=>row.name!==PURE[0])],
  ['duplicate file',list=>[...list,list[0]]],
  ['pure direct DB import',list=>list.map(row=>row.name===PURE[0]
    ?{...row,source:'import "../execution-attempts/test-database.js";'}:row)],
  ['pure direct TypeScript DB import',list=>list.map(row=>row.name===PURE[0]
    ?{...row,source:'import "../execution-attempts/test-database.ts";'}:row)],
])test('evidence planner refuses '+name+' before dispatch',async()=>{
  const plan=await planner();assert.throws(()=>plan(change(entries())),/EVIDENCE_TEST_/);
});
test('evidence explicit pure subset never creates a P3 activation',async()=>{
  const plan=await planner();
  assert.deepEqual(plan(entries(),['tests/evidence/'+PURE[0],PURE[0]]),[
    ['--import','tsx','--test','tests/evidence/'+PURE[0]],
  ]);
  assert.deepEqual(plan(entries(),[OWNER]),[isolated]);
  assert.throws(()=>plan(entries(),['../findings/repository.test.ts']),/EVIDENCE_TEST_/);
});

function npmEdge(firstStatus=0){
  // Only the actual dispatcher child boundary is intercepted. The old default
  // raw owner route is stopped in preload BEFORE tsx/test/DB imports.
  const preload=`
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const owner='tests/evidence/accepted-candidate-repository.test.ts';
if(process.argv.some(arg=>arg===owner||arg.endsWith('/'+owner)))throw Error('EVIDENCE_DEFAULT_RAW_OWNER_DISPATCH');
if(process.argv[1]?.endsWith('/scripts/run-evidence-tests.mjs')){
  let count=0;
  cp.spawnSync=(tool,args,options)=>{
    if(tool!==process.execPath||options.env.SETFARM_PG_URL!==undefined||options.stdio!=='inherit')throw Error('EVIDENCE_TEST_BOUNDARY_DRIFT');
    console.log('EVIDENCE_TEST_DISPATCH:'+JSON.stringify(args));
    return {status:++count===1?${firstStatus}:0,signal:null};
  };
  syncBuiltinESMExports();
}
`;
  return spawnSync('npm',['run','test:evidence','--silent'],{
    cwd:ROOT,encoding:'utf8',timeout:15000,maxBuffer:65536,
    env:{PATH:process.env.PATH??'',LANG:'C',LC_ALL:'C',
      SETFARM_PG_URL:'postgresql://invalid.example/not-connected',
      NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(preload).toString('base64')},
  });
}
function commands(result){return result.stdout.split('\n').filter(line=>line.startsWith('EVIDENCE_TEST_DISPATCH:'))
  .map(line=>JSON.parse(line.slice('EVIDENCE_TEST_DISPATCH:'.length)));}
test('actual default npm evidence edge routes the owner through P3 without duplicate raw execution',()=>{
  const r=npmEdge();assert.equal(r.error,undefined);assert.equal(r.signal,null);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.deepEqual(commands(r),[['--import','tsx','--test',...PURE.map(name=>'tests/evidence/'+name)],isolated]);
});
test('actual default evidence edge stops after its first failing test child',()=>{
  const r=npmEdge(7);assert.equal(r.error,undefined);assert.equal(r.signal,null);
  assert.equal(r.status,7,r.stdout+r.stderr);assert.equal(commands(r).length,1);
});
