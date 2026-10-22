import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {chmodSync,closeSync,constants,fstatSync,lstatSync,mkdtempSync,openSync,
  readFileSync,readSync,readlinkSync,realpathSync,statfsSync,writeFileSync} from 'node:fs';
import {userInfo} from 'node:os';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import postgres from 'postgres';
import {verifyFindingPrivateClusterIdentityV1} from './finding-test-preflight.mjs';
import {createPrivateTestJournalV1,createPrivateTestTerminalMirrorV1} from './private-postgres-test-journal-v1.mjs';
import {MANUAL_ORPHAN_VECTOR_V1,holdManualOrphanOwnedSourcesV1,
  observeManualOrphanOwnedChildV1,observeManualOrphanProcessV1,
  canonicalizeManualOrphanClusterBaselineV1,encodeManualOrphanRunnerSetupFrameV1,
  decodeManualOrphanRunnerResultV1} from '../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const PG='/opt/homebrew/opt/postgresql@17/bin/';

export function planPrivatePostgresTestsV1({root,port,mode}={}){
  if(typeof root!=='string'||!/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/.test(root)
    ||!Number.isInteger(port)||port<1024||port>65535||port===5432
    ||!['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal','after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt','migration33-observers','migration33-adjacent-full','manual-orphan-bootstrap'].includes(mode))throw Error('PRIVATE_TEST_CLUSTER_PLAN_INVALID');
  return Object.freeze({
    initdb:Object.freeze([
      '-D',root+'/data','--username=postgres','--auth-host=scram-sha-256',
      '--auth-local=scram-sha-256','--pwfile='+root+'/password','--encoding=UTF8',
      '--locale=C','--no-clean','--no-instructions',
    ]),
    server:Object.freeze([
      '-D',root+'/data','-h','127.0.0.1','-p',String(port),'-k',root,
      '-c','unix_socket_permissions=0700','-c','shared_buffers=32MB',
      '-c','max_connections=50',
    ]),
    test:Object.freeze(mode==='manual-orphan-bootstrap'?[
      '--import','tsx','scripts/run-isolated-postgres-tests.ts','--',...MANUAL_ORPHAN_VECTOR_V1,
    ]:mode==='migration33-adjacent-full'?[
      '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
      '--import','tsx','--test','--test-concurrency=1',
      'tests/execution-attempts/migrations.test.ts',
    ]:mode==='migration33-observers'?[
      '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
      '--import','tsx','--test','--test-concurrency=1',
      'tests/execution-attempts/migration33-current-entry-observers.test.ts',
    ]:mode==='receipt'?[
      '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
      '--import','tsx','--test','--test-concurrency=1',
      'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts',
    ]:mode==='readonly-verifiers'?[
      '--import','tsx','--test','--test-concurrency=1',
      'tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',
      'tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts',
    ]:['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      ...(mode==='findings'?['run','test:findings']:mode==='after-scripts'?['run','test:after-scripts']:mode==='after-terminal'?['run','test:after-terminal']:mode==='after-findings'?['run','test:after-findings']:mode==='after-internal-pure'?['run','test:after-internal-pure']:mode==='after-local-custody'?['run','test:after-local-custody']:mode==='after-cutover'?['run','test:after-cutover']:mode==='after-receipt'?['run','test:after-receipt']:['test'])]),
  });
}

export function createPrivateTestOutputRedactorV1(secrets){
  if(!Array.isArray(secrets)||!secrets.length
    ||secrets.some(value=>typeof value!=='string'||!value.length||value.length>4096)){
    throw Error('PRIVATE_TEST_REDACTOR_SECRET_INVALID');
  }
  const needles=[...new Set(secrets)].map(value=>Buffer.from(value))
    .sort((left,right)=>right.length-left.length);
  const longest=needles[0].length,replacement=Buffer.from('[REDACTED]');
  let pending=Buffer.alloc(0),closed=false;
  function consume(final){
    const pieces=[];
    const limit=final?pending.length:Math.max(0,pending.length-longest+1);
    let cursor=0,start=0;
    while(cursor<limit){
      const match=needles.find(needle=>pending.subarray(cursor,cursor+needle.length).equals(needle));
      const partial=final&&!match&&needles.some(needle=>{
        const suffix=pending.subarray(cursor);
        return suffix.length<needle.length&&needle.subarray(0,suffix.length).equals(suffix);
      });
      if(match||partial){
        pieces.push(pending.subarray(start,cursor),replacement);
        cursor+=match?match.length:pending.length-cursor;start=cursor;
      }else cursor++;
    }
    pieces.push(pending.subarray(start,cursor));
    pending=Buffer.from(pending.subarray(cursor));
    return Buffer.concat(pieces);
  }
  return Object.freeze({
    write(chunk){
      if(closed)throw Error('PRIVATE_TEST_REDACTOR_CLOSED');
      if(!Buffer.isBuffer(chunk))throw Error('PRIVATE_TEST_REDACTOR_INPUT_INVALID');
      pending=Buffer.concat([pending,chunk]);return consume(false);
    },
    end(){
      if(closed)throw Error('PRIVATE_TEST_REDACTOR_CLOSED');
      closed=true;return consume(true);
    },
  });
}

export function attachPrivateTestChildJournalV1(child,role,secrets,journal,mirrors){
  if(!['initdb','server','test'].includes(role))throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
  function observed(stage,fields){journal.control(stage,fields);}
  const pid=()=>Number.isSafeInteger(child.pid)&&child.pid>0?child.pid:null;
  child.once('error',()=>observed('child-error',{childRole:role,reason:'PRIVATE_TEST_CLUSTER_REFUSED'}));
  child.once('exit',(code,signal)=>observed('child-exit',{childRole:role,pid:pid(),code,signal}));
  child.once('close',(code,signal)=>observed('child-close',{childRole:role,pid:pid(),code,signal}));
  for(const channel of ['stdout','stderr']){
    const input=child[channel],redactor=createPrivateTestOutputRedactorV1(secrets);
    if(!input||typeof input.on!=='function'||typeof input.once!=='function'){
      journal.burn('journal-input');
      observed('stream-error',{childRole:role,channel,reason:'PRIVATE_TEST_CLUSTER_REFUSED'});
      continue;
    }
    let flushed=false,ended=false;
    function persist(buffer){
      if(buffer.length&&journal.output(role,channel,buffer))mirrors[channel].write(buffer);
    }
    function flush(){if(!flushed){flushed=true;persist(redactor.end());}}
    function failed(){
      journal.burn('journal-input');
      observed('stream-error',{childRole:role,channel,reason:'PRIVATE_TEST_CLUSTER_REFUSED'});
      try{flush();}catch{journal.burn('journal-input');}
    }
    input.on('data',chunk=>{
      if(flushed)return;
      try{persist(redactor.write(chunk));}catch{failed();}
    });
    input.once('end',()=>{
      ended=true;
      try{flush();observed('stream-end',{childRole:role,channel});}catch{failed();}
    });
    input.once('error',failed);input.once('close',()=>{if(!ended)failed();});
  }
}

export function observeOwnedPrivateTestChildV1(child){
  let exited=false,closed=false,failed=false,result=null,exitResult=null;
  let complete;
  const completion=new Promise(resolve=>{complete=resolve;});
  child.once('error',()=>{failed=true;});
  child.once('exit',(code,signal)=>{
    exited=true;exitResult=Object.freeze({code,signal});
  });
  child.once('close',(code,signal)=>{
    closed=true;result=Object.freeze({code,signal});complete(result);
  });
  return Object.freeze({
    get exited(){return exited;},get closed(){return closed;},get failed(){return failed;},
    get result(){return result;},get exitResult(){return exitResult;},completion,
    signal(signal){
      if(exited||closed||failed)return false;
      try{return child.kill(signal)===true;}catch{return false;}
    },
  });
}

export async function settleOwnedPrivatePostgresV1(witness,timeoutMs){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return false;
  if(!witness.exited&&!witness.closed&&!witness.signal('SIGINT'))return false;
  let timer;
  try{
    if(!witness.closed)await Promise.race([
      witness.completion,new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);}),
    ]);
    return witness.closed&&witness.exited&&!witness.failed
      &&witness.result.code===0&&witness.result.signal===null
      &&witness.exitResult.code===0&&witness.exitResult.signal===null;
  }finally{clearTimeout(timer);}
}

export function verifyPrivateTestClusterQuiescenceV1(databases,backends,pid){
  return Array.isArray(databases)&&databases.length===3
    &&[...databases].sort().join(',')==='postgres,template0,template1'
    &&Number.isSafeInteger(pid)&&pid>0&&Array.isArray(backends)
    &&backends.length===1&&backends[0]===pid;
}

export function watchPrivateTestCancellationV1(emitter){
  let cancelled=false,resolve;
  const cancellation=new Promise(done=>{resolve=done;});
  function cancel(){cancelled=true;resolve();}
  emitter.once('SIGINT',cancel);emitter.once('SIGTERM',cancel);
  return Object.freeze({
    get cancelled(){return cancelled;},
    run(promise){return Promise.race([promise,cancellation.then(()=>{
      throw Error('PRIVATE_TEST_CLUSTER_CANCELLED');
    })]);},
    dispose(){emitter.removeListener('SIGINT',cancel);emitter.removeListener('SIGTERM',cancel);},
  });
}

export async function racePrivateTestDeadlineV1(promise,timeoutMs){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000){
    throw Error('PRIVATE_TEST_CLUSTER_DEADLINE_INVALID');
  }
  const started=performance.now();let timer;
  try{
    const result=await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('PRIVATE_TEST_CLUSTER_DEADLINE')),timeoutMs);
    })]);
    if(performance.now()-started>=timeoutMs)throw Error('PRIVATE_TEST_CLUSTER_DEADLINE');
    return result;
  }finally{clearTimeout(timer);}
}

