import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OWNER='accepted-candidate-repository.test.ts';
const PURE=new Set([
  'accepted-candidate-v1.test.ts','candidate-invocation-evidence-v2.test.ts',
  'canonical-evidence-runner.test.ts','command-runner-v2.test.ts',
  'evidence-adapter-definition-catalog-v2.test.ts','evidence-adapter-registry-v1.test.ts',
  'evidence-plan-v1.test.ts','evidence-receipt-v2.test.ts','implement-prompt-runtime-abi.test.ts',
  'invocation-evidence-evaluator-v2.test.ts','invocation-evidence-runner-execution-v2.test.ts',
  'invocation-runner-abi-v2.test.ts','observable-outcomes-v1.test.ts',
  'produced-predicate-semantics.test.ts','runtime-evidence-contract-producer-v1.test.ts',
  'stack-runtime-evidence-driver.test.ts','supported-profile-evidence-plan.test.ts',
]);
const PREFIX='tests/evidence/';

export function planEvidenceTestsV1(entries,requested=[]){
  if(!Array.isArray(entries)||!Array.isArray(requested))throw Error('EVIDENCE_TEST_INPUT_INVALID');
  const names=new Set();
  for(const entry of entries){
    if(!entry||typeof entry.name!=='string'||typeof entry.source!=='string')throw Error('EVIDENCE_TEST_ENTRY_INVALID');
    if(names.has(entry.name))throw Error('EVIDENCE_TEST_DUPLICATE');
    if(entry.name!==OWNER&&!PURE.has(entry.name))throw Error('EVIDENCE_TEST_UNCLASSIFIED');
    if(PURE.has(entry.name)&&(entry.source.includes('../execution-attempts/test-database.js')
      ||entry.source.includes('../execution-attempts/test-database.ts')))throw Error('EVIDENCE_TEST_PURE_DATABASE_FIXTURE');
    names.add(entry.name);
  }
  for(const required of [OWNER,...PURE])if(!names.has(required))throw Error('EVIDENCE_TEST_FILE_MISSING');
  const selected=requested.length?requested.map(locator=>{
    if(typeof locator!=='string')throw Error('EVIDENCE_TEST_UNKNOWN');
    const name=locator.startsWith(PREFIX)?locator.slice(PREFIX.length):locator;
    if(!names.has(name))throw Error('EVIDENCE_TEST_UNKNOWN');
    return name;
  }):[...names];
  const unique=[...new Set(selected)].sort(),commands=[];
  const raw=unique.filter(name=>PURE.has(name));
  if(raw.length)commands.push(['--import','tsx','--test',...raw.map(name=>PREFIX+name)]);
  if(unique.includes(OWNER))commands.push([
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',PREFIX+OWNER,
  ]);
  return commands;
}

function main(){
  const directory=path.join(ROOT,'tests/evidence');
  const entries=readdirSync(directory,{withFileTypes:true})
    .filter(entry=>entry.isFile()&&entry.name.endsWith('.test.ts'))
    .map(entry=>({name:entry.name,source:readFileSync(path.join(directory,entry.name),'utf8')}));
  const commands=planEvidenceTestsV1(entries,process.argv.slice(2));
  for(const command of commands){
    const env={...process.env};delete env.SETFARM_PG_URL;
    const result=spawnSync(process.execPath,command,{cwd:ROOT,env,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.signal)throw Error('EVIDENCE_TEST_CHILD_SIGNAL:'+result.signal);
    if(result.status!==0){process.exitCode=result.status??1;return;}
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
