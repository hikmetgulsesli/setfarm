import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {chmodSync,closeSync,constants,existsSync,mkdtempSync,openSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

// Reviewed fixed-host DATA, independently pinned here; never an ambient selector.
const TASK7_POLICY_BYTES=readFileSync(new URL('../../src/installation/manual-orphan-fixed-host-policy-v1.json',import.meta.url));
assert.equal(TASK7_POLICY_BYTES.length,318,'fixed-host policy exact byte count');
assert.equal(createHash('sha256').update(TASK7_POLICY_BYTES).digest('hex'),
  '4b7ed03bf755ec453e0c7a79d3fcf4f4f4fee387dc9bf551d55e41e7b2281dc5','independent fixed-host policy digest');
const TASK7_HOST_POLICY=Object.freeze(JSON.parse(TASK7_POLICY_BYTES.toString('utf8')));

const MODULE=new URL('../run-private-postgres-tests.mjs',import.meta.url);
async function implementation(){
  assert.ok(existsSync(MODULE),'ordinary private test cluster implementation missing');
  return import(MODULE.href);
}
const root='/tmp/setfarm-task6a-pg.Abc123';
for(const file of ['base-schema-readonly-verifier-v1.integration.test.ts',
  'contract-spine-readonly-verifier-v1.integration.test.ts'])
for(const [label,password] of [['nonhex','NEVER_EXPOSE_PRIVATE_LOGIN_BAD_PASSWORD'],
  ['empty',''],['malformed-encoding','NEVER_EXPOSE_PRIVATE_LOGIN_BAD_PASSWORD%ZZ']]){
  test('actual '+file+' refuses '+label+' password before connecting or exposing it',()=>{
    const guard=`import net from 'node:net';
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
  const options=Array.isArray(args[0])?args[0][0]:args[0];
  if(Number(options)===55439
    ||(typeof options==='string'&&options.includes('setfarm-task6a-pg.Abc123'))
    ||(options&&typeof options==='object'&&(Number(options.port)===55439
      ||String(options.path??'').includes('setfarm-task6a-pg.Abc123')))){
    console.log('PRIVATE_LOGIN_FORBIDDEN_CONNECT');process.exit(87);
  }
  return connect.apply(this,args);
};`;
    const filePath=fileURLToPath(new URL('../../tests/execution-attempts/'+file,import.meta.url));
    const result=spawnSync(process.execPath,['--import','tsx','--test',filePath],{
      encoding:'utf8',timeout:5000,maxBuffer:131072,
      env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',LC_ALL:'C',
        SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY:root+'/data',
        SETFARM_TEST_PG_ADMIN_URL:'postgresql://postgres:'+password+'@127.0.0.1:55439/postgres',
        NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
    });
    assert.equal(result.error,undefined);assert.equal(result.signal,null);
    assert.equal(result.status,1);
    const output=result.stdout+result.stderr;
    assert.match(output,/PRIVATE_READONLY_LOGIN_PASSWORD_INVALID/);
    assert.doesNotMatch(output,/PRIVATE_LOGIN_FORBIDDEN_CONNECT|NEVER_EXPOSE_PRIVATE_LOGIN_BAD_PASSWORD/);
  });
}

for(const fileName of ['base-schema-readonly-verifier-v1.integration.test.ts',
  'contract-spine-readonly-verifier-v1.integration.test.ts'])
for(const [label,algorithm] of [['missing',undefined],['legacy','md5'],
  ['noncanonical','scram-sha-256 ']]){
  test('actual '+fileName+' refuses '+label+' algorithm before database or role effects',async()=>{
    const file=fileURLToPath(new URL('../../tests/execution-attempts/'+fileName,import.meta.url));
    const actualRequire=createRequire(file),ts=actualRequire('typescript');
    async function consumer(removeGuard){
      let callback,databaseCreates=0,roleEffects=0,adminEnds=0,removed=0;
      const admin=async strings=>{
        if(!strings.join('?').includes("current_setting('data_directory')")){
          throw new Error('PRIVATE_ALGORITHM_FORBIDDEN_QUERY');
        }
        return [{data_directory:root+'/data',port:'55439',socket_directories:root,
          password_encryption:algorithm}];
      };
      admin.unsafe=async sql=>{
        if(sql==='DROP ACCESS METHOD IF EXISTS task6a_alt_heap')return [];
        roleEffects++;throw new Error('PRIVATE_ALGORITHM_FORBIDDEN_ROLE');
      };
      admin.end=async()=>{adminEnds++;};
      const compiled=ts.transpileModule(readFileSync(file,'utf8'),{
        compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
        fileName:file,
        ...(removeGuard?{transformers:{before:[context=>{
          function visit(node){
            if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)){
              const call=node.expression,arg=call.arguments[0];
              if(ts.isPropertyAccessExpression(call.expression)
                &&call.expression.name.text==='equal'&&arg
                &&ts.isPropertyAccessExpression(arg)&&arg.name.text==='password_encryption'){
                removed++;return context.factory.createEmptyStatement();
              }
            }
            return ts.visitEachChild(node,visit,context);
          }
          return source=>ts.visitNode(source,visit);
        }]}}:{}),
      }).outputText;
      runInNewContext(compiled,{
        exports:{},Buffer,URL,console,
        process:{env:{SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY:root+'/data',
          SETFARM_TEST_PG_ADMIN_URL:'postgresql://postgres:'+('a'.repeat(64))+'@127.0.0.1:55439/postgres'}},
        require(specifier){
          if(specifier==='node:test')return {test(_name,_options,run){callback=run;}};
          if(specifier==='postgres')return ()=>admin;
          if(specifier==='./test-database.js')return {async createIsolatedTestDatabase(){
            databaseCreates++;throw new Error('PRIVATE_ALGORITHM_FORBIDDEN_DATABASE');
          }};
          if(specifier.includes('/base-schema-readonly-verifier-v1.js'))return {
            verifyOrdinaryBaseSchemaCatalogReadOnlyV1(){throw new Error('PRIVATE_ALGORITHM_FORBIDDEN_VERIFIER');}};
          if(specifier.includes('/contract-spine-readonly-verifier-v1.js'))return {
            verifyContractSpineCurrentHeadJournalReadOnlyV1(){throw new Error('PRIVATE_ALGORITHM_FORBIDDEN_VERIFIER');}};
          return actualRequire(specifier);
        },
      },{filename:file});
      assert.equal(typeof callback,'function');
      let failure;
      try{await callback();}catch(error){failure=error;}
      return {failure,databaseCreates,roleEffects,adminEnds,removed};
    }
    function verify(observed){
      assert.equal(observed.failure?.code,'ERR_ASSERTION');
      assert.equal(observed.failure.actual,algorithm);
      assert.equal(observed.failure.expected,'scram-sha-256');
      assert.equal(observed.databaseCreates,0);assert.equal(observed.roleEffects,0);
      assert.equal(observed.adminEnds,1);
    }
    verify(await consumer(false));
    const mutant=await consumer(true);
    assert.equal(mutant.removed,1,'mutant removes only the observed algorithm equality');
    assert.match(mutant.failure?.message??'',/^PRIVATE_ALGORITHM_FORBIDDEN_(DATABASE|QUERY)$/);
    assert.throws(()=>verify(mutant),error=>error.code==='ERR_ASSERTION');
  });
}

test('actual base fixture never drops a pre-existing role after CREATE collision',async()=>{
  const file=fileURLToPath(new URL('../../tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',import.meta.url));
  const actualRequire=createRequire(file),ts=actualRequire('typescript');
  let callback,roleDrops=0,databaseCleanups=0,adminEnds=0;
  const collision=Object.assign(new Error('PRIVATE_ROLE_ALREADY_EXISTS'),{code:'42710'});
  const admin=async strings=>{
    assert.match(strings.join('?'),/current_setting\('data_directory'\)/);
    return [{data_directory:root+'/data',port:'55439',socket_directories:root,
      password_encryption:'scram-sha-256'}];
  };
  admin.unsafe=async sql=>{
    if(/^CREATE ROLE /.test(sql))throw collision;
    if(/^DROP ROLE /.test(sql)){roleDrops++;return [];}
    if(sql==='DROP ACCESS METHOD IF EXISTS task6a_alt_heap')return [];
    throw new Error('PRIVATE_COLLISION_UNEXPECTED_SQL');
  };
  admin.end=async()=>{adminEnds++;};
  const denyVerifier=()=>{throw new Error('PRIVATE_COLLISION_FORBIDDEN_VERIFIER');};
  const compiled=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    fileName:file,
  }).outputText;
  runInNewContext(compiled,{
    exports:{},Buffer,URL,console,
    process:{env:{SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY:root+'/data',
      SETFARM_TEST_PG_ADMIN_URL:'postgresql://postgres:'+('a'.repeat(64))+'@127.0.0.1:55439/postgres'}},
    require(specifier){
      if(specifier==='node:test')return {test(_name,_options,run){callback=run;}};
      if(specifier==='postgres')return ()=>admin;
      if(specifier==='./test-database.js')return {async createIsolatedTestDatabase(){
        return {database:'setfarm_contract_spine_test_1_abcdef012345',
          async cleanup(){databaseCleanups++;}};
      }};
      if(specifier==='../../src/db/base-schema-readonly-verifier-v1.js')return {verifyOrdinaryBaseSchemaCatalogReadOnlyV1:denyVerifier};
      return actualRequire(specifier);
    },
  },{filename:file});
  assert.equal(typeof callback,'function');
  await assert.rejects(callback(),error=>error===collision);
  assert.equal(roleDrops,0,'CREATE collision cannot authorize deleting the foreign role');
  assert.equal(databaseCleanups,1);assert.equal(adminEnds,1);
});
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
test('private focused verifier mode dispatches only both real serial integration files',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const result=plan({root,port:55439,mode:'readonly-verifiers'});
  assert.deepEqual(result.test,[
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',
    'tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts',
  ]);
  assert.deepEqual(result.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(result.server,plan({root,port:55439,mode:'findings'}).server);
  assert.equal(Object.isFrozen(result.test),true);
});
test('private receipt mode dispatches only the complete serial receipt through the isolated runner',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const result=plan({root,port:55439,mode:'receipt'});
  assert.deepEqual(result.test,[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts',
  ]);
  assert.deepEqual(result.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(result.server,plan({root,port:55439,mode:'findings'}).server);
  assert.equal(Object.isFrozen(result.test),true);
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

for(const args of [[],['unknown'],['findings','extra'],
  ['readonly-verifier'],['readonly-verifiers','extra'],
  ['receipts'],['receipt','extra'],['receipt','--test-name-pattern=other'],['receipt','all'],
  ['readonly-verifiers','--test-name-pattern=other'],['readonly-verifiers','all']]){
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
function wrapperBoundaryFixture(mode,commandMode='findings'){
  const expectedTestArgs=commandMode==='migration33-adjacent-full'?[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/migrations.test.ts',
  ]:commandMode==='migration33-observers'?[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/migration33-current-entry-observers.test.ts',
  ]:commandMode==='receipt'?[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts',
  ]:commandMode==='readonly-verifiers'?[
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',
    'tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts',
  ]:['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
    ...(commandMode==='all'?['test']:commandMode==='after-scripts'?['run','test:after-scripts']:commandMode==='after-terminal'?['run','test:after-terminal']:commandMode==='after-findings'?['run','test:after-findings']:commandMode==='after-internal-pure'?['run','test:after-internal-pure']:commandMode==='after-local-custody'?['run','test:after-local-custody']:commandMode==='after-cutover'?['run','test:after-cutover']:commandMode==='after-receipt'?['run','test:after-receipt']:['run','test:findings'])];
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
  else if(tool===process.execPath&&JSON.stringify(args)===${JSON.stringify(JSON.stringify(expectedTestArgs))})role='test';
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
  return spawnSync(process.execPath,[fileURLToPath(MODULE),commandMode],{
    encoding:'utf8',timeout:7000,maxBuffer:262144,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',
      NODE_OPTIONS:'--import=data:text/javascript;base64,'+Buffer.from(guard).toString('base64')},
  });
}
for(const commandMode of ['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal','after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt','migration33-observers','migration33-adjacent-full'])
for(const mode of commandMode==='all'?['normal']:
  ['normal','nonzero','mirror-error','journal-loss','close-fault','retained-db','cancel','before-server','before-test','attach-server','attach-test','input-error']){
  test('wrapper boundary '+commandMode+' '+mode+' retains ordered observed outcomes without native effects',async()=>{
    const result=wrapperBoundaryFixture(mode,commandMode);
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

// Fixed continuation keeps the original cluster ownership and cleanup protocol.
test('after-scripts permits only fixed npm suffix argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-scripts'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-scripts']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-scripts package command runs exactly the remaining seven package lanes',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const expected=['product-compiler','execution-attempts','findings','evidence','recovery','evals','internal-production']
    .map(name=>'npm run test:'+name).join(' && ');
  assert.equal(scripts['test:after-scripts'],expected);
  assert.equal(scripts.test.split('npm run test:scripts && ')[1],expected);
});
test('after-scripts refuses extra args and caller commands before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-scripts;echo denied','https://127.0.0.1/','test:after-scripts'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-scripts','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
});

// Fixed post-terminal continuation is a closed list, not a new discovery mode.
const POST_TERMINAL_OWNER_FILES=Object.freeze([
  "run-termination.test.ts",
  "runtime-completion.test.ts",
  "runtime-hooks.test.ts",
  "runtime-session-repository.test.ts",
  "story-publication.integration.test.ts",
  "terminal-claim-runtime-reconciler.test.ts",
  "v3-deploy-receipt-repository.test.ts",
  "v3-deploy-refusal.integration.test.ts",
  "v3-downstream-evidence-publication.test.ts",
  "v3-downstream-recovery-transition.test.ts",
  "v3-implementation-refusal.integration.test.ts",
  "v3-operational-retry-lifecycle.integration.test.ts",
  "v3-plan-invalid-proposal-retry.integration.test.ts",
  "v3-plan-product-build-authority.integration.test.ts",
  "v3-plan-refusal.integration.test.ts",
  "v3-platform-preclaim-claim.integration.test.ts",
  "v3-platform-preclaim-terminal.integration.test.ts",
  "v3-platform-preclaim-termination-race.integration.test.ts",
  "v3-pre-dispatch-failure.integration.test.ts",
  "v3-predecessor-completion-claim.integration.test.ts",
  "v3-preparation-claim-authority.test.ts",
  "v3-setup-build-failure-cause.integration.test.ts",
  "v3-setup-build-untyped-build-failure.integration.test.ts",
  "v3-stage-input-unresolved.integration.test.ts"
]);
test('after-terminal permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-terminal'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-terminal']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-terminal package command contains exactly24 fixed later owners and the unchanged five-package tail',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const execution=readFileSync(new URL('../run-execution-attempt-tests.ts',import.meta.url),'utf8');
  const blocks=[...execution.matchAll(/const OWNER_BACKED_TESTS = new Set\(\[([\s\S]*?)\]\);/g)];
  assert.equal(blocks.length,1,'one maintained owner inventory');
  const owners=[...blocks[0][1].matchAll(/"([A-Za-z0-9.-]+\.test\.ts)"/g)].map(m=>m[1]).sort();
  assert.equal(new Set(owners).size,owners.length,'maintained owners are unique');
  assert.equal(owners.filter(file=>file==='run-terminal-transition.test.ts').length,1,'one terminal transition boundary');
  const terminalIndex=owners.indexOf('run-terminal-transition.test.ts');
  assert.equal(owners.filter(file=>file==='migration33-current-entry-observers.test.ts').length,1);
  assert.deepEqual(owners.slice(terminalIndex+1),POST_TERMINAL_OWNER_FILES);
  assert.equal(POST_TERMINAL_OWNER_FILES.length,24);assert.equal(new Set(POST_TERMINAL_OWNER_FILES).size,24);
  assert.equal(POST_TERMINAL_OWNER_FILES.includes('run-terminal-transition.test.ts'),false);
  const tail=['findings','evidence','recovery','evals','internal-production'].map(n=>'npm run test:'+n).join(' && ');
  const expected='node --import tsx scripts/run-execution-attempt-tests.ts '
    +POST_TERMINAL_OWNER_FILES.map(n=>'tests/execution-attempts/'+n).join(' ')+' && '+tail;
  assert.equal(scripts['test:after-terminal'],expected);
  assert.equal(scripts['test:after-scripts'].split('npm run test:execution-attempts && ')[1],tail);
  assert.equal(scripts.test.split('npm run test:execution-attempts && ')[1],tail);
});
test('after-terminal refuses extra args and caller commands before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-terminal;echo denied','https://127.0.0.1/','test:after-terminal','after-terminal extra'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-terminal','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
});

// Closed findings continuation: one repaired callback, six later owners, four lanes.
const AFTER_FINDINGS_OWNER_FILES=Object.freeze([
  "v3-evidence-only-worker.test.ts",
  "v3-github-review-authorization.integration.test.ts",
  "v3-recovery-claim-authority.test.ts",
  "v3-recovery-coordinator.test.ts",
  "v3-recovery-lifecycle-reconciler.test.ts",
  "v3-recovery-work-router.test.ts"
]);
test('after-findings permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-findings'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-findings']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-findings package command contains one fixed callback, six exact later owners and unchanged four-package tail',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const source=readFileSync(new URL('../run-finding-tests.ts',import.meta.url),'utf8');
  const blocks=[...source.matchAll(/const OWNER_BACKED_TESTS = new Set\(\[([\s\S]*?)\]\);/g)];
  assert.equal(blocks.length,1,'one maintained findings owner inventory');
  const owners=[...blocks[0][1].matchAll(/"([A-Za-z0-9.-]+\.test\.ts)"/g)].map(m=>m[1]).sort();
  assert.equal(owners.length,10);assert.equal(owners.indexOf('repository.test.ts'),3);
  assert.deepEqual(owners.slice(4),AFTER_FINDINGS_OWNER_FILES);
  assert.equal(AFTER_FINDINGS_OWNER_FILES.length,6);assert.equal(new Set(AFTER_FINDINGS_OWNER_FILES).size,6);
  const first="node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 '--test-name-pattern=^cold pre32 catalog rejects unjournaled relations and orphan routines or triggers without writes$' tests/findings/repository.test.ts";
  const later='node --import tsx scripts/run-finding-tests.ts '
    +AFTER_FINDINGS_OWNER_FILES.map(n=>'tests/findings/'+n).join(' ');
  const tail=['evidence','recovery','evals','internal-production'].map(n=>'npm run test:'+n).join(' && ');
  assert.equal(scripts['test:after-findings'],first+' && '+later+' && '+tail);
  for(const prior of [scripts.test,scripts['test:after-scripts'],scripts['test:after-terminal']])
    assert.equal(prior.split('npm run test:findings && ')[1],tail);
});
test('after-findings refuses extra args and caller commands before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-findings;echo denied','https://127.0.0.1/','test:after-findings','after-findings extra'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-findings','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
});

