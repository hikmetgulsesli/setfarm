import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {chmodSync,closeSync,constants,existsSync,mkdtempSync,openSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const MODULE=new URL('../run-private-postgres-tests.mjs',import.meta.url);
async function implementation(){
  assert.ok(existsSync(MODULE),'ordinary private test cluster implementation missing');
  return import(MODULE.href);
}
const root='/tmp/setfarm-task6a-pg.Abc123';
test('private cluster plans only SCRAM loopback PG17 and the unchanged findings command',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const result=plan({root,port:55439,mode:'findings'});
  assert.deepEqual(result.initdb,[
    '-D',root+'/data','--username=postgres','--auth-host=scram-sha-256',
    '--auth-local=scram-sha-256','--pwfile='+root+'/password','--encoding=UTF8',
    '--locale=C','--no-clean','--no-instructions',
  ]);
  assert.deepEqual(result.server,[
    '-D',root+'/data','-h','127.0.0.1','-p','55439','-k',root,
    '-c','unix_socket_permissions=0700','-c','shared_buffers=32MB',
    '-c','max_connections=50',
  ]);
  assert.deepEqual(result.test,[
    '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:findings',
  ]);
  assert.deepEqual(plan({root,port:55439,mode:'all'}).test,[
    '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','test',
  ]);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.initdb),true);
});
for(const [label,overrides] of [
  ['live port',{port:5432}],['zero port',{port:0}],['fraction port',{port:55439.5}],
  ['overflow port',{port:65536}],['unknown command',{mode:'build'}],
  ['relative root',{root:'setfarm-task6a-pg.Abc123'}],['system root',{root:'/tmp'}],
  ['retained arbitrary root',{root:'/tmp/old-fixture'}],
  ['nested root',{root:root+'/data'}],['traversal root',{root:root+'/../other'}],
])test('private cluster refuses '+label+' before effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  assert.throws(()=>plan({root,port:55439,mode:'findings',...overrides}),
    /^Error: PRIVATE_TEST_CLUSTER_PLAN_INVALID$/);
});

test('private test output hides passwords and full URLs across every chunk boundary',async()=>{
  const {createPrivateTestOutputRedactorV1:create}=await implementation();
  const password='hand-derived-secret-0123456789';
  const url='postgresql://postgres:'+password+'@127.0.0.1:55439/postgres';
  const input=Buffer.from('before '+url+' middle '+password+' after \u00e9\n');
  const expected=Buffer.from('before [REDACTED] middle [REDACTED] after \u00e9\n');
  for(let split=0;split<=input.length;split++){
    const redactor=create([password,url]);
    assert.deepEqual(Buffer.concat([
      redactor.write(input.subarray(0,split)),redactor.write(input.subarray(split)),redactor.end(),
    ]),expected,'split '+split);
    assert.throws(()=>redactor.write(Buffer.from('late')),/PRIVATE_TEST_REDACTOR_CLOSED/);
  }
  const redactor=create([password,url]);
  assert.deepEqual(Buffer.concat([...input].map(byte=>redactor.write(Buffer.from([byte])))
    .concat(redactor.end())),expected);
});

test('private redactor keeps ordinary binary output exact and refuses empty secrets',async()=>{
  const {createPrivateTestOutputRedactorV1:create}=await implementation();
  const redactor=create(['long-secret']);
  const data=Buffer.from([0,255,195,169,10]);
  assert.deepEqual(Buffer.concat([redactor.write(data),redactor.end()]),data);
  assert.throws(()=>create(['']),/PRIVATE_TEST_REDACTOR_SECRET_INVALID/);
});

