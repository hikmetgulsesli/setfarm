import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
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