// Closed internal continuation: skip the completed pure node invocation only.
const AFTER_INTERNAL_PURE_ALIASES=Object.freeze([
  'test:dashboard-local-custody',
  'test:dashboard-joint-original-operation',
  'test:internal-production:create-only',
  'test:internal-production:cutover',
  'test:internal-production:isolated',
  'test:internal-production:manifest',
]);
test('after-internal-pure permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-internal-pure'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-internal-pure']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-internal-pure package command derives the exact six unrun aliases from maintained internal inventories',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const pureParts=scripts['test:internal-production:pure'].split(' && ');
  assert.deepEqual(pureParts.slice(1),[
    'npm run test:dashboard-local-custody','npm run test:dashboard-joint-original-operation',
  ]);
  const internalParts=scripts['test:internal-production'].split(' && ');
  const pure='npm run test:internal-production:pure';
  assert.equal(internalParts.filter(value=>value===pure).length,1,'one maintained pure-lane boundary');
  const pureIndex=internalParts.indexOf(pure);assert.ok(pureIndex>=0);
  const later=internalParts.slice(pureIndex+1);
  assert.deepEqual(later,[
    'npm run test:internal-production:create-only','npm run test:internal-production:cutover',
    'npm run test:internal-production:isolated','npm run test:internal-production:manifest',
  ]);
  const selected=[...pureParts.slice(1),...later];
  assert.equal(selected.length,6);assert.equal(new Set(selected).size,6);
  assert.deepEqual(selected,AFTER_INTERNAL_PURE_ALIASES.map(name=>'npm run '+name));
  assert.equal(scripts['test:after-internal-pure'],selected.join(' && '));
});
test('after-internal-pure refuses extra args and caller commands before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-internal-pure;echo denied','https://127.0.0.1/',
    'test:after-internal-pure','after-internal-pure extra'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-internal-pure','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
});

// Closed post-local continuation excludes completed/composed local coverage.
const AFTER_LOCAL_CUSTODY_ALIASES=Object.freeze([
  'test:dashboard-joint-original-operation',
  'test:internal-production:create-only',
  'test:internal-production:cutover',
  'test:internal-production:isolated',
  'test:internal-production:manifest',
]);
test('after-local-custody permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-local-custody'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-local-custody']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-local-custody package command derives exactly five unrun aliases from the maintained six-lane continuation',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const prior=scripts['test:after-internal-pure'].split(' && ');
  assert.equal(prior.length,6);
  assert.equal(prior[0],'npm run test:dashboard-local-custody');
  const selected=prior.slice(1);
  assert.equal(selected.length,5);assert.equal(new Set(selected).size,5);
  assert.deepEqual(selected,AFTER_LOCAL_CUSTODY_ALIASES.map(name=>'npm run '+name));
  for(const name of AFTER_LOCAL_CUSTODY_ALIASES)assert.equal(typeof scripts[name],'string');
  assert.equal(scripts['test:after-local-custody'],selected.join(' && '));
});
test('after-local-custody refuses extra args and caller commands before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-local-custody;echo denied','https://127.0.0.1/',
    'test:after-local-custody','after-local-custody extra'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-local-custody','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
});


// Closed post-cutover continuation runs only the two previously unrun lanes.
const AFTER_CUTOVER_ALIASES=Object.freeze([
  'test:internal-production:isolated',
  'test:internal-production:manifest',
]);
test('after-cutover permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-cutover'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-cutover']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-cutover package command derives only the final two aliases from the maintained five-lane continuation',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const prior=scripts['test:after-local-custody'].split(' && ');
  assert.deepEqual(prior,[
    'npm run test:dashboard-joint-original-operation',
    'npm run test:internal-production:create-only',
    'npm run test:internal-production:cutover',
    'npm run test:internal-production:isolated',
    'npm run test:internal-production:manifest',
  ]);
  const selected=prior.slice(3);
  assert.equal(selected.length,2);assert.equal(new Set(selected).size,2);
  assert.deepEqual(selected,AFTER_CUTOVER_ALIASES.map(name=>'npm run '+name));
  for(const name of AFTER_CUTOVER_ALIASES)assert.equal(typeof scripts[name],'string');
  assert.equal(scripts['test:after-cutover'],selected.join(' && '));
});
test('after-cutover retains the closed mode inventory and refuses caller selectors or extra argv before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-cutover;echo denied','https://127.0.0.1/',
    'test:after-cutover','after-cutover extra','AFTER-CUTOVER'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-cutover','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
  const source=readFileSync(MODULE,'utf8');
  const inventories=[...source.matchAll(/!\[([^\]\n]+)\]\.includes\((mode|args\[0\])\)/g)];
  assert.equal(inventories.length,2,'one pure-plan and one CLI closed mode inventory');
  assert.deepEqual(inventories.map(match=>match[2]).sort(),['args[0]','mode']);
  const expected=['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal',
    'after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt','migration33-observers','migration33-adjacent-full','manual-orphan-bootstrap'];
  for(const inventory of inventories)
    assert.deepEqual([...inventory[1].matchAll(/'([^']+)'/g)].map(match=>match[1]),expected);
});


// Closed post-receipt continuation selects only the five remaining isolated files, then manifest.
const AFTER_RECEIPT_FILES=Object.freeze([
  'tests/internal-production/baseline-restart-authority-retirement-v1.test.ts',
  'tests/internal-production/baseline-service-restart-helper-v1.test.ts',
  'tests/internal-production/baseline-service-restart-sequence-v1.test.ts',
  'tests/internal-production/baseline-spawner-startup-admission-v1.test.ts',
  'tests/internal-production/owner-admission-v1.test.ts',
]);
test('after-receipt permits only fixed npm continuation argv in a frozen private cluster plan',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'after-receipt'});
  assert.deepEqual(value.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','run','test:after-receipt']);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});
test('after-receipt package command derives only the five remaining isolated wrappers then manifest',()=>{
  const scripts=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).scripts;
  const wrapper='env -u SETFARM_PG_URL node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 ';
  const prior=scripts['test:internal-production:isolated'].split(' && ');
  assert.deepEqual(prior,[
    'tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts',
    'tests/internal-production/baseline-post-handoff-cli.test.ts',
    'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts',
    ...AFTER_RECEIPT_FILES,
  ].map(file=>wrapper+file));
  const selected=prior.slice(3);
  assert.equal(selected.length,5);assert.equal(new Set(selected).size,5);
  assert.deepEqual(selected,AFTER_RECEIPT_FILES.map(file=>wrapper+file));
  assert.equal(typeof scripts['test:internal-production:manifest'],'string');
  assert.equal(scripts['test:after-receipt'],[...selected,'npm run test:internal-production:manifest'].join(' && '));
});
test('after-receipt retains the closed mode inventory and refuses caller selectors or extra argv before cluster effects',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['after-receipt;echo denied','https://127.0.0.1/',
    'test:after-receipt','after-receipt extra','AFTER-RECEIPT',
    'tests/internal-production/baseline-restart-authority-retirement-v1.test.ts'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'after-receipt','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.match(child.stderr,/PRIVATE_TEST_CLUSTER_MODE_INVALID/);
  const source=readFileSync(MODULE,'utf8');
  const inventories=[...source.matchAll(/!\[([^\]\n]+)\]\.includes\((mode|args\[0\])\)/g)];
  assert.equal(inventories.length,2,'one pure-plan and one CLI closed mode inventory');
  assert.deepEqual(inventories.map(match=>match[2]).sort(),['args[0]','mode']);
  const expected=['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal',
    'after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt','migration33-observers','migration33-adjacent-full','manual-orphan-bootstrap'];
  for(const inventory of inventories)
    assert.deepEqual([...inventory[1].matchAll(/'([^']+)'/g)].map(match=>match[1]),expected);
});


test('migration33-observers plans only the fixed P3 observer test argv',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'migration33-observers'});
  assert.deepEqual(value.test,[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/migration33-current-entry-observers.test.ts',
  ]);
  assert.equal(value.test.length,10);
  assert.deepEqual(value.test.filter(cell=>cell.endsWith('.test.ts')),[
    'tests/execution-attempts/migration33-current-entry-observers.test.ts',
  ]);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'receipt'}).server);
});

test('migration33-observers keeps literal mode inventory and refuses caller selectors or extra argv',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const literalModes=['findings','all','readonly-verifiers','receipt','after-scripts',
    'after-terminal','after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt',
    'migration33-observers','migration33-adjacent-full'];
  assert.equal(new Set(literalModes).size,13);
  for(const mode of literalModes){
    const value=plan({root,port:55439,mode});
    assert.equal(Object.isFrozen(value.test),true);
  }
  for(const mode of ['migration33-observers;echo denied','migration33-observers extra',
    'migration33-observers/other','test:migration33-observers','migration33-observer',
    'tests/execution-attempts/migration33-current-entry-observers.test.ts',
    '--test-name-pattern=.*','https://127.0.0.1/',undefined,null,{}])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  for(const args of [
    ['migration33-observers','extra'],
    ['migration33-observers','tests/execution-attempts/migration33-current-entry-observers.test.ts'],
    ['migration33-observers','--test-name-pattern=.*'],
  ]){
    const result=spawnSync(process.execPath,[fileURLToPath(MODULE),...args],{
      encoding:'utf8',timeout:5000,maxBuffer:65536,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    });
    assert.equal(result.error,undefined);assert.equal(result.signal,null);
    assert.equal(result.status,1);assert.equal(result.stdout,'');
    assert.equal(result.stderr,'PRIVATE_TEST_CLUSTER_MODE_INVALID\n');
  }
});