test('private output termination never flushes a partial credential prefix',async()=>{
  const {createPrivateTestOutputRedactorV1:create}=await implementation();
  const secret='hand-derived-secret-0123456789';
  const url='postgresql://postgres:'+secret+'@127.0.0.1:55439/postgres';
  for(const sensitive of [secret,url])for(let length=1;length<sensitive.length;length++){
    const input=Buffer.from('normal '+sensitive.slice(0,length));
    for(let split=0;split<=input.length;split++){
      const redactor=create([secret,url]);
      assert.deepEqual(Buffer.concat([
        redactor.write(input.subarray(0,split)),redactor.write(input.subarray(split)),redactor.end(),
      ]),Buffer.from('normal [REDACTED]'),'prefix '+length+' split '+split);
    }
  }
});

function fakeChild(){
  const child=new EventEmitter();
  const signals=[];
  child.kill=signal=>{signals.push(signal);return true;};
  return {child,signals};
}
test('private cancellation races owned waits without signalling any child',async()=>{
  const {watchPrivateTestCancellationV1:watch}=await implementation();
  assert.equal(typeof watch,'function','owned wait cancellation missing');
  const emitter=new EventEmitter(),controller=watch(emitter);
  assert.equal(controller.cancelled,false);
  const waiting=controller.run(new Promise(()=>{}));
  emitter.emit('SIGTERM');
  await assert.rejects(waiting,/PRIVATE_TEST_CLUSTER_CANCELLED/);
  assert.equal(controller.cancelled,true);
  controller.dispose();assert.equal(emitter.listenerCount('SIGINT'),0);
  assert.equal(emitter.listenerCount('SIGTERM'),0);
});
test('private SQL deadline refuses a connected but permanently stalled query',async()=>{
  const {racePrivateTestDeadlineV1:bounded}=await implementation();
  assert.equal(typeof bounded,'function','absolute private SQL deadline missing');
  await assert.rejects(bounded(new Promise(()=>{}),5),/PRIVATE_TEST_CLUSTER_DEADLINE/);
  assert.equal(await bounded(Promise.resolve('actual-result'),50),'actual-result');
});
test('private shutdown gate requires exact original DB catalog and sole wrapper backend',async()=>{
  const {verifyPrivateTestClusterQuiescenceV1:verify}=await implementation();
  assert.equal(typeof verify,'function','real private cleanup gate missing');
  assert.equal(verify(['template1','postgres','template0'],[123],123),true);
  for(const [databases,backends,pid] of [
    [['postgres','template0','template1','setfarm_p3_retained'],[123],123],
    [['postgres','template0','template1'],[123,456],123],
    [['postgres','template0'],[123],123],
    [['postgres','template0','template1'],[],123],
    [['postgres','template0','template1'],[123],0],
  ])assert.equal(verify(databases,backends,pid),false);
});
test('private PG settlement requires actual owned SIGINT followed by successful close',async()=>{
  const {observeOwnedPrivateTestChildV1:observe,settleOwnedPrivatePostgresV1:settle}=await implementation();
  const {child,signals}=fakeChild();const witness=observe(child);
  const result=settle(witness,50);
  child.emit('exit',0,null);child.emit('close',0,null);
  assert.equal(await result,true);assert.deepEqual(signals,['SIGINT']);
  assert.equal(witness.closed,true);assert.deepEqual(witness.result,{code:0,signal:null});
});
test('an exit event alone never certifies private server stream closure',async()=>{
  const {observeOwnedPrivateTestChildV1:observe,settleOwnedPrivatePostgresV1:settle}=await implementation();
  const {child,signals}=fakeChild();const witness=observe(child);
  child.emit('exit',0,null);
  assert.equal(await settle(witness,5),false);assert.deepEqual(signals,[]);
  assert.equal(witness.closed,false);
});
for(const [label,code,signal,error] of [
  ['nonzero',1,null,false],['signal',null,'SIGTERM',false],['spawn error',0,null,true],
])test('private closure refuses '+label,async()=>{
  const {observeOwnedPrivateTestChildV1:observe,settleOwnedPrivatePostgresV1:settle}=await implementation();
  const {child,signals}=fakeChild();const witness=observe(child);
  if(error)child.emit('error',new Error('do-not-print-secret'));
  child.emit('exit',code,signal);child.emit('close',code,signal);
  assert.equal(await settle(witness,5),false);assert.deepEqual(signals,[]);
});
test('already closed private server is not signalled again',async()=>{
  const {observeOwnedPrivateTestChildV1:observe,settleOwnedPrivatePostgresV1:settle}=await implementation();
  const {child,signals}=fakeChild();const witness=observe(child);
  child.emit('exit',0,null);child.emit('close',0,null);
  assert.equal(await settle(witness,5),true);assert.deepEqual(signals,[]);
});
test('private server kill failure or timeout never becomes cleanup success',async()=>{
  const {observeOwnedPrivateTestChildV1:observe,settleOwnedPrivatePostgresV1:settle}=await implementation();
  for(const acceptsSignal of [false,true]){
    const {child,signals}=fakeChild();child.kill=signal=>{signals.push(signal);return acceptsSignal;};
    assert.equal(await settle(observe(child),5),false);assert.deepEqual(signals,['SIGINT']);
  }
});

