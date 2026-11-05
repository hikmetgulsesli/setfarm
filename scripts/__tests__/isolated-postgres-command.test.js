import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {transformSync} from 'esbuild';

const MODULE=new URL('../run-isolated-postgres-tests.ts',import.meta.url);
const PREFIX=Object.freeze(['node','--import','tsx','--test','--test-concurrency=1']);
const FIXED=Object.freeze([...PREFIX,'--test-name-pattern=^cold pre32 catalog rejects unjournaled relations and orphan routines or triggers without writes$','tests/findings/repository.test.ts']);
function extractedParts(){
  const source=readFileSync(MODULE,'utf8');
  const marker='function commandArguments(): string[] {';
  assert.equal(source.split(marker).length,2,'one genuine internal parser');
  const start=source.indexOf(marker),end=source.indexOf('\nfunction git(',start);
  assert.ok(end>start,'bounded pure function, no main import');
  const parser=source.slice(start,end);
  const constants=source.split('\n').filter(line=>line.startsWith('const P3_RECOVERY_LIFECYCLE_TEST_FILE_V1 =')
    ||line.startsWith('const P3_RECOVERY_LIFECYCLE_TEST_SHARDS_V1 =')).join('\n');
  assert.equal(constants.split('\n').length,2,'genuine recovery constants');
  const shardStart=source.indexOf('  const testShards = '),shardEnd=source.indexOf(';\n',shardStart);
  assert.ok(shardStart>=0&&shardEnd>shardStart,'bounded genuine recovery comparison');
  return {parser,recovery:constants+'\n'+source.slice(shardStart,shardEnd+1)};
}
function evaluate(source,globals){
  const rendered=transformSync(source,{loader:'ts',format:'cjs',target:'es2022'}).code;
  const context={...globals};runInNewContext(rendered,context,{timeout:1000});
  return Array.from(context.result);
}
function command(value,{separator=true}={}){
  const {parser}=extractedParts();
  return evaluate(parser+'\nglobalThis.result=commandArguments();',{
    process:{argv:['node','isolated-fixture',...(separator?['--']:[]),...value]},path,
  });
}
function shards(value){
  const {recovery}=extractedParts();
  return evaluate(recovery+'\nglobalThis.result=testShards;',{command:value});
}
test('isolated command preserves original six-cell grammar and genuine recovery shard selection',()=>{
  for(const filename of ['tests/findings/repository.test.ts',
    'tests/findings/v3-recovery-lifecycle-reconciler.test.ts','tests/execution-attempts/run-termination.test.ts']){
    const value=[...PREFIX,filename];assert.deepEqual(command(value),value);
  }
  assert.deepEqual(shards(command([...PREFIX,'tests/findings/v3-recovery-lifecycle-reconciler.test.ts'])),['0/3','1/3','2/3']);
  assert.deepEqual(shards(command([...PREFIX,'tests/findings/repository.test.ts'])),[undefined]);
});
test('isolated command accepts only the literal cold-pre32 selector and retains all seven actual cells',()=>{
  const actual=command(FIXED);assert.deepEqual(actual,Array.from(FIXED));assert.equal(actual.length,7);
  assert.equal(actual.at(-1),'tests/findings/repository.test.ts');assert.deepEqual(shards(actual),[undefined]);
});
test('isolated command rejects changed selectors files flags extras and invalid old paths before effects',()=>{
  const variants=FIXED.map((cell,index)=>FIXED.map((value,i)=>i===index?cell+' changed':value));
  variants.push([...FIXED,'extra'],FIXED.slice(0,-1),[...PREFIX,'--test-name-pattern=^cold pre32$','tests/findings/repository.test.ts'],
    [...PREFIX,FIXED[5].slice(0,-1),'tests/findings/repository.test.ts'],
    [...PREFIX,'--test-name-pattern=.*','tests/findings/repository.test.ts'],
    [...PREFIX,FIXED[5],FIXED[5],'tests/findings/repository.test.ts'],
    [...PREFIX,'tests/findings/repository.test.ts','--extra'],
    [...PREFIX,'/tmp/repository.test.ts'],[...PREFIX,'../repository.test.ts'],
    [...PREFIX,'--test-name-pattern=.*']);
  for(const value of variants)assert.throws(()=>command(value),/ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE/);
  assert.throws(()=>command(FIXED,{separator:false}),/ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE/);
});