test('migration33-adjacent-full plans only the fixed whole migrations P3 test argv',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'migration33-adjacent-full'});
  assert.deepEqual(value.test,[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
    '--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/migrations.test.ts',
  ]);
  assert.equal(value.test.length,10);
  assert.deepEqual(value.test.filter(cell=>cell.endsWith('.test.ts')),[
    'tests/execution-attempts/migrations.test.ts',
  ]);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'migration33-observers'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'receipt'}).server);
  for(const mode of ['migration33-adjacent-full;echo denied','migration33-adjacent-full extra',
    'migration33-adjacent-full/other','test:migration33-adjacent-full',
    'tests/execution-attempts/migrations.test.ts','--test-name-pattern=.*'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
  const refused=spawnSync(process.execPath,[fileURLToPath(MODULE),'migration33-adjacent-full','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(refused.error,undefined);assert.equal(refused.signal,null);assert.equal(refused.status,1);
  assert.equal(refused.stdout,'');assert.equal(refused.stderr,'PRIVATE_TEST_CLUSTER_MODE_INVALID\n');
});

// Slice1 declares a pure vector only; actual route refusal is source-contained
// in manual-orphan-bootstrap-owned-route-v1.test.js, with all effects intercepted.
test('manual-orphan-bootstrap pure plan selects the one fixed inactive owned route',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const value=plan({root,port:55439,mode:'manual-orphan-bootstrap'});
  assert.deepEqual(value.test,[
    '--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
    'node','--import','tsx','--test','--test-isolation=none',
    'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts',
  ]);
  assert.equal(Object.isFrozen(value),true);assert.equal(Object.isFrozen(value.test),true);
  assert.deepEqual(value.initdb,plan({root,port:55439,mode:'all'}).initdb);
  assert.deepEqual(value.server,plan({root,port:55439,mode:'all'}).server);
});

test('manual-orphan-bootstrap pure plan refuses caller selectors and command tails',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  for(const mode of ['MANUAL-ORPHAN-BOOTSTRAP','manual-orphan-bootstrap extra',
    'manual-orphan-bootstrap;echo denied','test:manual-orphan-bootstrap',
    'https://127.0.0.1/','postgresql://127.0.0.1/postgres',
    'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts'])
    assert.throws(()=>plan({root,port:55439,mode}),/PRIVATE_TEST_CLUSTER_PLAN_INVALID/);
});

test('manual-orphan-bootstrap addition preserves all thirteen prior literal plan vectors',async()=>{
  const {planPrivatePostgresTestsV1:plan}=await implementation();
  const npm='/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js';
  const isolated=['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
    'node','--import','tsx','--test','--test-concurrency=1'];
  const expected={
    findings:[npm,'run','test:findings'],all:[npm,'test'],
    'readonly-verifiers':['--import','tsx','--test','--test-concurrency=1',
      'tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts',
      'tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts'],
    receipt:[...isolated,'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts'],
    'after-scripts':[npm,'run','test:after-scripts'],
    'after-terminal':[npm,'run','test:after-terminal'],
    'after-findings':[npm,'run','test:after-findings'],
    'after-internal-pure':[npm,'run','test:after-internal-pure'],
    'after-local-custody':[npm,'run','test:after-local-custody'],
    'after-cutover':[npm,'run','test:after-cutover'],
    'after-receipt':[npm,'run','test:after-receipt'],
    'migration33-observers':[...isolated,'tests/execution-attempts/migration33-current-entry-observers.test.ts'],
    'migration33-adjacent-full':[...isolated,'tests/execution-attempts/migrations.test.ts'],
  };
  assert.equal(Object.keys(expected).length,13);
  for(const [mode,vector] of Object.entries(expected)){
    const value=plan({root,port:55439,mode});
    assert.deepEqual(value.test,vector,mode);
    assert.equal(Object.isFrozen(value.test),true,mode);
  }
});