function scrubEnvironment(){
  return {
    PATH:path.dirname(process.execPath)+':/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    LANG:'C',LC_ALL:'C',TSX_DISABLE_CACHE:'1',
    ...(process.env.HOME===undefined?{}:{HOME:process.env.HOME}),
    GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',
    GIT_CONFIG_COUNT:'0',GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/usr/bin/false',
  };
}
function preconditions(){
  if(Object.keys(process.env).some(name=>name.startsWith('PG'))){
    throw Error('PRIVATE_TEST_CLUSTER_AMBIENT_PG_FORBIDDEN');
  }
  if(process.platform!=='darwin'||process.getuid()!==501||process.geteuid()!==501
    ||process.getgid()!==20||process.getegid()!==20||Number(process.versions.node.split('.')[0])<26
    ||process.env.NODE_OPTIONS!==undefined||process.env.NODE_PATH!==undefined){
    throw Error('PRIVATE_TEST_CLUSTER_HOST_INVALID');
  }
  const space=statfsSync('/tmp',{bigint:true});
  if(space.bavail*space.bsize<4n*1024n**3n)throw Error('PRIVATE_TEST_CLUSTER_DISK_LOW');
  const env=scrubEnvironment();
  const status=execFileSync('/usr/bin/git',['status','--porcelain=v1','--untracked-files=all'],
    {cwd:ROOT,env,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
  if(status!=='')throw Error('PRIVATE_TEST_CLUSTER_SOURCE_DIRTY');
  for(const tool of ['initdb','postgres']){
    if(!lstatSync(PG+tool).isFile())throw Error('PRIVATE_TEST_CLUSTER_TOOL_INVALID');
    const version=execFileSync(PG+tool,['--version'],
      {env,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
    if(!version.match(/\(PostgreSQL\) 17\.[0-9]+/))throw Error('PRIVATE_TEST_CLUSTER_TOOL_INVALID');
  }
  const npm='/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js';
  if(!lstatSync(npm).isFile()||!readFileSync(npm).length)throw Error('PRIVATE_TEST_CLUSTER_TOOL_INVALID');
  return env;
}
async function reservePort(){
  const socket=net.createServer();
  await new Promise((resolve,reject)=>{
    socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);
  });
  const port=socket.address().port;
  await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
  return port;
}
function capturedChild(tool,args,env){
  return {child:spawn(tool,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe']}),witness:null};
}
async function boundedClose(witness,timeoutMs){
  let timer;
  try{
    if(!witness.closed)await Promise.race([witness.completion,
      new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);})]);
    return witness.closed;
  }finally{clearTimeout(timer);}
}
function definiteNormalClose(witness){
  return witness&&witness.closed&&witness.exited&&!witness.failed
    &&Number.isInteger(witness.result.code)&&witness.result.signal===null
    &&witness.exitResult.code===witness.result.code&&witness.exitResult.signal===null;
}
function unrefOwned(owned){
  if(!owned)return;
  owned.child.stdout?.destroy();owned.child.stderr?.destroy();owned.child.unref();
}
async function clusterIdentity(admin,url,dataDirectory,server){
  const deadline=performance.now()+30000;
  while(performance.now()<deadline){
    if(server.witness.closed||server.witness.exited||server.witness.failed){
      throw Error('PRIVATE_TEST_CLUSTER_SERVER_UNAVAILABLE');
    }
    try{
      const rows=await admin`SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,current_setting('unix_socket_directories') AS socket_directories,
        current_setting('listen_addresses') AS listen_addresses,
        current_setting('password_encryption') AS password_encryption,
        current_setting('unix_socket_permissions') AS socket_permissions`;
      if(rows.length!==1)throw Error('PRIVATE_TEST_CLUSTER_IDENTITY_INVALID');
      verifyFindingPrivateClusterIdentityV1(url,dataDirectory,rows[0]);
      if(rows[0].listen_addresses!=='127.0.0.1'||rows[0].password_encryption!=='scram-sha-256'
        ||rows[0].socket_directories!==path.dirname(dataDirectory)||rows[0].socket_permissions!=='0700'){
        throw Error('PRIVATE_TEST_CLUSTER_IDENTITY_INVALID');
      }
      return;
    }catch(error){
      if(error.code!=='ECONNREFUSED'&&error.code!=='57P03'&&error.code!=='CONNECTION_CLOSED'){
        throw Error('PRIVATE_TEST_CLUSTER_IDENTITY_INVALID');
      }
    }
    await delay(100);
  }
  throw Error('PRIVATE_TEST_CLUSTER_READINESS_TIMEOUT');
}
async function quiescence(admin,journal){
  for(let sample=0;sample<2;sample++){
    const rows=await admin`SELECT pg_backend_pid() AS pid,
      (SELECT array_agg(datname ORDER BY datname) FROM pg_database) AS databases,
      (SELECT array_agg(pid ORDER BY pid) FROM pg_stat_activity
        WHERE pid=pg_backend_pid() OR backend_type IS NULL OR backend_type NOT IN (
          'autovacuum launcher','autovacuum worker','background writer',
          'checkpointer','walwriter','logical replication launcher'
        ) OR client_addr IS NOT NULL) AS backends`;
    const passed=rows.length===1&&verifyPrivateTestClusterQuiescenceV1(rows[0].databases,rows[0].backends,rows[0].pid);
    journal.control('quiescence-sample',{sample,passed});
    if(!passed)return false;
    if(sample===0)await delay(100);
  }
  return true;
}
// Private constructor. The public dispatch below deliberately remains guarded.
// These component predicates never grant ownership; the zeroarg owner below
// obtains and retains every resource before it can issue the one setup frame.
const manualOrphanNodeV1='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const manualOrphanNodeHashV1='59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553';
const manualOrphanPathV1='/opt/homebrew/Cellar/node/26.4.0/bin:/Users/setrox/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const manualOrphanTargetShaV1='161297ffca6adf2851918a93d492e1c9a77ce59d';
const manualOrphanDeliveryNsV1=5000000000n;
const manualOrphanComparisonV1=Object.freeze([
  ['constructor','scripts/run-private-postgres-tests.mjs'],
  ['constructorTests','scripts/__tests__/private-postgres-test-cluster.test.js'],
  ['wrapper','scripts/run-execution-attempt-tests.ts'],['isolatedRunner','scripts/run-isolated-postgres-tests.ts'],
  ['builtinChild','tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs'],
  ['routeTests','scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js'],
  ['fixture','tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts'],
  ['integration','tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts'],
  ['journal','scripts/private-postgres-test-journal-v1.mjs'],['pgPreflight','scripts/finding-test-preflight.mjs'],
  ['profile','src/installation/manual-orphan-target-dependencies-v1.json'],
]);
function manualOrphanUnknownV1(){return Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');}
function manualOrphanRequireV1(value,code='MANUAL_ORPHAN_SETUP_REFUSED'){
  if(!value)throw Error(code);
}
function manualOrphanEnvironmentV1(){return {PATH:manualOrphanPathV1,LANG:'C',LC_ALL:'C'};}
function assertManualOrphanConstructorEnvironmentV1(env,uid,platform){
  const expected=manualOrphanEnvironmentV1(),metadata='__CF_USER_TEXT_ENCODING',keys=Reflect.ownKeys(env);
  const hasMetadata=Object.hasOwn(env,metadata);
  manualOrphanRequireV1(keys.length===(hasMetadata?4:3)&&keys.every(key=>typeof key==='string'
    &&(key===metadata||(Object.hasOwn(expected,key)&&env[key]===expected[key]))),'MANUAL_ORPHAN_OWNER_REFUSED');
  if(hasMetadata){
    const value=env[metadata],fields=typeof value==='string'?value.split(':'):[];
    manualOrphanRequireV1(platform==='darwin'&&Number.isSafeInteger(uid)&&uid>=0&&uid<=0xFFFFFFFF
      &&fields.length===3&&fields.every(field=>/^0x(?:0|[1-9A-F][0-9A-F]{0,7})$/.exec(field)?.[0]===field)
      &&fields[0]==='0x'+uid.toString(16).toUpperCase(),'MANUAL_ORPHAN_OWNER_REFUSED');
  }
}
function assertManualOrphanConstructorLaunchV1(f){
  const script=f.root+'/scripts/run-private-postgres-tests.mjs';
  manualOrphanRequireV1(f.node===manualOrphanNodeV1&&f.script===script
    &&f.execPath===f.node&&f.argv0===f.node&&Array.isArray(f.argv)&&f.argv.length===3
    &&f.argv[0]===f.node&&f.argv[1]===script&&f.argv[2]==='manual-orphan-bootstrap'
    &&Array.isArray(f.execArgv)&&f.execArgv.length===0&&f.cwd===f.root
    &&f.platform==='darwin'&&f.arch==='arm64'&&f.version==='v26.4.0'
    &&f.uid===501&&f.euid===501&&f.gid===20&&f.egid===20
    &&f.rawCommand===f.node+' '+script+' manual-orphan-bootstrap','MANUAL_ORPHAN_OWNER_REFUSED');
}
function assertManualOrphanConstructorContextV1(){
  const root=path.resolve(ROOT),script=path.join(root,'scripts/run-private-postgres-tests.mjs'),account=userInfo();
  manualOrphanRequireV1(account.homedir==='/Users/setrox'&&account.uid===501&&account.gid===20
    &&path.dirname(root)===path.join(account.homedir,'ai/setrox/releases')
    &&/^setfarm-[a-f0-9]{8}$/.test(path.basename(root))
    &&path.basename(root)!=='setfarm-161297ff','MANUAL_ORPHAN_OWNER_REFUSED');
  manualOrphanRequireV1(realpathSync(root)===root&&realpathSync(script)===script
    &&realpathSync(account.homedir)===account.homedir,'MANUAL_ORPHAN_OWNER_REFUSED');
  assertManualOrphanConstructorEnvironmentV1(process.env,process.getuid(),process.platform);
  const observation=observeManualOrphanProcessV1(process.pid);
  assertManualOrphanConstructorLaunchV1({node:manualOrphanNodeV1,root,script,argv:process.argv,
    argv0:process.argv0,execPath:process.execPath,execArgv:process.execArgv,cwd:process.cwd(),
    platform:process.platform,arch:process.arch,version:process.version,uid:process.getuid(),
    euid:process.geteuid(),gid:process.getgid(),egid:process.getegid(),rawCommand:observation.rawCommand});
  manualOrphanRequireV1(observation.pin.pid===process.pid&&observation.pin.ppid===process.ppid
    &&observation.pin.uid===501&&observation.pin.executable===manualOrphanNodeV1
    &&observation.pin.executableSha256===manualOrphanNodeHashV1,'MANUAL_ORPHAN_OWNER_REFUSED');
  return {root,script,self:observation};
}
function requireManualOrphanConstructorSpaceV1(){
  const space=statfsSync('/tmp',{bigint:true});
  manualOrphanRequireV1(typeof space.bavail==='bigint'&&typeof space.bsize==='bigint'
    &&space.bavail>=0n&&space.bsize>0n&&space.bavail*space.bsize>=8657043456n);
}
function sameManualOrphanMutableDirectoryV1(before,after){
  return before!==null&&after!==null&&['dev','ino','uid','gid','mode','birthtimeNs']
    .every(key=>before[key]!==undefined&&before[key]===after[key]);
}
function createManualOrphanConstructorClockV1(){
  let start=null,last=null,unknown=false;
  function sample(){
    if(unknown)return null;
    try{
      const now=process.hrtime.bigint();
      if(typeof now!=='bigint'||now<0n||(last!==null&&now<last))throw manualOrphanUnknownV1();
      last=now;return now;
    }catch{unknown=true;return null;}
  }
  start=sample();
  const check=limitNs=>{
    if(unknown)return false;
    if(limitNs!==undefined&&(typeof limitNs!=='bigint'||limitNs<=0n)){unknown=true;return false;}
    const now=sample();
    if(now===null||(limitNs!==undefined&&now-start>=limitNs)){unknown=true;return false;}
    return true;
  };
  return Object.freeze({check,remaining(limitNs){
    if(!check(limitNs))return 0;
    return Number((limitNs-(last-start)+999999n)/1000000n);
  }});
}
function spawnManualOrphanConstructorChildV1(purpose,args,cwd,env){
  const clock=createManualOrphanConstructorClockV1();
  if(!clock.check())throw manualOrphanUnknownV1();
  manualOrphanRequireV1(['initdb','server','runner'].includes(purpose)&&Array.isArray(args)
    &&args.every(arg=>typeof arg==='string')&&typeof cwd==='string');
  assertManualOrphanConstructorEnvironmentV1(env,501,'darwin');
  const milliseconds={initdb:60000,server:960000,runner:840000}[purpose];
  const tool=purpose==='runner'?manualOrphanNodeV1:PG+(purpose==='initdb'?'initdb':'postgres');
  const purposeLimitNs=BigInt(milliseconds)*1000000n;
  let child=null,writer=null,witness=null,serverWitness=null,unknown=false,purposeComplete=false;
  // Retain original and then its writer before any observer or clock read.
  child=spawn(tool,args,{cwd,env:manualOrphanEnvironmentV1(),argv0:tool,shell:false,detached:false,
    stdio:purpose==='runner'?['ignore','pipe','pipe','ignore','pipe']:['ignore','pipe','pipe']});
  try{if(purpose==='runner')writer=child.stdio[4];}catch{unknown=true;}
  try{witness=observeManualOrphanOwnedChildV1(child,purpose);}catch{unknown=true;}
  if(purpose==='server')try{serverWitness=observeOwnedPrivateTestChildV1(child);}catch{unknown=true;}
  // The helper attempts every present binding even when one channel is absent.
  function check(limitNs=purposeLimitNs){
    const activeLimit=purposeComplete&&limitNs===purposeLimitNs?undefined:limitNs;
    if(!clock.check(activeLimit))unknown=true;
    let complete=false;
    try{
      const current=witness?.snapshot();
      if(!current||current.state==='unknown')unknown=true;
      complete=current?.purpose===purpose&&current.state==='observed';
    }catch{unknown=true;}
    // Qualify the complete current witness before the final outer-budget
    // sample, charging spawn/binding/snapshot work to its first completion.
    if(!clock.check(activeLimit))unknown=true;
    if(!unknown&&complete)purposeComplete=true;
    return !unknown;
  }
  check();
  return Object.freeze({child,writer,witness,serverWitness,clock,purpose,milliseconds,check});
}
function requireManualOrphanConstructorChildSuccessV1(witness,purpose){
  const current=witness.snapshot();
  if(current.purpose!==purpose||current.state!=='observed'||!current.exit||!current.close
    ||current.exit.signal!==null||current.close.signal!==null||current.exit.code!==current.close.code
    ||!current.stdout.end||!current.stdout.close||!current.stderr.end||!current.stderr.close
    ||(purpose==='runner'&&(!current.fd4?.finish||!current.fd4.end||!current.fd4.close)))throw manualOrphanUnknownV1();
  manualOrphanRequireV1(current.exit.code===0);
  return current;
}
function createManualOrphanConstructorInputV1(writer,clock){
  let attempted=false,issued=false,aborted=false,unknown=false;
  return Object.freeze({end(bytes){
    if(attempted||aborted||unknown){unknown=true;return false;}
    if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>16384||!clock.check(manualOrphanDeliveryNsV1)){
      unknown=true;return false;
    }
    attempted=true;issued=true;
    try{writer.end(bytes);}catch{unknown=true;}
    if(!clock.check(manualOrphanDeliveryNsV1))unknown=true;
    return !unknown;
  },abort(){
    if(attempted||aborted)return;
    aborted=true;
    try{writer.end();}catch{unknown=true;}
  },snapshot:()=>Object.freeze({attempted,issued,aborted,unknown})});
}
function attachManualOrphanConstructorControlV1(child,role,journal,_mirrors,
  state={controls:[],staging:true,healthy:true}){
  manualOrphanRequireV1(['initdb','server','test'].includes(role));
  const burn=()=>{state.healthy=false;try{state.onFault?.();}catch{}try{journal.burn('journal-input');}catch{}};
  const persist=record=>{
    try{if(journal.control(record[0],record[1])!==true||journal.healthy===false)burn();}catch{burn();}
  };
  const record=(stage,fields)=>{
    if(state.staging){if(state.controls.length===32){burn();return;}state.controls.push({persist,record:[stage,fields]});}
    else persist([stage,fields]);
  };
  const pid=()=>Number.isSafeInteger(child.pid)&&child.pid>0?child.pid:null;
  try{child.on('error',()=>record('child-error',{childRole:role,reason:'PRIVATE_TEST_CLUSTER_REFUSED'}));}catch{burn();}
  for(const event of ['exit','close'])try{child.on(event,(code,signal)=>record('child-'+event,
    {childRole:role,pid:pid(),code:Number.isInteger(code)?code:null,signal:typeof signal==='string'?signal:null}));}catch{burn();}
  for(const channel of ['stdout','stderr']){
    try{
      const stream=child[channel];
      stream.on('end',()=>record('stream-end',{childRole:role,channel}));
      stream.on('error',()=>record('stream-error',{childRole:role,channel,reason:'PRIVATE_TEST_CLUSTER_REFUSED'}));
    }catch{burn();}
  }
  return Object.freeze({get healthy(){return state.healthy;},stage(){state.staging=true;},flush(){
    state.staging=false;
    while(state.controls.length){const item=state.controls.shift();item.persist(item.record);}
    return state.healthy;
  }});
}
function manualOrphanConstructorCleanupEligibleV1(facts){
  return facts!==null&&typeof facts==='object'&&facts.unknown===false&&facts.cancelled===false
    &&['runnerReceipt','runnerClosed','baselineRestored','ownBackend','adminClosed','currentSource']
      .every(key=>facts[key]===true);
}
function verifyManualOrphanConstructorQuiescenceV1(rows,original){
  if(!Array.isArray(rows)||rows.length<1||rows.length>128||!Number.isSafeInteger(original?.pid))return false;
  let own=0;const seen=new Set();
  for(const row of rows){
    if(!Number.isSafeInteger(row.pid)||row.pid<=0||seen.has(row.pid))return false;seen.add(row.pid);
    if(row.pid===original.pid){
      if(row.backendStartedAtUTC!==original.backendStartedAtUTC||row.backendType!=='client backend')return false;
      own++;
    }else if(row.clientAddress!==null||!['autovacuum launcher','autovacuum worker','background writer',
      'checkpointer','walwriter','logical replication launcher'].includes(row.backendType))return false;
  }
  return own===1;
}

function manualOrphanMicrosecondsV1(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))return false;
  const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
  const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  return year>0&&month>=1&&month<=12&&day>=1&&day<=days[month-1]
    &&Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60&&Number(value.slice(17,19))<60;
}
// boundary is a private closure of the real constructor, never a wire/public
// option or a Source owner supplied to it. It cannot authorize a query: this
// component still retains its own pool/reservation/backend and sticky ledger.
async function openManualOrphanConstructorAdminV1(endpoint,boundary=()=>{}){
  let pool=null,reserved=null,backend=null,identity=null,pending=null,closePromise=null;
  let unknown=false,stopped=false,closed=false,closing=false,released=false,endAttempted=false,closeNotifications=0;
  const mark=()=>{unknown=true;};
  const requireReady=()=>{if(unknown||stopped||closed||pending!==null)throw manualOrphanUnknownV1();};
  function checkBoundary(){try{boundary();}catch{mark();throw manualOrphanUnknownV1();}}
  async function collect(start,timeoutMs){
    requireReady();checkBoundary();
    const clock=createManualOrphanConstructorClockV1();
    if(!clock.check(BigInt(timeoutMs)*1000000n)){mark();throw manualOrphanUnknownV1();}
    let timer=null,result;
    try{
      // Retain the in-flight operation; the timer burns uncertainty but does
      // not abandon it, release its connection or run concurrent cleanup.
      pending=Promise.resolve(start());
      try{timer=setTimeout(mark,timeoutMs);}catch{mark();}
      result=await pending;
    }catch{mark();}
    finally{pending=null;if(timer!==null)try{clearTimeout(timer);}catch{mark();}}
    if(!clock.check(BigInt(timeoutMs)*1000000n))mark();
    checkBoundary();if(unknown)throw manualOrphanUnknownV1();return result;
  }
  function validateIdentity(row){
    const valid=row&&Number.isSafeInteger(row.pid)&&row.pid>0&&manualOrphanMicrosecondsV1(row.backendStartedAtUTC)
      &&Number.isInteger(row.serverVersionNum)&&row.serverVersionNum>=170000&&row.serverVersionNum<=179999
      &&row.database==='postgres'&&row.currentUser==='postgres'&&row.sessionUser==='postgres'
      &&Number.isSafeInteger(row.databaseOid)&&row.databaseOid>0&&Number.isSafeInteger(row.userOid)&&row.userOid>0
      &&row.serverAddress==='127.0.0.1'&&row.serverPort===endpoint.port
      &&typeof row.systemIdentifier==='string'&&/^[1-9][0-9]{0,19}$/.test(row.systemIdentifier)
      &&BigInt(row.systemIdentifier)<=18446744073709551615n&&manualOrphanMicrosecondsV1(row.postmasterStartedAtUTC)
      &&row.dataDirectory===endpoint.dataDirectory&&row.socketDirectories===endpoint.root&&row.port===endpoint.port
      &&row.listenAddresses==='127.0.0.1'&&row.passwordEncryption==='scram-sha-256'&&row.socketPermissions==='0700';
    if(!valid){mark();throw manualOrphanUnknownV1();}
    const captured={pid:row.pid,backendStartedAtUTC:row.backendStartedAtUTC,
      serverVersionNum:row.serverVersionNum,database:row.database,currentUser:row.currentUser,sessionUser:row.sessionUser,
      databaseOid:row.databaseOid,userOid:row.userOid,serverAddress:row.serverAddress,serverPort:row.serverPort,
      systemIdentifier:row.systemIdentifier,postmasterStartedAtUTC:row.postmasterStartedAtUTC,
      dataDirectory:row.dataDirectory,socketDirectories:row.socketDirectories,port:row.port,
      listenAddresses:row.listenAddresses,passwordEncryption:row.passwordEncryption,socketPermissions:row.socketPermissions};
    if(backend===null){backend=Object.freeze({pid:row.pid,backendStartedAtUTC:row.backendStartedAtUTC});identity=Object.freeze(captured);}
    else if(JSON.stringify(captured)!==JSON.stringify(identity)){mark();throw manualOrphanUnknownV1();}
    return identity;
  }
  async function readIdentity(){
    const rows=await collect(()=>reserved`SELECT pg_backend_pid() AS pid,
      to_char(a.backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",
      current_setting('server_version_num')::integer AS "serverVersionNum",
      current_database() AS database,current_user AS "currentUser",session_user AS "sessionUser",
      a.datid::float8 AS "databaseOid",a.usesysid::float8 AS "userOid",
      host(inet_server_addr()) AS "serverAddress",inet_server_port() AS "serverPort",
      (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier",
      to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "postmasterStartedAtUTC",
      current_setting('data_directory') AS "dataDirectory",current_setting('unix_socket_directories') AS "socketDirectories",
      current_setting('port')::integer AS port,current_setting('listen_addresses') AS "listenAddresses",
      current_setting('password_encryption') AS "passwordEncryption",current_setting('unix_socket_permissions') AS "socketPermissions"
      FROM pg_stat_activity a WHERE a.pid=pg_backend_pid()`,30000);
    if(!Array.isArray(rows)||rows.length!==1){mark();throw manualOrphanUnknownV1();}
    return validateIdentity(rows[0]);
  }
  async function catalogQuery(start,limit){
    await readIdentity();const rows=await collect(start,30000);await readIdentity();
    if(!Array.isArray(rows)||rows.length>=limit){mark();throw manualOrphanUnknownV1();}
    return rows;
  }
  async function readBaselines(){
    try{
      const db=await catalogQuery(()=>reserved`SELECT datname AS name,oid::float8 AS oid,datdba::float8 AS "ownerOid",
        datallowconn AS "allowConnections",datconnlimit AS "connectionLimit"
        FROM pg_database ORDER BY datname COLLATE "C",oid LIMIT 4`,4);
      const roles=await catalogQuery(()=>reserved`SELECT rolname AS name,oid::float8 AS oid,rolsuper AS superuser,
        rolinherit AS inherit,rolcreaterole AS "createRole",rolcreatedb AS "createDb",rolcanlogin AS login,
        rolreplication AS replication,rolbypassrls AS "bypassRls",rolconnlimit AS "connectionLimit",
        CASE WHEN rolvaliduntil IS NULL THEN NULL WHEN rolvaliduntil='infinity'::timestamptz THEN 'infinity'
          WHEN rolvaliduntil='-infinity'::timestamptz THEN '-infinity'
          ELSE to_char(rolvaliduntil AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS "validUntilUTC"
        FROM pg_roles ORDER BY rolname COLLATE "C",oid LIMIT 129`,129);
      const memberships=await catalogQuery(()=>reserved`SELECT roleid::float8 AS "roleOid",member::float8 AS "memberOid",
        grantor::float8 AS "grantorOid",admin_option AS "adminOption",inherit_option AS "inheritOption",set_option AS "setOption"
        FROM pg_auth_members ORDER BY roleid,member,grantor LIMIT 257`,257);
      // postgres Result has extra own metadata. Copy only the selected fields;
      // the shared reviewed canonicalizer alone validates/sorts/hashes rows.
      const baseline=canonicalizeManualOrphanClusterBaselineV1({
        databases:Array.from(db,r=>({name:r.name,oid:r.oid,ownerOid:r.ownerOid,
          allowConnections:r.allowConnections,connectionLimit:r.connectionLimit})),
        roles:Array.from(roles,r=>({name:r.name,oid:r.oid,superuser:r.superuser,inherit:r.inherit,
          createRole:r.createRole,createDb:r.createDb,login:r.login,replication:r.replication,
          bypassRls:r.bypassRls,connectionLimit:r.connectionLimit,validUntilUTC:r.validUntilUTC})),
        memberships:Array.from(memberships,r=>({roleOid:r.roleOid,memberOid:r.memberOid,grantorOid:r.grantorOid,
          adminOption:r.adminOption,inheritOption:r.inheritOption,setOption:r.setOption})),
      });
      checkBoundary();if(unknown)throw manualOrphanUnknownV1();return baseline;
    }catch{mark();throw manualOrphanUnknownV1();}
  }
  async function readSessions(){
    await readIdentity();
    const rows=await collect(()=>reserved`SELECT pid,
      to_char(backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",
      backend_type AS "backendType",host(client_addr) AS "clientAddress"
      FROM pg_stat_activity ORDER BY pid LIMIT 129`,30000);
    await readIdentity();
    if(!verifyManualOrphanConstructorQuiescenceV1(rows,backend)){mark();throw manualOrphanUnknownV1();}
    return rows;
  }
  function close(){
    if(pending!==null){mark();stopped=true;return Promise.reject(manualOrphanUnknownV1());}
    if(closePromise!==null)return closePromise.then(()=>{if(unknown)throw manualOrphanUnknownV1();});
    stopped=true;closing=true;
    closePromise=(async()=>{
      let ending=null,timer=null;
      const clock=createManualOrphanConstructorClockV1();
      // No query, await, Source callback or re-reservation between these calls.
      if(reserved!==null&&!released){released=true;try{reserved.release();}catch{mark();}}
      if(pool!==null&&!endAttempted){endAttempted=true;try{ending=Promise.resolve(pool.end({timeout:5}));}catch{mark();}}
      try{
        if(ending!==null){
          try{timer=setTimeout(mark,5000);}catch{mark();}
          await ending;closed=true;
        }
      }catch{mark();}
      finally{if(timer!==null)try{clearTimeout(timer);}catch{mark();}closing=false;}
      if(!clock.check(5000000000n))mark();
      checkBoundary();if(unknown||!closed)throw manualOrphanUnknownV1();
    })();
    return closePromise;
  }
  try{
    manualOrphanRequireV1(endpoint&&/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/.test(endpoint.root)
      &&endpoint.dataDirectory===endpoint.root+'/data'&&endpoint.physicalRoot==='/private'+endpoint.root
      &&Number.isInteger(endpoint.port)&&endpoint.port>=1024&&endpoint.port<=65535&&endpoint.port!==5432
      &&typeof endpoint.url==='string'&&new RegExp('^postgresql://postgres:[a-f0-9]{64}@127\\.0\\.0\\.1:'
        +endpoint.port+'/postgres$').test(endpoint.url));
    checkBoundary();
    pool=postgres(endpoint.url,{max:1,connect_timeout:2,idle_timeout:0,max_lifetime:0,
      connection:{statement_timeout:5000,lock_timeout:5000},onnotice:()=>{},onclose(){
        closeNotifications++;if(!(closeNotifications===1&&(closing||closed)))mark();
      }});
    // Assign the acquired reservation inside the retained pending operation,
    // before collect's post-await boundary can fail.
    await collect(async()=>{reserved=await pool.reserve();return reserved;},30000);
    await readIdentity();
    return Object.freeze({readIdentity,readBaselines,readSessions,checkOwnBackend:readIdentity,close,
      invalidate(){mark();stopped=true;},snapshot:()=>Object.freeze({backend,pending:pending!==null,unknown,closed})});
  }catch{
    mark();if(pending===null)try{await close();}catch{}
    throw manualOrphanUnknownV1();
  }
}