for(const args of [[],['unknown'],['findings','extra']]){
  test('private CLI refuses invalid mode '+JSON.stringify(args)+' before child effects',()=>{
    const guard=`import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
cp.spawn=cp.spawnSync=()=>{throw Error('PRIVATE_TEST_FORBIDDEN_TEST_EFFECT');};syncBuiltinESMExports();`;
    const result=spawnSync(process.execPath,[fileURLToPath(MODULE),...args],{
      encoding:'utf8',timeout:5000,maxBuffer:65536,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',
        NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
    });
    assert.equal(result.error,undefined);assert.equal(result.signal,null);
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
    assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_TEST_FORBIDDEN_TEST_EFFECT/);
  });
}

test('private CLI refuses ambient PG driver settings before any subprocess or cluster creation',()=>{
  const secretMarker='never-expose-this-pg-debug-value';
  const guard=`
import cp from 'node:child_process';import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const deny=()=>{console.log('PRIVATE_TEST_FORBIDDEN_TEST_EFFECT');throw Error('blocked');};
cp.spawn=cp.spawnSync=cp.execFileSync=deny;fs.mkdtempSync=deny;syncBuiltinESMExports();`;
  const result=spawnSync(process.execPath,[fileURLToPath(MODULE),'findings'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PGDEBUG:secretMarker,
      NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1);
  assert.match(result.stdout,/PRIVATE_TEST_CLUSTER_AMBIENT_PG_FORBIDDEN/);
  assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_TEST_FORBIDDEN_TEST_EFFECT/);
  assert.equal((result.stdout+result.stderr).includes(secretMarker),false);
});

for(const phase of ['creation','journal-opened'])test('actual wrapper '+phase+' fsync failure denies password and child effects',()=>{
  const guard=`
import cp from 'node:child_process';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
delete process.env.NODE_OPTIONS;
const original={...fs};let journalFd=null,syncs=0;
const deny=()=>{console.log('PRIVATE_TEST_FORBIDDEN_TEST_EFFECT');throw Error('test effect denied');};
cp.spawn=cp.spawnSync=deny;
cp.execFileSync=(tool,args)=>{
  if(tool==='/usr/bin/git'&&args[0]==='status')return '';
  if(['/opt/homebrew/opt/postgresql@17/bin/initdb','/opt/homebrew/opt/postgresql@17/bin/postgres'].includes(tool)
    &&args.length===1&&args[0]==='--version')return 'postgres (PostgreSQL) 17.10\\n';
  return deny();
};
fs.openSync=(pathname,...args)=>{
  if(String(pathname).endsWith('/password'))return deny();
  const fd=original.openSync(pathname,...args);
  if(String(pathname).endsWith('/transcript.journal'))journalFd=fd;return fd;
};
fs.fsyncSync=fd=>{
  if(fd===journalFd&&++syncs===${phase==='creation'?1:2})throw Error('never expose journal fault');
  return original.fsyncSync(fd);
};syncBuiltinESMExports();`;
  const result=spawnSync(process.execPath,[fileURLToPath(MODULE),'findings'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',
      NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1);
  assert.equal(result.stderr,'','test boundary loader must execute without syntax errors');
  assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_TEST_FORBIDDEN_TEST_EFFECT|never expose/);
  assert.match(result.stdout,/PRIVATE_TEST_JOURNAL_REFUSED/);
});