test('manual-orphan-bootstrap direct CLI refuses extra argv before cluster effects',()=>{
  const child=spawnSync(process.execPath,[fileURLToPath(MODULE),'manual-orphan-bootstrap','extra'],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.equal(child.stderr,'PRIVATE_TEST_CLUSTER_MODE_INVALID\n');
});

// Task4B private constructor components. These do not establish Source, SQL,
// native-process custody, or successful setup issuance. Root owns the real run.
// The complete constructor is lowered only for ESM language containment; no
// production guard or function body is removed, extracted, or substituted.
const TASK4B_NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const TASK4B_M=TASK7_HOST_POLICY.releases+'/setfarm-3271862b';
const TASK4B_PATH=TASK7_HOST_POLICY.path;
const TASK4B_PRIVATE_NAMES=Object.freeze([
  'runManualOrphanConstructorV1','assertManualOrphanConstructorLaunchV1',
  'assertManualOrphanConstructorEnvironmentV1','requireManualOrphanConstructorSpaceV1',
  'sameManualOrphanMutableDirectoryV1','holdManualOrphanPgToolsV1',
  'createManualOrphanConstructorClockV1','spawnManualOrphanConstructorChildV1',
  'requireManualOrphanConstructorChildSuccessV1','openManualOrphanConstructorAdminV1',
  'attachManualOrphanConstructorControlV1','checkManualOrphanDeliveryMetadataV1',
  'createManualOrphanConstructorInputV1','manualOrphanConstructorCleanupEligibleV1',
  'verifyManualOrphanConstructorQuiescenceV1',
]);

async function task4bContainedConstructor({hostPolicy=false,moduleUrl=MODULE.href}={}){
  const actualRequire=createRequire(import.meta.url),ts=actualRequire('typescript');
  const fault=[],trace=[],timers=new Map();let nextTimer=1,now=0n;
  // Only inert module initialization precedes a private-function typeof gate.
  // Mutable seam maps remain empty until the particular test passes that gate.
  const seams={fs:{},cp:{},os:{},helper:{},journal:{},crypto:{},json:{},buffer:{},postgres:null};
  const deny=site=>(..._args)=>{fault.push(site);throw Error('TASK4B_UNLISTED_CALL');};
  const invoke=(site,fn,args)=>{
    try{return fn(...args);}catch(error){
      if(error?.code==='ERR_ASSERTION')fault.push('seam assertion: '+site);
      throw error;
    }
  };
  const closed=(label,allowed)=>new Proxy(allowed,{get(target,key){
    if(key==='__esModule')return true;
    if(Object.hasOwn(target,key))return target[key];
    return deny(label+'.'+String(key));
  }});
  const dispatch=(label,table,name)=>(...args)=>{
    if(!Object.hasOwn(table,name))return deny(label+'.'+name)(...args);
    return invoke(label+'.'+name,table[name],args);
  };
  const fake=new EventEmitter();
  Object.assign(fake,{argv:[TASK4B_NODE,'/component/import-only'],argv0:TASK4B_NODE,
    execPath:TASK4B_NODE,execArgv:[],platform:'darwin',arch:'arm64',version:'v26.4.0',
    versions:{node:'26.4.0'},env:{PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'},pid:7100,ppid:7099,
    getuid:()=>501,geteuid:()=>501,getgid:()=>20,getegid:()=>20,cwd:()=>TASK4B_M,
    hrtime:{bigint:()=>now},exit:deny('process.exit'),kill:deny('process.kill')});
  const output={stdout:[],stderr:[]};
  for(const channel of ['stdout','stderr']){
    fake[channel]=new EventEmitter();
    fake[channel].write=bytes=>{output[channel].push(Buffer.from(bytes));return true;};
  }
  const fsNames=['chmodSync','closeSync','fstatSync','lstatSync','mkdtempSync','openSync',
    'readFileSync','readSync','realpathSync','readlinkSync','readdirSync','statfsSync',
    'writeFileSync','writeSync','fsyncSync','statSync'];
  const fs=closed('fs',{constants,...Object.fromEntries(fsNames.map(name=>[name,dispatch('fs',seams.fs,name)]))});
  const cp=closed('child_process',Object.fromEntries(['spawn','spawnSync','execFileSync']
    .map(name=>[name,dispatch('child_process',seams.cp,name)])));
  const helperNames=['holdManualOrphanOwnedSourcesV1','observeManualOrphanOwnedChildV1',
    'observeManualOrphanProcessV1','canonicalizeManualOrphanClusterBaselineV1',
    'encodeManualOrphanRunnerSetupFrameV1','decodeManualOrphanRunnerResultV1'];
  const helper=closed('helper',{
    MANUAL_ORPHAN_VECTOR_V1:Object.freeze(['node','--import','tsx','--test','--test-isolation=none',
      'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts']),
    ...Object.fromEntries(helperNames.map(name=>[name,dispatch('helper',seams.helper,name)])),
  });
  const journal=closed('journal',{
    createPrivateTestJournalV1:dispatch('journal',seams.journal,'createPrivateTestJournalV1'),
    createPrivateTestTerminalMirrorV1:dispatch('journal',seams.journal,'createPrivateTestTerminalMirrorV1'),
  });
  const modules=new Map([
    ['node:fs',fs],['node:child_process',cp],['node:path',actualRequire('node:path')],
    ['node:url',actualRequire('node:url')],['node:crypto',closed('crypto',{
      createHash:dispatch('crypto',seams.crypto,'createHash'),randomBytes:deny('crypto.randomBytes')})],
    ['node:os',closed('os',{userInfo:dispatch('os',seams.os,'userInfo')})],
    ['node:net',closed('net',{default:closed('net.default',{})})],
    ['node:timers/promises',closed('timers/promises',{})],
    ['postgres',{__esModule:true,default:(...args)=>seams.postgres===null
      ?deny('postgres')(...args):invoke('postgres',seams.postgres,args)}],
    ['./finding-test-preflight.mjs',closed('preflight',{})],
    ['./private-postgres-test-journal-v1.mjs',journal],
    ['../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs',helper],
  ]);
  // CommonJS interop needs a default for the existing default path import.
  const pathModule=modules.get('node:path');modules.set('node:path',{__esModule:true,default:pathModule,...pathModule});
  let metaReplacements=0;
  const source=readFileSync(MODULE,'utf8');
  const diagnostics='\nglobalThis.__task4bPrivate={'+TASK4B_PRIVATE_NAMES.map(name=>
    name+':typeof '+name+"==='function'?"+name+':undefined').join(',')+'};'
    +'\nglobalThis.__task6ConstructorMainV1=main;'
    +(hostPolicy?'\nglobalThis.__task7PolicyPrivate={read:typeof readManualOrphanHostPolicyV1===\"function\"?readManualOrphanHostPolicyV1:undefined,context:assertManualOrphanConstructorContextV1};':'');
  const compiled=ts.transpileModule(source+diagnostics,{
    fileName:fileURLToPath(MODULE)+'.ts',reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    transformers:{before:[context=>{
      function visit(node){
        if(ts.isMetaProperty(node)&&node.keywordToken===ts.SyntaxKind.ImportKeyword
          &&node.name.text==='meta'){
          metaReplacements++;return context.factory.createIdentifier('__task4bModuleMeta');
        }
        return ts.visitEachChild(node,visit,context);
      }
      return node=>ts.visitNode(node,visit);
    }]},
  });
  assert.equal(metaReplacements,2,'only the two import.meta expressions are lowered');
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'complete constructor language containment must succeed before any predicate counts');
  const context={exports:{},Buffer,URL,Error,process:fake,
    __task4bModuleMeta:Object.freeze({url:moduleUrl}),
    ...(hostPolicy?{Buffer:new Proxy(Buffer,{get(target,key){
      if(key==='alloc')return dispatch('buffer',seams.buffer,'alloc');
      if(key==='allocUnsafe'||key==='allocUnsafeSlow')return deny('buffer.'+key);
      return Reflect.get(target,key);
    }}),JSON:{parse:dispatch('json',seams.json,'parse'),stringify:JSON.stringify}}:{}),
    require(specifier){if(!modules.has(specifier))return deny('require:'+specifier)();return modules.get(specifier);},
    setTimeout(callback,ms){
      invoke('setTimeout',()=>{assert.equal(typeof callback,'function');assert.ok(Number.isFinite(ms)&&ms>=0);},[]);
      const id=nextTimer++;timers.set(id,{callback,ms});return id;
    },
    clearTimeout(id){timers.delete(id);},queueMicrotask,
    Date:new Proxy(function(){return deny('Date')();},{get(_target,key){return deny('Date.'+String(key));}}),
    console:closed('console',{}),performance:closed('performance',{}),
  };
  await runInNewContext('(async()=>{\n'+compiled.outputText+'\n})()',context,
    {filename:fileURLToPath(MODULE),timeout:5000});
  assert.deepEqual(fault,[],'obtaining private bindings must not acquire or observe any resource');
  assert.equal(timers.size,0,'module initialization cannot start an operation timer');
  assert.deepEqual(fake.eventNames(),[],'module initialization cannot install owner signal listeners');
  assert.equal(output.stdout.length+output.stderr.length,0,'module initialization remains inert');
  return {bindings:context.__task4bPrivate,main:context.__task6ConstructorMainV1,hostPolicy:context.__task7PolicyPrivate,
    seams,fake,fault,trace,timers,output,
    time(value){now=value;},
    fire(ms){const found=[...timers].filter(([,item])=>item.ms===ms);
      assert.equal(found.length,1,'one fixed timer '+ms);const [id,item]=found[0];timers.delete(id);item.callback();},
    clean(){assert.deepEqual(fault,[],'no swallowed forbidden/unlisted call may count as refusal');},
  };
}
function task4bBinding(h,name){
  const fn=h.bindings[name];
  assert.equal(typeof fn,'function','Task4B missing-private-function scaffolding: '+name);
  return fn;
}
function task4bPlain(value){return JSON.parse(JSON.stringify(value));}
function task4bCheckedSeam(h,fn){
  return (...args)=>{
    try{return fn(...args);}catch(error){
      if(error?.code==='ERR_ASSERTION')h.fault.push('reserved-client seam assertion');
      throw error;
    }
  };
}
function task4bUnknown(error){return error?.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN';}
function task4bRefused(error){return ['MANUAL_ORPHAN_OWNER_REFUSED','MANUAL_ORPHAN_SETUP_REFUSED',
  'MANUAL_ORPHAN_CLEANUP_UNKNOWN'].includes(error?.message);}

// Break: extra arguments can smuggle a holder/options object into the owner.
test('Task4B private owner refuses arguments before Source or resource acquisition',async()=>{
  const h=await task4bContainedConstructor(),run=task4bBinding(h,'runManualOrphanConstructorV1');
  h.seams.journal.createPrivateTestTerminalMirrorV1=stream=>({write:bytes=>stream.write(bytes)});
  await run({source:{},client:{},enabled:true});
  assert.equal(h.fake.exitCode,1);assert.equal(Buffer.concat(h.output.stdout).length,0);
  assert.equal(Buffer.concat(h.output.stderr).toString(),'MANUAL_ORPHAN_OWNER_REFUSED\n');h.clean();
});

// Break: the private entry trusts caller argv instead of its physical module.
test('Task4B private owner refuses this nonrelease physical context before Source acquisition',async()=>{
  const h=await task4bContainedConstructor(),run=task4bBinding(h,'runManualOrphanConstructorV1');
  h.seams.journal.createPrivateTestTerminalMirrorV1=stream=>({write:bytes=>stream.write(bytes)});
  h.seams.os.userInfo=()=>({homedir:TASK7_HOST_POLICY.home,uid:501,gid:20,username:'setrox',shell:'/bin/zsh'});
  h.fake.argv=[TASK4B_NODE,TASK4B_M+'/scripts/run-private-postgres-tests.mjs','manual-orphan-bootstrap'];
  h.seams.fs.realpathSync=value=>{h.trace.push(['realpath',String(value)]);return String(value);};
  await run();
  assert.equal(h.fake.exitCode,1);assert.equal(Buffer.concat(h.output.stdout).length,0);
  assert.equal(Buffer.concat(h.output.stderr).toString(),'MANUAL_ORPHAN_OWNER_REFUSED\n');h.clean();
});

// Complete actual main and private owner under the existing nonrelease module URL.
// A normal return from the owner's refusal catch must still end exact dispatch.
async function task6ConstructorExactEntryV1(){
  const h=await task4bContainedConstructor();
  assert.equal(typeof h.main,'function','fixed actual main exposure before behavioral credit');
  assert.equal(h.main.length,0);
  const mirrors=[],writes=[],identity=[],timerCalls=[],listenerCalls=[],assertions=[];
  const checked=fn=>(...args)=>{
    try{return fn(...args);}catch(error){
      if(error?.code==='ERR_ASSERTION')assertions.push(error.message);
      throw error;
    }
  };
  // Keep independent ledgers: an internally caught adapter assertion, timer or
  // listener operation cannot be mistaken for the intended physical refusal.
  for(const operation of ['set','delete','clear']){
    const original=h.timers[operation];
    h.timers[operation]=(...args)=>{
      timerCalls.push(operation);return Reflect.apply(original,h.timers,args);
    };
  }
  for(const operation of ['on','once','addListener','prependListener','prependOnceListener',
    'removeListener','off','removeAllListeners']){
    h.fake[operation]=(..._args)=>{
      listenerCalls.push(operation);throw Error('TASK6_UNEXPECTED_PROCESS_LISTENER');
    };
  }
  h.seams.journal.createPrivateTestTerminalMirrorV1=checked((...args)=>{
    assert.equal(args.length,2);const [stream,onFault]=args;
    const channel=stream===h.fake.stdout?'stdout':stream===h.fake.stderr?'stderr':null;
    assert.notEqual(channel,null);assert.equal(typeof onFault,'function');
    const acquisition=mirrors.length;mirrors.push(channel);
    return {write:checked(bytes=>{
      assert.equal(Buffer.isBuffer(bytes),true);writes.push({acquisition,channel});return stream.write(bytes);
    })};
  });
  h.seams.os.userInfo=checked((...args)=>{
    assert.equal(args.length,0);identity.push('userInfo');
    return {homedir:TASK7_HOST_POLICY.home,uid:501,gid:20,username:'setrox',shell:'/bin/zsh'};
  });
  h.seams.fs.realpathSync=checked(value=>{
    h.trace.push(['realpath',String(value)]);return String(value);
  });
  h.fake.argv=[TASK4B_NODE,TASK4B_M+'/scripts/run-private-postgres-tests.mjs','manual-orphan-bootstrap'];
  const clean=()=>{
    h.clean();assert.deepEqual(assertions,[],'no swallowed exact-entry adapter assertion');
    assert.deepEqual(timerCalls,[],'neither main nor owner may start or clear an operation timer');
    assert.equal(h.timers.size,0);
    assert.deepEqual(listenerCalls,[],'physical refusal precedes owner and ordinary signal listeners');
    assert.deepEqual(h.fake.eventNames(),[]);
  };
  clean();await h.main();clean();
  return {h,mirrors,writes,identity,clean};
}

// Break: exact dispatch stops at availability or skips the actual zeroarg owner.
test('source-contained constructor refuses the genuine mode before preconditions',async()=>{
  const f=await task6ConstructorExactEntryV1(),{h}=f;
  assert.equal(Buffer.concat(h.output.stderr).toString(),'MANUAL_ORPHAN_OWNER_REFUSED\n');
  assert.equal(h.fake.exitCode,1);assert.equal(Buffer.concat(h.output.stdout).length,0);
  assert.deepEqual(f.mirrors,['stdout','stderr','stdout','stderr'],
    'two main mirrors precede two separately acquired private-owner mirrors');
  assert.deepEqual(f.writes,[{acquisition:3,channel:'stderr'}],'only the owner emits one refusal');
  assert.deepEqual(f.identity,['userInfo']);assert.deepEqual(h.trace,[],
    'the actual nonrelease module root refuses before realpath/Source observations');f.clean();
});

// Break: a handled owner refusal returns normally and falls through into ordinary setup.
test('source-contained enabled constructor exact route never falls through to ordinary setup',async()=>{
  const f=await task6ConstructorExactEntryV1(),{h}=f;
  assert.equal(Buffer.concat(h.output.stderr).toString(),'MANUAL_ORPHAN_OWNER_REFUSED\n');
  assert.equal(h.fake.exitCode,1);assert.deepEqual(h.output.stdout,[]);
  assert.equal(h.output.stderr.length,1,'one owner terminal write without ordinary setup output');
  assert.deepEqual(f.mirrors,['stdout','stderr','stdout','stderr']);
  assert.deepEqual(f.writes,[{acquisition:3,channel:'stderr'}]);
  assert.deepEqual(f.identity,['userInfo']);assert.deepEqual(h.trace,[]);
  assert.deepEqual(h.fault,[],'no ordinary preconditions/root/admin/spawn or other denied capability');
  f.clean();
});

// DATA only. Physical acquisition and self-process observations remain Task7.
test('Task4B launch comparison distinguishes resolved argv from exact raw constructor command',async()=>{
  const h=await task4bContainedConstructor(),check=task4bBinding(h,'assertManualOrphanConstructorLaunchV1');
  const facts={node:TASK4B_NODE,root:TASK4B_M,script:TASK4B_M+'/scripts/run-private-postgres-tests.mjs',
    argv:[TASK4B_NODE,TASK4B_M+'/scripts/run-private-postgres-tests.mjs','manual-orphan-bootstrap'],
    argv0:TASK4B_NODE,execPath:TASK4B_NODE,execArgv:[],cwd:TASK4B_M,
    platform:'darwin',arch:'arm64',version:'v26.4.0',uid:501,euid:501,gid:20,egid:20,
    rawCommand:TASK4B_NODE+' '+TASK4B_M+'/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap'};
  assert.doesNotThrow(()=>check(facts));
  for(const [label,change] of [
    ['relative argv',{argv:[TASK4B_NODE,'scripts/run-private-postgres-tests.mjs','manual-orphan-bootstrap']}],
    ['extra raw option',{rawCommand:TASK4B_NODE+' --no-warnings '+TASK4B_M+'/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap'}],
    ['preload',{execArgv:['--import','tsx']}],['wrong cwd',{cwd:TASK4B_M+'/scripts'}],
    ['changed Node',{version:'v26.4.1'}],['wrong effective uid',{euid:0}],
  ])assert.throws(()=>check({...facts,...change}),task4bRefused,label);
  h.clean();
});

// Break: ambient configuration or noncanonical Darwin metadata reaches children.
test('Task4B environment comparison permits only the exact baseline and canonical Darwin metadata',async()=>{
  const h=await task4bContainedConstructor(),check=task4bBinding(h,'assertManualOrphanConstructorEnvironmentV1');
  const env={PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'};
  for(const extra of [{},{__CF_USER_TEXT_ENCODING:'0x1F5:0x0:0xFFFFFFFF'}])
    assert.doesNotThrow(()=>check({...env,...extra},501,'darwin',TASK7_HOST_POLICY));
  for(const [label,extra] of [
    ['PG selector',{PGPORT:'55439'}],['NODE_OPTIONS',{NODE_OPTIONS:''}],['HOME',{HOME:TASK7_HOST_POLICY.home}],
    ['worker',{NODE_TEST_WORKER_ID:'1'}],['cache',{TSX_DISABLE_CACHE:'1'}],
    ['wrong PATH',{PATH:'/usr/bin:/bin'}],['lowercase CF',{__CF_USER_TEXT_ENCODING:'0x1f5:0x0:0x0'}],
    ['padded CF',{__CF_USER_TEXT_ENCODING:'0x01F5:0x0:0x0'}],
    ['wrong uid CF',{__CF_USER_TEXT_ENCODING:'0x1F4:0x0:0x0'}],
    ['overflow CF',{__CF_USER_TEXT_ENCODING:'0x1F5:0x100000000:0x0'}],
  ])assert.throws(()=>check({...env,...extra},501,'darwin',TASK7_HOST_POLICY),task4bRefused,label);
  assert.throws(()=>check({...env,__CF_USER_TEXT_ENCODING:'0x1F5:0x0:0x0'},501,'linux',TASK7_HOST_POLICY),task4bRefused);
  h.clean();
});

// Break: new mode accidentally inherits the legacy4GiB allocation gate.
test('Task4B allocation consumer requires eight GiB plus sixty four MiB before allocation',async()=>{
  const h=await task4bContainedConstructor(),check=task4bBinding(h,'requireManualOrphanConstructorSpaceV1');
  for(const [available,want] of [[8657043455n,false],[8657043456n,true],[4294967296n,false]]){
    h.seams.fs.statfsSync=(pathname,options)=>{assert.equal(pathname,'/tmp');assert.equal(options.bigint,true);
      h.trace.push('space');return {bavail:available,bsize:1n};};
    if(want)assert.doesNotThrow(()=>check());else assert.throws(()=>check(),task4bRefused);
  }
  assert.deepEqual(h.trace,['space','space','space']);h.clean();
});

// Break: expected mutable-directory timestamps are treated as immutable, or
// replacement/permission identity is silently refreshed.
test('Task4B mutable directory comparison tolerates mtime only while retaining every ownership field',async()=>{
  const h=await task4bContainedConstructor(),same=task4bBinding(h,'sameManualOrphanMutableDirectoryV1');
  const before={dev:1n,ino:2n,uid:501n,gid:20n,mode:0o40700n,birthtimeNs:3n,mtimeNs:4n,ctimeNs:5n};
  assert.equal(same(before,{...before,mtimeNs:40n,ctimeNs:50n}),true);
  for(const key of ['dev','ino','uid','gid','mode','birthtimeNs'])
    assert.equal(same(before,{...before,[key]:before[key]+1n}),false,key);
  h.clean();
});

// Break: tool admission executes --version or adopts a missing fixed Node pin.
test('Task4B executable pin acquisition refuses missing fixed Node without any version subprocess',async()=>{
  const h=await task4bContainedConstructor(),hold=task4bBinding(h,'holdManualOrphanPgToolsV1');
  h.seams.fs.realpathSync=value=>{h.trace.push(['realpath',value]);return value;};
  h.seams.fs.lstatSync=value=>{h.trace.push(['lstat',value]);throw Object.assign(Error('component missing'),{code:'ENOENT'});};
  assert.throws(()=>hold(),task4bRefused);
  assert.ok(h.trace.some(([op])=>op==='lstat'),'reach actual executable filesystem admission');
  assert.ok(h.trace.every(([,value])=>typeof value==='string'&&TASK4B_NODE.startsWith(value)),
    'only the fixed independently owned Node path/ancestors precede its refusal');h.clean();
});

// Break: clock access silently falls back, retries, or repairs malformed samples.
test('Task4B private clock faults are sticky without fallback or retry',async()=>{
  const h=await task4bContainedConstructor(),create=task4bBinding(h,'createManualOrphanConstructorClockV1');
  for(const [label,sample] of [['getter',null],['throw',()=>{throw Error('clock');}],['number',()=>0],
    ['negative',()=>-1n],['undefined',()=>undefined]]){
    let calls=0;
    const read=()=>{calls++;if(sample===null)throw Error('clock getter');return sample();};
    h.fake.hrtime=sample===null?Object.defineProperty({},'bigint',{get:read}):{bigint:read};
    const clock=create();assert.equal(clock.check(5000000000n),false,label);
    h.fake.hrtime={bigint(){calls++;return 1n;}};
    assert.equal(clock.check(5000000000n),false,label+' stays unknown');assert.equal(calls,1,label);
  }
  h.clean();
});

// Break: inclusive cutoff, reset origin, or backwards time permits issuance.
test('Task4B private clock enforces strict five second prespawn elapsed time',async()=>{
  const h=await task4bContainedConstructor(),create=task4bBinding(h,'createManualOrphanConstructorClockV1');
  h.time(100n);const clock=create();
  h.time(5000000099n);assert.equal(clock.check(5000000000n),true);
  h.time(5000000100n);assert.equal(clock.check(5000000000n),false);
  h.time(101n);assert.equal(clock.check(5000000000n),false,'a later sample cannot repair expiry');
  h.time(100n);const backwards=create();h.time(99n);assert.equal(backwards.check(5000000000n),false);
  h.clean();
});

function task4bEventChild(h,fd4=true){
  const child=new EventEmitter();child.pid=7103;
  for(const channel of ['stdout','stderr']){
    child[channel]=new EventEmitter();child[channel].pause=()=>{};child[channel].resume=()=>{};
  }
  const writer=new EventEmitter();writer.pause=()=>{};writer.resume=()=>{};
  writer.end=bytes=>{h.trace.push(['end',bytes===undefined?null:Buffer.from(bytes).toString('hex')]);};
  writer.destroy=()=>{h.fault.push('writer.destroy');throw Error('forbidden');};
  child.stdio=[null,child.stdout,child.stderr,null,fd4?writer:null];
  child.kill=()=>{h.fault.push('child.kill');throw Error('forbidden');};
  child.unref=()=>{h.fault.push('child.unref');throw Error('forbidden');};
  return {child,writer};
}
async function task4bRealObserver(h){
  const helper=await import('../../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs');
  h.seams.helper.observeManualOrphanOwnedChildV1=helper.observeManualOrphanOwnedChildV1;
  return helper.observeManualOrphanOwnedChildV1;
}
function task4bFinish(child,writer,code=0){
  child.emit('exit',code,null);
  for(const stream of [child.stdout,child.stderr])if(stream){stream.emit('end');stream.emit('close',false);}
  if(writer){writer.emit('finish');writer.emit('end');writer.emit('close',false);}
  child.emit('close',code,null);
}
function task4bReleaseSyntheticObserver(child){
  // If an assertion fails, stop only a test emitter's real observer timer.
  // No OS handle is signalled, destroyed, unreferenced, or declared closed.
  if(child.listenerCount('error')>0)child.emit('error',Error('component finished'));
}

test('Task4B spawn consumer captures its clock before permitting any native dispatch',async()=>{
  const h=await task4bContainedConstructor(),spawn=task4bBinding(h,'spawnManualOrphanConstructorChildV1');
  h.fake.hrtime={bigint(){h.trace.push('clock');throw Error('clock');}};
  assert.throws(()=>spawn('initdb',[],TASK4B_M,{PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'},TASK7_HOST_POLICY),task4bUnknown);
  assert.deepEqual(h.trace,['clock']);h.clean();
});

test('Task4B spawn consumer binds present original channels before postspawn clock refusal',async()=>{
  const h=await task4bContainedConstructor(),spawn=task4bBinding(h,'spawnManualOrphanConstructorChildV1');
  await task4bRealObserver(h);
  for(const missingStdout of [false,true]){
    h.time(0n);const {child,writer}=task4bEventChild(h);
    if(missingStdout){child.stdout=null;child.stdio[1]=null;}
    h.seams.cp.spawn=(executable,args,options)=>{
      assert.equal(executable,TASK4B_NODE);assert.equal(options.cwd,TASK4B_M);
      assert.equal(options.argv0,TASK4B_NODE);assert.equal(options.shell,false);assert.equal(options.detached,false);
      assert.deepEqual(Array.from(options.stdio),['ignore','pipe','pipe','ignore','pipe']);
      assert.deepEqual(task4bPlain(options.env),{PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'});
      h.time(5000000000n);return child;
    };
    try{
    const owned=spawn('runner',['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
      'node','--import','tsx','--test','--test-isolation=none',
      'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts'],TASK4B_M,
      {PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'},TASK7_HOST_POLICY);
    assert.equal(owned.child,child);assert.equal(owned.writer,writer);
    for(const event of ['error','exit','close'])assert.ok(child.listenerCount(event)>0,event);
    for(const stream of [child.stderr,writer])for(const event of ['error','end','close'])
      assert.ok(stream.listenerCount(event)>0,event+' still bound');
    assert.equal(owned.check(5000000000n),false,'spawn/binding time consumes the owner window');
    task4bFinish(child,writer);await owned.witness.settled;
    }finally{task4bReleaseSyntheticObserver(child);}
  }
  assert.equal(h.trace.length,0,'no end or cleanup effect follows refusal');h.clean();
});

// This consumes the actual shared observer snapshot, not a fabricated all-good
// constructor. The earlier immutable settled value never grants later success.
test('Task4B child completion consumer requires current complete purpose specific joins',async()=>{
  const h=await task4bContainedConstructor(),requireSuccess=task4bBinding(h,'requireManualOrphanConstructorChildSuccessV1');
  const observe=await task4bRealObserver(h);
  for(const purpose of ['initdb','server','runner']){
    const {child,writer}=task4bEventChild(h,purpose==='runner');
    const witness=observe(child,purpose);
    try{
    assert.throws(()=>requireSuccess(witness,purpose),task4bUnknown,'no original close');
    task4bFinish(child,purpose==='runner'?writer:null);await witness.settled;
    assert.doesNotThrow(()=>requireSuccess(witness,purpose));
    child.stderr.emit('error',Error('late'));
    assert.throws(()=>requireSuccess(witness,purpose),task4bUnknown,'current late error dominates historical settlement');
    }finally{task4bReleaseSyntheticObserver(child);}
  }
  const {child}=task4bEventChild(h,false),witness=observe(child,'initdb');
  try{
  task4bFinish(child,null,7);await witness.settled;
  assert.throws(()=>requireSuccess(witness,'initdb'),error=>error?.message==='MANUAL_ORPHAN_SETUP_REFUSED');
  }finally{task4bReleaseSyntheticObserver(child);}
  h.clean();
});

// A reserved-client/row-order seam only. Nothing here authenticates PostgreSQL,
// a connection, catalog contents, or a complete constructor owner. Its strict
// SQL inventory detects pool queries, reconnects, mutation and sensitive reads.
function task4bAdminFixture(h){
  const endpoint={url:'postgresql://postgres:'+('a'.repeat(64))+'@127.0.0.1:55439/postgres',
    root,physicalRoot:'/private'+root,dataDirectory:root+'/data',port:55439};
  const identity={pid:7110,backendStartedAtUTC:'2026-10-22T00:00:00.123456Z',
    serverVersionNum:170010,database:'postgres',currentUser:'postgres',sessionUser:'postgres',
    databaseOid:5,userOid:10,serverAddress:'127.0.0.1',serverPort:55439,
    systemIdentifier:'7550000000000000001',postmasterStartedAtUTC:'2026-10-22T00:00:00.000001Z',
    dataDirectory:root+'/data',socketDirectories:root,port:55439,listenAddresses:'127.0.0.1',
    passwordEncryption:'scram-sha-256',socketPermissions:'0700'};
  const data={databases:[
    {name:'postgres',oid:5,ownerOid:10,allowConnections:true,connectionLimit:-1},
    {name:'template0',oid:4,ownerOid:10,allowConnections:false,connectionLimit:-1},
    {name:'template1',oid:1,ownerOid:10,allowConnections:true,connectionLimit:-1},
  ],roles:[{name:'postgres',oid:10,superuser:true,inherit:true,createRole:true,createDb:true,
    login:true,replication:true,bypassRls:true,connectionLimit:-1,validUntilUTC:null}],memberships:[]};
  const state={identity,data,options:null,identityQueries:0,reserves:0,releases:0,ends:0,
    nextIdentity:null,releaseError:null,endError:null,endPending:null,queries:[]};
  const failure=site=>{h.fault.push(site);throw Error('TASK4B_FORBIDDEN_SQL');};
  const reserved=task4bCheckedSeam(h,(strings,...values)=>{
    if(!Array.isArray(strings)||!Array.isArray(strings.raw))return failure('untagged reserved query');
    const sql=strings.join('?');state.queries.push(sql);h.trace.push('query');
    if(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|pg_authid|pg_terminate_backend|FORCE)\b/i.test(sql))
      return failure('mutation or sensitive catalog');
    assert.deepEqual(values,[],'fixed read-only constructor queries have no caller SQL substitutions');
    if(/pg_backend_pid\s*\(/i.test(sql)){
      assert.match(sql,/pg_stat_activity/i);assert.match(sql,/backend_start/i);
      assert.match(sql,/to_char/i);assert.match(sql,/UTC/i);
      assert.match(sql,/pg_control_system/i);assert.match(sql,/server_version_num/i);
      assert.match(sql,/current_database/i);assert.match(sql,/current_user/i);assert.match(sql,/session_user/i);
      assert.match(sql,/inet_server_addr/i);assert.match(sql,/inet_server_port/i);
      state.identityQueries++;
      return state.nextIdentity===null?Promise.resolve([{...state.identity}]):state.nextIdentity();
    }
    if(/FROM\s+pg_database\b/i.test(sql)){
      assert.match(sql,/LIMIT\s+4\b/i);assert.match(sql,/datdba/i);assert.match(sql,/datallowconn/i);
      return Promise.resolve(state.data.databases);
    }
    if(/FROM\s+pg_roles\b/i.test(sql)){
      assert.match(sql,/LIMIT\s+129\b/i);assert.match(sql,/rolvaliduntil/i);
      assert.match(sql,/to_char/i);assert.match(sql,/UTC/i);assert.match(sql,/infinity/i);
      return Promise.resolve(state.data.roles);
    }
    if(/FROM\s+pg_auth_members\b/i.test(sql)){
      assert.match(sql,/LIMIT\s+257\b/i);assert.match(sql,/inherit_option/i);assert.match(sql,/set_option/i);
      return Promise.resolve(state.data.memberships);
    }
    return failure('unlisted reserved query');
  });
  reserved.unsafe=()=>failure('reserved.unsafe');
  reserved.release=()=>{state.releases++;h.trace.push('release');if(state.releaseError)throw state.releaseError;};
  const pool=()=>failure('pool query');
  pool.reserve=async()=>{state.reserves++;h.trace.push('reserve');if(state.reserves!==1)return failure('re-reserve');return reserved;};
  pool.end=task4bCheckedSeam(h,options=>{state.ends++;h.trace.push('end');assert.deepEqual(task4bPlain(options),{timeout:5});
    if(state.endError)return Promise.reject(state.endError);
    return state.endPending??Promise.resolve();});
  h.seams.postgres=(url,options)=>{assert.equal(url,endpoint.url);assert.equal(state.options,null,'one pool only');
    state.options=options;h.trace.push('pool');return pool;};
  return {endpoint,state};
}

test('Task4B admin consumer reserves one nonexpiring connection and captures its own microsecond backend pair',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
  assert.equal(state.options.max,1);assert.equal(state.options.idle_timeout,0);assert.equal(state.options.max_lifetime,0);
  assert.equal(state.reserves,1);assert.equal(state.identityQueries,1);
  assert.deepEqual(task4bPlain(admin.snapshot().backend),{pid:7110,backendStartedAtUTC:'2026-10-22T00:00:00.123456Z'});
  assert.notEqual(admin.snapshot().backend.pid,h.fake.pid);
  await admin.close();assert.equal(state.releases,1);assert.equal(state.ends,1);h.clean();
});

test('Task4B admin consumer refuses changed backend pid or same pid with a new start without refreshing ownership',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  for(const change of [{pid:7111},{backendStartedAtUTC:'2026-10-22T00:00:00.123457Z'}]){
    const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
    Object.assign(state.identity,change);
    await assert.rejects(admin.readIdentity(),task4bUnknown);
    assert.equal(admin.snapshot().unknown,true);
    assert.deepEqual(task4bPlain(admin.snapshot().backend),{pid:7110,backendStartedAtUTC:'2026-10-22T00:00:00.123456Z'});
    const before=state.identityQueries;await assert.rejects(admin.readIdentity(),task4bUnknown);
    assert.equal(state.identityQueries,before);assert.equal(state.reserves,1);
    await assert.rejects(admin.close(),task4bUnknown);
    assert.equal(state.releases,1);assert.equal(state.ends,1,'own settled client still attempts its close once');
  }
  h.clean();
});

test('Task4B unexpected admin onclose stays unknown after later matching identity data',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
  assert.equal(typeof state.options.onclose,'function');state.options.onclose(999);
  await assert.rejects(admin.readIdentity(),task4bUnknown);
  assert.equal(state.identityQueries,1,'matching rows must not be fetched to repair an onclose');
  assert.equal(state.reserves,1);assert.equal(admin.snapshot().unknown,true);
  await assert.rejects(admin.close(),task4bUnknown);h.clean();
});

test('Task4B timed out query remains pending until its eventual result and cannot race admin close',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
  let resolveQuery,settled=false;
  state.nextIdentity=()=>new Promise(resolve=>{resolveQuery=resolve;});
  const operation=admin.readIdentity().then(()=>{settled=true;return null;},error=>{settled=true;return error;});
  await Promise.resolve();assert.equal(typeof resolveQuery,'function','the actual query must have begun');
  h.time(30000000000n);h.fire(30000);await Promise.resolve();
  assert.equal(admin.snapshot().unknown,true);assert.equal(admin.snapshot().pending,true);
  assert.equal(settled,false,'deadline is uncertainty, not abandonment of in-flight work');
  await assert.rejects(admin.close(),task4bUnknown);
  assert.equal(state.releases,0);assert.equal(state.ends,0);
  resolveQuery([{...state.identity}]);assert.ok(task4bUnknown(await operation));
  assert.equal(admin.snapshot().pending,false);assert.equal(admin.snapshot().unknown,true);
  await assert.rejects(admin.close(),task4bUnknown);
  assert.equal(state.reserves,1);assert.equal(state.releases,1);assert.equal(state.ends,1);h.clean();
});

test('Task4B admin close burns reservation once then immediately ends and permanently stops queries',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
  h.trace.length=0;await admin.close();
  assert.deepEqual(h.trace,['release','end']);assert.equal(admin.snapshot().closed,true);
  await admin.close();assert.deepEqual(h.trace,['release','end'],'no query, reserve, release or end retry');
  await assert.rejects(admin.readIdentity(),task4bUnknown);
  assert.deepEqual(h.trace,['release','end']);
  assert.equal(state.reserves,1);assert.equal(state.releases,1);assert.equal(state.ends,1);h.clean();
});

test('Task4B release throw end rejection and close deadline never promote later close fulfillment',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  for(const failure of ['release','end','deadline']){
    h.time(0n);const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
    let resolveEnd;
    if(failure==='release')state.releaseError=Error('release uncertain');
    if(failure==='end')state.endError=Error('end uncertain');
    if(failure==='deadline')state.endPending=new Promise(resolve=>{resolveEnd=resolve;});
    const closing=admin.close().then(()=>null,error=>error);
    if(failure==='deadline'){
      await Promise.resolve();h.time(5000000000n);h.fire(5000);resolveEnd();
    }
    assert.ok(task4bUnknown(await closing),failure);assert.equal(admin.snapshot().unknown,true);
    assert.equal(state.releases,1);assert.equal(state.ends,1,'end is requested even when release throws');
    await assert.rejects(admin.close(),task4bUnknown);
    assert.equal(state.releases,1);assert.equal(state.ends,1);
  }
  h.clean();
});

test('Task4B catalog reader requests overflow rows and uses the reviewed canonicalizer for full original arrays',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  const {canonicalizeManualOrphanClusterBaselineV1:canonicalize}=
    await import('../../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs');
  let normalizations=0;
  // Realm-only DATA transfer: the real codec rejects foreign Array prototypes.
  // No bytes, flags, fields or rows are repaired by this bridge.
  h.seams.helper.canonicalizeManualOrphanClusterBaselineV1=value=>{
    normalizations++;return canonicalize(task4bPlain(value));
  };
  const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint);
  const result=await admin.readBaselines();
  assert.equal(normalizations,1);assert.deepEqual(task4bPlain(result.databases),state.data.databases);
  assert.deepEqual(task4bPlain(result.roles),state.data.roles);assert.deepEqual(task4bPlain(result.memberships),[]);
  assert.equal(state.queries.filter(sql=>/FROM\s+pg_database\b/i.test(sql)&&/LIMIT\s+4\b/i.test(sql)).length,1);
  assert.equal(state.queries.filter(sql=>/FROM\s+pg_roles\b/i.test(sql)&&/LIMIT\s+129\b/i.test(sql)).length,1);
  assert.equal(state.queries.filter(sql=>/FROM\s+pg_auth_members\b/i.test(sql)&&/LIMIT\s+257\b/i.test(sql)).length,1);
  state.data.databases.push({name:'unexpected',oid:999,ownerOid:10,allowConnections:true,connectionLimit:-1});
  await assert.rejects(admin.readBaselines(),task4bRefused);
  assert.equal(admin.snapshot().unknown,true,'catalog overflow cannot become new original baseline');
  await assert.rejects(admin.close(),task4bUnknown);h.clean();
});

// The tap is diagnostic, not a replacement lifecycle observer. No stream bytes
// may become journal output, display output, or a buffered raw-data record.
function task4bControlFixture(h){
  const {child,writer}=task4bEventChild(h),records=[],state={unknown:false,flushError:false,returnFalse:false};
  const journal={control(stage,fields){if(state.flushError)throw Error('journal');
    if(state.returnFalse)return false;
    records.push([stage,task4bPlain(fields)]);return true;},
    output(){h.fault.push('raw journal output');throw Error('forbidden');},
    burn(){state.unknown=true;}};
  const mirrors={stdout:{write(){h.fault.push('raw stdout mirror');throw Error('forbidden');}},
    stderr:{write(){h.fault.push('raw stderr mirror');throw Error('forbidden');}}};
  return {child,writer,records,state,journal,mirrors};
}

test('Task4B runner control tap stages early lifecycle observations in order without raw bytes',async()=>{
  const h=await task4bContainedConstructor(),attach=task4bBinding(h,'attachManualOrphanConstructorControlV1');
  const f=task4bControlFixture(h),tap=attach(f.child,'test',f.journal,f.mirrors);
  f.child.stdout.emit('data',Buffer.from('NEVER_FORWARD_PRIVATE_STDOUT'));
  f.child.stderr.emit('data',Buffer.from('NEVER_FORWARD_PRIVATE_STDERR'));
  f.child.emit('exit',7,null);f.child.stderr.emit('end');f.child.stdout.emit('end');f.child.emit('close',7,null);
  assert.deepEqual(f.records,[],'no durable journal write in the delivery interval');
  tap.flush();
  assert.deepEqual(f.records,[
    ['child-exit',{childRole:'test',pid:7103,code:7,signal:null}],
    ['stream-end',{childRole:'test',channel:'stderr'}],
    ['stream-end',{childRole:'test',channel:'stdout'}],
    ['child-close',{childRole:'test',pid:7103,code:7,signal:null}],
  ]);
  assert.equal(tap.healthy,true);assert.equal(f.state.unknown,false);h.clean();
});

test('Task4B runner control staging caps at thirty two and burns overflow or flush failure',async()=>{
  const h=await task4bContainedConstructor(),attach=task4bBinding(h,'attachManualOrphanConstructorControlV1');
  for(const cause of ['overflow','flush','false']){
    const f=task4bControlFixture(h),tap=attach(f.child,'test',f.journal,f.mirrors);
    if(cause==='overflow'){
      for(let index=0;index<32;index++)f.child.emit('error',Error('private'));
      assert.equal(tap.healthy,true,'32 finite controls fit staging; full witness separately rejects duplicate errors');
      f.child.emit('error',Error('private overflow'));assert.equal(tap.healthy,false);
    }else{f.child.emit('exit',7,null);f.state.flushError=cause==='flush';f.state.returnFalse=cause==='false';}
    tap.flush();assert.equal(tap.healthy,false);assert.equal(f.state.unknown,true);
    assert.ok(f.records.length<=32);assert.doesNotMatch(JSON.stringify(f.records),/private|overflow/);
  }
  h.clean();
});

// Supplementary metadata only: 11 immutable comparison files +14 canonical
// ancestors. No whole-tree, byte/hash, package, build or target recheck claim.
function task4bDeliveryFixture(h){
  const directories=['/',path.dirname(TASK7_HOST_POLICY.home),TASK7_HOST_POLICY.home,path.dirname(TASK7_HOST_POLICY.workspace),TASK7_HOST_POLICY.workspace,
    TASK7_HOST_POLICY.releases,TASK4B_M,TASK4B_M+'/scripts',TASK4B_M+'/scripts/__tests__',
    TASK4B_M+'/tests',TASK4B_M+'/tests/execution-attempts',TASK4B_M+'/tests/execution-attempts/helpers',
    TASK4B_M+'/src',TASK4B_M+'/src/installation'];
  const leaves=[
    ['constructor','scripts/run-private-postgres-tests.mjs'],
    ['constructorTests','scripts/__tests__/private-postgres-test-cluster.test.js'],
    ['wrapper','scripts/run-execution-attempt-tests.ts'],['isolatedRunner','scripts/run-isolated-postgres-tests.ts'],
    ['builtinChild','tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs'],
    ['routeTests','scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js'],
    ['fixture','tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts'],
    ['integration','tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts'],
    ['journal','scripts/private-postgres-test-journal-v1.mjs'],['pgPreflight','scripts/finding-test-preflight.mjs'],
    ['profile','src/installation/manual-orphan-target-dependencies-v1.json'],
  ];
  let id=100;
  function pin(path,kind,key){
    const fd=id++,directory=kind==='directory';
    const stat={dev:1n,ino:BigInt(fd),uid:501n,gid:20n,mode:directory?0o40755n:0o100644n,
      nlink:directory?2n:1n,size:directory?128n:10n,birthtimeNs:1n,mtimeNs:2n,ctimeNs:3n,
      isDirectory:()=>directory,isFile:()=>!directory,isSymbolicLink:()=>false};
    return {path,fd,key,stat,immutable:path===TASK4B_M||path.startsWith(TASK4B_M+'/')};
  }
  const pins={directories:directories.map(path=>pin(path,'directory')),
    files:leaves.map(([key,suffix])=>pin(TASK4B_M+'/'+suffix,'file',key))};
  const all=[...pins.directories,...pins.files],named=new Map(all.map(p=>[p.path,{...p.stat}])),
    held=new Map(all.map(p=>[p.fd,{...p.stat}]));
  h.seams.fs.lstatSync=(path,options)=>{assert.equal(options.bigint,true);assert.ok(named.has(path));
    h.trace.push(['named',path]);return named.get(path);};
  h.seams.fs.fstatSync=(fd,options)=>{assert.equal(options.bigint,true);assert.ok(held.has(fd));
    h.trace.push(['held',fd]);return held.get(fd);};
  return {pins,all,named,held};
}

test('Task4B supplementary delivery metadata checks exactly twenty five held and named identities without reads',async()=>{
  const h=await task4bContainedConstructor(),check=task4bBinding(h,'checkManualOrphanDeliveryMetadataV1');
  const {pins,all,named,held}=task4bDeliveryFixture(h);
  assert.doesNotThrow(()=>check(pins));assert.equal(h.trace.length,50);
  assert.equal(new Set(h.trace.filter(([kind])=>kind==='named').map(([,key])=>key)).size,25);
  assert.equal(new Set(h.trace.filter(([kind])=>kind==='held').map(([,key])=>key)).size,25);
  const ancestor=pins.directories[1];named.get(ancestor.path).mtimeNs=90n;held.get(ancestor.fd).mtimeNs=90n;
  h.trace.length=0;assert.doesNotThrow(()=>check(pins));assert.equal(h.trace.length,50,'shared ancestor timestamps are mutable');
  for(const [label,pin,field] of [
    ['leaf named replacement',pins.files[0],'ino'],['leaf bytes changed',pins.files[0],'size'],
    ['leaf timestamp',pins.files[0],'mtimeNs'],['leaf mode',pins.files[0],'mode'],
    ['immutable directory timestamp',pins.directories[7],'mtimeNs'],
    ['ancestor identity',pins.directories[1],'ino'],
  ]){
    const original=named.get(pin.path)[field];named.get(pin.path)[field]=original+1n;
    assert.throws(()=>check(pins),task4bRefused,label);named.get(pin.path)[field]=original;
  }
  const pin=all[all.length-1];held.get(pin.fd).ino++;
  assert.throws(()=>check(pins),task4bRefused,'held descriptor differs despite unchanged named path');
  h.clean();
});

// Only a private input-stream consumer is exercised; these bytes intentionally
// are NOT a valid setup frame and are never passed to a receiver or full owner.
test('Task4B input consumer attempts one end and never retries after end throw or late cutoff',async()=>{
  const h=await task4bContainedConstructor(),create=task4bBinding(h,'createManualOrphanConstructorInputV1'),
    clockFactory=task4bBinding(h,'createManualOrphanConstructorClockV1');
  for(const fault of ['none','throw','overrun']){
    h.time(0n);const clock=clockFactory(),ends=[];
    const writer={end(bytes){ends.push(Buffer.from(bytes));
      if(fault==='throw')throw Error('partial write');if(fault==='overrun')h.time(5000000000n);}};
    const input=create(writer,clock),bytes=Buffer.from('inert-component-bytes\n');
    assert.equal(input.end(bytes),fault==='none');
    assert.equal(ends.length,1);assert.deepEqual(ends[0],bytes);
    input.abort();assert.equal(ends.length,1,'abort cannot send a second empty end');
    assert.equal(input.end(bytes),false);assert.equal(ends.length,1,'no valid-frame retry');
    assert.equal(input.snapshot().unknown,true,'duplicate issuance or prior end fault is sticky');
  }
  h.clean();
});

test('Task4B input consumer refuses issuance after synchronous observation overrun and aborts at most once',async()=>{
  const h=await task4bContainedConstructor(),create=task4bBinding(h,'createManualOrphanConstructorInputV1'),
    clockFactory=task4bBinding(h,'createManualOrphanConstructorClockV1');
  h.time(0n);const clock=clockFactory(),ends=[];
  const input=create({end(bytes){ends.push(bytes);}},clock);
  // Models elapsed time after an unpreemptible existing process observation.
  // The outer clock cannot promise that observation returned within five seconds.
  h.time(6000000000n);
  assert.equal(input.end(Buffer.from('inert-component-bytes\n')),false);assert.deepEqual(ends,[]);
  assert.equal(input.snapshot().unknown,true);
  input.abort();input.abort();assert.deepEqual(ends,[undefined]);
  assert.equal(input.snapshot().issued,false,'empty EOF request is not frame delivery');h.clean();
});

test('Task4B cleanup eligibility requires every independently collected final fact and no sticky fault',async()=>{
  const h=await task4bContainedConstructor(),eligible=task4bBinding(h,'manualOrphanConstructorCleanupEligibleV1');
  // Inert predicate DATA; never provided to runManualOrphanConstructorV1 or a
  // signal helper. Actual acquisition and two100ms-spaced samples stay Task7.
  const facts={runnerReceipt:true,runnerClosed:true,baselineRestored:true,ownBackend:true,
    adminClosed:true,currentSource:true,unknown:false,cancelled:false};
  assert.equal(eligible(facts),true);
  for(const key of ['runnerReceipt','runnerClosed','baselineRestored','ownBackend','adminClosed','currentSource'])
    assert.equal(eligible({...facts,[key]:false}),false,key);
  for(const key of ['unknown','cancelled'])assert.equal(eligible({...facts,[key]:true}),false,key);
  assert.equal(eligible({}),false,'precleanup refusal cannot authorize a server shutdown');h.clean();
});

test('Task4B admin identity refuses wrong server version settings or login before later queries',async()=>{
  const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
  for(const change of [
    {serverVersionNum:169999},{serverVersionNum:180000},{database:'foreign'},
    {sessionUser:'foreign'},{dataDirectory:'/private'+root+'/data'},{socketDirectories:'/tmp'},
    {passwordEncryption:'md5'},{backendStartedAtUTC:'2026-10-22T00:00:00.123Z'},
  ]){
    const {endpoint,state}=task4bAdminFixture(h);Object.assign(state.identity,change);
    await assert.rejects(open(endpoint),task4bRefused);
    assert.equal(state.identityQueries,1,'the malformed actual-query DATA must be reached');
    assert.equal(state.reserves,1);assert.equal(state.releases,1);assert.equal(state.ends,1,
      'reservation and pool are retained before fallible initial identity validation');
  }
  h.clean();
});

test('Task4B restored-session comparison permits only the original backend and named background types',async()=>{
  const h=await task4bContainedConstructor(),check=task4bBinding(h,'verifyManualOrphanConstructorQuiescenceV1');
  const original={pid:7110,backendStartedAtUTC:'2026-10-22T00:00:00.123456Z'};
  const own={...original,backendType:'client backend',clientAddress:'127.0.0.1'};
  const backgrounds=['autovacuum launcher','autovacuum worker','background writer','checkpointer',
    'walwriter','logical replication launcher'].map((backendType,index)=>({pid:7200+index,
      backendStartedAtUTC:'2026-10-22T00:00:00.000001Z',backendType,clientAddress:null}));
  assert.equal(check([own,...backgrounds],original),true);
  for(const [label,rows] of [
    ['missing original',backgrounds],['duplicate original',[own,own]],
    ['new start',[{...own,backendStartedAtUTC:'2026-10-22T00:00:00.123457Z'}]],
    ['unknown client',[own,{...own,pid:7999}]],
    ['unknown background',[own,{...backgrounds[0],backendType:'extension worker'}]],
    ['background with client address',[own,{...backgrounds[0],clientAddress:'127.0.0.1'}]],
    ['null type',[own,{...backgrounds[0],backendType:null}]],
  ])assert.equal(check(rows,original),false,label);
  h.clean();
});

// Fix1/I1 break: the outer purpose clock keeps expiring an original whose
// complete joins were observed on time. These are actual spawn/check consumers
// and the real shared observer over emitters, not a complete owner emulator.
test('Task4B fix1 outer child clock retains timely completion while refusing late completion and later faults',async()=>{
  const cases=[
    {label:'initdb stays complete',purpose:'initdb',later:61000000000n},
    {label:'runner stays complete',purpose:'runner',later:841000000000n},
    {label:'late original error',purpose:'initdb',later:61000000000n,fault:'original'},
    {label:'late stream error',purpose:'initdb',later:61000000000n,fault:'stream'},
    {label:'backwards clock after completion',purpose:'initdb',later:61000000000n,fault:'backwards'},
    {label:'unavailable clock after completion',purpose:'initdb',later:61000000000n,fault:'unavailable'},
    {label:'first completion at deadline',purpose:'initdb',firstLate:true},
    {label:'spawn time is charged',purpose:'initdb',firstLate:true,spawnTime:59000000000n},
    {label:'binding time is charged',purpose:'initdb',bindingLate:true},
  ];
  for(const row of cases){
    const h=await task4bContainedConstructor(),spawn=task4bBinding(h,'spawnManualOrphanConstructorChildV1');
    const observe=await task4bRealObserver(h),{child,writer}=task4bEventChild(h,row.purpose==='runner');
    let dispatches=0,bindings=0;
    h.seams.cp.spawn=()=>{dispatches++;h.time(row.spawnTime??0n);return child;};
    h.seams.helper.observeManualOrphanOwnedChildV1=(original,purpose)=>{
      assert.equal(original,child);assert.equal(purpose,row.purpose);bindings++;
      const witness=observe(original,purpose);
      if(row.bindingLate){h.time(60000000000n);task4bFinish(child,null);}
      return witness;
    };
    try{
      const owned=spawn(row.purpose,[],TASK4B_M,{PATH:TASK4B_PATH,LANG:'C',LC_ALL:'C'},TASK7_HOST_POLICY);
      assert.equal(dispatches,1,row.label);assert.equal(bindings,1,row.label);
      if(row.bindingLate){
        await owned.witness.settled;
        assert.equal(owned.witness.snapshot().state,'observed','shared completion cannot erase outer binding time');
        assert.equal(owned.check(),false,row.label);
      }else{
        assert.equal(owned.check(),true,row.label+' starts within its purpose budget');
        h.time(row.firstLate?60000000000n:2000000000n);
        task4bFinish(child,row.purpose==='runner'?writer:null);await owned.witness.settled;
        assert.equal(owned.witness.snapshot().state,'observed',row.label+' actual full joins');
        assert.equal(owned.check(),!row.firstLate,row.label+' first complete current observation');
        if(!row.firstLate){
          h.time(row.later);
          assert.equal(owned.check(),true,row.label+' completed purpose must not expire in a later phase');
          if(row.fault){
            const originalClock=h.fake.hrtime;
            if(row.fault==='original')child.emit('error',Error('late component original'));
            if(row.fault==='stream')child.stderr.emit('error',Error('late component stream'));
            if(row.fault==='backwards')h.time(1000000000n);
            if(row.fault==='unavailable')h.fake.hrtime={bigint(){throw Error('component clock unavailable');}};
            assert.equal(owned.check(),false,row.label+' remains a current-fault check');
            h.fake.hrtime=originalClock;h.time(row.later+1n);
            assert.equal(owned.check(),false,row.label+' uncertainty is sticky');
          }
        }
      }
      assert.equal(h.trace.length,0,'no input end or native cleanup is used by this clock predicate');h.clean();
    }finally{task4bReleaseSyntheticObserver(child);}
  }
});

// Test-only operation gate. Rejection is requested only after the retained
// pending assertions pass; finally resolves any still-open gate and collects
// the consumer, so the intended RED cannot leave an unhandled late rejection.
function task4bFix1Gate(){
  let resolve,reject,done=false;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,get done(){return done;},resolve(value){if(!done){done=true;resolve(value);}},
    reject(error){if(!done){done=true;reject(error);}}};
}
function task4bFix1TimerThrow(h,milliseconds,assertStarted){
  let faults=0;
  assert.equal(Object.hasOwn(h.timers,'set'),false,'the existing timer map has no override');
  h.timers.set=task4bCheckedSeam(h,(id,item)=>{
    if(item.ms===milliseconds&&faults===0){
      assertStarted();faults++;h.trace.push('timer-throw');throw Error('component timer construction');
    }
    return Map.prototype.set.call(h.timers,id,item);
  });
  return {get faults(){return faults;},restore(){delete h.timers.set;}};
}
function task4bFix1TimerDeleteThrow(h,milliseconds,assertSettled){
  let faults=0;
  assert.equal(Object.hasOwn(h.timers,'delete'),false,'the existing timer map has no cleanup override');
  h.timers.delete=task4bCheckedSeam(h,id=>{
    const item=h.timers.get(id),removed=Map.prototype.delete.call(h.timers,id);
    if(item?.ms===milliseconds&&faults===0){
      assertSettled();faults++;h.trace.push('timer-cleanup-throw');throw Error('component timer cleanup');
    }
    return removed;
  });
  return {get faults(){return faults;},restore(){delete h.timers.delete;}};
}
// Let already-queued promise reactions run before inspecting settled flags.
// This turn is not the oracle: each test also requires an explicitly open gate,
// exact started-operation/timer trace, sticky state and cleanup call counts.
const task4bFix1Turn=()=>new Promise(resolve=>setImmediate(resolve));

// Fix1/I2 break: timer creation throws after reserve starts, so open clears its
// pending work and ends the pool before that exact reservation can settle.
test('Task4B fix1 timer construction failure retains an unresolved reservation until its actual settlement',async()=>{
  for(const outcome of ['resolve','reject']){
    const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
    const {endpoint,state}=task4bAdminFixture(h),gate=task4bFix1Gate(),factory=h.seams.postgres;
    let settled=false;
    h.seams.postgres=task4bCheckedSeam(h,(...args)=>{
      const pool=factory(...args),reserve=pool.reserve;
      pool.reserve=task4bCheckedSeam(h,()=>{
        const original=reserve();
        return gate.promise.then(()=>original);
      });
      return pool;
    });
    const timer=task4bFix1TimerThrow(h,30000,()=>{
      assert.equal(state.reserves,1,'reserve is already started');assert.equal(gate.done,false);
      assert.equal(state.releases,0);assert.equal(state.ends,0);
    });
    const opening=open(endpoint).then(value=>{settled=true;return {value};},error=>{settled=true;return {error};});
    try{
      await task4bFix1Turn();
      assert.equal(timer.faults,1,'reach the post-reserve timer failure');assert.equal(gate.done,false);
      assert.deepEqual(h.trace,['pool','reserve','timer-throw'],'no query or cleanup while reserve remains unresolved');
      assert.equal(state.releases,0);assert.equal(state.ends,0);
      assert.equal(settled,false,'the actual acquisition remains retained until the reservation settles');
      if(outcome==='resolve')gate.resolve();else gate.reject(Error('component reserve rejection'));
      const result=await opening;assert.ok(task4bUnknown(result.error),outcome+' cannot promote acquisition');
      assert.equal(state.reserves,1);assert.equal(state.identityQueries,0,'unknown acquisition cannot begin SQL');
      assert.equal(state.releases,outcome==='resolve'?1:0,'only an actually returned reservation can be released');
      assert.equal(state.ends,1,'own pool end is requested once after reserve settles');
      assert.deepEqual(h.trace,outcome==='resolve'?['pool','reserve','timer-throw','release','end']:
        ['pool','reserve','timer-throw','end']);h.clean();
    }finally{timer.restore();gate.resolve();await opening;}
  }
});

// Fix1/I2 break: timer creation clears a still-running reserved query, permitting
// close to release/end the exact connection that the query is still using.
test('Task4B fix1 query timer faults retain pending work and sanitize cleanup uncertainty',async()=>{
  for(const {outcome,cleanup} of [{outcome:'resolve',cleanup:false},{outcome:'reject',cleanup:false},
    {outcome:'resolve',cleanup:true}]){
    const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
    const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint),gate=task4bFix1Gate();
    let settled=false;state.nextIdentity=()=>gate.promise;h.trace.length=0;
    const timer=cleanup?task4bFix1TimerDeleteThrow(h,30000,()=>{
      assert.equal(gate.done,true,'the exact query settles before timer cleanup');
      assert.equal(state.releases,0);assert.equal(state.ends,0);
    }):task4bFix1TimerThrow(h,30000,()=>{
      assert.equal(state.identityQueries,2,'the actual second identity query has started');
      assert.equal(gate.done,false);assert.equal(state.releases,0);assert.equal(state.ends,0);
    });
    const reading=admin.readIdentity().then(value=>{settled=true;return {value};},error=>{settled=true;return {error};});
    try{
      assert.equal(timer.faults,cleanup?0:1,'reach the selected timer boundary');
      assert.equal(admin.snapshot().unknown,!cleanup);assert.equal(admin.snapshot().pending,true,
        'timer construction failure must not clear an unresolved operation');
      await task4bFix1Turn();assert.equal(gate.done,false);assert.equal(settled,false);
      if(!cleanup)await assert.rejects(admin.close(),task4bUnknown);
      assert.equal(admin.snapshot().pending,true);assert.equal(state.releases,0);assert.equal(state.ends,0);
      assert.deepEqual(h.trace,cleanup?['query']:['query','timer-throw'],
        'no cleanup effects may race a pending query');
      if(outcome==='resolve')gate.resolve([{...state.identity}]);else gate.reject(Error('component query rejection'));
      const result=await reading;assert.equal(timer.faults,1,'the actual timer fault was reached');
      assert.ok(task4bUnknown(result.error),outcome+' timer fault is sanitized and cannot promote success');
      assert.equal(admin.snapshot().pending,false);assert.equal(admin.snapshot().unknown,true);
      await assert.rejects(admin.readIdentity(),task4bUnknown);
      assert.equal(state.identityQueries,2,'no new query can repair the fault');
      await assert.rejects(admin.close(),task4bUnknown);await assert.rejects(admin.close(),task4bUnknown);
      assert.equal(state.reserves,1);assert.equal(state.releases,1);assert.equal(state.ends,1);
      assert.deepEqual(h.trace,['query',cleanup?'timer-cleanup-throw':'timer-throw','release','end']);h.clean();
    }finally{
      timer.restore();gate.resolve([{...state.identity}]);await reading;
      await admin.close().catch(()=>{});
    }
  }
});