function manualOrphanSameMetadataV1(first,current,file=false,immutable=false){
  const keys=['dev','ino','uid','gid','mode','birthtimeNs'];
  if(file)keys.push('nlink','size','mtimeNs','ctimeNs');
  else if(immutable)keys.push('mtimeNs','ctimeNs');
  return keys.every(key=>first[key]!==undefined&&first[key]===current[key]);
}
function manualOrphanPinMetadataV1(pin,file=false){
  const named=lstatSync(pin.path,{bigint:true}),held=fstatSync(pin.fd,{bigint:true});
  for(const stat of [named,held])manualOrphanRequireV1(!stat.isSymbolicLink()
    &&(file?stat.isFile():stat.isDirectory())&&manualOrphanSameMetadataV1(pin.stat,stat,file,pin.immutable));
}
function manualOrphanDescriptorListV1(){
  const descriptors=[];let closed=false,unknown=false;
  return {retain(fd){manualOrphanRequireV1(!closed);descriptors.push(fd);return fd;},close(){
    if(!closed){closed=true;while(descriptors.length){const fd=descriptors.pop();try{closeSync(fd);}catch{unknown=true;}}}
    if(unknown)throw manualOrphanUnknownV1();
  },check(){if(closed||unknown)throw manualOrphanUnknownV1();}};
}
function manualOrphanOpenDirectoryV1(locator,descriptors,immutable=false,privateDirectory=false){
  manualOrphanRequireV1(realpathSync(locator)===locator);
  const stat=lstatSync(locator,{bigint:true});
  manualOrphanRequireV1(stat.isDirectory()&&!stat.isSymbolicLink()
    &&(stat.uid===0n||stat.uid===501n)&&(stat.mode&0o022n)===0n
    &&(!privateDirectory||(stat.uid===501n&&stat.gid===20n&&(stat.mode&0o7777n)===0o700n)));
  const fd=descriptors.retain(openSync(locator,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW));
  const pin={path:locator,fd,stat,immutable};manualOrphanPinMetadataV1(pin);return pin;
}
function manualOrphanOpenFileV1(locator,descriptors,executable=false){
  manualOrphanRequireV1(realpathSync(locator)===locator);
  const stat=lstatSync(locator,{bigint:true});
  manualOrphanRequireV1(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1n
    &&(stat.uid===501n||(executable&&stat.uid===0n))&&(stat.mode&0o022n)===0n
    &&stat.size>=0n&&stat.size<=(executable?536870912n:16777216n)
    &&(!executable||(stat.size>0n&&(stat.mode&0o111n)!==0n&&(stat.mode&0o6000n)===0n)));
  const fd=descriptors.retain(openSync(locator,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK));
  const pin={path:locator,fd,stat,immutable:true};manualOrphanPinMetadataV1(pin,true);return pin;
}
function manualOrphanHashHeldFileV1(pin){
  manualOrphanPinMetadataV1(pin,true);
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let offset=0;
  const size=Number(pin.stat.size);
  while(offset<size){
    const count=readSync(pin.fd,buffer,0,Math.min(buffer.length,size-offset),offset);
    manualOrphanRequireV1(Number.isInteger(count)&&count>0&&count<=Math.min(buffer.length,size-offset));
    hash.update(buffer.subarray(0,count));offset+=count;
  }
  manualOrphanRequireV1(readSync(pin.fd,buffer,0,1,offset)===0);
  manualOrphanPinMetadataV1(pin,true);return hash.digest('hex');
}
function holdManualOrphanPgToolsV1(){
  const descriptors=manualOrphanDescriptorListV1(),directories=new Map(),files=[];let link=null,linkText=null;
  const holdDirectory=locator=>{
    if(!directories.has(locator))directories.set(locator,manualOrphanOpenDirectoryV1(locator,descriptors));
  };
  function metadataCheck(){
    descriptors.check();for(const pin of directories.values())manualOrphanPinMetadataV1(pin);
    for(const pin of files)manualOrphanPinMetadataV1(pin,true);
    if(link!==null){const now=lstatSync(link.path,{bigint:true});manualOrphanRequireV1(now.isSymbolicLink()
      &&manualOrphanSameMetadataV1(link.stat,now,true));}
  }
  function fullCheck(){
    metadataCheck();
    if(link!==null)manualOrphanRequireV1(readlinkSync(link.path)===linkText);
    for(const pin of files)manualOrphanRequireV1(realpathSync(pin.path)===pin.path&&manualOrphanHashHeldFileV1(pin)===pin.sha256);
    metadataCheck();
  }
  try{
    // Fixed Node has its own FD. The full Source holder's hidden FD is never borrowed.
    for(const locator of ['/','/opt','/opt/homebrew','/opt/homebrew/Cellar','/opt/homebrew/Cellar/node',
      '/opt/homebrew/Cellar/node/26.4.0','/opt/homebrew/Cellar/node/26.4.0/bin'])holdDirectory(locator);
    const node=manualOrphanOpenFileV1(manualOrphanNodeV1,descriptors,true);files.push(node);
    node.sha256=manualOrphanHashHeldFileV1(node);manualOrphanRequireV1(node.sha256===manualOrphanNodeHashV1);
    holdDirectory('/opt/homebrew/opt');
    const linkPath='/opt/homebrew/opt/postgresql@17',stat=lstatSync(linkPath,{bigint:true});
    manualOrphanRequireV1(stat.isSymbolicLink()&&stat.uid===501n&&stat.nlink===1n);
    link={path:linkPath,stat};linkText=readlinkSync(linkPath);
    manualOrphanRequireV1(/^\.\.\/Cellar\/postgresql@17\/17\.[0-9]+(?:_[0-9]+)?$/.test(linkText));
    const physical='/opt/homebrew/'+linkText.slice(3);
    manualOrphanRequireV1(realpathSync(linkPath)===physical);
    for(const locator of ['/opt/homebrew/Cellar/postgresql@17',physical,physical+'/bin'])holdDirectory(locator);
    for(const name of ['initdb','postgres']){
      manualOrphanRequireV1(realpathSync(PG+name)===physical+'/bin/'+name);
      const pin=manualOrphanOpenFileV1(physical+'/bin/'+name,descriptors,true);files.push(pin);
      pin.sha256=manualOrphanHashHeldFileV1(pin);pin.lexical=PG+name;
    }
    fullCheck();
    return Object.freeze({check:fullCheck,metadataCheck,close:()=>descriptors.close(),
      node:Object.freeze({path:node.path,sha256:node.sha256}),
      initdb:Object.freeze({path:files[1].path,sha256:files[1].sha256}),
      postgres:Object.freeze({path:files[2].path,sha256:files[2].sha256})});
  }catch{
    try{descriptors.close();}catch{throw manualOrphanUnknownV1();}
    throw Error('MANUAL_ORPHAN_SETUP_REFUSED');
  }
}
function checkManualOrphanDeliveryMetadataV1(pins){
  manualOrphanRequireV1(Array.isArray(pins.directories)&&pins.directories.length===14
    &&Array.isArray(pins.files)&&pins.files.length===11);
  for(const pin of pins.directories)manualOrphanPinMetadataV1(pin);
  for(const pin of pins.files)manualOrphanPinMetadataV1(pin,true);
}
function holdManualOrphanTemporaryParentsV1(){
  const descriptors=manualOrphanDescriptorListV1(),pins=[];
  try{
    for(const locator of ['/','/private'])pins.push(manualOrphanOpenDirectoryV1(locator,descriptors));
    const stat=lstatSync('/private/tmp',{bigint:true});
    manualOrphanRequireV1(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===0n
      &&(stat.mode&0o7777n)===0o1777n&&realpathSync('/private/tmp')==='/private/tmp');
    const fd=descriptors.retain(openSync('/private/tmp',constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW));
    pins.push({path:'/private/tmp',fd,stat,immutable:false});
    const alias=lstatSync('/tmp',{bigint:true}),text=readlinkSync('/tmp');
    manualOrphanRequireV1(alias.isSymbolicLink()&&alias.uid===0n
      &&['private/tmp','/private/tmp'].includes(text)&&realpathSync('/tmp')==='/private/tmp');
    function check(){
      descriptors.check();for(const pin of pins)manualOrphanPinMetadataV1(pin);
      const now=lstatSync('/tmp',{bigint:true});
      manualOrphanRequireV1(now.isSymbolicLink()&&manualOrphanSameMetadataV1(alias,now,true));
    }
    check();return Object.freeze({check,close:()=>descriptors.close()});
  }catch{try{descriptors.close();}catch{throw manualOrphanUnknownV1();}throw Error('MANUAL_ORPHAN_SETUP_REFUSED');}
}
function manualOrphanDirectoryDataV1(pin){
  return {dev:String(pin.stat.dev),ino:String(pin.stat.ino),uid:Number(pin.stat.uid),
    gid:Number(pin.stat.gid),mode:Number(pin.stat.mode&0o7777n)};
}
function manualOrphanCheckMutablePinV1(pin){
  for(const stat of [lstatSync(pin.path,{bigint:true}),fstatSync(pin.fd,{bigint:true})])
    manualOrphanRequireV1(stat.isDirectory()&&!stat.isSymbolicLink()
      &&sameManualOrphanMutableDirectoryV1(pin.stat,stat)&&stat.uid===501n&&stat.gid===20n&&(stat.mode&0o7777n)===0o700n);
}