const NATIVE_REVIEW=Object.freeze([...PREFIX,'--test-name-pattern=native review R[1-7]',
  'tests/execution-attempts/native-implementation-join.integration.test.ts']);
function privatePlan(input){
  const source=readFileSync(new URL('../run-private-postgres-tests.mjs',import.meta.url),'utf8');
  const marker='export function planPrivatePostgresTestsV1({root,port,mode}={}){';
  assert.equal(source.split(marker).length,2,'one genuine private plan');
  const start=source.indexOf(marker),end=source.indexOf('\nexport function createPrivateTestOutputRedactorV1(',start);
  assert.ok(end>start,'bounded pure plan, no module import or main effects');
  const actual=source.slice(start,end).replace(/^export /,'');
  const context={input};
  runInNewContext(actual+'\nglobalThis.result=planPrivatePostgresTestsV1(input);',context,{timeout:1000});
  return context.result;
}
test('native implementation review plan is closed and preserves the full-suite vector and cluster controls',()=>{
  const input={root:'/tmp/setfarm-task6a-pg.Abc123',port:55439};
  const full=privatePlan({...input,mode:'native-implementation-join'});
  const review=privatePlan({...input,mode:'native-implementation-review'});
  assert.deepEqual(Array.from(full.test),['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
    ...PREFIX,'tests/execution-attempts/native-implementation-join.integration.test.ts']);
  assert.deepEqual(Array.from(review.test),['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',...NATIVE_REVIEW]);
  assert.deepEqual(Array.from(review.initdb),Array.from(full.initdb));
  assert.deepEqual(Array.from(review.server),Array.from(full.server));
  assert.ok(Object.isFrozen(review)&&Object.isFrozen(review.test));
  for(const mode of ['native-implementation-review extra','NATIVE-IMPLEMENTATION-REVIEW',
    'native-implementation-review;echo denied','--test-name-pattern=native review R[1-7]'])
    assert.throws(()=>privatePlan({...input,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  for(const overrides of [{port:5432},{port:1023},{port:65536},{root:'/tmp/arbitrary'},
    {root:input.root+'/child'}])
    assert.throws(()=>privatePlan({...input,...overrides,mode:'native-implementation-review'}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
});
test('native implementation review accepts the exact seven-cell vector without recovery shards',()=>{
  const input={root:'/tmp/setfarm-task6a-pg.Abc123',port:55439,mode:'native-implementation-review'};
  const plan=privatePlan(input);
  const actual=command(Array.from(plan.test).slice(4));
  assert.deepEqual(actual,Array.from(NATIVE_REVIEW));
  assert.deepEqual(shards(actual),[undefined]);
  assert.deepEqual(command([...PREFIX,NATIVE_REVIEW.at(-1)]),[...PREFIX,NATIVE_REVIEW.at(-1)]);
});
test('native implementation review rejects changed patterns files extra flags and multiple files',()=>{
  const variants=NATIVE_REVIEW.map((cell,index)=>NATIVE_REVIEW.map((value,i)=>i===index?cell+' changed':value));
  variants.push([...NATIVE_REVIEW,'extra'],NATIVE_REVIEW.slice(0,-1),
    [...PREFIX,'--test-name-pattern=.*',NATIVE_REVIEW.at(-1)],
    [...PREFIX,'--test-name-pattern=^native review R[1-7]$',NATIVE_REVIEW.at(-1)],
    [...PREFIX,'--test-name-pattern=native review R[1-8]',NATIVE_REVIEW.at(-1)],
    [...PREFIX,NATIVE_REVIEW[5],'tests/findings/repository.test.ts'],
    [...NATIVE_REVIEW,'tests/findings/repository.test.ts'],
    [...PREFIX,'--test-only',NATIVE_REVIEW[5],NATIVE_REVIEW.at(-1)],
    [...PREFIX,NATIVE_REVIEW[5],NATIVE_REVIEW[5],NATIVE_REVIEW.at(-1)]);
  for(const value of variants)assert.throws(()=>command(value),/ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE/);
  assert.throws(()=>command(NATIVE_REVIEW,{separator:false}),/ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE/);
});