// Fix1/I2 break: end has already started when timer creation throws; close must
// retain that same promise instead of returning UNKNOWN before actual closure.
test('Task4B fix1 close timer faults retain the one end and sanitize cleanup uncertainty',async()=>{
  for(const {outcome,cleanup} of [{outcome:'resolve',cleanup:false},{outcome:'reject',cleanup:false},
    {outcome:'resolve',cleanup:true}]){
    const h=await task4bContainedConstructor(),open=task4bBinding(h,'openManualOrphanConstructorAdminV1');
    const {endpoint,state}=task4bAdminFixture(h),admin=await open(endpoint),gate=task4bFix1Gate();
    let settled=false,repeatSettled=false;state.endPending=gate.promise;h.trace.length=0;
    const timer=cleanup?task4bFix1TimerDeleteThrow(h,5000,()=>{
      assert.equal(gate.done,true,'the exact end settles before timer cleanup');
      assert.equal(state.releases,1);assert.equal(state.ends,1);
    }):task4bFix1TimerThrow(h,5000,()=>{
      assert.equal(state.releases,1);assert.equal(state.ends,1,'pool.end already returned its retained promise');
      assert.equal(gate.done,false);assert.deepEqual(h.trace,['release','end']);
    });
    const closing=admin.close().then(value=>{settled=true;return {value};},error=>{settled=true;return {error};});
    const repeat=admin.close().then(value=>{repeatSettled=true;return {value};},error=>{repeatSettled=true;return {error};});
    try{
      await task4bFix1Turn();
      assert.equal(timer.faults,cleanup?0:1);assert.equal(gate.done,false);
      assert.equal(admin.snapshot().unknown,!cleanup);assert.equal(admin.snapshot().closed,false);
      assert.equal(settled,false,'initial close retains actual end after timer setup throws');
      assert.equal(repeatSettled,false,'repeat close joins the same retained end');
      await assert.rejects(admin.readIdentity(),task4bUnknown);
      assert.equal(state.identityQueries,1);assert.equal(state.reserves,1);
      assert.equal(state.releases,1);assert.equal(state.ends,1);
      assert.deepEqual(h.trace,cleanup?['release','end']:['release','end','timer-throw'],
        'release immediately precedes exactly one end');
      if(outcome==='resolve')gate.resolve();else gate.reject(Error('component end rejection'));
      assert.ok(task4bUnknown((await closing).error),outcome+' timer fault is sanitized');
      assert.ok(task4bUnknown((await repeat).error),outcome);assert.equal(timer.faults,1);
      assert.equal(admin.snapshot().unknown,true,'actual later settlement cannot repair the timer fault');
      await assert.rejects(admin.close(),task4bUnknown);
      assert.equal(state.releases,1);assert.equal(state.ends,1);
      assert.deepEqual(h.trace,['release','end',cleanup?'timer-cleanup-throw':'timer-throw']);h.clean();
    }finally{timer.restore();gate.resolve();await closing;await repeat;}
  }
});