async function reserveManualOrphanConstructorPortV1(boundary){
  const clock=createManualOrphanConstructorClockV1();
  if(!clock.check(10000000000n))throw manualOrphanUnknownV1();
  let socket=null,unknown=false,closed=false,closing=false,timer=null;
  try{
    socket=net.createServer();
    socket.on('error',()=>{unknown=true;});socket.on('close',()=>{if(!closing)unknown=true;closed=true;});
    await new Promise((resolve,reject)=>{
      socket.once('error',reject);timer=setTimeout(()=>{unknown=true;},10000);
      socket.listen(0,'127.0.0.1',resolve);
    });
    clearTimeout(timer);timer=null;
    if(!clock.check(10000000000n))unknown=true;
    boundary();const address=socket.address(),port=address?.port;
    if(!Number.isInteger(port)||port<1024||port>65535||port===5432)unknown=true;
    closing=true;
    await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{unknown=true;},10000);
      socket.close(error=>error?reject(error):resolve());
    });
    clearTimeout(timer);timer=null;boundary();
    if(!clock.check(10000000000n)||unknown||!closed)throw manualOrphanUnknownV1();
    return port;
  }catch{
    unknown=true;
    // A listen failure is settled here. Close only this retained server; never
    // treat close-request or disappearance as the observed close event.
    if(socket!==null&&!closing&&!closed){
      closing=true;
      try{await new Promise(resolve=>socket.close(()=>resolve()));}catch{}
    }
    throw manualOrphanUnknownV1();
  }finally{if(timer!==null)clearTimeout(timer);}
}
async function waitManualOrphanConstructorChildV1(owned,shutdownClock=null){
  if(!owned.check()||owned.witness===null)throw manualOrphanUnknownV1();
  let timer=null;
  try{
    const remaining=Math.min(owned.clock.remaining(BigInt(owned.milliseconds)*1000000n),
      shutdownClock===null?Infinity:shutdownClock.remaining(30000000000n));
    if(remaining<=0)throw manualOrphanUnknownV1();
    await Promise.race([owned.witness.settled,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(manualOrphanUnknownV1()),remaining);
    })]);
    if(!owned.check()||(shutdownClock!==null&&!shutdownClock.check(30000000000n)))throw manualOrphanUnknownV1();
    return owned.witness.snapshot();
  }finally{if(timer!==null)clearTimeout(timer);}
}
function sameManualOrphanProcessObservationV1(previous,current){
  return previous.rawCommand===current.rawCommand&&['pid','ppid','uid','pgid','startedAtUTC',
    'executable','executableSha256','commandSha256'].every(key=>previous.pin[key]===current.pin[key]);
}
async function runManualOrphanConstructorV1(){
  let unknown=false,cancelled=false,context=null,sourceHolder=null,tools=null,tmp=null,delivery=null;
  let root=null,rootPin=null,dataPin=null,journal=null,admin=null,input=null,runner=null,server=null;
  let stage='preconditions',testsStarted=false,serverMayExit=false,sourceClosed=false,adminClosed=false;
  let serverObservation=null,baseline=null,identity=null,frameDigest=null,run=null,normal=false;
  const originals=[],taps=[],closers=[],clock=createManualOrphanConstructorClockV1();
  // One queue preserves cross-original event order and a total 32-record cap.
  const mark=()=>{unknown=true;process.exitCode=1;};
  const controlState={controls:[],staging:true,healthy:true,onFault:mark};
  const mirrors=Object.fromEntries(['stdout','stderr'].map(channel=>[channel,
    createPrivateTestTerminalMirrorV1(process[channel],mark)]));
  const cancel=()=>{cancelled=true;mark();admin?.invalidate();};
  let listeners=false;
  function retain(close){const resource={attempted:false,close};closers.push(resource);return resource;}
  function closeOne(resource){
    if(resource.attempted)return;
    resource.attempted=true;try{resource.close();}catch{mark();}
  }
  function currentOriginals(){
    if(!clock.check())mark();
    for(const owned of originals){
      if(!owned.check())mark();
      const facts=owned.witness?.snapshot();
      if(!facts||facts.state==='unknown')mark();
      if(owned===server&&!serverMayExit&&(facts?.exit!==null||facts?.close!==null))mark();
    }
    for(const tap of taps)if(!tap.healthy)mark();
    if(admin?.snapshot().unknown||input?.snapshot().unknown)mark();
    if(cancelled||unknown)throw manualOrphanUnknownV1();
  }
  function rootMetadata(){
    tmp?.check();if(rootPin&&!rootPin.closed)manualOrphanCheckMutablePinV1(rootPin);
    if(dataPin&&!dataPin.closed)manualOrphanCheckMutablePinV1(dataPin);
  }
  function fullCheck(){
    try{
      currentOriginals();
      if(sourceHolder!==null&&!sourceClosed)sourceHolder.check();
      currentOriginals();tools?.check();currentOriginals();rootMetadata();delivery?.check();currentOriginals();
      if(journal!==null&&!journal.healthy)throw manualOrphanUnknownV1();
    }catch{mark();throw manualOrphanUnknownV1();}
  }
  function control(next,fields={}){
    stage=next;
    if(!journal.control(next,fields)||!journal.healthy){mark();throw manualOrphanUnknownV1();}
    if(!mirrors.stdout.write(Buffer.from(JSON.stringify({event:'private-postgres-test-cluster',stage:next,
      ...fields,productionAuthority:false})+'\n'))){mark();throw manualOrphanUnknownV1();}
    currentOriginals();
  }
  function ownChild(owned,role){
    originals.push(owned);
    // The shared observer is already bound. These current joins preserve late
    // uncertainty even after the owner's final synchronous return; no Source,
    // SQL, journal or filesystem work is performed by the join itself.
    const rejoin=()=>{try{currentOriginals();}catch{mark();}};
    try{for(const event of ['error','exit','close'])owned.child.on(event,rejoin);}catch{mark();}
    for(const stream of [owned.child.stdout,owned.child.stderr]){
      try{for(const event of ['data','error','end','close'])stream.on(event,rejoin);}catch{mark();}
    }
    if(owned.purpose==='runner'){
      try{for(const event of ['data','error','finish','end','close'])owned.writer.on(event,rejoin);}catch{mark();}
    }
    const tap=attachManualOrphanConstructorControlV1(owned.child,role,journal,mirrors,controlState);taps.push(tap);
    return tap;
  }
  function observeServer(){
    currentOriginals();const actual=observeManualOrphanProcessV1(server.child.pid);currentOriginals();
    const raw=PG+'postgres '+planPrivatePostgresTestsV1({root,port:identity?.port??port,mode:'manual-orphan-bootstrap'}).server.join(' ');
    manualOrphanRequireV1(actual.pin.pid===server.child.pid&&actual.pin.ppid===process.pid&&actual.pin.uid===501
      &&actual.pin.executable===tools.postgres.path&&actual.pin.executableSha256===tools.postgres.sha256
      &&actual.rawCommand===raw);
    if(serverObservation!==null)manualOrphanRequireV1(sameManualOrphanProcessObservationV1(serverObservation,actual));
    else serverObservation=actual;
    return actual;
  }
  function holdDeliveryPins(){
    const root=context.root,source=sourceHolder.source;
    const descriptors=manualOrphanDescriptorListV1(),pins={directories:[],files:[]};
    const directories=['/','/Users','/Users/setrox','/Users/setrox/ai','/Users/setrox/ai/setrox',
      '/Users/setrox/ai/setrox/releases',root,root+'/scripts',root+'/scripts/__tests__',root+'/tests',
      root+'/tests/execution-attempts',root+'/tests/execution-attempts/helpers',root+'/src',root+'/src/installation'];
    try{
      manualOrphanRequireV1(path.dirname(root)==='/Users/setrox/ai/setrox/releases'
        &&/^setfarm-[a-f0-9]{8}$/.test(path.basename(root))&&new Set(directories).size===14
        &&JSON.stringify(Object.keys(source.files))===JSON.stringify(manualOrphanComparisonV1.map(([key])=>key)));
      for(const locator of directories)pins.directories.push(manualOrphanOpenDirectoryV1(locator,descriptors,
        locator===root||locator.startsWith(root+'/')));
      for(const [key,suffix] of manualOrphanComparisonV1){
        for(const directory of pins.directories)manualOrphanPinMetadataV1(directory);
        const pin=manualOrphanOpenFileV1(root+'/'+suffix,descriptors);pins.files.push(pin);pin.key=key;
        const actual=source.files[key],stat=pin.stat,sha256=manualOrphanHashHeldFileV1(pin);
        manualOrphanRequireV1(actual.dev===String(stat.dev)&&actual.ino===String(stat.ino)
          &&actual.uid===Number(stat.uid)&&actual.gid===Number(stat.gid)&&actual.mode===Number(stat.mode&0o7777n)
          &&actual.nlink===Number(stat.nlink)&&actual.bytes===Number(stat.size)
          &&actual.mtimeNs===String(stat.mtimeNs)&&actual.ctimeNs===String(stat.ctimeNs)&&actual.sha256===sha256
          &&stat.dev===pins.directories[6].stat.dev);
        for(const directory of pins.directories)manualOrphanPinMetadataV1(directory);
      }
      checkManualOrphanDeliveryMetadataV1(pins);
      return Object.freeze({check(){descriptors.check();checkManualOrphanDeliveryMetadataV1(pins);},close:()=>descriptors.close()});
    }catch{try{descriptors.close();}catch{throw manualOrphanUnknownV1();}throw Error('MANUAL_ORPHAN_SETUP_REFUSED');}
  }
  let port=null;
  try{
    manualOrphanRequireV1(arguments.length===0,'MANUAL_ORPHAN_OWNER_REFUSED');
    currentOriginals();
    context=assertManualOrphanConstructorContextV1();currentOriginals();
    process.once('SIGINT',cancel);process.once('SIGTERM',cancel);listeners=true;
    requireManualOrphanConstructorSpaceV1();
    sourceHolder=await holdManualOrphanOwnedSourcesV1();
    // Register the returned owner before accessing any of its fields.
    retain(()=>{sourceClosed=true;sourceHolder.close();});currentOriginals();
    manualOrphanRequireV1(sourceHolder.source.maintenance.sha!==manualOrphanTargetShaV1
      &&sourceHolder.source.target.sha===manualOrphanTargetShaV1
      &&path.basename(context.root)==='setfarm-'+sourceHolder.source.maintenance.sha.slice(0,8));
    sourceHolder.check();currentOriginals();
    tools=holdManualOrphanPgToolsV1();retain(()=>tools.close());currentOriginals();
    tmp=holdManualOrphanTemporaryParentsV1();retain(()=>tmp.close());fullCheck();
    // This nested owner acquires its own FDs against the actual Source holder.
    delivery=holdDeliveryPins();retain(()=>{delivery.close();delivery=null;});fullCheck();
    requireManualOrphanConstructorSpaceV1();stage='create-private-root';
    root=mkdtempSync('/tmp/setfarm-task6a-pg.');
    manualOrphanRequireV1(/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/.test(root)&&Buffer.byteLength(root)<=128);
    // mkdtemp already creates0700. Refuse an unexpected directory instead of
    // repairing/rechmodding an object we have not pinned yet.
    const physicalRoot='/private'+root;
    manualOrphanRequireV1(realpathSync(root)===physicalRoot);
    const rootDescriptors=manualOrphanDescriptorListV1();retain(()=>rootDescriptors.close());
    rootPin=manualOrphanOpenDirectoryV1(physicalRoot,rootDescriptors,false,true);
    // Marking a pin closed prevents later metadata checks from touching a reused FD.
    retain(()=>{rootPin.closed=true;});fullCheck();
    journal=createPrivateTestJournalV1(root,rootPin.fd);
    retain(()=>{if(!journal.close())mark();});
    control('journal-opened',{root});control('port-reservation');
    port=await reserveManualOrphanConstructorPortV1(fullCheck);fullCheck();
    requireManualOrphanConstructorSpaceV1();control('password-create');
    const password=randomBytes(32).toString('hex');
    const passwordFd=openSync(root+'/password',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    const passwordClose=retain(()=>closeSync(passwordFd));
    try{
      const stat=fstatSync(passwordFd,{bigint:true});
      manualOrphanRequireV1(stat.isFile()&&stat.uid===501n&&stat.gid===20n&&(stat.mode&0o7777n)===0o600n&&stat.nlink===1n);
      writeFileSync(passwordFd,password+'\n');
    }finally{closeOne(passwordClose);}
    fullCheck();control('private-root-retained',{root,port});
    const plan=planPrivatePostgresTestsV1({root,port,mode:'manual-orphan-bootstrap'});
    control('initdb');fullCheck();
    const initdb=spawnManualOrphanConstructorChildV1('initdb',plan.initdb,context.root,manualOrphanEnvironmentV1());
    const initTap=ownChild(initdb,'initdb');initTap.flush();fullCheck();
    await waitManualOrphanConstructorChildV1(initdb);fullCheck();
    requireManualOrphanConstructorChildSuccessV1(initdb.witness,'initdb');
    manualOrphanRequireV1(realpathSync(root+'/data')===physicalRoot+'/data');
    const dataDescriptors=manualOrphanDescriptorListV1();retain(()=>dataDescriptors.close());
    dataPin=manualOrphanOpenDirectoryV1(physicalRoot+'/data',dataDescriptors,false,true);
    retain(()=>{dataPin.closed=true;});fullCheck();
    control('server-start');fullCheck();
    server=spawnManualOrphanConstructorChildV1('server',plan.server,context.root,manualOrphanEnvironmentV1());
    const serverTap=ownChild(server,'server');serverTap.flush();fullCheck();observeServer();
    control('identity');
    // Readiness output permits only attempting the sole connection; actual
    // server/settings/backend qualification is still the read-only SQL below.
    while(true){
      fullCheck();if(!server.check(30000000000n))throw manualOrphanUnknownV1();
      const output=server.witness.output();
      if(output.stderr.toString('utf8').split('\n').some(line=>/LOG:  database system is ready to accept connections$/.test(line)))break;
      await delay(100);fullCheck();
    }
    const endpoint={url:'postgresql://postgres:'+password+'@127.0.0.1:'+port+'/postgres',root,physicalRoot,
      dataDirectory:root+'/data',port};
    admin=await openManualOrphanConstructorAdminV1(endpoint,fullCheck);fullCheck();
    if(!server.check(30000000000n))throw manualOrphanUnknownV1();
    identity=await admin.readIdentity();fullCheck();observeServer();
    control('identity-verified',{root,port,serverPid:server.child.pid});
    baseline=await admin.readBaselines();fullCheck();
    const originalBaseline=JSON.stringify(baseline),constructorAdminBackend=admin.snapshot().backend;
    // Every settled SQL await rejoins the complete Source owner before spawn.
    // These serialized observations are historical, not an atomic SQL/Source
    // snapshot. No expensive Source callback enters the delivery window.
    identity=await admin.readIdentity();fullCheck();
    const beforeSpawn=await admin.readBaselines();fullCheck();
    manualOrphanRequireV1(JSON.stringify(beforeSpawn)===originalBaseline);
    await admin.readSessions();fullCheck();observeServer();
    manualOrphanRequireV1(JSON.stringify(admin.snapshot().backend)===JSON.stringify(constructorAdminBackend)
      &&admin.snapshot().pending===false);
    requireManualOrphanConstructorSpaceV1();rootMetadata();tools.metadataCheck();delivery.check();currentOriginals();
    run=randomBytes(32).toString('hex');
    const cluster={root:manualOrphanDirectoryDataV1(rootPin),data:manualOrphanDirectoryDataV1(dataPin),port,
      postmasterStartedAtUTC:identity.postmasterStartedAtUTC,systemIdentifier:identity.systemIdentifier,
      serverVersionNum:identity.serverVersionNum,databaseBaselineSha256:baseline.databaseBaselineSha256,
      roleBaselineSha256:baseline.roleBaselineSha256,membershipBaselineSha256:baseline.membershipBaselineSha256};
    // Only this lexical closure can combine the real retained sources, original
    // server, one reservation, password and newly observed runner into setup.
    function issueRunnerSetup(){
      const windowCheck=()=>{
        currentOriginals();
        if(!runner.check(manualOrphanDeliveryNsV1)||admin.snapshot().pending
          ||admin.snapshot().unknown||!journal.healthy)throw manualOrphanUnknownV1();
        const current=runner.witness.snapshot();
        if(current.state!=='pending'||current.exit!==null||current.close!==null
          ||current.stdout.end||current.stdout.close||current.stderr.end||current.stderr.close
          ||(!input.snapshot().attempted&&(current.fd4.finish||current.fd4.end||current.fd4.close)))throw manualOrphanUnknownV1();
      };
      windowCheck();
      const currentSelf=observeManualOrphanProcessV1(process.pid);windowCheck();
      manualOrphanRequireV1(sameManualOrphanProcessObservationV1(context.self,currentSelf));windowCheck();
      const currentServer=observeManualOrphanProcessV1(server.child.pid);windowCheck();
      manualOrphanRequireV1(sameManualOrphanProcessObservationV1(serverObservation,currentServer));windowCheck();
      const currentRunner=observeManualOrphanProcessV1(runner.child.pid);windowCheck();
      manualOrphanRequireV1(currentRunner.pin.pid===runner.child.pid&&currentRunner.pin.ppid===process.pid
        &&currentRunner.pin.uid===501&&currentRunner.pin.executable===manualOrphanNodeV1
        &&currentRunner.pin.executableSha256===manualOrphanNodeHashV1
        &&currentRunner.rawCommand===manualOrphanNodeV1+' '+plan.test.join(' '));windowCheck();
      delivery.check();windowCheck();tools.metadataCheck();windowCheck();rootMetadata();windowCheck();
      const bytes=encodeManualOrphanRunnerSetupFrameV1({schema:'setfarm.manual-orphan-runner-setup.v1',run,
        constructor:context.self.pin,runner:currentRunner.pin,server:serverObservation.pin,source:sourceHolder.source,
        cluster,constructorAdminBackend,adminPassword:password});
      windowCheck();frameDigest=createHash('sha256').update(bytes).digest('hex');windowCheck();
      delivery.check();windowCheck();tools.metadataCheck();windowCheck();rootMetadata();windowCheck();
      if(!input.end(bytes))throw manualOrphanUnknownV1();windowCheck();
    }
    control('test-graph');testsStarted=true;
    for(const tap of taps)tap.stage();
    runner=spawnManualOrphanConstructorChildV1('runner',plan.test,context.root,manualOrphanEnvironmentV1());
    input=createManualOrphanConstructorInputV1(runner.writer,runner.clock);
    ownChild(runner,'test');
    try{issueRunnerSetup();}
    catch{mark();input.abort();throw manualOrphanUnknownV1();}
    finally{for(const tap of taps)tap.flush();}
    // Yield immediately so the reader/writer can make actual EOF/close progress.
    await delay(0);fullCheck();
    await waitManualOrphanConstructorChildV1(runner);fullCheck();
    requireManualOrphanConstructorChildSuccessV1(runner.witness,'runner');
    const output=runner.witness.output();manualOrphanRequireV1(output.stderr.length===0,'MANUAL_ORPHAN_FRAME_REFUSED');
    const receipt=decodeManualOrphanRunnerResultV1(output.stdout);
    manualOrphanRequireV1(receipt.run===run&&receipt.frameSha256===frameDigest&&receipt.pid===runner.child.pid
      &&receipt.parentPid===process.pid&&receipt.sourcePinsClosed===true
      &&JSON.stringify(receipt.oldEntry.maintenance)===JSON.stringify(sourceHolder.source.maintenance)
      &&JSON.stringify(receipt.oldEntry.target)===JSON.stringify(sourceHolder.source.target),'MANUAL_ORPHAN_FRAME_REFUSED');
    fullCheck();control('private-db-quiescence');
    const cleanupClock=createManualOrphanConstructorClockV1();
    for(let sample=0;sample<2;sample++){
      fullCheck();observeServer();
      if(!cleanupClock.check(30000000000n))throw manualOrphanUnknownV1();
      const restored=await admin.readBaselines();fullCheck();
      manualOrphanRequireV1(JSON.stringify(restored)===originalBaseline);
      await admin.readSessions();fullCheck();observeServer();
      if(!cleanupClock.check(30000000000n))throw manualOrphanUnknownV1();
      manualOrphanRequireV1(JSON.stringify(admin.snapshot().backend)===JSON.stringify(constructorAdminBackend));
      control('quiescence-sample',{sample,passed:true});
      if(sample===0){await delay(100);fullCheck();}
    }
    control('direct-test-child-closed',{code:0,privateDbQuiescent:true});
    control('admin-close');fullCheck();await admin.close();adminClosed=true;fullCheck();control('admin-ended');
    fullCheck();observeServer();
    const eligible=manualOrphanConstructorCleanupEligibleV1({runnerReceipt:true,
      runnerClosed:runner.witness.snapshot().state==='observed',baselineRestored:true,
      ownBackend:JSON.stringify(admin.snapshot().backend)===JSON.stringify(constructorAdminBackend),
      adminClosed:admin.snapshot().closed,currentSource:!sourceClosed,unknown,cancelled});
    if(!eligible)throw manualOrphanUnknownV1();
    control('server-close');fullCheck();observeServer();
    const shutdownClock=createManualOrphanConstructorClockV1();
    if(!shutdownClock.check(30000000000n))throw manualOrphanUnknownV1();
    serverMayExit=true;
    if(!await settleOwnedPrivatePostgresV1(server.serverWitness,30000))throw manualOrphanUnknownV1();
    fullCheck();await waitManualOrphanConstructorChildV1(server,shutdownClock);fullCheck();
    if(!shutdownClock.check(30000000000n))throw manualOrphanUnknownV1();
    requireManualOrphanConstructorChildSuccessV1(server.witness,'server');
    control('server-definitely-closed',{root,port,code:0,retained:true});
    if(!journal.finish({outcome:'observed',testCode:0,privateDbQuiescent:true,
      adminEnded:true,serverClosed:true,productionAuthority:false}))throw manualOrphanUnknownV1();
    normal=true;
  }catch(error){
    try{if(error?.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN')mark();}catch{mark();}
    // No generated-resource DROP and no signal on this path, including refusal
    // before runner dispatch. Retained originals remain observed and draining.
    try{input?.abort();}catch{mark();}
    for(const tap of taps)try{if(!tap.flush())mark();}catch{mark();}
    if(admin!==null&&!adminClosed){
      if(admin.snapshot().pending)mark();
      else try{await admin.close();adminClosed=true;}catch{mark();}
    }
    try{currentOriginals();}catch{mark();}
    if(journal!==null){
      try{
        journal.control('refused',{operation:stage,reason:'PRIVATE_TEST_CLUSTER_REFUSED',root,
          testsStarted,serverClosed:server!==null&&server.witness?.snapshot().state==='observed',retained:root!==null});
        journal.finish({outcome:'refused',reason:'PRIVATE_TEST_CLUSTER_REFUSED',productionAuthority:false});
      }catch{mark();}
    }
    let code='MANUAL_ORPHAN_SETUP_REFUSED';
    try{if(['MANUAL_ORPHAN_FRAME_REFUSED','MANUAL_ORPHAN_OWNER_REFUSED','MANUAL_ORPHAN_SETUP_REFUSED',
      'MANUAL_ORPHAN_CASE_REFUSED','MANUAL_ORPHAN_CLEANUP_UNKNOWN'].includes(error?.message))code=error.message;}catch{mark();}
    for(let index=closers.length-1;index>=0;index--){closeOne(closers[index]);try{currentOriginals();}catch{mark();}}
    if(unknown)code='MANUAL_ORPHAN_CLEANUP_UNKNOWN';
    try{if(!mirrors.stderr.write(Buffer.from(code+'\n')))mark();}catch{mark();}
    process.exitCode=1;
  }finally{
    for(let index=closers.length-1;index>=0;index--){closeOne(closers[index]);try{currentOriginals();}catch{mark();}}
    if(listeners){process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
    if(normal){
      try{currentOriginals();requireManualOrphanConstructorChildSuccessV1(runner.witness,'runner');
        requireManualOrphanConstructorChildSuccessV1(server.witness,'server');}catch{mark();}
      process.exitCode=unknown?1:0;
      if(unknown)try{mirrors.stderr.write(Buffer.from('MANUAL_ORPHAN_CLEANUP_UNKNOWN\n'));}catch{}
    }
  }
}

async function main(){
  let journal=null;
  const unavailable=new Map();
  const mirrors=Object.fromEntries(['stdout','stderr'].map(channel=>[channel,
    createPrivateTestTerminalMirrorV1(process[channel],reason=>{
      unavailable.set(channel,reason);
      journal?.control('terminal-unavailable',{channel,reason});
    })]));
  const args=process.argv.slice(2);
  if(args.length!==1||!['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal','after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt','migration33-observers','migration33-adjacent-full','manual-orphan-bootstrap'].includes(args[0])){
    mirrors.stderr.write(Buffer.from('PRIVATE_TEST_CLUSTER_MODE_INVALID\n'));process.exitCode=1;return;
  }
  if(args[0]==='manual-orphan-bootstrap'){
    mirrors.stderr.write(Buffer.from('MANUAL_ORPHAN_SLICE2_UNAVAILABLE\n'));
    process.exitCode=1;return;
  }
  let stage='preconditions',root=null,directoryFd=null,init=null,server=null,testChild=null,admin=null;
  let testsStarted=false,mayStopServer=true,resultCode=1;
  const cancellation=watchPrivateTestCancellationV1(process);
  function record(stage,fields={}){
    const persisted=journal?journal.control(stage,fields):true;
    mirrors.stdout.write(Buffer.from(JSON.stringify({event:'private-postgres-test-cluster',stage,
      ...fields,productionAuthority:false})+'\n'));
    return persisted;
  }
  function intent(next,dispatch=false){
    stage=next;
    if(dispatch&&!journal.healthy)throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
    const persisted=record(next);
    if(dispatch&&(!persisted||!journal.healthy))throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
  }
  try{
    const env=preconditions();
    stage='create-private-root';root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
    directoryFd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    const pinned=fstatSync(directoryFd);
    function recheckRoot(){
      const actual=lstatSync(root),held=fstatSync(directoryFd);
      if(!actual.isDirectory()||actual.isSymbolicLink()||actual.uid!==501||(actual.mode&0o777)!==0o700
        ||actual.dev!==pinned.dev||actual.ino!==pinned.ino||held.dev!==pinned.dev||held.ino!==pinned.ino){
        throw Error('PRIVATE_TEST_CLUSTER_ROOT_CHANGED');
      }
    }
    recheckRoot();
    journal=createPrivateTestJournalV1(root,directoryFd);
    if(!record('journal-opened',{root})||!journal.healthy)throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
    for(const [channel,reason] of unavailable)journal.control('terminal-unavailable',{channel,reason});
    intent('port-reservation',true);
    const port=await cancellation.run(racePrivateTestDeadlineV1(reservePort(),10000)),
      plan=planPrivatePostgresTestsV1({root,port,mode:args[0]});
    intent('password-create',true);
    const password=randomBytes(32).toString('hex');
    const passwordFd=openSync(root+'/password',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try{
      const observed=fstatSync(passwordFd);
      if(!observed.isFile()||observed.uid!==501||(observed.mode&0o777)!==0o600||observed.nlink!==1){
        throw Error('PRIVATE_TEST_CLUSTER_PASSWORD_FILE_INVALID');
      }
      writeFileSync(passwordFd,password+'\n');
    }finally{closeSync(passwordFd);}
    const url='postgresql://postgres:'+password+'@127.0.0.1:'+port+'/postgres';
    const secrets=[password,url];
    record('private-root-retained',{root,port});
    intent('initdb',true);recheckRoot();
    init=capturedChild(PG+'initdb',plan.initdb,env);
    init.witness=observeOwnedPrivateTestChildV1(init.child);
    attachPrivateTestChildJournalV1(init.child,'initdb',secrets,journal,mirrors);
    if(!await cancellation.run(boundedClose(init.witness,60000))
      ||!definiteNormalClose(init.witness)||init.witness.result.code!==0){
      throw Error('PRIVATE_TEST_CLUSTER_INIT_FAILED');
    }
    intent('server-start',true);recheckRoot();
    server=capturedChild(PG+'postgres',plan.server,env);
    server.witness=observeOwnedPrivateTestChildV1(server.child);
    attachPrivateTestChildJournalV1(server.child,'server',secrets,journal,mirrors);
    admin=postgres(url,{max:1,connect_timeout:2,idle_timeout:1,onnotice:()=>{}});
    intent('identity');await cancellation.run(racePrivateTestDeadlineV1(
      clusterIdentity(admin,url,root+'/data',server),30000));recheckRoot();
    record('identity-verified',{root,port,serverPid:server.child.pid});
    const testEnv={...env,SETFARM_TEST_PG_ADMIN_URL:url,SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY:root+'/data'};
    intent('test-graph',true);testsStarted=true;mayStopServer=false;
    testChild=capturedChild(process.execPath,plan.test,testEnv);
    testChild.witness=observeOwnedPrivateTestChildV1(testChild.child);
    attachPrivateTestChildJournalV1(testChild.child,'test',secrets,journal,mirrors);
    await cancellation.run(testChild.witness.completion);
    if(!definiteNormalClose(testChild.witness))throw Error('PRIVATE_TEST_CLUSTER_TEST_CLOSE_UNCERTAIN');
    resultCode=testChild.witness.result.code;
    intent('private-db-quiescence');recheckRoot();
    if(!await cancellation.run(racePrivateTestDeadlineV1(quiescence(admin,journal),10000))){
      throw Error('PRIVATE_TEST_CLUSTER_DB_CLEANUP_UNVERIFIED');
    }
    mayStopServer=true;record('direct-test-child-closed',{code:resultCode,privateDbQuiescent:true});
    intent('admin-close');await cancellation.run(admin.end({timeout:5}));admin=null;
    record('admin-ended');intent('server-close');
    if(!await cancellation.run(settleOwnedPrivatePostgresV1(server.witness,30000))){
      mayStopServer=false;throw Error('PRIVATE_TEST_CLUSTER_SERVER_CLOSE_UNCERTAIN');
    }
    record('server-definitely-closed',{root,port,code:resultCode,retained:true});
    if(!journal.finish({outcome:'observed',testCode:resultCode,privateDbQuiescent:true,
      adminEnded:true,serverClosed:true,productionAuthority:false}))throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
    process.exitCode=resultCode;
  }catch(error){
    const operation=stage;
    journal?.burn('journal-input');
    if(cancellation.cancelled&&testsStarted)mayStopServer=false;
    if(admin){
      try{
        record('admin-close');await admin.end({timeout:5});record('admin-ended');
      }catch{if(testsStarted)mayStopServer=false;}
      admin=null;
    }
    let serverClosed=server?.witness?.closed===true&&definiteNormalClose(server.witness)
      &&server.witness.result.code===0;
    if(server?.witness&&mayStopServer&&!serverClosed){
      record('server-close');serverClosed=await settleOwnedPrivatePostgresV1(server.witness,30000);
    }
    const knownReasons=new Set([
      'PRIVATE_TEST_CLUSTER_AMBIENT_PG_FORBIDDEN','PRIVATE_TEST_CLUSTER_HOST_INVALID',
      'PRIVATE_TEST_CLUSTER_DISK_LOW','PRIVATE_TEST_CLUSTER_SOURCE_DIRTY','PRIVATE_TEST_CLUSTER_TOOL_INVALID',
      'PRIVATE_TEST_CLUSTER_ROOT_CHANGED','PRIVATE_TEST_CLUSTER_PASSWORD_FILE_INVALID',
      'PRIVATE_TEST_CLUSTER_INIT_FAILED','PRIVATE_TEST_CLUSTER_SERVER_UNAVAILABLE',
      'PRIVATE_TEST_CLUSTER_IDENTITY_INVALID','PRIVATE_TEST_CLUSTER_READINESS_TIMEOUT',
      'PRIVATE_TEST_CLUSTER_TEST_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_DB_CLEANUP_UNVERIFIED',
      'PRIVATE_TEST_CLUSTER_SERVER_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_CANCELLED',
      'PRIVATE_TEST_CLUSTER_DEADLINE',
      'PRIVATE_TEST_JOURNAL_REFUSED',
    ]);
    const reason=knownReasons.has(error?.message)?error.message:'PRIVATE_TEST_CLUSTER_REFUSED';
    record('refused',{operation,reason,root,retained:root!==null,testsStarted,serverClosed:serverClosed===true});
    journal?.finish({outcome:'refused',reason,productionAuthority:false});process.exitCode=1;
    unrefOwned(init);unrefOwned(testChild);unrefOwned(server);
  }finally{
    if(journal&&!journal.close())process.exitCode=1;
    if(directoryFd!==null){try{closeSync(directoryFd);}catch{process.exitCode=1;}}
    cancellation.dispose();
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