test('captured child binding persists real redactor output before every terminal mirror',async()=>{
  const {attachPrivateTestChildJournalV1:attach}=await implementation();
  assert.equal(typeof attach,'function','captured private child journal binding missing');
  const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:createReader}=
    await import('../private-postgres-test-journal-v1.mjs');
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  const fd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),journal=create(root,fd);
  const password='test-owned-secret-0123456789',url='postgresql://postgres:'+password+'@127.0.0.1:55439/postgres';
  const child=new EventEmitter();child.pid=101;child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  const mirrored={stdout:[],stderr:[]},persistedLength={stdout:0,stderr:0};let signals=0;
  child.kill=()=>{signals++;throw Error('forbidden child signal');};
  const mirrors=Object.fromEntries(['stdout','stderr'].map(channel=>[channel,{write(buffer){
    const reader=createReader();reader.write(readFileSync(root+'/transcript.journal'));
    const recorded=readFileSync(root+'/transcript.journal').toString().split('\n').filter(Boolean)
      .map(line=>JSON.parse(line)).filter(r=>r.kind==='output'&&r.channel===channel)
      .map(r=>Buffer.from(r.payloadBase64,'base64'));
    const bytes=Buffer.concat(recorded);assert.ok(bytes.length>=persistedLength[channel]+buffer.length);
    assert.deepEqual(bytes.subarray(bytes.length-buffer.length),buffer);
    persistedLength[channel]=bytes.length;mirrored[channel].push(Buffer.from(buffer));return true;
  }}]));
  try{
    journal.control('journal-opened',{root});journal.control('initdb');
    attach(child,'initdb',[password,url],journal,mirrors);
    const input=Buffer.from('before '+url+' middle '+password+' after\n'),expected=Buffer.from('before [REDACTED] middle [REDACTED] after\n');
    for(let split=0;split<=input.length;split++){
      child.stdout.emit('data',input.subarray(0,split));child.stdout.emit('data',input.subarray(split));
    }
    child.stdout.emit('data',Buffer.from([0,255,10]));child.stdout.emit('end');child.stderr.emit('end');
    child.emit('exit',0,null);child.emit('close',0,null);
    assert.deepEqual(Buffer.concat(mirrored.stdout),Buffer.concat([
      ...Array.from({length:input.length+1},()=>expected),Buffer.from([0,255,10]),
    ]));
    assert.equal(signals,0);assert.equal(journal.healthy,true);
    const reader=createReader(),records=reader.write(readFileSync(root+'/transcript.journal'));
    const controls=records.filter(r=>r.kind==='control').map(r=>JSON.parse(r.payload));
    assert.deepEqual(controls.filter(r=>r.stage==='child-exit'||r.stage==='child-close').map(r=>[r.stage,r.pid,r.code,r.signal]),[
      ['child-exit',101,0,null],['child-close',101,0,null],
    ]);assert.equal(reader.end().incomplete,true,'no invented terminal');
  }finally{journal.close();closeSync(fd);}
});