// Task7 fixed-host bootstrap: complete actual constructor, opt-in private exposure.
// Only the exact configuration FD and hash/JSON builtins are admitted below;
// native, Source, database, arbitrary filesystem and timer seams remain closed.
function task7PolicyReaderFixture(h,{fault='none',root=TASK4B_M,contextHome=TASK7_HOST_POLICY.home}={}){
  const locator=root+'/src/installation/manual-orphan-fixed-host-policy-v1.json',fd=7301;
  const bytes=Buffer.from(TASK7_POLICY_BYTES);
  if(fault==='digest')bytes[bytes.indexOf('setrox')]='x'.charCodeAt(0);
  const state={events:[],reads:[],allocations:[],opens:0,closes:0,closed:false,hashes:0,parses:0,digest:null,offset:0};
  const stat=()=>({dev:1n,ino:fault==='identity'&&state.reads.length?74n:73n,
    uid:fault==='owner'?502n:501n,gid:20n,mode:fault==='mode'?0o100620n:0o100600n,
    nlink:1n,size:BigInt(fault==='size'?319:318),mtimeNs:1000n,ctimeNs:2000n,birthtimeNs:3000n,
    isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>fault==='symlink'});
  const checked=fn=>(...args)=>{
    try{return fn(...args);}catch(error){
      if(error?.code==='ERR_ASSERTION')h.fault.push('Task7 policy boundary assertion');
      throw error;
    }
  };
  h.seams.buffer.alloc=checked(size=>{
    assert.ok(size===318||size===1,'bounded configuration or EOF buffer only');
    state.allocations.push(size);state.events.push(['allocate',size]);return Buffer.alloc(size);
  });
  h.seams.fs.realpathSync=checked(value=>{
    assert.ok([locator,root,root+'/scripts/run-private-postgres-tests.mjs',contextHome].includes(value));
    state.events.push(['realpath',value]);
    if(value===locator&&fault==='missing')throw Error('PRIVATE_POLICY_MISSING_DETAIL');
    return value;
  });
  h.seams.fs.lstatSync=checked((value,options)=>{
    assert.equal(value,locator);assert.equal(options?.bigint,true);state.events.push(['named']);return stat();
  });
  h.seams.fs.openSync=checked((value,flags)=>{
    assert.equal(value,locator);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    assert.equal(state.opens,0);state.opens++;state.events.push(['open']);return fd;
  });
  h.seams.fs.fstatSync=checked((actual,options)=>{
    assert.equal(actual,fd);assert.equal(state.opens,1);assert.equal(state.closed,false);
    assert.equal(options?.bigint,true);state.events.push(['held']);return stat();
  });
  h.seams.fs.readSync=checked((actual,buffer,offset,length,position)=>{
    assert.equal(actual,fd);assert.equal(state.opens,1);assert.equal(state.closed,false);
    assert.ok(Buffer.isBuffer(buffer));assert.ok(buffer.length<=318,'allocate only the authenticated size or EOF byte');
    assert.ok(Number.isInteger(offset)&&offset>=0);assert.ok(Number.isInteger(length)&&length>0);
    assert.ok(offset+length<=buffer.length);assert.equal(position,state.offset,'explicit contiguous file offset');
    assert.ok(length<=(position===318?1:318-position));
    state.reads.push({position,length});state.events.push(['read',position]);
    if(fault==='read'||fault==='read-close')throw Error('PRIVATE_POLICY_READ_DETAIL');
    if(fault==='zero'&&position>0)return 0;
    if(position===318){
      assert.equal(length,1);if(fault==='extra'){buffer[offset]=120;return 1;}return 0;
    }
    const count=Math.min(length,73);bytes.copy(buffer,offset,position,position+count);state.offset+=count;return count;
  });
  h.seams.fs.closeSync=checked(actual=>{
    assert.equal(actual,fd);assert.equal(state.opens,1);assert.equal(state.closes,0);
    state.closes++;state.closed=true;state.events.push(['close']);
    if(fault==='close'||fault==='read-close')throw Error('PRIVATE_POLICY_CLOSE_DETAIL');
  });
  h.seams.crypto.createHash=checked(algorithm=>{
    assert.equal(algorithm,'sha256');assert.equal(state.offset,318);
    assert.equal(state.reads.at(-1).position,318,'EOF precedes authentication');
    assert.equal(state.hashes,0);state.hashes++;state.events.push(['hash']);
    const actual=createHash(algorithm);let updates=0;
    const hash={update:checked(value=>{
      assert.equal(updates++,0);assert.ok(Buffer.isBuffer(value));assert.deepEqual(value,bytes);
      actual.update(value);return hash;
    }),digest:checked(format=>{
      assert.equal(format,'hex');assert.equal(updates,1);state.digest=actual.digest(format);return state.digest;
    })};return hash;
  });
  h.seams.json.parse=checked(value=>{
    assert.equal(state.digest,'4b7ed03bf755ec453e0c7a79d3fcf4f4f4fee387dc9bf551d55e41e7b2281dc5',
      'authenticate the exact retained bytes before parsing');
    assert.equal(value,bytes.toString('utf8'));assert.equal(state.parses,0);state.parses++;
    state.events.push(['parse']);return JSON.parse(value);
  });
  return {state,bytes,locator,check(){
    h.clean();assert.ok(state.opens<=1);assert.equal(state.closes,state.opens,'close every acquired FD exactly once');
    assert.equal(state.closed,state.opens===1);assert.equal(h.timers.size,0);
    assert.deepEqual(h.fake.eventNames(),[]);assert.equal(h.output.stdout.length+h.output.stderr.length,0);
  }};
}
async function task7ReaderCase(fault){
  const h=await task4bContainedConstructor({hostPolicy:true,
    moduleUrl:new URL('file://'+TASK4B_M+'/scripts/run-private-postgres-tests.mjs').href});
  const read=h.hostPolicy.read;
  assert.equal(typeof read,'function','Task7 missing private reader scaffolding; no behavioral credit');
  assert.equal(read.length,0,'configuration reader has no selector arguments');
  const f=task7PolicyReaderFixture(h,{fault});let value,error;
  try{value=read();}catch(caught){error=caught;}
  f.check();
  if(fault==='none'){
    assert.equal(error,undefined);assert.equal(f.state.opens,1);assert.equal(f.state.closes,1);
    assert.deepEqual(task4bPlain(value),TASK7_HOST_POLICY);assert.equal(Object.isFrozen(value),true);
    assert.notEqual(value,TASK7_HOST_POLICY);assert.equal(f.state.parses,1);assert.equal(f.state.hashes,1);
    assert.equal(f.state.events.at(-1)[0],'close','known close precedes returning usable configuration');
    assert.throws(()=>{value.home='/changed-home';},TypeError);
  }else{
    assert.equal(value,undefined,'refusal cannot return usable configuration');
    assert.equal(error?.message,['close','read-close'].includes(fault)?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED');
    if(['missing','symlink','owner','mode'].includes(fault))assert.equal(f.state.opens,0);
    if(['missing','symlink','owner','mode','size'].includes(fault))assert.equal(f.state.reads.length,0);
    if(['missing','symlink','owner','mode','size'].includes(fault))assert.deepEqual(f.state.allocations,[],
      'reject metadata and wrong size before allocating configuration bytes');
    if(fault!=='close')assert.equal(f.state.parses,0,'invalid bytes or custody never reach parsing');
    if(fault==='digest')assert.equal(f.state.hashes,1,'changed valid JSON is rejected by authentication');
    if(['zero','extra','identity','read','read-close'].includes(fault))assert.equal(f.state.hashes,0);
    if(['digest','zero','extra','identity','read','close','read-close'].includes(fault))assert.equal(f.state.opens,1);
  }
}

// Each fault changes one boundary; owner and mode are deliberately separate rows.
test('Task7 host policy reader returns frozen authenticated data only after known close',()=>task7ReaderCase('none'));
test('Task7 host policy reader refuses a missing configuration before opening',()=>task7ReaderCase('missing'));
test('Task7 host policy reader refuses a symbolic link before opening',()=>task7ReaderCase('symlink'));
test('Task7 host policy reader refuses a different file owner before opening',()=>task7ReaderCase('owner'));
test('Task7 host policy reader refuses a writable file mode before opening',()=>task7ReaderCase('mode'));
test('Task7 host policy reader refuses wrong byte length before reading',()=>task7ReaderCase('size'));
test('Task7 host policy reader refuses changed valid JSON before parsing',()=>task7ReaderCase('digest'));
test('Task7 host policy reader refuses a zero read before complete bytes',()=>task7ReaderCase('zero'));
test('Task7 host policy reader refuses extra bytes after declared size',()=>task7ReaderCase('extra'));
test('Task7 host policy reader refuses named or held identity drift',()=>task7ReaderCase('identity'));
test('Task7 host policy reader sanitizes read failure after closing its FD',()=>task7ReaderCase('read'));
test('Task7 host policy reader withholds valid data when close is uncertain',()=>task7ReaderCase('close'));
test('Task7 host policy reader gives close uncertainty precedence over read failure',()=>task7ReaderCase('read-close'));

async function task7ContextCase(fault){
  const home=fault==='home'?'/alternate-account':TASK7_HOST_POLICY.home;
  const root=fault==='home'?home+'/ai/setrox/releases/setfarm-3271862b':
    fault==='parent'?TASK7_HOST_POLICY.workspace+'/other/setfarm-3271862b':TASK4B_M;
  const script=root+'/scripts/run-private-postgres-tests.mjs';
  const h=await task4bContainedConstructor({hostPolicy:true,moduleUrl:new URL('file://'+script).href});
  const check=h.hostPolicy.context;assert.equal(typeof check,'function');assert.equal(check.length,0);
  const f=task7PolicyReaderFixture(h,{root,contextHome:home}),observations=[];
  h.seams.os.userInfo=()=>({homedir:home,uid:fault==='uid'?502:501,gid:fault==='gid'?21:20,
    username:'setrox',shell:'/bin/zsh'});
  h.fake.argv=[TASK4B_NODE,script,'manual-orphan-bootstrap'];h.fake.cwd=()=>root;
  h.seams.helper.observeManualOrphanProcessV1=pid=>{
    assert.equal(pid,h.fake.pid);observations.push(pid);
    return {rawCommand:TASK4B_NODE+' '+script+' manual-orphan-bootstrap',pin:{pid:h.fake.pid,ppid:h.fake.ppid,
      uid:501,executable:TASK4B_NODE,executableSha256:'59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553'}};
  };
  let value,error;try{value=check();}catch(caught){error=caught;}
  f.check();
  if(fault==='none'){
    assert.equal(error,undefined);assert.equal(value.root,root);assert.equal(value.script,script);
    assert.deepEqual(task4bPlain(value.hostPolicy),TASK7_HOST_POLICY);assert.equal(Object.isFrozen(value.hostPolicy),true);
    assert.deepEqual(observations,[h.fake.pid]);assert.equal(f.state.opens,1);assert.equal(f.state.parses,1);
    assert.ok(f.state.closed,'config bootstrap is already closed before the next owner seam');
  }else{
    assert.equal(value,undefined);assert.equal(error?.message,'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(observations,[],'rejection precedes self-process/Source/native observations');
    assert.equal(f.state.opens,fault==='home'?1:0);
    if(fault!=='home')assert.deepEqual(f.state.events,[],'structural denial precedes configuration IO');
    else assert.equal(f.state.parses,1,'self-consistent alternate home still meets the independent fixed-home boundary');
  }
}
test('Task7 host context passes exact configured identity to the next owner seam',()=>task7ContextCase('none'));
test('Task7 host context rejects a self-consistent different account home after authenticated read',()=>task7ContextCase('home'));
test('Task7 host context rejects a different account UID before configuration IO',()=>task7ContextCase('uid'));
test('Task7 host context rejects a different account GID before configuration IO',()=>task7ContextCase('gid'));
test('Task7 host context rejects a different release parent before configuration IO',()=>task7ContextCase('parent'));
