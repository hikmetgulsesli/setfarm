import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {chmodSync,closeSync,constants,fstatSync,lstatSync,mkdtempSync,openSync,
  readFileSync,statfsSync,writeFileSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import postgres from 'postgres';
import {verifyFindingPrivateClusterIdentityV1} from './finding-test-preflight.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const PG='/opt/homebrew/opt/postgresql@17/bin/';

export function planPrivatePostgresTestsV1({root,port,mode}={}){
  if(typeof root!=='string'||!/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/.test(root)
    ||!Number.isInteger(port)||port<1024||port>65535||port===5432
    ||!['findings','all'].includes(mode))throw Error('PRIVATE_TEST_CLUSTER_PLAN_INVALID');
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
    test:Object.freeze(['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
      ...(mode==='findings'?['run','test:findings']:['test'])]),
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

function event(stage,fields={}){
  console.log(JSON.stringify({event:'private-postgres-test-cluster',stage,...fields}));
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
function forwardedChild(tool,args,env,secrets){
  const child=spawn(tool,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
  const witness=observeOwnedPrivateTestChildV1(child);
  for(const [input,output] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]){
    const redactor=createPrivateTestOutputRedactorV1(secrets);
    input.on('data',chunk=>output.write(redactor.write(chunk)));
    input.once('end',()=>output.write(redactor.end()));
    input.once('error',()=>{});
  }
  return {child,witness};
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
  return witness.closed&&witness.exited&&!witness.failed
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
async function quiescence(admin){
  for(let sample=0;sample<2;sample++){
    const rows=await admin`SELECT pg_backend_pid() AS pid,
      (SELECT array_agg(datname ORDER BY datname) FROM pg_database) AS databases,
      (SELECT array_agg(pid ORDER BY pid) FROM pg_stat_activity
        WHERE pid=pg_backend_pid() OR backend_type IS NULL OR backend_type NOT IN (
          'autovacuum launcher','autovacuum worker','background writer',
          'checkpointer','walwriter','logical replication launcher'
        ) OR client_addr IS NOT NULL) AS backends`;
    if(rows.length!==1||!verifyPrivateTestClusterQuiescenceV1(rows[0].databases,rows[0].backends,rows[0].pid)){
      return false;
    }
    if(sample===0)await delay(100);
  }
  return true;
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==1||!['findings','all'].includes(args[0])){
    console.error('PRIVATE_TEST_CLUSTER_MODE_INVALID');process.exitCode=1;return;
  }
  let stage='preconditions',root=null,directoryFd=null,init=null,server=null,testChild=null,admin=null;
  let testsStarted=false,mayStopServer=true,resultCode=1;
  const cancellation=watchPrivateTestCancellationV1(process);
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
    const port=await cancellation.run(racePrivateTestDeadlineV1(reservePort(),10000)),
      plan=planPrivatePostgresTestsV1({root,port,mode:args[0]});
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
    event('private-root-retained',{root,port});
    stage='initdb';recheckRoot();init=forwardedChild(PG+'initdb',plan.initdb,env,secrets);
    if(!await cancellation.run(boundedClose(init.witness,60000))
      ||!definiteNormalClose(init.witness)||init.witness.result.code!==0){
      throw Error('PRIVATE_TEST_CLUSTER_INIT_FAILED');
    }
    stage='server-start';recheckRoot();server=forwardedChild(PG+'postgres',plan.server,env,secrets);
    admin=postgres(url,{max:1,connect_timeout:2,idle_timeout:1,onnotice:()=>{}});
    stage='identity';await cancellation.run(racePrivateTestDeadlineV1(
      clusterIdentity(admin,url,root+'/data',server),30000));recheckRoot();
    event('identity-verified',{root,port,serverPid:server.child.pid});
    const testEnv={...env,SETFARM_TEST_PG_ADMIN_URL:url,SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY:root+'/data'};
    stage='test-graph';testsStarted=true;mayStopServer=false;
    testChild=forwardedChild(process.execPath,plan.test,testEnv,secrets);
    await cancellation.run(testChild.witness.completion);
    if(!definiteNormalClose(testChild.witness))throw Error('PRIVATE_TEST_CLUSTER_TEST_CLOSE_UNCERTAIN');
    resultCode=testChild.witness.result.code;
    stage='private-db-quiescence';recheckRoot();
    if(!await cancellation.run(racePrivateTestDeadlineV1(quiescence(admin),10000))){
      throw Error('PRIVATE_TEST_CLUSTER_DB_CLEANUP_UNVERIFIED');
    }
    mayStopServer=true;event('direct-test-child-closed',{code:resultCode,privateDbQuiescent:true});
    stage='admin-close';await cancellation.run(admin.end({timeout:5}));admin=null;
    stage='server-close';
    if(!await cancellation.run(settleOwnedPrivatePostgresV1(server.witness,30000))){
      mayStopServer=false;throw Error('PRIVATE_TEST_CLUSTER_SERVER_CLOSE_UNCERTAIN');
    }
    event('server-definitely-closed',{root,port,code:resultCode,retained:true,productionAuthority:false});
    process.exitCode=resultCode;
  }catch(error){
    if(cancellation.cancelled&&testsStarted)mayStopServer=false;
    if(admin){
      try{await admin.end({timeout:5});}catch{if(testsStarted)mayStopServer=false;}
      admin=null;
    }
    let serverClosed=server?.witness.closed===true&&definiteNormalClose(server.witness)
      &&server.witness.result.code===0;
    if(server&&mayStopServer&&!serverClosed)serverClosed=await settleOwnedPrivatePostgresV1(server.witness,30000);
    const knownReasons=new Set([
      'PRIVATE_TEST_CLUSTER_AMBIENT_PG_FORBIDDEN','PRIVATE_TEST_CLUSTER_HOST_INVALID',
      'PRIVATE_TEST_CLUSTER_DISK_LOW','PRIVATE_TEST_CLUSTER_SOURCE_DIRTY','PRIVATE_TEST_CLUSTER_TOOL_INVALID',
      'PRIVATE_TEST_CLUSTER_ROOT_CHANGED','PRIVATE_TEST_CLUSTER_PASSWORD_FILE_INVALID',
      'PRIVATE_TEST_CLUSTER_INIT_FAILED','PRIVATE_TEST_CLUSTER_SERVER_UNAVAILABLE',
      'PRIVATE_TEST_CLUSTER_IDENTITY_INVALID','PRIVATE_TEST_CLUSTER_READINESS_TIMEOUT',
      'PRIVATE_TEST_CLUSTER_TEST_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_DB_CLEANUP_UNVERIFIED',
      'PRIVATE_TEST_CLUSTER_SERVER_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_CANCELLED',
      'PRIVATE_TEST_CLUSTER_DEADLINE',
    ]);
    const reason=knownReasons.has(error?.message)?error.message:'PRIVATE_TEST_CLUSTER_REFUSED';
    event('refused',{stage,reason,root,retained:root!==null,testsStarted,serverClosed:serverClosed===true,
      productionAuthority:false});process.exitCode=1;
    unrefOwned(init);unrefOwned(testChild);unrefOwned(server);
  }finally{
    if(directoryFd!==null)closeSync(directoryFd);
    cancellation.dispose();
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