// Ordinary Node-only boundary fixture: NO PG process, SQL or password file.
function wrapperBoundaryFixture(mode){
  const guard=`
import cp from 'node:child_process';import fs from 'node:fs';import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';import {registerHooks,syncBuiltinESMExports} from 'node:module';
delete process.env.NODE_OPTIONS;
const original={...fs},mode=${JSON.stringify(mode)},trace=[];
let root=null,port=null,journalFd=null,closedJournal=false,testDispatched=false,journalFaulted=false,lastStage=null;
const virtualPassword=999000;
const deny=()=>{throw Error('UNIT_FORBIDDEN_NATIVE_EFFECT');};
fs.mkdtempSync=(...args)=>{root=original.mkdtempSync(...args);return root;};
cp.execFileSync=(tool,args)=>{
  if(tool==='/usr/bin/git'&&args[0]==='status')return '';
  if(['/opt/homebrew/opt/postgresql@17/bin/initdb','/opt/homebrew/opt/postgresql@17/bin/postgres'].includes(tool)
    &&args.length===1&&args[0]==='--version')return 'postgres (PostgreSQL) 17.10\\n';return deny();
};cp.spawnSync=deny;
fs.openSync=(pathname,...args)=>{
  if(String(pathname).endsWith('/password')){trace.push('virtual-password-open');return virtualPassword;}
  const fd=original.openSync(pathname,...args);
  if(String(pathname).endsWith('/transcript.journal'))journalFd=fd;return fd;
};
fs.fstatSync=fd=>fd===virtualPassword?{isFile:()=>true,uid:501,mode:0o100600,nlink:1}:original.fstatSync(fd);
fs.writeFileSync=(fd,...args)=>fd===virtualPassword?undefined:original.writeFileSync(fd,...args);
fs.closeSync=fd=>{
  if(fd===virtualPassword)return;
  if(fd===journalFd&&!closedJournal){closedJournal=true;original.closeSync(fd);
    if(mode==='close-fault')throw Error('unit close uncertain');return;}
  return original.closeSync(fd);
};
fs.writeSync=(fd,buffer,...args)=>{
  const count=original.writeSync(fd,buffer,...args);
  if(fd===journalFd){const frame=JSON.parse(buffer.toString());
    if(frame.kind==='control')lastStage=JSON.parse(Buffer.from(frame.payloadBase64,'base64')).stage;
  }return count;
};
fs.fsyncSync=fd=>{
  const beforeDispatch=(mode==='before-server'&&lastStage==='server-start')
    ||(mode==='before-test'&&lastStage==='test-graph');
  if(fd===journalFd&&((testDispatched&&mode==='journal-loss')||beforeDispatch)&&!journalFaulted){journalFaulted=true;
    trace.push('journal-fault');throw Error('unit journal fault');}
  return original.fsyncSync(fd);
};
function finish(child,code){
  trace.push(child.role+'-exit');child.emit('exit',code,null);
  let ended=0;for(const stream of [child.stdout,child.stderr]){
    stream.once('end',()=>{if(++ended===2)setImmediate(()=>{trace.push(child.role+'-close');child.emit('close',code,null);});});
    stream.end();
    if(mode==='attach-server'&&child.role==='server')stream.resume();
  }
}
const spawned=new Set();
cp.spawn=(tool,args,options)=>{
  let role;
  if(tool==='/opt/homebrew/opt/postgresql@17/bin/initdb')role='initdb';
  else if(tool==='/opt/homebrew/opt/postgresql@17/bin/postgres')role='server';
  else if(tool===process.execPath&&args.join('|')==='/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js|run|test:findings')role='test';
  else return deny();
  if(spawned.has(role))return deny();spawned.add(role);trace.push(role+'-dispatch');
  if(role==='server'){root=args[args.indexOf('-k')+1];port=Number(args[args.indexOf('-p')+1]);}
  const child=new EventEmitter();child.role=role;child.pid={initdb:7101,server:7102,test:7103}[role];
  child.stdout=new PassThrough();child.stderr=new PassThrough();child.unref=()=>trace.push(role+'-unref');
  if((mode==='attach-server'&&role==='server')||(mode==='attach-test'&&role==='test')){
    const originalOn=child.stdout.on.bind(child.stdout);
    child.stdout.on=(event,listener)=>{if(event==='data')throw Error('unit attachment uncertain');return originalOn(event,listener);};
  }
  child.kill=signal=>{if(role!=='server'||signal!=='SIGINT')return deny();trace.push('server-SIGINT');
    setImmediate(()=>finish(child,0));return true;};
  if(role!=='server')setImmediate(()=>{
    if(child.stdout.destroyed)return;
    if(role==='test'){
      testDispatched=true;
      if(mode==='mirror-error')process.stdout.emit('error',Error('unit EPIPE'));
      if(mode==='cancel'){
        trace.push('test-exit');child.emit('exit',0,null);process.emit('SIGTERM');return;
      }
    }
    child.stdout.write('unit '+role+' output\\n');
    if(role==='test'&&mode==='input-error')child.stdout.emit('error',Error('must-not-expose-input-error'));
    finish(child,role==='test'&&mode==='nonzero'?7:0);
  });return child;
};
let samples=0;
globalThis.__privateJournalUnitDriver=()=>{
  const query=async strings=>{
    const sql=strings.join('?');
    if(sql.includes('current_setting')){trace.push('identity-row');return [{data_directory:root+'/data',port:String(port),
      socket_directories:root,listen_addresses:'127.0.0.1',password_encryption:'scram-sha-256',socket_permissions:'0700'}];}
    if(sql.includes('pg_backend_pid')){trace.push('quiescence-'+samples++);return [{pid:7110,
      databases:mode==='retained-db'?['postgres','template0','template1','unit-retained']:['postgres','template0','template1'],backends:[7110]}];}
    return deny();
  };
  query.end=async()=>{trace.push('admin-ended');};return query;
};
const driverUrl='data:text/javascript;base64,'+Buffer.from('export default (...args)=>globalThis.__privateJournalUnitDriver(...args);').toString('base64');
registerHooks({resolve(specifier,context,next){return specifier==='postgres'?{url:driverUrl,shortCircuit:true}:next(specifier,context);}});
syncBuiltinESMExports();
process.once('exit',()=>{original.writeSync(1,Buffer.from('UNIT_BOUNDARY_RESULT '+JSON.stringify({root,trace,journalFaulted})+'\\n'));});`;
  return spawnSync(process.execPath,[fileURLToPath(MODULE),'findings'],{
    encoding:'utf8',timeout:7000,maxBuffer:262144,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',
      NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
  });
}
for(const mode of ['normal','nonzero','mirror-error','journal-loss','close-fault','retained-db','cancel','before-server','before-test','attach-server','attach-test','input-error']){
  test('wrapper boundary '+mode+' retains ordered observed outcomes without native effects',async()=>{
    const result=wrapperBoundaryFixture(mode);
    assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stderr,'',result.stderr);
    const marker=result.stdout.split('\n').find(line=>line.startsWith('UNIT_BOUNDARY_RESULT '));
    assert.ok(marker,'unit boundary must finish without native tool dispatch');
    const {root,trace}=JSON.parse(marker.slice('UNIT_BOUNDARY_RESULT '.length));
    const {createPrivateTestJournalReaderV1:createReader}=await import('../private-postgres-test-journal-v1.mjs');
    const reader=createReader(),bytes=readFileSync(root+'/transcript.journal');
    for(let offset=0;offset<bytes.length;offset+=65536)reader.write(bytes.subarray(offset,offset+65536));
    const observed=reader.end();
    const positive=['normal','nonzero','mirror-error','close-fault'].includes(mode);
    assert.equal(observed.terminalObserved,positive||['retained-db','cancel','attach-server','attach-test','input-error'].includes(mode));
    assert.equal(observed.incomplete,!positive);
    if(positive){assert.equal(observed.terminal.testCode,mode==='nonzero'?7:0);}
    assert.equal(result.status,mode==='nonzero'?7:['normal','mirror-error'].includes(mode)?0:1);
    const stops=trace.filter(item=>item==='server-SIGINT');
    assert.equal(stops.length,['retained-db','cancel','before-server','attach-test'].includes(mode)?0:1);
    if(stops.length&&!['before-test','attach-server'].includes(mode)){
      assert.ok(trace.indexOf('test-close')<trace.indexOf('quiescence-0'));
      assert.ok(trace.indexOf('quiescence-0')<trace.indexOf('quiescence-1'));
      assert.ok(trace.indexOf('quiescence-1')<trace.indexOf('admin-ended'));
      assert.ok(trace.indexOf('admin-ended')<trace.indexOf('server-SIGINT'));
    }
    if(mode==='journal-loss')assert.ok(trace.indexOf('journal-fault')<trace.indexOf('quiescence-0'),
      'persistence must actually fail during captured test observations, not at final close');
    if(['before-server','before-test'].includes(mode)){
      assert.equal(trace.includes('test-dispatch'),false);
      if(mode==='before-server')assert.equal(trace.includes('server-dispatch'),false);
    }
    if(mode==='attach-test')assert.equal(trace.includes('test-unref'),true,'original captured test record must survive setup failure');
    assert.equal(existsSync(root+'/password'),false,'virtual password must never become a real credential file');
    assert.doesNotMatch(result.stdout,/UNIT_FORBIDDEN_NATIVE_EFFECT|unit journal fault|unit close uncertain/);
  });
}

