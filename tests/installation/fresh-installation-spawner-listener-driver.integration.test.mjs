// Proposed tests/installation/fresh-installation-spawner-listener-driver.integration.test.mjs.
// Ordinary installed-driver regression candidate. UNRUN by preparer.
// No production authority is imported/mocked. Root supplies its owned isolated
// PostgreSQL test endpoint. Separate held children bound the negative hang.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const writer=fileURLToPath(new URL('../../',import.meta.url));
const version=JSON.parse(readFileSync(path.join(writer,'node_modules/postgres/package.json'),'utf8')).version;
const endpoint=process.env.SETFARM_PG_URL;
assert.equal(version,'3.4.8','this diagnostic pins the installed postgres3.4.8 behavior');
assert.ok(endpoint,'run only through the existing owned isolated-PG test wrapper');
const parsed=new URL(endpoint);
assert.ok(['postgres:','postgresql:'].includes(parsed.protocol));
assert.ok(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname));
assert.match(parsed.pathname,/^\/setfarm_p3_[a-f0-9]+_primary$/,'requires the wrapper-created isolated primary DB');
assert.ok(parsed.search===''&&parsed.hash==='','isolated endpoint cannot contain URL options');

function child(mode){
  const program=`
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const postgres=createRequire(${JSON.stringify(path.join(writer,'package.json'))})('postgres');
const mode=${JSON.stringify(mode)},url=process.env.SETFARM_PG_URL;
const options={max:1,fetch_types:false,connect_timeout:2,idle_timeout:0,max_lifetime:0,onnotice(){}};
const done=value=>process.stdout.write(JSON.stringify(value)+'\\n',()=>process.exit(0));
try{
  if(mode==='reserve-first'){
    const application='setfarm-reserve-first-'+randomUUID();
    const pool=postgres(url,{...options,connection:{application_name:application}});
    let settled=false;
    void pool.reserve().then(()=>{settled=true;},()=>{settled=true;});
    // A separate read-only observer proves authentication/ReadyForQuery reached
    // an idle backend rather than mistaking unavailable networking for the bug.
    const observer=postgres(url,options),deadline=Date.now()+4000;
    let authenticatedIdle=false;
    while(Date.now()<deadline){
      const rows=await observer.unsafe("SELECT state,wait_event,query FROM pg_catalog.pg_stat_activity WHERE application_name=$1 AND datname=current_database() AND usename=current_user",[application]);
      authenticatedIdle=rows.length===1&&rows[0].state==='idle'&&rows[0].wait_event==='ClientRead'&&rows[0].query==='';
      if(authenticatedIdle)break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(authenticatedIdle,true);await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(settled,false);
    // Explicit termination of THIS held diagnostic child closes its sockets.
    // This is not a claim that pool.end resolves the reserve-first condition.
    done({mode,authenticatedIdle,reserveFirstPending:true,settlement:'own-child-exit',poolEndClaimed:false});
  }else{
    const pool=postgres(url,options);
    let reserved;
    try{
      const warm=await pool.unsafe('SELECT 1::integer AS ready');
      assert.equal(warm.length,1);assert.equal(warm[0].ready,1);
      const warmPid=warm.state.pid;assert.ok(Number.isSafeInteger(warmPid)&&warmPid>0);
      reserved=await pool.reserve();
      const rows=await reserved.unsafe('SELECT pg_backend_pid()::integer AS pid');
      assert.equal(rows.length,1);assert.equal(rows[0].pid,warmPid);
      reserved.release();reserved=undefined;
      await pool.end({timeout:1});
      done({mode,warmup:true,sameBackend:true,ownedPoolClosed:true});
    }finally{
      // Failure cleanup remains bounded by the PARENT'S held-child deadline.
      if(reserved)reserved.release();
    }
  }
}catch{
  process.stderr.write('INSTALLED_DRIVER_REGRESSION_REFUSED\\n',()=>process.exit(2));
}
`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',program],{
    cwd:writer,env:{...process.env,NODE_OPTIONS:'',NODE_TEST_CONTEXT:''},
    encoding:'utf8',timeout:8000,killSignal:'SIGKILL',maxBuffer:16*1024,
    stdio:['ignore','pipe','pipe'],
  });
  assert.equal(result.error,undefined,'held driver child exceeded its bound or failed to start');
  assert.equal(result.signal,null,'held driver child did not terminate normally');
  assert.equal(result.status,0,'installed driver child reported a redacted failure');
  assert.equal(Buffer.byteLength(result.stderr),0,'unexpected child diagnostics withheld');
  assert.ok(Buffer.byteLength(result.stdout)<=1024);
  return JSON.parse(result.stdout);
}

test('installed postgres3.4.8 reserve-first/fetch_types:false remains pending after authenticated idle',{timeout:10000},()=>{
  assert.deepEqual(child('reserve-first'),{mode:'reserve-first',authenticatedIdle:true,reserveFirstPending:true,settlement:'own-child-exit',poolEndClaimed:false});
});
test('installed postgres3.4.8 fixed read warmup permits same-backend reserve and actual pool close',{timeout:10000},()=>{
  assert.deepEqual(child('warmup'),{mode:'warmup',warmup:true,sameBackend:true,ownedPoolClosed:true});
});
