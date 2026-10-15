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