test('missing captured output stream records uncertainty without fabricated EOF or callback throw',async()=>{
  const {attachPrivateTestChildJournalV1:attach}=await implementation();
  const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:createReader}=
    await import('../private-postgres-test-journal-v1.mjs');
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  const fd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),journal=create(root,fd);
  const child=new EventEmitter();child.stdout=null;child.stderr=new EventEmitter();
  try{
    journal.control('journal-opened',{root});journal.control('initdb');
    assert.doesNotThrow(()=>attach(child,'initdb',['unit-secret'],journal,{stdout:{write(){}},stderr:{write(){}}}));
    child.emit('error',Error('do-not-log'));child.stderr.emit('end');child.emit('close',-2,null);
    const reader=createReader(),records=reader.write(readFileSync(root+'/transcript.journal'));
    const controls=records.filter(r=>r.kind==='control').map(r=>JSON.parse(r.payload));
    assert.equal(controls.some(r=>r.stage==='stream-error'&&r.channel==='stdout'),true);
    assert.equal(controls.some(r=>r.stage==='stream-end'&&r.channel==='stdout'),false);
    assert.equal(reader.end().incomplete,true);assert.equal(journal.healthy,false);
  }finally{journal.close();closeSync(fd);}
});

for(const ending of ['end','error','close'])test('actual journal binding suppresses a truncated secret on stream '+ending,async()=>{
  const {attachPrivateTestChildJournalV1:attach}=await implementation();
  const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:createReader}=
    await import('../private-postgres-test-journal-v1.mjs');
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  const fd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),journal=create(root,fd);
  const child=new EventEmitter();child.pid=101;child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  const secret='unit-secret-abcdefgh',mirrored=[];
  try{
    journal.control('journal-opened',{root});journal.control('initdb');
    attach(child,'initdb',[secret],journal,{stdout:{write(buffer){mirrored.push(Buffer.from(buffer));return true;}},
      stderr:{write(){return true;}}});
    child.stdout.emit('data',Buffer.from('normal '+secret.slice(0,-3)));
    assert.doesNotThrow(()=>child.stdout.emit(ending,ending==='error'?Error('arbitrary error secret'):undefined));
    child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);
    assert.deepEqual(Buffer.concat(mirrored),Buffer.from('normal [REDACTED]'));
    const reader=createReader(),records=reader.write(readFileSync(root+'/transcript.journal'));
    assert.deepEqual(Buffer.concat(records.filter(r=>r.kind==='output').map(r=>r.payload)),Buffer.from('normal [REDACTED]'));
    const controls=records.filter(r=>r.kind==='control').map(r=>JSON.parse(r.payload));
    assert.equal(controls.some(r=>r.stage==='stream-end'&&r.channel==='stdout'),ending==='end');
    assert.equal(journal.healthy,ending==='end');assert.equal(reader.end().incomplete,true);
  }finally{journal.close();closeSync(fd);}
});
