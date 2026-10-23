import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {closeSync as closeFixtureFdV1,constants,existsSync,openSync as openFixtureFdV1,
  readFileSync,readSync as readFixtureFdV1} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import * as url from 'node:url';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

// Reviewed fixed-host DATA, independently pinned here; never an ambient selector.
const TASK7_POLICY_BYTES=readFileSync(new URL('../../src/installation/manual-orphan-fixed-host-policy-v1.json',import.meta.url));
assert.equal(TASK7_POLICY_BYTES.length,318,'fixed-host policy exact byte count');
assert.equal(createHash('sha256').update(TASK7_POLICY_BYTES).digest('hex'),
  '4b7ed03bf755ec453e0c7a79d3fcf4f4f4fee387dc9bf551d55e41e7b2281dc5','independent fixed-host policy digest');
const TASK7_HOST_POLICY=Object.freeze(JSON.parse(TASK7_POLICY_BYTES.toString('utf8')));

// These are test literals, not a substitute classifier. Every route decision
// below executes the complete current consumer Source in a contained VM.
const BASENAME='manual-control-orphan-bootstrap-v1.integration.test.ts';
const FILE='tests/execution-attempts/'+BASENAME;
const VECTOR=Object.freeze(['node','--import','tsx','--test','--test-isolation=none',FILE]);
const CONSTRUCTOR=new URL('../run-private-postgres-tests.mjs',import.meta.url);
const ISOLATED=new URL('../run-isolated-postgres-tests.ts',import.meta.url);
const WRAPPER=new URL('../run-execution-attempt-tests.ts',import.meta.url);
const HELPER=new URL('../../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs',import.meta.url);
const HELPER_SPECIFIER='../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs';
const TASK4_SPECIFIER='../tests/fixtures/mission-control-render-smoke-owned-v1.js';
const ts=createRequire(import.meta.url)('typescript');
// Initial RED has no helper file. Once present, bind only its REAL namespace;
// requiring an absent helper is an explicit harness error, never a fake export.
const helper=existsSync(HELPER)?await import(HELPER.href):null;
const WRAPPER_SOURCE=readFileSync(WRAPPER,'utf8');
const ownerMatches=[...WRAPPER_SOURCE.matchAll(/const OWNER_BACKED_TESTS = new Set\(\[([\s\S]*?)\]\);/g)];
assert.equal(ownerMatches.length,1,'one observed owner inventory supplies complete discovery fixtures');
const OWNER_FILES=[...ownerMatches[0][1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
assert.equal(OWNER_FILES.length,44,'preserve the current complete owner discovery inventory');
const discovery=(...extra)=>[...new Set([...OWNER_FILES,...extra])];
const ENV=Object.freeze({PATH:'/inert/bin',LANG:'C',LC_ALL:'C',KEEP_ROUTE_SENTINEL:'kept'});

function replaceOnce(source,before,after,label){
  assert.equal(source.split(before).length-1,1,'one replacement site: '+label);
  return source.replace(before,after);
}
function capture(){
  return {thrown:null,stderr:'',stdout:'',exitCode:undefined,
    calls:{preconditions:0,admin:0,task4:0,projection:0,spawn:[],forbidden:0},
    forbiddenSites:[],environment:null};
}
function forbidden(c,label){
  return ()=>{c.calls.forbidden++;c.forbiddenSites.push(label);throw Error('FORBIDDEN_EFFECT:'+label);};
}
function closedModule(c,label,allowed={}){
  return new Proxy(allowed,{get(target,key){
    if(key==='__esModule')return false;
    if(Object.hasOwn(target,key))return target[key];
    return forbidden(c,label+'.'+String(key));
  }});
}
function environment(c,file,args,extraEnv={}){
  const fake=new EventEmitter();
  fake.argv=['/inert/node',url.fileURLToPath(file),...args];
  fake.execPath='/inert/node';fake.env={...ENV,...extraEnv};
  for(const channel of ['stdout','stderr'])fake[channel]={write(bytes){c[channel]+=String(bytes);return true;}};
  Object.defineProperty(fake,'exitCode',{get:()=>c.exitCode,set:value=>{c.exitCode=value;}});
  fake.exit=code=>{c.exitCode=code;throw Error('TEST_PROCESS_EXIT');};
  for(const name of ['getuid','geteuid','getgid','getegid','cwd','chdir','kill'])fake[name]=forbidden(c,'process.'+name);
  c.environment=fake.env;
  return fake;
}
function bindings(c,file,fake,{wrapperDiscovery}={}){
  const fixedRoot=url.fileURLToPath(new URL('../',file));
  const fsAllowed={constants};
  if(file===ISOLATED)fsAllowed.realpathSync=value=>{
    assert.equal(value,fixedRoot,'only module-time fixed Source root is admitted');return value;
  };
  if(file===WRAPPER)fsAllowed.readdirSync=(directory,options)=>{
    assert.equal(directory,path.join(fixedRoot,'tests/execution-attempts'));
    assert.equal(options.withFileTypes,true);
    return wrapperDiscovery.map(name=>({name,isFile:()=>true}));
  };
  const childAllowed=file===WRAPPER?{spawnSync(executable,args,options){
    assert.equal(executable,fake.execPath);assert.equal(options.cwd,fixedRoot);
    assert.equal(options.stdio,'inherit');
    c.calls.spawn.push({args:Array.from(args),env:{...options.env}});
    return {status:0,signal:null,error:undefined};
  }}:{};
  const modules=new Map([
    ['node:path',path],['node:url',url],
    ['node:fs',closedModule(c,'fs',fsAllowed)],
    ['node:os',closedModule(c,'os',{tmpdir:()=>'/inert/manual-orphan-route'})],
    ['node:crypto',closedModule(c,'crypto',{createHash})],
    ['node:child_process',closedModule(c,'child_process',childAllowed)],
    ['node:net',closedModule(c,'net')],
    ['node:timers/promises',closedModule(c,'timers/promises')],
    ['postgres',forbidden(c,'postgres')],
    ['./finding-test-preflight.mjs',closedModule(c,'preflight')],
    ['./private-postgres-test-journal-v1.mjs',closedModule(c,'journal',{
      createPrivateTestTerminalMirrorV1:stream=>({write:bytes=>stream.write(bytes)}),
    })],
    [TASK4_SPECIFIER,closedModule(c,'Task4',{
      isTask4CommandV1(){c.calls.task4++;return false;},
    })],
  ]);
  return specifier=>{
    if(specifier===HELPER_SPECIFIER){
      assert.notEqual(helper,null,'consumer imports real helper but helper is absent');return helper;
    }
    // Static namespace only in the exposed-main simulation; the guard never invokes it.
    if(specifier==='../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.js')
      return fixedProbeVmV1({task5cFixture:true}).fixtureExports;
    if(!modules.has(specifier))throw Error('UNLISTED_VM_REQUIRE:'+specifier);
    return modules.get(specifier);
  };
}
function evaluate(source,file,c,fake,extra={}){
  // .ts virtual filename ensures the .mjs constructor is lowered to CommonJS.
  const compiled=ts.transpileModule(source,{
    fileName:url.fileURLToPath(file)+'.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    reportDiagnostics:true,
  });
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'Source must transpile before a route result can count');
  const context={exports:{},Buffer,URL,Error,process:fake,
    require:bindings(c,file,fake,extra),
    setTimeout:forbidden(c,'setTimeout'),clearTimeout:forbidden(c,'clearTimeout'),
    console:closedModule(c,'console'),
    __boundary(name){c.calls[name]++;throw Error('OBSERVED_'+name.toUpperCase());},
  };
  runInNewContext(compiled.outputText,context,{filename:url.fileURLToPath(file),timeout:5000});
  return context;
}
async function runConstructorSourceV1(args){
  const c=capture(),fake=environment(c,CONSTRUCTOR,args);
  let source=readFileSync(CONSTRUCTOR,'utf8');
  source=replaceOnce(source,
    "if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();",
    'globalThis.__main=main;','constructor direct entry');
  source=replaceOnce(source,"new URL('../',import.meta.url)",
    "new URL('../',"+JSON.stringify(CONSTRUCTOR.href)+')','constructor module URL');
  // Ordinary/precondition-sentinel simulation only: the downstream binding changes.
  assert.equal(source.split('function preconditions(){').length-1,1,'one preconditions binding');
  source+='\npreconditions=()=>globalThis.__boundary("preconditions");\n';
  const context=evaluate(source,CONSTRUCTOR,c,fake);
  try{await context.__main();}catch(error){c.thrown=error.message;}
  return c;
}
async function runIsolatedSourceV1(vector,{ambient=false}={}){
  const c=capture(),fake=environment(c,ISOLATED,['--',...vector],ambient?{SETFARM_PG_URL:'ambient-sentinel'}:{});
  let source=readFileSync(ISOLATED,'utf8');
  // Exposed-main simulation only: admin/projection sentinels below are not full entry evidence.
  const legacyEntry='main().catch((error) => {\n'
    +'  const message = error instanceof Error ? error.message : String(error);\n'
    +'  process.stderr.write(`${task4InvocationV1 ? (/^TASK4_[A-Z_]+$/.test(message) ? message : "TASK4_CLEANUP_UNKNOWN") : message}\\n`);\n'
    +'  process.exitCode = 1;\n});';
  const guardedEntry='main().catch((error) => {\n'
    +'  if (manualOrphanInvocationV1) {\n'
    +'    process.stderr.write(`${manualOrphanFailureCodeV1(error)}\\n`);\n'
    +'    process.exitCode = 1;\n'
    +'    return;\n'
    +'  }\n'
    +legacyEntry.slice('main().catch((error) => {\n'.length);
  const entry=source.includes(guardedEntry)?guardedEntry:legacyEntry;
  source=replaceOnce(source,entry,'globalThis.__main=main;','isolated exposed-main simulation');
  source=replaceOnce(source,'new URL("../", import.meta.url)',
    'new URL("../", '+JSON.stringify(ISOLATED.href)+')','isolated module URL');
  // Embedded preload text retains its own import.meta.url; it is never evaluated.
  assert.equal(source.split('function normalizedAdminUrlV1(): string {').length-1,1,'one admin binding');
  assert.equal(source.split('function projectCurrentBytesV1():').length-1,1,'one projection binding');
  source+='\nnormalizedAdminUrlV1=()=>globalThis.__boundary("admin");\n'
    +'projectCurrentBytesV1=()=>globalThis.__boundary("projection");\n';
  const context=evaluate(source,ISOLATED,c,fake);
  try{await context.__main();}catch(error){c.thrown=error.message;}
  return c;
}
function runWrapperSourceV1(args,discovered){
  const c=capture(),fake=environment(c,WRAPPER,args,{SETFARM_PG_URL:'must-be-removed'});
  const source=replaceOnce(WRAPPER_SOURCE,'new URL("../", import.meta.url)',
    'new URL("../", '+JSON.stringify(WRAPPER.href)+')','wrapper module URL');
  // The wrapper has top-level control flow, so it runs unchanged in the VM.
  try{evaluate(source,WRAPPER,c,fake,{wrapperDiscovery:discovered});}catch(error){c.thrown=error.message;}
  return c;
}
function noEffects(c){
  assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));
  assert.equal(c.calls.preconditions,0);assert.equal(c.calls.admin,0);
  assert.equal(c.calls.task4,0);assert.equal(c.calls.projection,0);
  assert.deepEqual(c.calls.spawn,[]);
}

test('source-contained isolated runner refuses the genuine vector before Task4/admin/P3',async()=>{
  const f=task4cEntryFixtureV1({reader:{kind:'file'}});
  await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
});
test('source-contained wrapper refuses explicitly discovered reserved file before raw dispatch',()=>{
  const c=runWrapperSourceV1([FILE],discovery(BASENAME));
  assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);
});
test('source-contained wrapper refuses absent reserved filename before UNKNOWN validation',()=>{
  const c=runWrapperSourceV1([FILE],discovery());
  assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);
});
test('source-contained wrapper refuses the bare reserved basename before dispatch',()=>{
  const c=runWrapperSourceV1([BASENAME],discovery(BASENAME));
  assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);
});
test('source-contained wrapper defaults to unrelated raw and all ordinary owners without the reserved integration',()=>{
  const c=runWrapperSourceV1([],[...TASK6_EXPECTED_OWNER_FILES_V1,'aaa-unrelated.test.ts']);
  pr305AssertDispatchV1(c,[
    {args:['--import','tsx','--test','tests/execution-attempts/aaa-unrelated.test.ts'],env:{...ENV}},
    ...pr305OrdinaryOwnerSpawnsV1(),
  ]);
});

const NEAR=[
  ['former concurrency vector',['node','--import','tsx','--test','--test-concurrency=1',FILE]],
  ['uppercase basename',[...VECTOR.slice(0,5),'tests/execution-attempts/'+BASENAME.toUpperCase()]],
  ['./ prefix',[...VECTOR.slice(0,5),'./'+FILE]],
  ['absolute prefix',[...VECTOR.slice(0,5),'/inert/'+FILE]],
  ['backslash path',[...VECTOR.slice(0,5),FILE.replaceAll('/','\\')]],
  ['suffix bak',[...VECTOR.slice(0,5),FILE+'.bak']],
  ['extra operand',[...VECTOR,'extra']],
  ['extra flag',[...VECTOR.slice(0,5),'--test-only',FILE]],
  ['changed concurrency',[...VECTOR.slice(0,4),'--test-concurrency=2',FILE]],
  ['genuine path nonfinal',[FILE,...VECTOR.slice(1,5),'unrelated.test.ts']],
];
for(const [label,vector] of NEAR){
  test('source-contained isolated reserved near match '+label+' refuses before grammar/effects',async()=>{
    const c=await runIsolatedSourceV1(vector);
    assert.equal(c.thrown,'MANUAL_ORPHAN_ROUTE_REFUSED');noEffects(c);
  });
  test('source-contained wrapper reserved mention '+label+' refuses before validation/dispatch',()=>{
    const c=runWrapperSourceV1(vector,discovery(BASENAME));
    assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);
  });
}
for(const args of [[],['unknown'],['https://127.0.0.1/'],['manual-orphan-bootstrap','extra'],
  ['manual-orphan-bootstrap extra'],['MANUAL-ORPHAN-BOOTSTRAP'],[FILE]]){
  test('source-contained constructor preserves closed CLI refusal '+JSON.stringify(args),async()=>{
    const c=await runConstructorSourceV1(args);
    assert.equal(c.thrown,null);assert.equal(c.stderr,'PRIVATE_TEST_CLUSTER_MODE_INVALID\n');
    assert.equal(c.exitCode,1);noEffects(c);
  });
}
for(const mode of ['findings','all','readonly-verifiers','receipt','after-scripts','after-terminal',
  'after-findings','after-internal-pure','after-local-custody','after-cutover','after-receipt',
  'migration33-observers','migration33-adjacent-full']){
  test('source-contained constructor prior mode '+mode+' still reaches preconditions sentinel',async()=>{
    const c=await runConstructorSourceV1([mode]);
    assert.equal(c.calls.preconditions,1);assert.equal(c.calls.forbidden,0);
    assert.equal(c.thrown,null);assert.equal(c.exitCode,1);
    assert.deepEqual(c.environment,ENV);assert.equal(c.stderr,'');
    assert.match(c.stdout,/"operation":"preconditions","reason":"PRIVATE_TEST_CLUSTER_REFUSED"/);
  });
}
test('source-contained isolated reserved route precedes ordinary ambient URL guard',async()=>{
  const f=task4cEntryFixtureV1({environment:'ambient',reader:{kind:'file'}});
  await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
});
for(const vector of [[],['node'],['node','--import','tsx','--test','--test-concurrency=2','unrelated.test.ts'],
  ['node','--import','tsx','--test','--test-concurrency=1','/absolute/unrelated.test.ts']]){
  test('source-contained unrelated malformed command retains grammar refusal '+JSON.stringify(vector),async()=>{
    const c=await runIsolatedSourceV1(vector);
    assert.equal(c.thrown,'ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE');noEffects(c);
  });
}
test('source-contained unrelated valid isolated command reaches Task4 then admin sentinel',async()=>{
  const c=await runIsolatedSourceV1(['node','--import','tsx','--test','--test-concurrency=1',
    'tests/execution-attempts/unrelated.test.ts']);
  assert.equal(c.thrown,'OBSERVED_ADMIN');assert.equal(c.calls.task4,1);assert.equal(c.calls.admin,1);
  assert.equal(c.calls.projection,0);assert.equal(c.calls.forbidden,0);
});
test('source-contained wrapper preserves ordinary raw and owner vectors and scrubs ambient URL',()=>{
  const c=runWrapperSourceV1(['ordinary.test.ts','attempt-reconciler.test.ts'],discovery('ordinary.test.ts'));
  assert.equal(c.thrown,null);assert.equal(c.calls.forbidden,0);
  assert.deepEqual(c.calls.spawn,[
    {args:['--import','tsx','--test','tests/execution-attempts/ordinary.test.ts'],env:{...ENV}},
    {args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
      'node','--import','tsx','--test','--test-concurrency=1','tests/execution-attempts/attempt-reconciler.test.ts'],env:{...ENV}},
  ]);
});
test('source-contained wrapper preserves unrelated UNKNOWN refusal',()=>{
  const c=runWrapperSourceV1(['unknown.test.ts'],discovery());
  assert.equal(c.thrown,'EXECUTION_ATTEMPT_TEST_UNKNOWN:unknown.test.ts');noEffects(c);
});


// The complete actual entry/catch reaches the actual fixture's negative FD4 gate.
test('source-contained enabled isolated route exposes actual fixture FD4 refusal',async()=>{
  const f=task4cEntryFixtureV1({reader:{kind:'file'}});
  await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');
  task4cRawRefusalV1(f);
});

// Phase A: incremental codec contracts. Missing codec exports are absent-contract
// scaffolding only; these semantic assertions remain when the real exports exist.
// This fixture is shape data, not a process observation or ownership proof.
function codecFrameV1(){
  return {
    schema:'setfarm.manual-orphan-lifecycle-probe.v1',nonce:'c'.repeat(64),
    parent:{pid:122,ppid:121,uid:501,pgid:122,startedAtUTC:'2026-10-21T00:00:00.000Z',
      executable:'/usr/bin/node',executableSha256:'a'.repeat(64),commandSha256:'b'.repeat(64)},
    child:{pid:123,ppid:122,uid:501,pgid:122,startedAtUTC:'2026-10-21T00:00:00.000Z',
      executable:'/usr/bin/node',executableSha256:'a'.repeat(64),commandSha256:'b'.repeat(64)},
    source:{helperSha256:'d'.repeat(64),issuerTestSha256:'e'.repeat(64)},
  };
}
// Independently written wire literal: no encoder or fixture serialization builds
// this oracle. Its final LF is part of both the wire format and the digest.
const CODEC_EXPECTED_V1=Buffer.from('{"schema":"setfarm.manual-orphan-lifecycle-probe.v1","nonce":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","parent":{"pid":122,"ppid":121,"uid":501,"pgid":122,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/usr/bin/node","executableSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","commandSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"child":{"pid":123,"ppid":122,"uid":501,"pgid":122,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/usr/bin/node","executableSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","commandSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},"source":{"helperSha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","issuerTestSha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}}\n','utf8');
const CODEC_TEXT_V1=CODEC_EXPECTED_V1.toString('utf8');
function frameRefusedV1(action,label){
  let caught;
  try{action();}catch(error){caught=error;}
  assert.ok(caught instanceof Error,label+' must throw Error');
  assert.equal(caught.message,'MANUAL_ORPHAN_FRAME_REFUSED',label+' must sanitize its error');
  return caught;
}
function reverseOwnKeysV1(value){
  return Object.fromEntries(Object.entries(value).reverse());
}

test('codec encoder emits the independently ordered exact bytes including LF',()=>{
  const bytes=helper.encodeManualOrphanProbeFrameV1(codecFrameV1());
  assert.ok(Buffer.isBuffer(bytes));assert.deepEqual(bytes,CODEC_EXPECTED_V1);
  const expectedDigest=createHash('sha256').update(CODEC_EXPECTED_V1).digest('hex');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expectedDigest);
  assert.notEqual(expectedDigest,createHash('sha256').update(CODEC_EXPECTED_V1.subarray(0,-1)).digest('hex'));
});
test('codec encoder reconstructs canonical top process and source key order',()=>{
  const frame=codecFrameV1();
  frame.parent=reverseOwnKeysV1(frame.parent);frame.child=reverseOwnKeysV1(frame.child);
  frame.source=reverseOwnKeysV1(frame.source);
  assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(reverseOwnKeysV1(frame)),CODEC_EXPECTED_V1);
});
test('codec decoder accepts the known bytes and deeply freezes every object',()=>{
  const frame=helper.decodeManualOrphanProbeFrameV1(Buffer.from(CODEC_EXPECTED_V1));
  assert.deepEqual(frame,codecFrameV1());
  for(const value of [frame,frame.parent,frame.child,frame.source]){
    assert.equal(Object.getPrototypeOf(value),Object.prototype);
    assert.equal(Object.isFrozen(value),true);
  }
  assert.throws(()=>{frame.nonce='f'.repeat(64);},TypeError);
  assert.throws(()=>{frame.parent.pid=999;},TypeError);
  assert.throws(()=>{frame.child.commandSha256='f'.repeat(64);},TypeError);
  assert.throws(()=>{frame.source.helperSha256='f'.repeat(64);},TypeError);
});
test('codec encoder retains no aliases to input objects or previously returned buffers',()=>{
  const input=codecFrameV1(),bytes=helper.encodeManualOrphanProbeFrameV1(input);
  input.nonce='f'.repeat(64);input.parent.pid=999;input.child.executable='/changed/node';
  input.source.helperSha256='f'.repeat(64);
  assert.deepEqual(bytes,CODEC_EXPECTED_V1);
  bytes.fill(0);
  assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(codecFrameV1()),CODEC_EXPECTED_V1);
});
test('codec decoded data retains no aliases to the input buffer or later decodes',()=>{
  const input=Buffer.from(CODEC_EXPECTED_V1),first=helper.decodeManualOrphanProbeFrameV1(input);
  input.fill(0);
  assert.deepEqual(first,codecFrameV1());
  assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(first),CODEC_EXPECTED_V1);
  const second=helper.decodeManualOrphanProbeFrameV1(Buffer.from(CODEC_EXPECTED_V1));
  for(const key of ['parent','child','source'])assert.notEqual(first[key],second[key]);
  assert.notEqual(first,second);assert.deepEqual(second,codecFrameV1());
});
test('codec accepts a shape-valid changed nonce and hashes its changed exact bytes',()=>{
  const frame=codecFrameV1();frame.nonce='f'.repeat(64);
  const expected=Buffer.from(CODEC_TEXT_V1.replace('"nonce":"'+'c'.repeat(64)+'"','"nonce":"'+'f'.repeat(64)+'"'));
  const bytes=helper.encodeManualOrphanProbeFrameV1(frame);
  assert.deepEqual(bytes,expected);assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(expected),frame);
  assert.notEqual(createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(CODEC_EXPECTED_V1).digest('hex'));
  // This is codec shape/digest behavior only, never child nonce authentication.
});

const CODEC_DECODER_REFUSALS_V1=[
  ['string instead of Buffer',()=>CODEC_TEXT_V1],
  ['Uint8Array instead of Buffer',()=>new Uint8Array(CODEC_EXPECTED_V1)],
  ['empty Buffer',()=>Buffer.alloc(0)],
  ['16385 byte Buffer',()=>Buffer.alloc(16385,0x20)],
  ['UTF8 BOM',()=>Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),CODEC_EXPECTED_V1])],
  ['CRLF ending',()=>Buffer.from(CODEC_TEXT_V1.slice(0,-1)+'\r\n')],
  ['missing final LF',()=>CODEC_EXPECTED_V1.subarray(0,-1)],
  ['leading whitespace',()=>Buffer.from(' '+CODEC_TEXT_V1)],
  ['trailing JSON whitespace before LF',()=>Buffer.from(CODEC_TEXT_V1.slice(0,-1)+' \n')],
  ['extra final LF',()=>Buffer.from(CODEC_TEXT_V1+'\n')],
  ['trailing JSON record',()=>Buffer.from(CODEC_TEXT_V1+'{}\n')],
  ['invalid UTF8 inside a JSON string',()=>Buffer.concat([
    Buffer.from(CODEC_TEXT_V1.split('/usr/bin/node')[0]),Buffer.from([0xff]),
    Buffer.from('/usr/bin/node'+CODEC_TEXT_V1.split('/usr/bin/node').slice(1).join('/usr/bin/node')),
  ])],
  ['duplicate top key',()=>Buffer.from(CODEC_TEXT_V1.replace('{"schema":','{"nonce":"'+'c'.repeat(64)+'","schema":'))],
  ['duplicate nested process key',()=>Buffer.from(CODEC_TEXT_V1.replace('"child":{"pid":123,','"child":{"pid":123,"pid":123,'))],
  ['duplicate nested source key',()=>Buffer.from(CODEC_TEXT_V1.replace('"source":{','"source":{"helperSha256":"'+'d'.repeat(64)+'",'))],
  ['alternate top key order',()=>{
    const {schema,...rest}=codecFrameV1();return Buffer.from(JSON.stringify({...rest,schema})+'\n');
  }],
  ['alternate nested process key order',()=>{
    const frame=codecFrameV1();frame.child=reverseOwnKeysV1(frame.child);return Buffer.from(JSON.stringify(frame)+'\n');
  }],
  ['alternate nested source key order',()=>{
    const frame=codecFrameV1();frame.source=reverseOwnKeysV1(frame.source);return Buffer.from(JSON.stringify(frame)+'\n');
  }],
  ['alternate valid JSON escape',()=>Buffer.from(CODEC_TEXT_V1.replace('/usr/bin/node','\\/usr/bin/node'))],
  ['invalid JSON syntax',()=>Buffer.from('{"schema":}\n')],
  ['extra schema permission field',()=>Buffer.from(CODEC_TEXT_V1.slice(0,-2)+',"permission":true}\n')],
  ['missing nonce field',()=>Buffer.from(CODEC_TEXT_V1.replace('"nonce":"'+'c'.repeat(64)+'",',''))],
  ['wrong source hash field',()=>Buffer.from(CODEC_TEXT_V1.replace('"helperSha256":','"sourceSha256":'))],
  ['out of range nested process id',()=>Buffer.from(CODEC_TEXT_V1.replace('"pid":123','"pid":2147483648'))],
];
for(const [label,input] of CODEC_DECODER_REFUSALS_V1){
  test('codec decoder refuses '+label+' with the fixed error',()=>{
    frameRefusedV1(()=>helper.decodeManualOrphanProbeFrameV1(input()),label);
  });
}

const CODEC_ENCODER_SHAPE_REFUSALS_V1=[
  ['top array',()=>[]],['top null',()=>null],
  ['top nonplain prototype',()=>Object.assign(Object.create({inherited:true}),codecFrameV1())],
  ['top null prototype',()=>Object.assign(Object.create(null),codecFrameV1())],
  ['parent array',frame=>{frame.parent=[];return frame;}],
  ['parent null',frame=>{frame.parent=null;return frame;}],
  ['parent nonplain prototype',frame=>{frame.parent=Object.assign(Object.create({inherited:true}),frame.parent);return frame;}],
  ['child array',frame=>{frame.child=[];return frame;}],
  ['child null',frame=>{frame.child=null;return frame;}],
  ['child nonplain prototype',frame=>{frame.child=Object.assign(Object.create({inherited:true}),frame.child);return frame;}],
  ['source array',frame=>{frame.source=[];return frame;}],
  ['source null',frame=>{frame.source=null;return frame;}],
  ['source nonplain prototype',frame=>{frame.source=Object.assign(Object.create({inherited:true}),frame.source);return frame;}],
  ['top extra field',frame=>{frame.permission=true;return frame;}],
  ['top missing field',frame=>{delete frame.nonce;return frame;}],
  ['parent extra field',frame=>{frame.parent.permission=true;return frame;}],
  ['parent missing field',frame=>{delete frame.parent.pgid;return frame;}],
  ['child extra field',frame=>{frame.child.permission=true;return frame;}],
  ['child missing field',frame=>{delete frame.child.startedAtUTC;return frame;}],
  ['source extra field',frame=>{frame.source.permission=true;return frame;}],
  ['source missing field',frame=>{delete frame.source.issuerTestSha256;return frame;}],
  ['wrong source field',frame=>{frame.source.sourceSha256=frame.source.helperSha256;delete frame.source.helperSha256;return frame;}],
  ['wrong schema type',frame=>{frame.schema=1;return frame;}],
  ['wrong schema value',frame=>{frame.schema='setfarm.manual-orphan-runner-setup.v1';return frame;}],
  ['wrong nonce type',frame=>{frame.nonce=123;return frame;}],
  ['wrong timestamp type',frame=>{frame.child.startedAtUTC=Date.UTC(2026,9,21);return frame;}],
  ['wrong executable type',frame=>{frame.child.executable=new String('/usr/bin/node');return frame;}],
  ['wrong executable hash type',frame=>{frame.child.executableSha256=null;return frame;}],
  ['wrong command hash type',frame=>{frame.parent.commandSha256=false;return frame;}],
  ['wrong source hash type',frame=>{frame.source.issuerTestSha256=123;return frame;}],
];
for(const [label,make] of CODEC_ENCODER_SHAPE_REFUSALS_V1){
  test('codec encoder refuses '+label+' with the fixed error',()=>{
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(make(codecFrameV1())),label);
  });
}
for(const location of ['top','parent','child','source']){
  test('codec encoder refuses symbol data on '+location,()=>{
    const frame=codecFrameV1(),object=location==='top'?frame:frame[location];
    object[Symbol('unserializable')]='hidden';
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),location+' symbol');
  });
  test('codec encoder refuses nonenumerable data on '+location,()=>{
    const frame=codecFrameV1(),object=location==='top'?frame:frame[location];
    Object.defineProperty(object,'hidden',{value:'not a wire field',enumerable:false});
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),location+' nonenumerable');
  });
}
for(const [location,key] of [['top','nonce'],['parent','pid'],['child','commandSha256'],['source','helperSha256']]){
  test('codec encoder refuses '+location+' getter before invoking it',()=>{
    const frame=codecFrameV1(),object=location==='top'?frame:frame[location];let calls=0;
    Object.defineProperty(object,key,{enumerable:true,configurable:true,get(){calls++;return 'private getter value';}});
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),location+' getter');
    assert.equal(calls,0,'shape validation must inspect descriptors before reading any getter');
  });
}
test('codec encoder refuses a setter-only accessor without invoking it',()=>{
  const frame=codecFrameV1();let calls=0;
  Object.defineProperty(frame.source,'issuerTestSha256',{enumerable:true,configurable:true,set(){calls++;}});
  frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),'setter-only accessor');
  assert.equal(calls,0);
});
for(const field of ['pid','ppid','uid','pgid']){
  test('codec encoder refuses invalid '+field+' integer domain',()=>{
    const invalid=['123',null,NaN,Infinity,1.5,-1,2147483648,Number.MAX_SAFE_INTEGER+1];
    if(field!=='uid')invalid.push(0);
    for(const value of invalid){
      const frame=codecFrameV1();frame.child[field]=value;
      frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),field+'='+String(value));
    }
  });
}
test('codec encoder also validates the parent integer domain',()=>{
  const frame=codecFrameV1();frame.parent.pid=0;
  frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),'parent pid zero');
});
for(const [label,values] of [
  ['minimum ids and root uid',{pid:1,ppid:1,uid:0,pgid:1}],
  ['maximum bounded integers',{pid:2147483647,ppid:2147483647,uid:2147483647,pgid:2147483647}],
]){
  test('codec accepts '+label+' as shape data only',()=>{
    const frame=codecFrameV1();Object.assign(frame.child,values);
    const bytes=helper.encodeManualOrphanProbeFrameV1(frame);
    for(const [key,value] of Object.entries(values))assert.ok(bytes.includes(Buffer.from('"'+key+'":'+value)));
    assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(bytes),frame);
  });
}
for(const [label,value] of [
  ['uppercase hex','C'.repeat(64)],['short hex','c'.repeat(63)],['long hex','c'.repeat(65)],
  ['nonhex character','g'.repeat(64)],['empty hash',''],
]){
  test('codec encoder refuses '+label+' nonce',()=>{
    const frame=codecFrameV1();frame.nonce=value;
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),label);
  });
}
for(const [location,field] of [
  ['parent','executableSha256'],['parent','commandSha256'],
  ['child','executableSha256'],['child','commandSha256'],
  ['source','helperSha256'],['source','issuerTestSha256'],
]){
  test('codec encoder validates lowercase hex in '+location+'.'+field,()=>{
    const frame=codecFrameV1();frame[location][field]='A'.repeat(64);
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),location+'.'+field);
  });
}
for(const [label,value] of [
  ['nonleap February 29','2026-02-29T00:00:00.000Z'],['April 31','2026-04-31T00:00:00.000Z'],
  ['month 13','2026-13-21T00:00:00.000Z'],['day zero','2026-10-00T00:00:00.000Z'],
  ['hour 24','2026-10-21T24:00:00.000Z'],['minute 60','2026-10-21T00:60:00.000Z'],
  ['second 60','2026-10-21T00:00:60.000Z'],['nonzero milliseconds','2026-10-21T00:00:00.001Z'],
  ['missing milliseconds','2026-10-21T00:00:00Z'],['timezone offset','2026-10-21T00:00:00.000+00:00'],
  ['unpadded month','2026-1-21T00:00:00.000Z'],
]){
  test('codec encoder refuses timestamp '+label,()=>{
    const frame=codecFrameV1();frame.child.startedAtUTC=value;
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),label);
  });
}
test('codec accepts a real leap calendar date without process identity credit',()=>{
  const frame=codecFrameV1();frame.parent.startedAtUTC=frame.child.startedAtUTC='2024-02-29T23:59:59.000Z';
  const expected=Buffer.from(CODEC_TEXT_V1.replaceAll('2026-10-21T00:00:00.000Z','2024-02-29T23:59:59.000Z'));
  assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(frame),expected);
  assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(expected),frame);
});
for(const [label,value] of [
  ['root slash','/'],['relative path','usr/bin/node'],['dot segment','/usr/./bin/node'],
  ['parent segment','/usr/bin/../node'],['repeated slash','/usr//bin/node'],['trailing slash','/usr/bin/node/'],
  ['NUL','/usr/bin/no\u0000de'],['newline','/usr/bin/no\nde'],['tab','/usr/bin/no\tde'],
  ['DEL control','/usr/bin/no\u007fde'],['over4096 ASCII bytes','/'+'n'.repeat(4096)],
  ['over4096 UTF8 bytes with fewer characters','/'+'é'.repeat(2048)],
]){
  test('codec encoder refuses executable '+label+' syntactically',()=>{
    const frame=codecFrameV1();frame.child.executable=value;
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),label);
  });
}
for(const [label,value] of [
  ['4096 ASCII bytes','/'+'n'.repeat(4095)],
  ['4096 UTF8 bytes','/'+'é'.repeat(2047)+'n'],
]){
  test('codec accepts normalized executable at '+label+' without resolving it',()=>{
    assert.equal(Buffer.byteLength(value,'utf8'),4096);
    const frame=codecFrameV1();frame.parent.executable=frame.child.executable=value;
    const expected=Buffer.from(CODEC_TEXT_V1.replaceAll('/usr/bin/node',value),'utf8');
    assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(frame),expected);
    assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(expected),frame);
  });
}

// Separate Task1 classifier coverage: these assertions may already pass and do
// not supply incremental codec RED or lifecycle/ownership evidence.
const CLASSIFIER_MALFORMED_V1=[
  ['undefined',()=>undefined],['null',()=>null],['string',()=>FILE],['array-like object',()=>({0:FILE,length:1})],
  ['number cell',()=>[123]],['boxed string cell',()=>[new String(FILE)]],
  ['sparse array',()=>new Array(1)],
  ['inherited hole',()=>{
    const cells=new Array(1),prototype=Object.create(Array.prototype);
    prototype[0]=FILE;Object.setPrototypeOf(cells,prototype);return cells;
  }],
];
for(const name of ['classifyManualOrphanVectorV1','mentionsManualOrphanFileV1']){
  for(const [label,make] of CLASSIFIER_MALFORMED_V1){
    test('pure classifier '+name+' refuses '+label+' with a fresh fixed Error',()=>{
      const first=frameRefusedV1(()=>helper[name](make()),label);
      const second=frameRefusedV1(()=>helper[name](make()),label);
      assert.notEqual(first,second,'refusals must not reuse an Error instance');
    });
  }
}
for(const [label,cells,classification,mentions] of [
  ['exact vector',[...VECTOR],'exact',true],
  ['former concurrency vector',['node','--import','tsx','--test','--test-concurrency=1',FILE],'near',true],
  ['near uppercase filename',[...VECTOR.slice(0,5),FILE.toUpperCase()],'near',true],
  ['unrelated ordinary cells',['node','unrelated.test.ts'],'unrelated',false],
  ['empty ordinary array',[],'unrelated',false],
]){
  test('pure classifier ordinary '+label+' keeps both literal outputs',()=>{
    assert.equal(helper.classifyManualOrphanVectorV1(cells),classification);
    assert.equal(helper.mentionsManualOrphanFileV1(cells),mentions);
  });
}

// Codec review I1: JSON escaping can overflow the total frame while each
// normalized executable remains exactly4096 UTF8 bytes. These are shape data.
function assertEscapedPathFixtureV1(value){
  assert.equal(Buffer.byteLength(value,'utf8'),4096,'individual executable stays within its byte cap');
  assert.equal(value.length,4096,'fixture uses ASCII characters only');
  assert.equal(value[0],'/');
  assert.equal([...value.slice(1)].every(character=>character==='"'||character==='\\'||character==='n'),true,
    'one nonempty segment with no slash/dot/control/NUL keeps the path syntactically normalized');
}
for(const [label,character] of [['double quotes','"'],['backslashes','\\']]){
  test('codec encoder refuses total overflow from valid4096-byte executable '+label,()=>{
    const frame=codecFrameV1();frame.parent.executable=frame.child.executable='/'+character.repeat(4095);
    assertEscapedPathFixtureV1(frame.parent.executable);assertEscapedPathFixtureV1(frame.child.executable);
    // Independent ordered fixture serialization, never encoder-produced bytes.
    // Baseline893 +2*(4096-13) path bytes +8190 escape bytes =17249 incl LF.
    const expected=Buffer.from(JSON.stringify(frame)+'\n','utf8');
    assert.equal(expected.length,17249);assert.equal(expected.at(-1),0x0a);
    frameRefusedV1(()=>helper.decodeManualOrphanProbeFrameV1(expected),label+' oversized wire');
    const first=frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),label+' total overflow');
    const second=frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),label+' total overflow again');
    assert.notEqual(first,second,'oversized encoder refusals must create fresh Errors');
  });
}
for(const [label,childQuotes,childPlain,size] of [
  ['one byte below cap',3229,866,16383],
  ['exact cap',3230,865,16384],
]){
  test('codec accepts escaped valid4096-byte paths with total frame '+label+' including LF',()=>{
    const frame=codecFrameV1();
    frame.parent.executable='/'+ '"'.repeat(4095);
    frame.child.executable='/'+ '"'.repeat(childQuotes)+'n'.repeat(childPlain);
    assertEscapedPathFixtureV1(frame.parent.executable);assertEscapedPathFixtureV1(frame.child.executable);
    // 9059 bytes before escaping +4095 parent escapes +literal child quote count.
    const expected=Buffer.from(JSON.stringify(frame)+'\n','utf8');
    assert.equal(expected.length,size);assert.equal(expected.at(-1),0x0a);
    assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(frame),expected);
    assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(expected),frame);
  });
}
test('codec encoder refuses escaped valid4096-byte paths at16385 total bytes including LF',()=>{
  const frame=codecFrameV1();
  frame.parent.executable='/'+ '"'.repeat(4095);
  frame.child.executable='/'+ '"'.repeat(3231)+'n'.repeat(864);
  assertEscapedPathFixtureV1(frame.parent.executable);assertEscapedPathFixtureV1(frame.child.executable);
  // 9059 +4095 +3231 =16385. Without the required final LF it would fit.
  const expected=Buffer.from(JSON.stringify(frame)+'\n','utf8');
  assert.equal(expected.length,16385);assert.equal(expected.subarray(0,-1).length,16384);
  assert.equal(expected.at(-1),0x0a);
  frameRefusedV1(()=>helper.decodeManualOrphanProbeFrameV1(expected),'16385-byte wire');
  const first=frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),'16385-byte frame');
  const second=frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(frame),'16385-byte frame again');
  assert.notEqual(first,second);
});

// Task2 process/source observation: Source-contained simulations below exercise
// the complete actual helper. Synthetic ps/file facts earn no current-OS credit.
const OBS_EXE_V1='/fixture/manual-orphan-node-physical-v1';
const OBS_HELPER_PATH_V1=url.fileURLToPath(HELPER);
const OBS_TEST_PATH_V1=url.fileURLToPath(import.meta.url);
const OBS_RAW_V1=OBS_EXE_V1+' --flag café';
const OBS_PS_ENV_V1=Object.freeze({PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TZ:'UTC'});
function observationRowV1(changes={}){
  const row={pid:'123',ppid:'122',uid:'501',date:'Wed Oct 21 00:00:00 2026',pgid:'122',raw:OBS_RAW_V1,...changes};
  return ' '+row.pid+' '+row.ppid+' '+row.uid+' '+row.date+' '+row.pgid+' '+row.raw+'\n';
}
function observationStatV1(kind,ino,size=0){
  return {dev:1n,ino:BigInt(ino),uid:501n,gid:20n,mode:kind==='directory'?0o40755n:0o100644n,
    nlink:kind==='directory'?2n:1n,size:BigInt(size),mtimeNs:1000000000n,ctimeNs:1000000000n,
    kind};
}
function observationFixtureV1(){
  const files=new Map(),directories=new Map();let ino=10;
  for(const [locator,text] of [
    [OBS_HELPER_PATH_V1,'independent helper Source fixture v1\n'],
    [OBS_TEST_PATH_V1,'independent issuer Source fixture v1\n'],
    [OBS_EXE_V1,'independent executable fixture v1\n'],
  ]){
    const bytes=Buffer.from(text,'utf8');files.set(locator,{bytes,stat:observationStatV1('file',ino++,bytes.length),heldStat:null});
    for(let ancestor=path.dirname(locator);;ancestor=path.dirname(ancestor)){
      if(!directories.has(ancestor))directories.set(ancestor,observationStatV1('directory',ino++));
      if(ancestor===path.dirname(ancestor))break;
    }
  }
  const row=observationRowV1();
  const state={files,directories,operations:[],psCalls:[],opened:[],closeAttempts:[],descriptors:new Map(),
    unlisted:[],fixtureFaults:[],
    psResults:[{stdout:row},{stdout:OBS_EXE_V1+'\n'},{stdout:row}],
    realpathAliases:new Map(),closeFailures:new Set(),failOpenPath:null,afterOpen:null,nextFd:100};
  const unexpected=label=>{state.unlisted.push(label);throw Error('OBSERVATION_UNLISTED_IO:'+label);};
  function entry(locator){return files.get(locator)??directories.get(locator)??unexpected('path '+String(locator));}
  function statValue(stat){
    const value={...stat};delete value.kind;
    return {...value,isFile:()=>stat.kind==='file',isDirectory:()=>stat.kind==='directory',
      isSymbolicLink:()=>stat.kind==='symlink',isFIFO:()=>false,isSocket:()=>false};
  }
  function descriptor(fd){
    const value=state.descriptors.get(fd);assert.ok(value,'only a captured descriptor may be used');
    assert.equal(value.closeAttempted,false,'no access after a descriptor close attempt');return value;
  }
  const realpath=locator=>{
    state.operations.push(['realpath',locator]);entry(locator);
    return state.realpathAliases.get(locator)??locator;
  };
  realpath.native=realpath;
  state.fs={constants,realpathSync:realpath,
    lstatSync(locator,options){
      state.operations.push(['lstat',locator]);assert.equal(options?.bigint,true);
      const value=entry(locator);return statValue(files.has(locator)?value.stat:value);
    },
    openSync(locator,flags){
      state.operations.push(['open',locator,flags]);const value=entry(locator);
      assert.equal(typeof flags,'number');assert.ok((flags&constants.O_NOFOLLOW)!==0,'every captured FD uses nofollow');
      assert.equal(flags&(constants.O_WRONLY|constants.O_RDWR|constants.O_CREAT|constants.O_TRUNC|constants.O_APPEND),0,
        'read-only ownership never creates or writes');
      if(state.failOpenPath===locator)throw Error('synthetic secret open failure');
      const fd=state.nextFd++,record={fd,path:locator,entry:value,closeAttempted:false};
      state.descriptors.set(fd,record);state.opened.push(record);
      if(state.afterOpen)state.afterOpen(record);
      return fd;
    },
    fstatSync(fd,options){
      state.operations.push(['fstat',fd]);assert.equal(options?.bigint,true);const record=descriptor(fd);
      return statValue(files.has(record.path)?(record.entry.heldStat??record.entry.stat):record.entry);
    },
    readSync(fd,buffer,offset,length,position){
      state.operations.push(['read',fd,position,length]);const record=descriptor(fd);
      assert.ok(files.has(record.path),'only a known regular file is read');
      assert.ok(Buffer.isBuffer(buffer));
      for(const n of [offset,length,position])assert.ok(Number.isSafeInteger(n)&&n>=0,'bounded positional read');
      assert.ok(offset+length<=buffer.length);assert.ok(length<=536870912);
      const count=Math.max(0,Math.min(length,record.entry.bytes.length-position));
      record.entry.bytes.copy(buffer,offset,position,position+count);return count;
    },
    closeSync(fd){
      state.operations.push(['close',fd]);const record=state.descriptors.get(fd);
      assert.ok(record,'no phantom descriptor closes');state.closeAttempts.push(fd);
      assert.equal(record.closeAttempted,false,'never retry a possibly reused descriptor');record.closeAttempted=true;
      if(state.closeFailures.has(record.path))throw Error('synthetic private close uncertainty');
    },
  };
  state.childProcess={spawnSync(executable,args,options){
    state.operations.push(['ps',executable]);const index=state.psCalls.length;
    assert.equal(executable,'/bin/ps');assert.ok(index<3,'one fixed before/comm/after sequence only');
    const expected=index===1?['-ww','-p','123','-o','comm=']:
      ['-ww','-p','123','-o','pid=','-o','ppid=','-o','uid=','-o','lstart=','-o','pgid=','-o','args='];
    assert.deepEqual(Array.from(args),expected);
    assert.deepEqual(Object.keys(options).sort(),['encoding','env','maxBuffer','timeout']);
    assert.equal(options.encoding,'utf8');assert.equal(options.timeout,2000);assert.equal(options.maxBuffer,16384);
    assert.deepEqual({...options.env},OBS_PS_ENV_V1);state.psCalls.push({executable,args:Array.from(args)});
    return {status:0,signal:null,error:undefined,stderr:'',...state.psResults[index]};
  }};
  state.process={getuid(){state.operations.push(['getuid']);return 501;}};
  // A production catch must never turn a broken fixture assertion into an
  // apparently valid OWNER_REFUSED outcome. Keep those faults independently.
  const checked=fn=>(...args)=>{try{return fn(...args);}catch(error){
    if(error?.code==='ERR_ASSERTION')state.fixtureFaults.push(error.message);throw error;
  }};
  for(const [name,fn] of Object.entries(state.fs))if(typeof fn==='function')state.fs[name]=checked(fn);
  state.fs.realpathSync.native=state.fs.realpathSync;
  state.childProcess.spawnSync=checked(state.childProcess.spawnSync);
  state.assertClosed=()=>{
    assert.deepEqual(state.closeAttempts,state.opened.map(record=>record.fd).reverse(),
      'all captured descriptors have one close attempt in reverse acquisition order');
    for(const record of state.opened)assert.equal(record.closeAttempted,true);
  };
  return state;
}
function observationVmV1(state){
  let source=readFileSync(HELPER,'utf8');
  source=lowerFixedProbeEntryV1(source);
  const locatorSites=[...source.matchAll(/\bimport\.meta\.url\b/g)].length;
  const hasObservation=typeof helper.observeManualOrphanProcessV1==='function'
    ||typeof helper.pinManualOrphanProbeSourcesV1==='function';
  assert.equal(locatorSites,hasObservation?1:0,'one actual helper locator after observation exports exist; zero only absent-contract scaffolding');
  if(locatorSites===1)source=replaceOnce(source,'import.meta.url',JSON.stringify(HELPER.href),'helper fixed module URL');
  const c=capture(),pureUtil=createRequire(import.meta.url)('node:util');
  const modules=new Map([
    ['node:util',closedModule(c,'observation util',{TextDecoder:pureUtil.TextDecoder,types:pureUtil.types})],
    ['node:crypto',closedModule(c,'observation crypto',{createHash})],
    ['node:path',path],['node:url',url],['node:buffer',{Buffer}],
    ['node:net',closedModule(c,'observation net')],
    ['node:os',closedModule(c,'observation os')],
    ['node:fs',closedModule(c,'observation fs',state.fs)],
    ['node:child_process',closedModule(c,'observation child_process',state.childProcess)],
  ]);
  const compiled=ts.transpileModule(source,{fileName:OBS_HELPER_PATH_V1+'.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'complete helper Source must transpile before a contained result counts');
  const context={exports:{},Buffer,URL,Error,TextDecoder:pureUtil.TextDecoder,
    process:closedModule(c,'observation process',state.process),
    require(specifier){assert.ok(modules.has(specifier),'no unlisted helper module: '+specifier);return modules.get(specifier);},
    setTimeout:forbidden(c,'observation setTimeout'),clearTimeout:forbidden(c,'observation clearTimeout'),
    console:closedModule(c,'observation console')};
  runInNewContext(compiled.outputText,context,{filename:OBS_HELPER_PATH_V1,timeout:5000});
  assert.equal(state.operations.length,0,'actual whole-module import is inert');
  assert.equal(c.calls.forbidden,0,'module import cannot touch an unlisted operation');
  return {actual:context.exports,assertContained(){
    assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));
    assert.deepEqual(state.unlisted,[],'no out-of-fixture path may explain a refusal');
    assert.deepEqual(state.fixtureFaults,[],'no swallowed fixture assertion may explain a refusal');
  }};
}
function ownerRefusedV1(action,label,code='MANUAL_ORPHAN_OWNER_REFUSED'){
  let caught;try{action();}catch(error){caught=error;}
  assert.ok(caught instanceof Error,label+' must throw Error');assert.equal(caught.message,code,label+' fixed error');return caught;
}
function observedDataV1(actual){return JSON.parse(JSON.stringify(actual));}
function expectedObservationV1(changes={}){
  const rawCommand=changes.rawCommand??OBS_RAW_V1;
  return {pin:{pid:123,ppid:122,uid:501,pgid:122,startedAtUTC:'2026-10-21T00:00:00.000Z',
    executable:OBS_EXE_V1,executableSha256:createHash('sha256').update('independent executable fixture v1\n').digest('hex'),
    commandSha256:createHash('sha256').update(rawCommand,'utf8').digest('hex'),...changes.pin},rawCommand};
}
function containedProcessRefusalV1(state,label){
  const vm=observationVmV1(state);
  ownerRefusedV1(()=>vm.actual.observeManualOrphanProcessV1(123),label);
  state.assertClosed();vm.assertContained();
}

test('source-contained process observer accepts the complete fixed ps/file prerequisites and exact UTF8 command hash',()=>{
  const state=observationFixtureV1(),vm=observationVmV1(state);
  const observed=vm.actual.observeManualOrphanProcessV1(123);
  assert.deepEqual(observedDataV1(observed),expectedObservationV1());
  assert.equal(Object.isFrozen(observed),true);assert.equal(Object.isFrozen(observed.pin),true);
  assert.equal(state.psCalls.length,3);assert.ok(state.opened.some(record=>record.path===OBS_EXE_V1));
  state.assertClosed();vm.assertContained();
});
test('source-contained process observer accepts a real leap calendar weekday',()=>{
  const state=observationFixtureV1(),row=observationRowV1({date:'Thu Feb 29 23:59:59 2024'});
  state.psResults[0].stdout=state.psResults[2].stdout=row;const vm=observationVmV1(state);
  assert.deepEqual(observedDataV1(vm.actual.observeManualOrphanProcessV1(123)),
    expectedObservationV1({pin:{startedAtUTC:'2024-02-29T23:59:59.000Z'}}));
  state.assertClosed();vm.assertContained();
});
test('source-contained process observer accepts uid0 with a root-owned physical executable',()=>{
  const state=observationFixtureV1(),row=observationRowV1({uid:'0'});state.files.get(OBS_EXE_V1).stat.uid=0n;
  state.psResults[0].stdout=state.psResults[2].stdout=row;const vm=observationVmV1(state);
  assert.deepEqual(observedDataV1(vm.actual.observeManualOrphanProcessV1(123)),expectedObservationV1({pin:{uid:0}}));
  state.assertClosed();vm.assertContained();
});
for(const [label,pid] of [['zero',0],['negative',-1],['fraction',1.5],['unsafe',Number.MAX_SAFE_INTEGER+1],
  ['out of range',2147483648],['string','123']]){
  test('source-contained process observer refuses invalid PID '+label+' before IO',()=>{
    const state=observationFixtureV1(),vm=observationVmV1(state);
    const first=ownerRefusedV1(()=>vm.actual.observeManualOrphanProcessV1(pid),label);
    const second=ownerRefusedV1(()=>vm.actual.observeManualOrphanProcessV1(pid),label);
    assert.notEqual(first,second);assert.deepEqual(state.operations,[]);state.assertClosed();vm.assertContained();
  });
}
const OBS_ROW_REFUSALS_V1=[
  ['before after mismatch',state=>{state.psResults[2].stdout=observationRowV1({raw:OBS_RAW_V1+' changed'});}],
  ['wrong requested pid',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({pid:'124'});}],
  ['extra row',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1()+observationRowV1();}],
  ['malformed row',state=>{state.psResults[0].stdout=state.psResults[2].stdout='not a ps row\n';}],
  ['missing row LF',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1().slice(0,-1);}],
  ['wrong weekday',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({date:'Thu Oct 21 00:00:00 2026'});}],
  ['nonexistent calendar date',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({date:'Mon Feb 30 00:00:00 2026'});}],
  ['invalid ppid',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({ppid:'0'});}],
  ['invalid uid',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({uid:'2147483648'});}],
  ['invalid pgid',state=>{state.psResults[0].stdout=state.psResults[2].stdout=observationRowV1({pgid:'2147483648'});}],
  ['extra comm line',state=>{state.psResults[1].stdout=OBS_EXE_V1+'\n'+OBS_EXE_V1+'\n';}],
  ['missing comm LF',state=>{state.psResults[1].stdout=OBS_EXE_V1;}],
  ['relative comm executable',state=>{state.psResults[1].stdout='relative-node\n';}],
];
for(const [label,change] of OBS_ROW_REFUSALS_V1){
  test('source-contained process/parse refusal '+label+' with otherwise complete file prerequisites',()=>{
    const state=observationFixtureV1();change(state);containedProcessRefusalV1(state,label);
  });
}
for(const [label,result] of [
  ['nonzero ps status',{status:1}],['ps signal',{signal:'SIGTERM'}],['ps stderr',{stderr:'private ps detail'}],
  ['ps error',{error:Error('private ps native error')}],
]){
  test('source-contained process observer sanitizes '+label,()=>{
    const state=observationFixtureV1();Object.assign(state.psResults[1],result);containedProcessRefusalV1(state,label);
  });
}
test('source-contained process observer refuses a shape-valid16385-byte ps row',()=>{
  const state=observationFixtureV1(),prefix=' 123 122 501 Wed Oct 21 00:00:00 2026 122 ';
  const row=prefix+'n'.repeat(16385-Buffer.byteLength(prefix)-1)+'\n';assert.equal(Buffer.byteLength(row),16385);
  state.psResults[0].stdout=state.psResults[2].stdout=row;containedProcessRefusalV1(state,'ps output cap');
});
for(const [label,change] of [
  ['physical alias',state=>{state.realpathAliases.set(OBS_EXE_V1,'/fixture/other-physical-node');}],
  ['foreign executable owner',state=>{state.files.get(OBS_EXE_V1).stat.uid=502n;}],
  ['writable executable',state=>{state.files.get(OBS_EXE_V1).stat.mode=0o100666n;}],
  ['multiply linked executable',state=>{state.files.get(OBS_EXE_V1).stat.nlink=2n;}],
  ['nonregular executable',state=>{state.files.get(OBS_EXE_V1).stat.kind='directory';}],
  ['executable cap',state=>{state.files.get(OBS_EXE_V1).stat.size=536870913n;}],
]){
  test('source-contained process observer refuses '+label+' after valid ps facts',()=>{
    const state=observationFixtureV1();change(state);containedProcessRefusalV1(state,label);
  });
}
test('source-contained process observer close uncertainty overrides a valid observation',()=>{
  const state=observationFixtureV1();state.closeFailures.add(OBS_EXE_V1);const vm=observationVmV1(state);
  ownerRefusedV1(()=>vm.actual.observeManualOrphanProcessV1(123),'executable close','MANUAL_ORPHAN_CHILD_UNKNOWN');
  state.assertClosed();vm.assertContained();
});

test('source-contained source pair retains independent hashes and checks then closes once in reverse order',()=>{
  const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
  assert.deepEqual(Object.keys(owner).sort(),['check','close','hashes']);
  assert.deepEqual(observedDataV1(owner.hashes),{
    helperSha256:createHash('sha256').update('independent helper Source fixture v1\n').digest('hex'),
    issuerTestSha256:createHash('sha256').update('independent issuer Source fixture v1\n').digest('hex'),
  });
  assert.deepEqual(state.closeAttempts,[],'source descriptors stay held until their owner closes');
  owner.check();owner.check();owner.close();owner.close();state.assertClosed();vm.assertContained();
  for(const locator of [OBS_HELPER_PATH_V1,OBS_TEST_PATH_V1])assert.ok(state.opened.some(record=>record.path===locator));
});
const OBS_SOURCE_REFUSALS_V1=[
  ['group-writable source',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.mode=0o100664n;}],
  ['world-writable source',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.mode=0o100646n;}],
  ['multiply linked source',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.nlink=2n;}],
  ['foreign source owner',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.uid=0n;}],
  ['nonregular source',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.kind='directory';}],
  ['symlink source',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.kind='symlink';}],
  ['physical source alias',state=>{state.realpathAliases.set(OBS_HELPER_PATH_V1,OBS_HELPER_PATH_V1+'.alias');}],
  ['source cap',state=>{state.files.get(OBS_HELPER_PATH_V1).stat.size=16777217n;}],
  ['symlink ancestor',state=>{state.directories.get(path.dirname(OBS_HELPER_PATH_V1)).kind='symlink';}],
  ['nondirectory ancestor',state=>{state.directories.get(path.dirname(OBS_HELPER_PATH_V1)).kind='file';}],
];
for(const [label,change] of OBS_SOURCE_REFUSALS_V1){
  test('source-contained source owner refuses '+label+' and closes captured descriptors',()=>{
    const state=observationFixtureV1();change(state);const vm=observationVmV1(state);
    ownerRefusedV1(()=>vm.actual.pinManualOrphanProbeSourcesV1(),label);state.assertClosed();vm.assertContained();
  });
}
test('source-contained source owner rejects opened versus named identity drift',()=>{
  const state=observationFixtureV1();state.afterOpen=record=>{
    if(record.path===OBS_HELPER_PATH_V1){record.entry.heldStat={...record.entry.stat};record.entry.stat.ino++;}
  };
  const vm=observationVmV1(state);ownerRefusedV1(()=>vm.actual.pinManualOrphanProbeSourcesV1(),'opened named drift');
  state.assertClosed();vm.assertContained();
});
for(const [field,value] of [['dev',2n],['ino',999999n],['uid',502n],['mode',0o40750n]]){
  test('source-contained source owner detects ancestor '+field+' identity drift on check',()=>{
    const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
    state.directories.get(path.dirname(OBS_HELPER_PATH_V1))[field]=value;
    ownerRefusedV1(()=>owner.check(),'ancestor '+field);owner.close();state.assertClosed();vm.assertContained();
  });
}
for(const [field,value] of [
  ['dev',2n],['ino',999999n],['uid',502n],['gid',21n],['mode',0o100640n],
  ['nlink',2n],['size',999n],['mtimeNs',1000000001n],['ctimeNs',1000000001n],
]){
  test('source-contained source owner detects retained file '+field+' drift on check',()=>{
    const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
    state.files.get(OBS_HELPER_PATH_V1).stat[field]=value;
    ownerRefusedV1(()=>owner.check(),'file '+field);owner.close();state.assertClosed();vm.assertContained();
  });
}
test('source-contained source owner detects changed same-size bytes with unchanged metadata',()=>{
  const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
  const file=state.files.get(OBS_HELPER_PATH_V1);file.bytes[0]^=1;
  ownerRefusedV1(()=>owner.check(),'same-size Source content');owner.close();state.assertClosed();vm.assertContained();
});
test('source-contained source owner refuses check after known successful close without touching reused FDs',()=>{
  const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
  owner.close();const operations=state.operations.length;
  ownerRefusedV1(()=>owner.check(),'check after close');owner.close();
  assert.deepEqual(state.operations.slice(operations).filter(row=>['open','fstat','read','close'].includes(row[0])),[],
    'check after close must not use or reacquire an owned descriptor');
  state.assertClosed();vm.assertContained();
});
test('source-contained source owner closes its first captured pin after second-source open failure',()=>{
  const state=observationFixtureV1();state.failOpenPath=OBS_TEST_PATH_V1;const vm=observationVmV1(state);
  ownerRefusedV1(()=>vm.actual.pinManualOrphanProbeSourcesV1(),'second source open');
  assert.ok(state.opened.some(record=>record.path===OBS_HELPER_PATH_V1));
  assert.equal(state.opened.some(record=>record.path===OBS_TEST_PATH_V1),false,'failed open returns no owned FD');
  state.assertClosed();vm.assertContained();
});
test('source-contained source owner retains sticky close UNKNOWN and attempts every known close once',()=>{
  const state=observationFixtureV1(),vm=observationVmV1(state),owner=vm.actual.pinManualOrphanProbeSourcesV1();
  state.closeFailures.add(OBS_TEST_PATH_V1);
  const first=ownerRefusedV1(()=>owner.close(),'source close','MANUAL_ORPHAN_CHILD_UNKNOWN');
  const attempts=state.closeAttempts.length;
  const second=ownerRefusedV1(()=>owner.close(),'source close again','MANUAL_ORPHAN_CHILD_UNKNOWN');
  const third=ownerRefusedV1(()=>owner.check(),'check after uncertain close','MANUAL_ORPHAN_CHILD_UNKNOWN');
  assert.notEqual(first,second);assert.notEqual(second,third);assert.equal(state.closeAttempts.length,attempts);
  state.assertClosed();vm.assertContained();
});
test('source-contained partial source refusal is overridden by captured FD close uncertainty',()=>{
  const state=observationFixtureV1();state.failOpenPath=OBS_TEST_PATH_V1;state.closeFailures.add(OBS_HELPER_PATH_V1);
  const vm=observationVmV1(state);
  ownerRefusedV1(()=>vm.actual.pinManualOrphanProbeSourcesV1(),'partial source close','MANUAL_ORPHAN_CHILD_UNKNOWN');
  assert.ok(state.opened.some(record=>record.path===OBS_HELPER_PATH_V1));state.assertClosed();vm.assertContained();
});

// Actual local observations: only Root's admitted Node26 run executes these.
// Neither case spawns a helper child or grants original-launch/PG/setup credit.
test('actual local process observation binds current process and independently read physical Node bytes',()=>{
  const observed=helper.observeManualOrphanProcessV1(process.pid);
  const actualFs=createRequire(import.meta.url)('node:fs'),actualChild=createRequire(import.meta.url)('node:child_process');
  const physical=actualFs.realpathSync(process.execPath);
  assert.deepEqual(Object.keys(observed).sort(),['pin','rawCommand']);
  assert.deepEqual(Object.keys(observed.pin),['pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256']);
  assert.equal(observed.pin.pid,process.pid);assert.equal(observed.pin.ppid,process.ppid);assert.equal(observed.pin.uid,process.getuid());
  assert.equal(observed.pin.executable,physical);
  assert.equal(observed.pin.executableSha256,createHash('sha256').update(readFileSync(physical)).digest('hex'));
  const independent=actualChild.spawnSync('/bin/ps',['-ww','-p',String(process.pid),'-o','args='],
    {encoding:'utf8',env:{...OBS_PS_ENV_V1},timeout:2000,maxBuffer:16384});
  assert.equal(independent.status,0);assert.equal(independent.signal,null);assert.equal(independent.error,undefined);assert.equal(independent.stderr,'');
  assert.match(independent.stdout,/^[^\r\n]+\n$/);
  const measured=independent.stdout.slice(0,-1).replace(/^\s+/,'');
  assert.equal(observed.rawCommand,measured);
  assert.equal(observed.pin.commandSha256,createHash('sha256').update(measured,'utf8').digest('hex'));
  assert.equal(Object.isFrozen(observed),true);assert.equal(Object.isFrozen(observed.pin),true);
});
test('actual local source pair check and close binds independently read fixed public Source hashes',()=>{
  let owner;
  try{
    owner=helper.pinManualOrphanProbeSourcesV1();
    assert.deepEqual(owner.hashes,{
      helperSha256:createHash('sha256').update(readFileSync(HELPER)).digest('hex'),
      issuerTestSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    });
    owner.check();owner.close();owner.close();
    ownerRefusedV1(()=>owner.check(),'actual check after known close');
  }finally{if(owner)owner.close();}
});

// Task2 original-event components: manual events on unconnected PassThroughs.
// These diagnostics are neither a live original child nor ownership authority.
function eventFixtureV1(){
  const {PassThrough}=createRequire(import.meta.url)('node:stream');
  const child=new EventEmitter(),channels={},faults=[],forbiddenOps=[],inspections=[],resumed=[];
  const checked=fn=>(...args)=>{try{return fn(...args);}catch(error){faults.push(error.message);throw error;}};
  for(const name of ['stdout','stderr','fd4']){
    const stream=new PassThrough({autoDestroy:false});channels[name]=stream;
    for(const operation of ['write','end','destroy'])stream[operation]=checked(()=>{
      forbiddenOps.push(name+'.'+operation);throw Error('EVENT_OBSERVER_FOREIGN_OPERATION');
    });
    stream.resume=checked(()=>{
      for(const event of name==='fd4'?['data','error','finish','end','close']:['data','error','end','close']){
        assert.ok(stream.listenerCount(event)>0,name+' '+event+' listener exists before resume');
      }
      resumed.push(name);return stream;
    });
  }
  const bindings={stdout:channels.stdout,stderr:channels.stderr,stdio:[null,channels.stdout,channels.stderr,null,channels.fd4]};
  const beforeInspection=checked(name=>{
    for(const event of ['spawn','error','exit','close'])assert.ok(child.listenerCount(event)>0,'original '+event+' bound before channel inspection');
    inspections.push(name);
  });
  Object.defineProperty(child,'stdout',{get(){beforeInspection('stdout');return bindings.stdout;}});
  Object.defineProperty(child,'stderr',{get(){beforeInspection('stderr');return bindings.stderr;}});
  Object.defineProperty(child,'stdio',{get(){beforeInspection('fd4');return bindings.stdio;}});
  child.pid=123;
  for(const operation of ['kill','send','disconnect'])child[operation]=checked(()=>{
    forbiddenOps.push('child.'+operation);throw Error('EVENT_OBSERVER_FOREIGN_OPERATION');
  });
  return {child,channels,bindings,resumed,inspections,assertGuarded(){
    assert.deepEqual(faults,[],'no caught fixture assertion or forbidden operation explains the witness state');
    assert.deepEqual(forbiddenOps,[],'observer only observes/drains the given original');
    if(inspections.length)assert.deepEqual([...new Set(inspections)],['stdout','stderr','fd4'],'fixed channel inspection order');
  }};
}
function completeEventFixtureV1(fixture,code=0){
  for(const name of ['stdout','stderr']){fixture.channels[name].emit('end');fixture.channels[name].emit('close');}
  fixture.channels.fd4.emit('finish');fixture.channels.fd4.emit('end');fixture.channels.fd4.emit('close');
  fixture.child.emit('exit',code,null);fixture.child.emit('close',code,null);
}
async function withEventComponentV1(body,prepare){
  const fixture=eventFixtureV1();if(prepare)prepare(fixture);let witness;
  try{
    witness=helper.observeManualOrphanOriginalChildV1(fixture.child);
    return await body(fixture,witness);
  }finally{
    // Only cleanup of simulated facts: no .end/.destroy/signal on real handles.
    if(witness&&witness.snapshot().state==='pending')completeEventFixtureV1(fixture);
    if(witness&&witness.snapshot().state==='pending'&&fixture.child.listenerCount('error')){
      fixture.child.emit('error',Error('component cleanup uncertainty'));
    }
    fixture.assertGuarded();
  }
}
function emptyEventSnapshotV1(){
  const empty=createHash('sha256').update(Buffer.alloc(0)).digest('hex');
  return {state:'pending',exit:null,close:null,
    stdout:{bytes:0,sha256:empty,end:false,close:false},stderr:{bytes:0,sha256:empty,end:false,close:false},
    fd4:{finish:false,end:false,close:false},reason:null};
}
function assertEventFrozenV1(snapshot){
  assert.deepEqual(Object.keys(snapshot),['state','exit','close','stdout','stderr','fd4','reason']);
  for(const value of [snapshot,snapshot.exit,snapshot.close,snapshot.stdout,snapshot.stderr,snapshot.fd4]){
    if(value!==null)assert.equal(Object.isFrozen(value),true);
  }
}
async function assertEventUnknownV1(witness,reason){
  const current=witness.snapshot();assert.equal(current.state,'unknown');assert.equal(current.reason,reason);
  assertEventFrozenV1(current);
  const history=await witness.settled;
  assert.equal(history.state,'unknown');assert.equal(history.reason,reason);assertEventFrozenV1(history);
  return history;
}

test('event component requires every exit stream and fd4 fact and returns exact frozen diagnostics',async()=>{
  await withEventComponentV1(async(f,w)=>{
    assert.deepEqual(Object.keys(w).sort(),['output','settled','snapshot']);
    const initial=w.snapshot();assert.deepEqual(initial,emptyEventSnapshotV1());assertEventFrozenV1(initial);
    const again=w.snapshot();assert.notEqual(again,initial);assert.notEqual(again.stdout,initial.stdout);
    assert.ok(f.resumed.includes('stdout'));assert.ok(f.resumed.includes('stderr'));assert.ok(f.resumed.includes('fd4'));
    // No spawn event is needed for success: its flag is diagnostic only.
    f.child.emit('exit',0,null);assert.equal(w.snapshot().state,'pending');
    for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
    assert.equal(w.snapshot().state,'pending');
    f.child.emit('close',0,null);assert.equal(w.snapshot().state,'pending','matching child events cannot substitute for fd4');
    f.channels.fd4.emit('finish');assert.equal(w.snapshot().state,'pending');
    f.channels.fd4.emit('end');assert.equal(w.snapshot().state,'pending');
    f.channels.fd4.emit('close');
    const history=await w.settled,current=w.snapshot();
    assert.deepEqual(current,{...emptyEventSnapshotV1(),state:'observed',exit:{code:0,signal:null},close:{code:0,signal:null},
      stdout:{...emptyEventSnapshotV1().stdout,end:true,close:true},stderr:{...emptyEventSnapshotV1().stderr,end:true,close:true},
      fd4:{finish:true,end:true,close:true}});
    assert.deepEqual(history,current);assertEventFrozenV1(history);assertEventFrozenV1(current);
    assert.deepEqual(initial,emptyEventSnapshotV1(),'earlier snapshots do not mutate with later events');
  });
});
test('event component keeps missing exit pending even with all three channel closures',async()=>{
  await withEventComponentV1(async(f,w)=>{
    for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
    f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');
    assert.equal(w.snapshot().state,'pending');assert.equal(w.snapshot().exit,null);assert.equal(w.snapshot().close,null);
    f.child.emit('exit',0,null);assert.equal(w.snapshot().state,'pending');
    f.child.emit('close',0,null);assert.equal((await w.settled).state,'observed');
  });
});
for(const name of ['stdout','stderr']){
  test('event component matching child events never replace missing '+name+' close',async()=>{
    await withEventComponentV1(async(f,w)=>{
      const other=name==='stdout'?'stderr':'stdout';
      f.channels[name].emit('end');f.channels[other].emit('end');f.channels[other].emit('close');
      f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');
      f.child.emit('exit',0,null);f.child.emit('close',0,null);
      assert.equal(w.snapshot().state,'pending');assert.equal(w.snapshot()[name].close,false);
      f.channels[name].emit('close');assert.equal((await w.settled).state,'observed');
    });
  });
  test('event component matching child events and '+name+' close never invent EOF',async()=>{
    await withEventComponentV1(async(f,w)=>{
      const other=name==='stdout'?'stderr':'stdout';
      f.channels[name].emit('close');f.channels[other].emit('end');f.channels[other].emit('close');
      f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');
      f.child.emit('exit',0,null);f.child.emit('close',0,null);
      assert.equal(w.snapshot()[name].end,false);assert.notEqual(w.snapshot().state,'observed','close cannot manufacture EOF');
      f.channels[name].emit('error',Error('component missing EOF cleanup'));await assertEventUnknownV1(w,name);
    });
  });
}
test('event component fully observed exit1 is a completed negative process diagnostic',async()=>{
  await withEventComponentV1(async(f,w)=>{
    f.child.emit('spawn');f.channels.stderr.emit('data',Buffer.from('MANUAL_ORPHAN_OWNER_REFUSED\n'));
    completeEventFixtureV1(f,1);const history=await w.settled;
    assert.equal(history.state,'observed');assert.deepEqual(history.exit,{code:1,signal:null});assert.equal(history.reason,null);
    assert.equal(w.output().stderr.toString('utf8'),'MANUAL_ORPHAN_OWNER_REFUSED\n');
  });
});
test('event component hashes independent actual bytes and returns isolated retained output copies',async()=>{
  await withEventComponentV1(async(f,w)=>{
    const stdout=Buffer.from('stdout café\n'),stderr=Buffer.from('stderr literal\n');
    f.channels.stdout.emit('data',stdout);f.channels.stderr.emit('data',stderr);
    stdout.fill(0);stderr.fill(0);
    const first=w.output();assert.deepEqual(Object.keys(first).sort(),['stderr','stdout']);
    assert.deepEqual(first.stdout,Buffer.from('stdout café\n'));assert.deepEqual(first.stderr,Buffer.from('stderr literal\n'));
    first.stdout.fill(0);first.stderr.fill(0);
    assert.deepEqual(w.output().stdout,Buffer.from('stdout café\n'));assert.deepEqual(w.output().stderr,Buffer.from('stderr literal\n'));
    const current=w.snapshot();
    for(const [name,text] of [['stdout','stdout café\n'],['stderr','stderr literal\n']]){
      assert.equal(current[name].bytes,Buffer.byteLength(text,'utf8'));
      assert.equal(current[name].sha256,createHash('sha256').update(text,'utf8').digest('hex'));
    }
    completeEventFixtureV1(f);assert.equal((await w.settled).state,'observed');
  });
});
test('event component receipt-like JSON and exit0 alone cannot settle observed',async()=>{
  await withEventComponentV1(async(f,w)=>{
    f.channels.stdout.emit('data',Buffer.from('{"fd4Closed":true,"sourcePinsClosed":true}\n'));
    f.child.emit('exit',0,null);const current=w.snapshot();
    assert.equal(current.state,'pending');assert.equal(current.stdout.end,false);assert.equal(current.fd4.close,false);
    f.channels.stdout.emit('end');f.channels.stdout.emit('close');f.channels.stderr.emit('end');f.channels.stderr.emit('close');
    f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');f.child.emit('close',0,null);
    assert.equal((await w.settled).state,'observed');
  });
});
test('event component late fault burns current UNKNOWN while settled observed history remains frozen',async()=>{
  await withEventComponentV1(async(f,w)=>{
    completeEventFixtureV1(f);const history=await w.settled;assert.equal(history.state,'observed');
    f.child.emit('close',0,null);let current=w.snapshot();assert.equal(current.state,'unknown');assert.equal(current.reason,'exit-close');
    f.channels.stderr.emit('error',Error('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'));
    current=w.snapshot();assert.equal(current.reason,'exit-close');assert.equal(history.state,'observed');
    assert.equal(history.reason,null);assert.equal(await w.settled,history);
    assert.equal(JSON.stringify(current).includes('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'),false);
    assertEventFrozenV1(current);assertEventFrozenV1(history);
  });
});
const EVENT_CHILD_FAILURES_V1=[
  ['duplicate exit',f=>{f.child.emit('exit',0,null);f.child.emit('exit',0,null);},'exit-close'],
  ['duplicate close',f=>{f.child.emit('exit',0,null);f.child.emit('close',0,null);f.child.emit('close',0,null);},'exit-close'],
  ['close before exit',f=>{f.child.emit('close',0,null);},'exit-close'],
  ['different close code',f=>{f.child.emit('exit',0,null);f.child.emit('close',1,null);},'exit-close'],
  ['different close signal',f=>{f.child.emit('exit',0,null);f.child.emit('close',0,'SIGTERM');},'exit-close'],
  ['signalled exit',f=>{f.child.emit('exit',null,'SIGTERM');},'exit-close'],
  ['noninteger exit code',f=>{f.child.emit('exit',1.5,null);},'exit-close'],
  ['error before spawn event',f=>{f.child.emit('error',Error('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'));},'spawn-error'],
  ['error after spawn event',f=>{f.child.emit('spawn');f.child.emit('error',Error('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'));},'child-error'],
];
for(const [label,emit,reason] of EVENT_CHILD_FAILURES_V1){
  test('event component refuses '+label+' and never upgrades later facts',async()=>{
    await withEventComponentV1(async(f,w)=>{
      emit(f);const history=await assertEventUnknownV1(w,reason);
      completeEventFixtureV1(f);const current=w.snapshot();assert.equal(current.state,'unknown');assert.equal(current.reason,reason);
      assert.equal(await w.settled,history);assert.equal(JSON.stringify(current).includes('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'),false);
    });
  });
}
for(const name of ['stdout','stderr','fd4']){
  test('event component missing '+name+' records its channel reason and keeps present listeners',async()=>{
    await withEventComponentV1(async(f,w)=>{
      await assertEventUnknownV1(w,name);
      for(const present of ['stdout','stderr','fd4'].filter(channel=>channel!==name)){
        assert.ok(f.channels[present].listenerCount('error')>0);
        assert.ok(f.channels[present].listenerCount('data')>0);
      }
      if(name!=='stdout'){
        f.channels.stdout.emit('data',Buffer.from('still drained'));
        assert.equal(w.snapshot().stdout.bytes,13);assert.deepEqual(w.output().stdout,Buffer.from('still drained'));
      }
    },f=>{if(name==='fd4')f.bindings.stdio[4]=null;else{f.bindings[name]=null;f.bindings.stdio[name==='stdout'?1:2]=null;}});
  });
}
test('event component first missing stdout wins over missing stderr and later fd4 error',async()=>{
  await withEventComponentV1(async(f,w)=>{
    await assertEventUnknownV1(w,'stdout');f.channels.fd4.emit('error',Error('private late detail'));
    assert.equal(w.snapshot().reason,'stdout');assert.ok(f.channels.fd4.listenerCount('end')>0);
  },f=>{f.bindings.stdout=null;f.bindings.stderr=null;f.bindings.stdio[1]=f.bindings.stdio[2]=null;});
});
for(const [label,original] of [['null',null],['missing listener methods',{}]]){
  test('event component invalid original '+label+' resolves binding UNKNOWN',async()=>{
    const w=helper.observeManualOrphanOriginalChildV1(original);await assertEventUnknownV1(w,'binding');
    assert.equal(w.snapshot().exit,null);assert.equal(w.snapshot().close,null);
  });
}
test('event component invalid stdio container resolves binding UNKNOWN',async()=>{
  await withEventComponentV1(async(f,w)=>{await assertEventUnknownV1(w,'binding');},f=>{f.bindings.stdio={};});
});
test('event component listener attachment exception resolves sanitized binding UNKNOWN',async()=>{
  const child=new EventEmitter();child.on=()=>{throw Error('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK');};
  const w=helper.observeManualOrphanOriginalChildV1(child);await assertEventUnknownV1(w,'binding');
  assert.equal(JSON.stringify(w.snapshot()).includes('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'),false);
});
for(const name of ['stdout','stderr','fd4']){
  test('event component '+name+' error resolves its fixed reason without raw detail',async()=>{
    await withEventComponentV1(async(f,w)=>{
      f.channels[name].emit('error',Error('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'));await assertEventUnknownV1(w,name);
      assert.equal(JSON.stringify(w.snapshot()).includes('RAW_EVENT_PAYLOAD_MUST_NOT_LEAK'),false);
    });
  });
}
for(const name of ['stdout','stderr']){
  for(const [label,emit] of [
    ['data after EOF',stream=>{stream.emit('end');stream.emit('data',Buffer.from('late'));}],
    ['data after close',stream=>{stream.emit('close');stream.emit('data',Buffer.from('late'));}],
    ['duplicate end',stream=>{stream.emit('end');stream.emit('end');}],
    ['duplicate close',stream=>{stream.emit('end');stream.emit('close');stream.emit('close');}],
  ]){
    test('event component '+name+' refuses '+label+' and retains the actual diagnostic bytes',async()=>{
      await withEventComponentV1(async(f,w)=>{
        emit(f.channels[name]);await assertEventUnknownV1(w,name);
        if(label.startsWith('data')){
          assert.equal(w.snapshot()[name].bytes,4);assert.equal(w.snapshot()[name].sha256,createHash('sha256').update('late').digest('hex'));
        }
      });
    });
  }
}
for(const [label,emit] of [
  ['inbound data',stream=>{stream.emit('data',Buffer.from('unexpected inbound bytes'));}],
  ['duplicate finish',stream=>{stream.emit('finish');stream.emit('finish');}],
  ['duplicate end',stream=>{stream.emit('end');stream.emit('end');}],
  ['duplicate close',stream=>{stream.emit('close');stream.emit('close');}],
]){
  test('event component fd4 refuses '+label,async()=>{
    await withEventComponentV1(async(f,w)=>{emit(f.channels.fd4);await assertEventUnknownV1(w,'fd4');});
  });
}
test('event component accepts65536 bytes on each output independently without a combined cap',async()=>{
  await withEventComponentV1(async(f,w)=>{
    const stdout=Buffer.alloc(65536,0x61),stderr=Buffer.alloc(65536,0x62);
    f.channels.stdout.emit('data',stdout);f.channels.stderr.emit('data',stderr);completeEventFixtureV1(f);
    const history=await w.settled;assert.equal(history.state,'observed');
    for(const [name,bytes] of [['stdout',stdout],['stderr',stderr]]){
      assert.equal(history[name].bytes,65536);assert.equal(history[name].sha256,createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual(w.output()[name],bytes);
    }
  });
});
for(const name of ['stdout','stderr']){
  test('event component '+name+'65537 overflow drains and hashes all bytes with bounded prefix and sticky limit',async()=>{
    await withEventComponentV1(async(f,w)=>{
      const bytes=Buffer.alloc(65537,0x63);f.channels[name].emit('data',bytes);
      const history=await assertEventUnknownV1(w,'limit');assert.equal(history[name].bytes,65537);
      f.channels[name].emit('end');f.channels[name].emit('close');f.channels[name].emit('data',Buffer.from('tail'));
      const current=w.snapshot(),all=Buffer.concat([bytes,Buffer.from('tail')]);
      assert.equal(current.state,'unknown');assert.equal(current.reason,'limit');assert.equal(current[name].bytes,65541);
      assert.equal(current[name].sha256,createHash('sha256').update(all).digest('hex'));
      assert.equal(history[name].bytes,65537);assert.equal(history[name].sha256,createHash('sha256').update(bytes).digest('hex'));
      const output=w.output()[name];assert.equal(output.length,65536);assert.deepEqual(output,Buffer.alloc(65536,0x63));
      output.fill(0);assert.deepEqual(w.output()[name],Buffer.alloc(65536,0x63));
    });
  });
}

function eventClockVmV1(hashBinding=createHash){
  let source=readFileSync(HELPER,'utf8');
  source=lowerFixedProbeEntryV1(source);
  assert.equal([...source.matchAll(/\bimport\.meta\.url\b/g)].length,1,'retain the single reviewed process locator');
  source=replaceOnce(source,'import.meta.url',JSON.stringify(HELPER.href),'event clock fixed helper URL');
  const c=capture(),pureUtil=createRequire(import.meta.url)('node:util'),scheduled=[],cleared=[];
  const clock={setTimeout(callback,delay){assert.equal(typeof callback,'function');assert.equal(delay,10000);
    const handle={unref(){return this;},ref(){return this;}};scheduled.push({callback,delay,handle});return handle;},
    clearTimeout(handle){assert.ok(scheduled.some(timer=>timer.handle===handle),'clear only the owned timer');cleared.push(handle);}};
  const modules=new Map([
    ['node:fs',closedModule(c,'event clock fs',{constants})],['node:child_process',closedModule(c,'event clock child_process')],
    ['node:net',closedModule(c,'event clock net')],
    ['node:os',closedModule(c,'event clock os')],
    ['node:crypto',closedModule(c,'event clock crypto',{createHash:hashBinding})],['node:path',path],['node:url',url],['node:buffer',{Buffer}],
    ['node:util',closedModule(c,'event clock util',{TextDecoder:pureUtil.TextDecoder,types:pureUtil.types})],
    ['node:timers',closedModule(c,'event clock timers',clock)],
  ]);
  const compiled=ts.transpileModule(source,{fileName:OBS_HELPER_PATH_V1+'.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[]);
  const context={exports:{},Buffer,URL,Error,TextDecoder:pureUtil.TextDecoder,
    process:closedModule(c,'event clock process'),console:closedModule(c,'event clock console'),...clock,
    require(specifier){assert.ok(modules.has(specifier),'unlisted event helper import '+specifier);return modules.get(specifier);}};
  runInNewContext(compiled.outputText,context,{filename:OBS_HELPER_PATH_V1,timeout:5000});
  assert.equal(scheduled.length,0,'module import never starts an observation timer');assert.equal(c.calls.forbidden,0);
  return {actual:context.exports,scheduled,cleared,assertContained(){assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));}};
}
test('source-contained event clock fires the actual10000ms deadline and preserves UNKNOWN after late child close',async()=>{
  const vm=eventClockVmV1(),f=eventFixtureV1(),w=vm.actual.observeManualOrphanOriginalChildV1(f.child);
  assert.equal(vm.scheduled.length,1);assert.equal(vm.scheduled[0].delay,10000);
  f.child.emit('exit',0,null);
  for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
  f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');
  assert.equal(w.snapshot().state,'pending');assert.equal(w.snapshot().close,null);assert.deepEqual(vm.cleared,[]);
  vm.scheduled[0].callback();const history=await w.settled;
  assert.equal(history.state,'unknown');assert.equal(history.reason,'deadline');assert.equal(history.close,null);assertEventFrozenV1(history);
  assert.deepEqual(vm.cleared,[vm.scheduled[0].handle]);
  f.child.emit('close',0,null);const current=w.snapshot();
  assert.equal(current.state,'unknown');assert.equal(current.reason,'deadline');assert.deepEqual(observedDataV1(current.close),{code:0,signal:null});
  assert.equal(history.close,null);assert.equal(await w.settled,history);assert.deepEqual(vm.cleared,[vm.scheduled[0].handle]);
  f.assertGuarded();vm.assertContained();
});

// Event review I1: assert ordering at the actual crypto import boundary, never
// by matching Source strings or replacing observer predicates/function bodies.
test('source-contained event consumer binds every original and channel handler before hash construction',async()=>{
  const f=eventFixtureV1(),hashFaults=[],hashChecks=[];
  const hashBinding=(...args)=>{
    const missing=[];
    for(const event of ['spawn','error','exit','close']){
      if(f.child.listenerCount(event)===0)missing.push('original.'+event);
    }
    for(const name of ['stdout','stderr','fd4']){
      for(const event of name==='fd4'?['error','data','finish','end','close']:['error','data','end','close']){
        if(f.channels[name].listenerCount(event)===0)missing.push(name+'.'+event);
      }
    }
    hashChecks.push([...missing]);
    try{assert.deepEqual(missing,[],'all original and present channel handlers precede fallible createHash');}
    catch(error){hashFaults.push({missing:[...missing],message:error.message});throw error;}
    return createHash(...args);
  };
  const vm=eventClockVmV1(hashBinding),w=vm.actual.observeManualOrphanOriginalChildV1(f.child);
  try{
    // This ledger is independent of the consumer catch: UNKNOWN after catching
    // a crypto assertion cannot disguise the ordering defect as a valid refusal.
    assert.deepEqual(hashFaults,[],'no caught hash-construction ordering assertion may count as valid UNKNOWN');
    f.channels.stdout.emit('data',Buffer.from('stdout handler-ready\n'));
    f.channels.stderr.emit('data',Buffer.from('stderr handler-ready\n'));
    completeEventFixtureV1(f);
    const history=await w.settled;assert.equal(history.state,'observed');assert.equal(history.reason,null);
    for(const [name,text] of [['stdout','stdout handler-ready\n'],['stderr','stderr handler-ready\n']]){
      assert.equal(history[name].bytes,Buffer.byteLength(text));
      assert.equal(history[name].sha256,createHash('sha256').update(text).digest('hex'));
      assert.deepEqual(w.output()[name],Buffer.from(text));
    }
    assert.ok(hashChecks.length>0,'the real consumer reaches the guarded crypto boundary');
    assert.deepEqual(hashFaults,[]);assert.equal(vm.scheduled.length,1);
    assert.deepEqual(vm.cleared,[vm.scheduled[0].handle]);
  }finally{
    if(w.snapshot().state==='pending')completeEventFixtureV1(f);
    f.assertGuarded();vm.assertContained();
  }
});

// Fixed-child Phase A: only this exact entry line is test plumbing. The private
// main, exact context guard, reader, issuer and cleanup bodies stay unchanged.
const FIXED_PROBE_ENTRY_V1="if(import.meta.main)void runManualOrphanProbeChildV1().catch(()=>{process.stderr.write('MANUAL_ORPHAN_CHILD_UNKNOWN\\n');process.exitCode=1;});";
function lowerFixedProbeEntryV1(source,expose=false){
  const sites=source.split(FIXED_PROBE_ENTRY_V1).length-1;
  const ready=typeof helper.readManualOrphanProbeFd4V1==='function'||typeof helper.runManualOrphanLifecycleProbeV1==='function';
  assert.equal(sites,ready?1:0,'exactly one bounded direct entry after implementation; zero only while new contracts absent');
  return sites?replaceOnce(source,FIXED_PROBE_ENTRY_V1,expose?'globalThis.__fixedProbeChildMain=runManualOrphanProbeChildV1;':'','fixed helper direct-entry plumbing'):source;
}
function fixedProbeVmV1(bindings={},expose=false){
  let source=lowerFixedProbeEntryV1(readFileSync(HELPER,'utf8'),expose);
  assert.equal([...source.matchAll(/\bimport\.meta\.url\b/g)].length,1);
  source=replaceOnce(source,'import.meta.url',JSON.stringify(HELPER.href),'fixed probe locator');
  if(bindings.task5bPrivate===true)source+=task5bPrivateExposureV1();
  const c=capture(),pureUtil=createRequire(import.meta.url)('node:util'),timers=[],cleared=[],faults=[];
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const clock={setTimeout:guard((callback,delay)=>{
    assert.ok([5000,10000,60000,960000,840000,300000,180000,120000].includes(delay)||(bindings.task5cFixture===true&&[100,30000].includes(delay)));const handle={unref(){return this;},ref(){return this;}};
    timers.push({callback,delay,handle});return handle;
  }),clearTimeout:guard(handle=>{assert.ok(timers.some(timer=>timer.handle===handle));cleared.push(handle);})};
  const crypto={createHash,randomBytes:guard(size=>{assert.equal(size,32);return Buffer.alloc(32,0xcc);}),...bindings.crypto};
  const modules=new Map([
    ['node:fs',closedModule(c,'fixed probe fs',{constants,...bindings.fs})],
    ['node:net',closedModule(c,'fixed probe net',bindings.net??{})],
    ['node:os',closedModule(c,'fixed probe os',bindings.os??{})],
    ['node:child_process',closedModule(c,'fixed probe child_process',bindings.childProcess??{})],
    ['node:crypto',closedModule(c,'fixed probe crypto',crypto)],['node:path',path],['node:url',url],['node:buffer',{Buffer}],
    ['node:util',closedModule(c,'fixed probe util',{TextDecoder:pureUtil.TextDecoder,types:pureUtil.types})],
    ['node:timers',closedModule(c,'fixed probe timers',clock)],
  ]);
  const compiled=ts.transpileModule(source,{fileName:OBS_HELPER_PATH_V1+'.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[]);
  const context={exports:{},Buffer,URL,Error,TextDecoder:pureUtil.TextDecoder,queueMicrotask,
    process:closedModule(c,'fixed probe process',bindings.process??{}),console:closedModule(c,'fixed probe console'),...clock,
    require(specifier){if(bindings.task5bPrivate===true&&!modules.has(specifier))faults.push('unexpected Task5B deferred import');assert.ok(modules.has(specifier),'unlisted fixed probe import '+specifier);return modules.get(specifier);}};
  runInNewContext(compiled.outputText,context,{filename:OBS_HELPER_PATH_V1,timeout:5000});
  if(bindings.task5cFixture===true)task5cEvaluateFixtureV1(context,bindings,c,faults);
  assert.equal(timers.length,0,'import creates no timer');assert.equal(c.calls.forbidden,0,'import performs no IO');
  return {actual:context.exports,childMain:context.__fixedProbeChildMain,timers,cleared,...(bindings.task5cFixture===true?{fixtureExports:context.__task5cFixtureExportsV1,fixtureLexical:context.__task5cFixtureLexicalV1,fixtureFix1Lexical:context.__task5cFixtureFix1LexicalV1,...(bindings.task6CompletionLifetime===true?{task6CompletionChild:context.__task6CompletionChildV1}:{}),...(bindings.task6Fix1===true?{task6Fix1:context.__task6Fix1PrivateV1}:{}),...(bindings.task4cIsolatedEntry===true?{task4cEntry:task4cEvaluateIsolatedEntryV1(context,bindings,c,faults)}:{}),...(bindings.task6IntegrationModule===true?{task6Integration:task6EvaluateIntegrationV1(context,bindings,c,faults)}:{})}:{}),...(bindings.task5bPrivate===true?{task5bPrivate:context.__task5bPrivateV1}:{}),assertContained(){
    assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));assert.deepEqual(faults,[],'no swallowed binding assertion');
    if(bindings.assertClean)bindings.assertClean();
  }};
}
function probeReaderFixtureV1(options={}){
  const ledger={fstats:[],rawCloses:[],constructs:[],destroys:0,closed:false,socket:null,faults:[],adopted:false};
  const guarded=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')ledger.faults.push(error.message);throw error;}};
  const fs={fstatSync:guarded(fd=>{
    ledger.fstats.push(fd);assert.equal(fd,4,'reader only inspects inherited4, never3');
    if(options.fstatError)throw Error('PRIVATE_FSTAT_DETAIL');
    return {isFIFO:()=>options.kind!=='socket'&&options.kind!=='file',isSocket:()=>options.kind==='socket'};
  }),closeSync:guarded(fd=>{
    assert.equal(fd,4);assert.equal(ledger.adopted,false,'never raw-close an FD after returned Socket adoption');
    ledger.rawCloses.push(fd);assert.equal(ledger.rawCloses.length,1,'one raw close attempt');
    if(options.rawCloseError)throw Error('PRIVATE_CLOSE_DETAIL');
  })};
  class Socket extends EventEmitter{
    constructor(input){
      super();ledger.constructs.push({...input});
      try{assert.deepEqual({...input},{fd:4,readable:true,writable:false});}
      catch(error){ledger.faults.push(error.message);throw error;}
      if(options.constructorError)throw Error('PRIVATE_CONSTRUCTOR_DETAIL');
      ledger.adopted=true;ledger.socket=this;
    }
    pause(){return this;}
    resume(){
      for(const name of ['data','error','end','close'])assert.ok(this.listenerCount(name)>0,'reader '+name+' bound before resume');
      if(options.autoBytes)queueMicrotask(()=>{
        this.emit('data',Buffer.from(options.autoBytes));this.emit('end');ledger.closed=true;this.emit('close',false);
      });return this;
    }
    destroy(){
      ledger.destroys++;assert.equal(ledger.destroys,1,'reader requests owned close once');
      if(options.destroyError)throw Error('PRIVATE_DESTROY_DETAIL');return this;
    }
  }
  for(const name of ['pause','resume','destroy']){
    const original=Socket.prototype[name];
    Socket.prototype[name]=function(...args){try{return original.apply(this,args);}catch(error){
      if(error?.code==='ERR_ASSERTION')ledger.faults.push(error.message);throw error;
    }};
  }
  return {fs,net:{Socket},ledger,assertClean(){assert.deepEqual(ledger.faults,[]);}};
}
function trackProbePromiseV1(promise){
  const tracked={outcome:null};tracked.done=Promise.resolve(promise).then(value=>(tracked.outcome={value}),error=>(tracked.outcome={error}));return tracked;
}
async function assertProbeRejectedV1(tracked,code){
  const result=await tracked.done;assert.ok(result.error instanceof Error);assert.equal(result.error.message,code);
  assert.equal(Object.hasOwn(result,'value'),false);return result.error;
}
for(const kind of ['fifo','socket']){
  test('source-contained fd4 reader accepts actual decoded frame after EOF then known '+kind+' close',async()=>{
    const f=probeReaderFixtureV1({kind}),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
    assert.deepEqual(f.ledger.fstats,[4]);assert.equal(vm.timers.length,1);assert.equal(vm.timers[0].delay,5000);
    f.ledger.socket.emit('data',Buffer.from(CODEC_EXPECTED_V1));f.ledger.socket.emit('end');
    await Promise.resolve();assert.equal(t.outcome,null,'EOF/destroy request is not actual close');assert.equal(f.ledger.destroys,1);
    f.ledger.closed=true;f.ledger.socket.emit('close',false);const result=await t.done;
    assert.deepEqual(observedDataV1(result.value),codecFrameV1());assert.equal(Object.isFrozen(result.value),true);
    for(const key of ['parent','child','source'])assert.equal(Object.isFrozen(result.value[key]),true);
    assert.deepEqual(f.ledger.rawCloses,[]);assert.deepEqual(vm.cleared,[vm.timers[0].handle]);vm.assertContained();
  });
}
test('source-contained fd4 reader accepts exact16384 bytes including LF without reading parent fd4',async()=>{
  const frame=codecFrameV1();frame.parent.executable='/'+ '"'.repeat(4095);frame.child.executable='/'+ '"'.repeat(3230)+'n'.repeat(865);
  const bytes=Buffer.from(JSON.stringify(frame)+'\n');assert.equal(bytes.length,16384);
  const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
  f.ledger.socket.emit('data',bytes.subarray(0,8000));f.ledger.socket.emit('data',bytes.subarray(8000));
  f.ledger.socket.emit('end');f.ledger.closed=true;f.ledger.socket.emit('close',false);
  assert.deepEqual(observedDataV1((await t.done).value),frame);assert.equal(f.ledger.destroys,1);vm.assertContained();
});
for(const [label,emit,code] of [
  ['empty EOF',s=>{s.emit('end');},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['invalid UTF8',s=>{s.emit('data',Buffer.from([0xff,0x0a]));s.emit('end');},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['nonBuffer data',s=>{s.emit('data','not a Buffer');s.emit('end');},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['16385 byte aggregate',s=>{s.emit('data',Buffer.alloc(16385,0x20));s.emit('end');},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['missing final LF',s=>{s.emit('data',CODEC_EXPECTED_V1.subarray(0,-1));s.emit('end');},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['read error',s=>{s.emit('error',Error('PRIVATE_READER_DETAIL'));},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['duplicate EOF',s=>{s.emit('data',Buffer.from(CODEC_EXPECTED_V1));s.emit('end');s.emit('end');},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['data after EOF',s=>{s.emit('data',Buffer.from(CODEC_EXPECTED_V1));s.emit('end');s.emit('data',Buffer.from('late'));},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
]){
  test('source-contained fd4 reader '+label+' refuses only after known owned close',async()=>{
    const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
    emit(f.ledger.socket);await Promise.resolve();assert.equal(t.outcome,null,'no refusal fabricates a close');
    f.ledger.closed=true;f.ledger.socket.emit('close',false);await assertProbeRejectedV1(t,code);
    assert.ok(f.ledger.destroys<=1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
  });
}
for(const hadError of [false,true]){
  test('source-contained fd4 reader close '+hadError+' without EOF is UNKNOWN',async()=>{
    const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
    f.ledger.socket.emit('data',Buffer.from(CODEC_EXPECTED_V1));f.ledger.closed=true;f.ledger.socket.emit('close',hadError);
    await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CHILD_UNKNOWN');assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
  });
}
test('source-contained fd4 reader hadError close overrides otherwise valid bytes and EOF',async()=>{
  const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
  f.ledger.socket.emit('data',Buffer.from(CODEC_EXPECTED_V1));f.ledger.socket.emit('end');f.ledger.closed=true;f.ledger.socket.emit('close',true);
  await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CHILD_UNKNOWN');vm.assertContained();
});
for(const [label,options,code] of [
  ['nonstream fd',{kind:'file'},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['fstat error',{fstatError:true},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['raw close uncertainty',{kind:'file',rawCloseError:true},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['Socket constructor failure',{constructorError:true},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
]){
  test('source-contained fd4 reader '+label+' attempts raw4 cleanup once',async()=>{
    const f=probeReaderFixtureV1(options),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
    await assertProbeRejectedV1(t,code);assert.deepEqual(f.ledger.rawCloses,[4]);assert.equal(f.ledger.adopted,false);
    assert.equal(f.ledger.closed,false,'no invented Socket close');vm.assertContained();
  });
}
test('source-contained fd4 reader exact5000 deadline waits for actualclose and never invents EOF',async()=>{
  const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
  f.ledger.socket.emit('data',Buffer.from(CODEC_EXPECTED_V1));assert.equal(vm.timers[0].delay,5000);vm.timers[0].callback();
  await Promise.resolve();assert.equal(t.outcome,null);assert.equal(f.ledger.destroys,1);
  f.ledger.closed=true;f.ledger.socket.emit('close',false);await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CHILD_UNKNOWN');
  assert.deepEqual(vm.cleared,[vm.timers[0].handle]);vm.assertContained();
});
test('source-contained fd4 reader destroy uncertainty overrides valid bytes after eventual actualclose',async()=>{
  const f=probeReaderFixtureV1({destroyError:true}),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
  f.ledger.socket.emit('data',Buffer.from(CODEC_EXPECTED_V1));f.ledger.socket.emit('end');await Promise.resolve();assert.equal(t.outcome,null);
  f.ledger.closed=true;f.ledger.socket.emit('close',false);await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CHILD_UNKNOWN');
  assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
});
function probeCompositionFixtureV1(role='issuer',configure){
  const state=observationFixtureV1(),f=eventFixtureV1(),root=path.resolve(path.dirname(OBS_TEST_PATH_V1),'../..');
  const facts={parent:{pid:122,ppid:121,raw:OBS_EXE_V1+' '+OBS_TEST_PATH_V1},child:{pid:123,ppid:122,raw:OBS_EXE_V1+' '+OBS_HELPER_PATH_V1}};
  const control={role,spawnCalls:[],endCalls:[],stdout:'',stderr:'',endReady:null,reader:null,late:null,lateSent:false,childClosed:false};
  control.endReady=new Promise(resolve=>{control.markEnd=resolve;});
  const processBinding={platform:'darwin',pid:role==='child'?123:122,ppid:role==='child'?122:121,execPath:OBS_EXE_V1,argv0:OBS_EXE_V1,
    argv:[OBS_EXE_V1,role==='child'?OBS_HELPER_PATH_V1:OBS_TEST_PATH_V1],execArgv:[],
    env:{PATH:path.dirname(OBS_EXE_V1)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    getuid:state.process.getuid,cwd(){state.operations.push(['cwd']);return control.cwd??root;},exitCode:undefined,
    stdout:{write(bytes){
      assert.ok(state.opened.every(record=>record.closeAttempted),'receipt waits for every owned file pin close');
      if(role==='child')assert.equal(control.reader.ledger.closed,true,'receipt waits for actual owned reader close');
      control.stdout+=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);return true;
    }},stderr:{write(bytes){control.stderr+=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);return true;}}};
  const fixtureFaults=[],check=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')fixtureFaults.push(error.message);throw error;}};
  processBinding.stdout.write=check(processBinding.stdout.write);processBinding.stderr.write=check(processBinding.stderr.write);
  const cycles=new Map();
  const childProcess={spawnSync:check((executable,args,options)=>{
    assert.equal(executable,'/bin/ps');const pid=Number(args[2]);assert.ok(pid===122||pid===123);
    const n=cycles.get(pid)??0,index=n%3;cycles.set(pid,n+1);
    const expected=index===1?['-ww','-p',String(pid),'-o','comm=']:
      ['-ww','-p',String(pid),'-o','pid=','-o','ppid=','-o','uid=','-o','lstart=','-o','pgid=','-o','args='];
    assert.deepEqual(Array.from(args),expected);assert.equal(options.encoding,'utf8');assert.equal(options.timeout,2000);assert.equal(options.maxBuffer,16384);
    assert.deepEqual({...options.env},OBS_PS_ENV_V1);
    const row=pid===122?facts.parent:facts.child;
    return {status:0,signal:null,error:undefined,stderr:'',stdout:index===1?OBS_EXE_V1+'\n':
      observationRowV1({pid:String(row.pid),ppid:String(row.ppid),raw:row.raw})};
  }),spawn:check((executable,args,options)=>{
    assert.equal(executable,OBS_EXE_V1);assert.deepEqual(Array.from(args),[OBS_HELPER_PATH_V1]);
    assert.deepEqual({...options,env:{...options.env},stdio:Array.from(options.stdio)},
      {cwd:root,argv0:OBS_EXE_V1,shell:false,detached:false,env:{PATH:path.dirname(OBS_EXE_V1)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
        stdio:['ignore','pipe','pipe','ignore','pipe']});
    control.spawnCalls.push({executable,args:Array.from(args)});assert.equal(control.spawnCalls.length,1);return f.child;
  })};
  const pin=row=>({pid:row.pid,ppid:row.ppid,uid:501,pgid:122,startedAtUTC:'2026-10-21T00:00:00.000Z',executable:OBS_EXE_V1,
    executableSha256:createHash('sha256').update('independent executable fixture v1\n').digest('hex'),
    commandSha256:createHash('sha256').update(row.raw).digest('hex')});
  const frame=()=>({schema:'setfarm.manual-orphan-lifecycle-probe.v1',nonce:'c'.repeat(64),parent:pin(facts.parent),child:pin(facts.child),
    source:{helperSha256:createHash('sha256').update('independent helper Source fixture v1\n').digest('hex'),
      issuerTestSha256:createHash('sha256').update('independent issuer Source fixture v1\n').digest('hex')}});
  f.channels.fd4.end=check(bytes=>{
    control.endCalls.push(bytes===undefined?Buffer.alloc(0):Buffer.from(bytes));assert.equal(control.endCalls.length,1,'one owned end attempt');
    f.child.emit('spawn');f.channels.fd4.emit('finish');control.markEnd();return f.channels.fd4;
  });
  const oldClose=state.fs.closeSync;
  state.fs.closeSync=check(fd=>{
    const record=state.descriptors.get(fd),result=oldClose(fd);
    const atSourceFile=record&&(record.path===OBS_HELPER_PATH_V1||record.path===OBS_TEST_PATH_V1);
    const finalClose=state.opened.every(opened=>opened.closeAttempted);
    if(control.childClosed&&!control.lateSent&&((control.late==='pin-close'&&atSourceFile)||(control.late==='final-close'&&finalClose))){
      control.lateSent=true;f.child.emit('error',Error('late current-state fault'));
    }
    return result;
  });
  const fixture={state,f,control,facts,process:processBinding,childProcess,frame,fs:state.fs,
    finish(mode='valid'){
      const issued=control.endCalls[0];let receipt=null;
      if(mode==='owner-refusal')f.channels.stderr.emit('data',Buffer.from('MANUAL_ORPHAN_OWNER_REFUSED\n'));
      else{
        assert.deepEqual(issued,Buffer.from(JSON.stringify(frame())+'\n'),'actual issuer frame equals independent ordered observations');
        receipt={schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:createHash('sha256').update(issued).digest('hex'),
          pid:123,parentPid:122,fd4Closed:true,sourcePinsClosed:true};
        if(mode==='digest-mismatch')receipt.frameSha256='f'.repeat(64);
        f.channels.stdout.emit('data',Buffer.from(JSON.stringify(receipt)+'\n'));
      }
      for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
      f.channels.fd4.emit('end');f.channels.fd4.emit('close');f.child.emit('exit',mode==='owner-refusal'?1:0,null);
      control.childClosed=true;f.child.emit('close',mode==='owner-refusal'?1:0,null);
      if(mode==='late-await')f.child.emit('error',Error('late fault after historical observed resolution'));
      return receipt;
    },assertClean(){
      assert.deepEqual(fixtureFaults,[],'no swallowed composition fixture assertion');assert.deepEqual(state.unlisted,[]);
      assert.deepEqual(state.fixtureFaults,[]);f.assertGuarded();
      if(control.reader)control.reader.assertClean();
      for(const record of state.opened)assert.equal(state.closeAttempts.filter(fd=>fd===record.fd).length,1,'every known pin close attempted once');
    }};
  if(configure)configure(fixture);
  if(role==='child'){
    const reader=probeReaderFixtureV1({autoBytes:Buffer.from(JSON.stringify(frame())+'\n')});control.reader=reader;
    const oldStat=state.fs.fstatSync,oldRawClose=state.fs.closeSync;
    fixture.fs={...state.fs,fstatSync(fd,options){return fd===4?reader.fs.fstatSync(fd,options):oldStat(fd,options);},
      closeSync(fd){return fd===4?reader.fs.closeSync(fd):oldRawClose(fd);}};
    fixture.net=reader.net;
  }
  return fixture;
}
async function issueCompositionV1(fixture,vm,mode='valid'){
  const tracked=trackProbePromiseV1(vm.actual.runManualOrphanLifecycleProbeV1());
  const early=await Promise.race([fixture.control.endReady.then(()=>null),tracked.done]);
  if(early!==null){assert.equal(early.error,undefined,'issuer must reach its own writer with complete prerequisites');assert.fail('issuer returned before frame delivery');}
  fixture.finish(mode);return tracked;
}
test('source-contained normal issuer returns exact independently generated receipt after original events and owned pin closes',async()=>{
  const f=probeCompositionFixtureV1(),vm=fixedProbeVmV1(f),t=await issueCompositionV1(f,vm);
  const result=await t.done;assert.equal(result.error,undefined);
  assert.deepEqual(observedDataV1(result.value),{schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',
    frameSha256:createHash('sha256').update(Buffer.from(JSON.stringify(f.frame())+'\n')).digest('hex'),pid:123,parentPid:122,fd4Closed:true,sourcePinsClosed:true});
  assert.equal(f.control.spawnCalls.length,1);assert.equal(f.control.endCalls.length,1);vm.assertContained();
});
for(const [label,configure,mode,code] of [
  ['own source close uncertainty',f=>{f.state.closeFailures.add(OBS_TEST_PATH_V1);},'valid','MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['late fault after historical promise resolution',()=>{},'late-await','MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['late fault during source pin close',f=>{f.control.late='pin-close';},'valid','MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['late fault after final owned descriptor close',f=>{f.control.late='final-close';},'valid','MANUAL_ORPHAN_CHILD_UNKNOWN'],
  ['receipt digest differs from locally issued bytes',()=>{},'digest-mismatch','MANUAL_ORPHAN_OWNER_REFUSED'],
]){
  test('source-contained normal issuer rejects '+label+' despite otherwise valid receipt/events',async()=>{
    const f=probeCompositionFixtureV1('issuer',configure),vm=fixedProbeVmV1(f),t=await issueCompositionV1(f,vm,mode);
    await assertProbeRejectedV1(t,code);assert.equal(f.control.endCalls.length,1);vm.assertContained();
  });
}
test('source-contained normal issuer pre-send binding refusal ends own writer once empty and joins natural negative',async()=>{
  const f=probeCompositionFixtureV1('issuer',value=>{value.facts.child.ppid=999;}),vm=fixedProbeVmV1(f);
  const t=await issueCompositionV1(f,vm,'owner-refusal');assert.deepEqual(f.control.endCalls,[Buffer.alloc(0)]);
  await assertProbeRejectedV1(t,'MANUAL_ORPHAN_OWNER_REFUSED');vm.assertContained();
});
for(const [label,configure,args] of [
  ['wrong caller file',f=>{f.process.argv[1]='/not-the-fixed-issuer.test.js';},[]],
  ['extra public argument',()=>{},['caller-selected-frame']],
]){
  test('source-contained normal issuer refuses '+label+' before spawn',async()=>{
    const f=probeCompositionFixtureV1('issuer',configure),vm=fixedProbeVmV1(f);
    const t=trackProbePromiseV1(vm.actual.runManualOrphanLifecycleProbeV1(...args));await assertProbeRejectedV1(t,'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(f.control.spawnCalls,[]);vm.assertContained();
  });
}
test('source-contained fixed child actual guard reader and receipt consumer accepts complete independent prerequisites',async()=>{
  const f=probeCompositionFixtureV1('child'),vm=fixedProbeVmV1(f,true);await vm.childMain();
  const bytes=Buffer.from(JSON.stringify(f.frame())+'\n');
  assert.equal(f.control.stdout,JSON.stringify({schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:createHash('sha256').update(bytes).digest('hex'),
    pid:123,parentPid:122,fd4Closed:true,sourcePinsClosed:true})+'\n');
  assert.equal(f.control.stderr,'');assert.equal(f.process.exitCode??0,0);vm.assertContained();
});
for(const [label,configure,code] of [
  ['execArgv flag',f=>{f.process.execArgv=['--expose-gc'];},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong argv0',f=>{f.process.argv0='/other/node';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong exact helper argv1',f=>{f.process.argv[1]='/other/manual-control-orphan-bootstrap-child-v1.mjs';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['extra child argument',f=>{f.process.argv.push('extra');},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong current directory',f=>{f.control.cwd='/other/root';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['extra environment key',f=>{f.process.env.EXTRA='not permitted';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong PATH',f=>{f.process.env.PATH='/other/bin';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['different measured own command',f=>{f.facts.child.raw+=' --other';},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['source pin close uncertainty',f=>{f.state.closeFailures.add(OBS_HELPER_PATH_V1);},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
]){
  test('source-contained fixed child actual guard/close consumer refuses '+label,async()=>{
    const f=probeCompositionFixtureV1('child',configure),vm=fixedProbeVmV1(f,true);await vm.childMain();
    assert.equal(f.control.stdout,'');assert.equal(f.control.stderr,code+'\n');assert.equal(f.process.exitCode,1);vm.assertContained();
  });
}

let actualFixedProbeControlV1;
function requireActualFixedProbeControlV1(){
  // No manual native child may be launched until the real zero-argument issuer
  // has completed once. With absent contracts this fails inside the callback.
  if(!actualFixedProbeControlV1)actualFixedProbeControlV1=helper.runManualOrphanLifecycleProbeV1();
  return actualFixedProbeControlV1;
}
function assertActualProbeReceiptV1(receipt,parentPid){
  assert.deepEqual(Object.keys(receipt),['schema','frameSha256','pid','parentPid','fd4Closed','sourcePinsClosed']);
  assert.equal(receipt.schema,'setfarm.manual-orphan-lifecycle-probe-result.v1');assert.match(receipt.frameSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(receipt.pid)&&receipt.pid>0&&receipt.pid<=2147483647);assert.notEqual(receipt.pid,parentPid);assert.equal(receipt.parentPid,parentPid);
  assert.equal(receipt.fd4Closed,true);assert.equal(receipt.sourcePinsClosed,true);
}
test('actual Node26 Darwin zeroarg normal issuer completes its fixed child receipt and all owned closures',async()=>{
  const receipt=await requireActualFixedProbeControlV1();
  assert.equal(process.platform,'darwin');assert.match(process.versions.node,/^26\./);
  assertActualProbeReceiptV1(receipt,process.pid);
});
async function actualFixedReceiverV1(transform,{missingEOF=false}={}){
  await requireActualFixedProbeControlV1();
  const localRequire=createRequire(import.meta.url),fs=localRequire('node:fs'),native=localRequire('node:child_process');
  const nodePhysical=fs.realpathSync(process.execPath),helperPhysical=fs.realpathSync(OBS_HELPER_PATH_V1);
  assert.equal(helperPhysical,OBS_HELPER_PATH_V1);
  const root=path.resolve(path.dirname(OBS_TEST_PATH_V1),'../..'),source=helper.pinManualOrphanProbeSourcesV1();
  let original=null,witness=null,joined=null,endAttempted=false,primary=null,result=null;
  const endOnce=bytes=>{if(!endAttempted){endAttempted=true;original.stdio[4].end(bytes);}};
  try{
    const parentObserved=helper.observeManualOrphanProcessV1(process.pid),parent=parentObserved.pin;
    original=native.spawn(nodePhysical,[helperPhysical],{cwd:root,argv0:nodePhysical,shell:false,detached:false,
      env:{PATH:path.dirname(nodePhysical)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdio:['ignore','pipe','pipe','ignore','pipe']});
    witness=helper.observeManualOrphanOriginalChildV1(original);
    // Separate original-handle joins prove actual channel and child closure even
    // if a witness has already resolved a historical UNKNOWN diagnostic.
    joined=Promise.all([new Promise(resolve=>original.once('close',(code,signal)=>resolve({code,signal}))),
      ...[original.stdout,original.stderr,original.stdio[4]].map(stream=>new Promise(resolve=>stream.once('close',resolve)))]);
    const childObserved=helper.observeManualOrphanProcessV1(original.pid),child=childObserved.pin;
    assert.equal(child.pid,original.pid);assert.equal(child.ppid,parent.pid);assert.equal(parent.pid,process.pid);
    assert.equal(child.uid,parent.uid);assert.equal(child.executable,nodePhysical);assert.equal(parent.executable,nodePhysical);
    assert.equal(child.executableSha256,parent.executableSha256);assert.equal(childObserved.rawCommand,nodePhysical+' '+helperPhysical);
    const frame={schema:'setfarm.manual-orphan-lifecycle-probe.v1',nonce:'c'.repeat(64),parent,child,
      source:{helperSha256:source.hashes.helperSha256,issuerTestSha256:source.hashes.issuerTestSha256}};
    const issued=Buffer.from(JSON.stringify(frame)+'\n');assert.deepEqual(helper.encodeManualOrphanProbeFrameV1(frame),issued);
    const delivered=Buffer.from(transform?transform(frame,Buffer.from(issued)):issued);
    source.check();assert.deepEqual(helper.observeManualOrphanProcessV1(parent.pid),parentObserved);
    assert.deepEqual(helper.observeManualOrphanProcessV1(child.pid),childObserved);assert.equal(witness.snapshot().state,'pending');
    if(missingEOF){
      original.stdio[4].once('end',()=>endOnce());
      original.stdio[4].write(delivered);
    }else endOnce(delivered);
    await witness.settled;const closes=await joined;
    const current=witness.snapshot(),output=witness.output();assert.equal(current.state,'observed');
    assert.deepEqual(current.exit,current.close);assert.deepEqual(current.close,closes[0]);assert.equal(current.close.signal,null);
    assert.deepEqual(current.fd4,{finish:true,end:true,close:true});
    assert.equal(current.stdout.end,true);assert.equal(current.stdout.close,true);assert.equal(current.stderr.end,true);assert.equal(current.stderr.close,true);
    assert.ok(original.stdout.closed&&original.stderr.closed&&original.stdio[4].closed);
    assert.equal(endAttempted,true);source.check();
    result={frame,issued,delivered,snapshot:current,stdout:output.stdout,stderr:output.stderr};
  }catch(error){
    primary=error;
    if(original){
      try{endOnce();}catch{}
      if(witness)await witness.settled;
      if(joined)await joined;
    }
  }finally{source.close();}
  if(primary)throw primary;
  return result;
}
function assertActualReceiverReceiptV1(result){
  const expected={schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:createHash('sha256').update(result.delivered).digest('hex'),
    pid:result.frame.child.pid,parentPid:result.frame.parent.pid,fd4Closed:true,sourcePinsClosed:true};
  assertActualProbeReceiptV1(expected,process.pid);assert.deepEqual(result.stdout,Buffer.from(JSON.stringify(expected)+'\n'));return expected;
}
function canonicalReceiverBytesV1(frame){
  const bytes=Buffer.from(JSON.stringify(frame)+'\n');
  assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(bytes),frame,'wrong binding fixture is otherwise canonical and shape-valid');
  return bytes;
}
function assertActualReceiverRefusalV1(result,code){
  assert.equal(result.snapshot.close.code,1);assert.deepEqual(result.stdout,Buffer.alloc(0));
  assert.deepEqual(result.stderr,Buffer.from(code+'\n'));
}
for(const [label,transform,options,code] of [
  ['extra JSON field',(_f,bytes)=>Buffer.from(bytes.toString('utf8').slice(0,-2)+',"extra":true}\n'),{},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['duplicate JSON key',(_f,bytes)=>Buffer.from(bytes.toString('utf8').replace('{"schema":','{"nonce":"'+ 'd'.repeat(64)+'","schema":')),{},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['invalid UTF8',()=>Buffer.from([0xff,0x0a]),{},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['truncated frame missing LF',(_f,bytes)=>bytes.subarray(0,-1),{},'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['wrong otherwise-current parent pin',frame=>{frame.parent={...frame.parent,pid:frame.parent.pid+1};return canonicalReceiverBytesV1(frame);},{},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong otherwise-current child birth',frame=>{frame.child={...frame.child,startedAtUTC:new Date(Date.parse(frame.child.startedAtUTC)+1000).toISOString()};return canonicalReceiverBytesV1(frame);},{},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['wrong otherwise-current helper hash',frame=>{frame.source.helperSha256=(frame.source.helperSha256[0]==='0'?'1':'0')+frame.source.helperSha256.slice(1);return canonicalReceiverBytesV1(frame);},{},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['missing EOF until owned reader actual deadline',(_f,bytes)=>bytes,{missingEOF:true},'MANUAL_ORPHAN_CHILD_UNKNOWN'],
]){
  test('actual same fixed child receiver naturally closes for '+label,async()=>{
    const result=await actualFixedReceiverV1(transform,options);assertActualReceiverRefusalV1(result,code);
  });
}
test('actual same fixed child rejects completed prior-child frame by current binding with canonical bytes',async()=>{
  const prior=await actualFixedReceiverV1();assert.equal(prior.snapshot.close.code,0);assert.deepEqual(prior.stderr,Buffer.alloc(0));
  const receipt=assertActualReceiverReceiptV1(prior);
  assert.equal(receipt.frameSha256,createHash('sha256').update(prior.issued).digest('hex'));
  const replay=await actualFixedReceiverV1(current=>{
    assert.notEqual(current.child.pid,prior.frame.child.pid,'fixture requires a different actual original child');
    assert.deepEqual(helper.decodeManualOrphanProbeFrameV1(prior.issued),prior.frame);
    return prior.issued;
  });
  assertActualReceiverRefusalV1(replay,'MANUAL_ORPHAN_OWNER_REFUSED');
});
test('actual nonce-only well-shaped change is accepted childside but differs from parents original issued digest',async()=>{
  const result=await actualFixedReceiverV1(frame=>{frame.nonce='f'.repeat(64);return canonicalReceiverBytesV1(frame);});
  assert.equal(result.snapshot.close.code,0);assert.deepEqual(result.stderr,Buffer.alloc(0));
  const receipt=assertActualReceiverReceiptV1(result);
  assert.equal(receipt.frameSha256,createHash('sha256').update(result.delivered).digest('hex'));
  assert.notEqual(receipt.frameSha256,createHash('sha256').update(result.issued).digest('hex'));
  // The source-contained normal issuer digest-mismatch case above exercises the
  // actual parent's rejection body. This receiver case claims no nonce auth.
});

// Added interaction coverage of already implemented Root v2 semantics: a known
// frame fault may refuse after its own observed close without fabricating EOF.
for(const [label,chunk] of [['nonBuffer data','not a Buffer'],['16385 aggregate',Buffer.alloc(16385,0x20)]]){
  test('source-contained fd4 reader '+label+' without EOF remains pending until known close then FRAME',async()=>{
    const f=probeReaderFixtureV1(),vm=fixedProbeVmV1(f),t=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());
    f.ledger.socket.emit('data',chunk);
    await Promise.resolve();assert.equal(t.outcome,null,'a frame fault and destroy request do not invent actual close');
    assert.equal(f.ledger.destroys,1);assert.equal(f.ledger.closed,false);assert.deepEqual(f.ledger.rawCloses,[]);
    // Deliberately no end event: only the explicit known owned Socket close.
    f.ledger.closed=true;f.ledger.socket.emit('close',false);
    await assertProbeRejectedV1(t,'MANUAL_ORPHAN_FRAME_REFUSED');
    assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);
    assert.deepEqual(vm.cleared,[vm.timers[0].handle]);vm.assertContained();
  });
}

// Root-adopted Darwin effective metadata correction: the producer still sends
// exactly3 keys; only this strict, current-UID runtime metadata is optional.
for(const [label,value] of [
  ['current UID and observed locale fields','0x1F5:0x23:0x18'],
  ['current UID and zero uint32 suffixes','0x1F5:0x0:0x0'],
  ['current UID and maximum uint32 suffixes','0x1F5:0xFFFFFFFF:0xFFFFFFFF'],
]){
  test('source-contained fixed child accepts canonical Darwin CF metadata '+label+' after reader and source close',async()=>{
    const f=probeCompositionFixtureV1('child',fixture=>{fixture.process.env.__CF_USER_TEXT_ENCODING=value;});
    assert.equal(f.process.platform,'darwin');assert.equal(f.process.getuid(),501,'independent fixture UID matches literal 0x1F5');
    const vm=fixedProbeVmV1(f,true);await vm.childMain();
    const bytes=Buffer.from(JSON.stringify(f.frame())+'\n');
    const expected={schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:createHash('sha256').update(bytes).digest('hex'),
      pid:123,parentPid:122,fd4Closed:true,sourcePinsClosed:true};
    assert.equal(f.control.stdout,JSON.stringify(expected)+'\n');assert.equal(f.control.stderr,'');assert.equal(f.process.exitCode,0);
    assert.equal(f.control.reader.ledger.closed,true);assert.equal(f.control.reader.ledger.destroys,1);
    assert.deepEqual(f.control.reader.ledger.rawCloses,[]);assert.ok(f.state.opened.length>0);vm.assertContained();
  });
}
for(const [label,value,configure] of [
  ['different UID','0x1F4:0x23:0x18',()=>{}],
  ['empty value','',()=>{}],
  ['empty field','0x1F5::0x18',()=>{}],
  ['missing field','0x1F5:0x23',()=>{}],
  ['extra field','0x1F5:0x23:0x18:0x0',()=>{}],
  ['lowercase noncanonical hex','0x1f5:0x23:0x18',()=>{}],
  ['leading zero','0x01F5:0x23:0x18',()=>{}],
  ['nonhex field','0x1F5:0xG:0x18',()=>{}],
  ['larger than uint32','0x1F5:0x100000000:0x18',()=>{}],
  ['trailing newline','0x1F5:0x23:0x18\n',()=>{}],
  ['space in field','0x1F5:0x23: 0x18',()=>{}],
  ['CF key on linux','0x1F5:0x23:0x18',f=>{f.process.platform='linux';}],
  ['CF plus unrelated key','0x1F5:0x23:0x18',f=>{f.process.env.UNRELATED='refuse';}],
  ['CF plus changed baseline','0x1F5:0x23:0x18',f=>{f.process.env.LANG='en_US';}],
  ['CF plus missing baseline','0x1F5:0x23:0x18',f=>{delete f.process.env.LC_ALL;}],
]){
  test('source-contained fixed child refuses Darwin CF metadata '+label+' before reading inherited4',async()=>{
    const f=probeCompositionFixtureV1('child',fixture=>{
      fixture.process.env.__CF_USER_TEXT_ENCODING=value;configure(fixture);
    }),vm=fixedProbeVmV1(f,true);await vm.childMain();
    assert.equal(f.control.stdout,'');assert.equal(f.control.stderr,'MANUAL_ORPHAN_OWNER_REFUSED\n');assert.equal(f.process.exitCode,1);
    assert.deepEqual(f.control.reader.ledger.rawCloses,[4]);assert.equal(f.control.reader.ledger.adopted,false);
    assert.deepEqual(f.control.reader.ledger.constructs,[]);assert.deepEqual(f.control.reader.ledger.fstats,[]);
    assert.equal(f.state.opened.length,0);vm.assertContained();
  });
}


// Task1 owned-setup PhaseA data contracts follow the preserved
// Slice1 tests. They confer no process, filesystem, Source or SQL authority.

// Independent synthetic fixtures and wire oracles. No encoder or decoder builds
// an expected value. Common literal fragments keep the eleven-file wire map
// reviewable without coupling its insertion order to the input constructors.
const OWN_H='a'.repeat(64),OWN_B='b'.repeat(64),OWN_C='c'.repeat(64);
const OWN_M='8'.repeat(40),OWN_T='161297ffca6adf2851918a93d492e1c9a77ce59d';
const OWN_ID='12345678-1234-4234-8234-123456789abc';
const OWN_OP='87654321-4321-4321-9321-cba987654321';
const OWN_SUFFIX='12345678123442348234123456789abc';
function ownedProcessData(pid,ppid){
  return {pid,ppid,uid:501,pgid:101,startedAtUTC:'2026-10-21T00:00:00.000Z',
    executable:'/fixture/node',executableSha256:OWN_H,commandSha256:OWN_B};
}
function ownedDirData(){return {dev:'1',ino:'2',uid:501,gid:20,mode:448};}
function ownedFileData(){return {dev:'1',ino:'2',uid:501,gid:20,mode:420,nlink:1,
  bytes:1,mtimeNs:'3',ctimeNs:'4',sha256:OWN_H};}
function ownedReleaseData(sha){return {sha,treeHash:'9'.repeat(40),buildHash:OWN_B};}
function ownedSourceData(){return {
  maintenance:ownedReleaseData(OWN_M),target:ownedReleaseData(OWN_T),profileSha256:OWN_C,
  files:{constructor:ownedFileData(),constructorTests:ownedFileData(),wrapper:ownedFileData(),
    isolatedRunner:ownedFileData(),builtinChild:ownedFileData(),routeTests:ownedFileData(),
    fixture:ownedFileData(),integration:ownedFileData(),journal:ownedFileData(),
    pgPreflight:ownedFileData(),profile:ownedFileData()},
};}
function ownedClusterData(){return {root:ownedDirData(),data:ownedDirData(),port:55439,
  postmasterStartedAtUTC:'2026-10-21T00:00:00.123456Z',systemIdentifier:'123',serverVersionNum:170001,
  databaseBaselineSha256:OWN_H,roleBaselineSha256:OWN_B,membershipBaselineSha256:OWN_C};}
function ownedInstallationData(activated=false){
  const value={installationId:OWN_ID,operationId:OWN_OP,directory:ownedDirData(),
    databaseName:'setfarm_install_'+OWN_SUFFIX,databaseOid:7,ownerRole:'sf_owner_'+OWN_SUFFIX,
    ownerOid:7,runtimeRole:'sf_runtime_'+OWN_SUFFIX,runtimeOid:8,sourceSha:OWN_T,schemaCatalogHash:OWN_H};
  if(activated)value.activationCatalogHash=OWN_B;
  value.records={'planned.json':{bytes:1,sha256:OWN_H},'owner-created.json':{bytes:2,sha256:OWN_H},
    'runtime-created.json':{bytes:3,sha256:OWN_H},'database-created.json':{bytes:4,sha256:OWN_H},
    'runtime-credentials.json':{bytes:4096,sha256:OWN_H},'schema-prepared.json':{bytes:6,sha256:OWN_H},
    'schema-committed.json':{bytes:32768,sha256:OWN_H}};
  if(activated){value.records['activation-prepared.json']={bytes:8,sha256:OWN_H};
    value.records['activated.json']={bytes:9,sha256:OWN_H};}
  return value;
}
function ownedOldData(){return {state:'old-entry-verified',maintenance:ownedReleaseData(OWN_M),
  target:ownedReleaseData(OWN_T),installationId:OWN_ID,sameClient:true,entryAssert:true,
  databaseAssert:true,close:'fulfilled',closedGetter:'refused'};}
function ownedNewData(){return {state:'source-mismatch-refused',maintenance:ownedReleaseData(OWN_M),
  target:ownedReleaseData(OWN_T),installationId:OWN_ID,mismatch:'maintenance-sha-vs-target-origin',
  close:'fulfilled',closedGetter:'refused'};}
function ownedSetupData(){return {schema:'setfarm.manual-orphan-runner-setup.v1',run:OWN_C,
  constructor:ownedProcessData(101,100),runner:ownedProcessData(102,101),server:ownedProcessData(103,101),
  source:ownedSourceData(),cluster:ownedClusterData(),
  constructorAdminBackend:{pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'},adminPassword:OWN_H};}
function ownedPhaseData(purpose){
  const mechanical=purpose==='old_entry_positive'||purpose==='new_entry_refusal';
  const input=purpose==='provision'?{adminPassword:OWN_H}:purpose==='activate'?
    {adminPassword:OWN_H,installation:ownedInstallationData()}:{installation:ownedInstallationData(true)};
  return {schema:'setfarm.manual-orphan-owned-phase.v1',run:OWN_C,
    constructor:ownedProcessData(101,100),runner:ownedProcessData(102,101),
    parent:ownedProcessData(mechanical?104:102,mechanical?102:101),
    child:ownedProcessData(mechanical?105:104,mechanical?104:102),server:ownedProcessData(103,101),
    source:ownedSourceData(),cluster:ownedClusterData(),installations:ownedDirData(),purpose,input};
}
function ownedPhaseResultData(purpose){
  const result=purpose==='provision'?{state:'schema-verified',installation:ownedInstallationData(),factoryOwnerClose:'fulfilled'}:
    purpose==='activate'?{state:'activation-verified',installation:ownedInstallationData(true),
      selectionBefore:'schema-committed-unactivated',selectionAfter:'stale-refused',databaseModuleClose:'fulfilled'}:
      purpose==='old_entry_positive'?ownedOldData():ownedNewData();
  return {schema:'setfarm.manual-orphan-owned-phase-result.v1',run:OWN_C,purpose,frameSha256:OWN_B,
    pid:105,parentPid:104,fd4Closed:true,sourcePinsClosed:true,result};
}
function ownedIntegrationData(){return {schema:'setfarm.manual-orphan-integration-result.v1',run:OWN_C,
  frameSha256:OWN_B,pid:104,parentPid:102,oldEntry:ownedOldData(),newEntry:ownedNewData(),sourcePinsClosed:true};}
function ownedRunnerData(){return {schema:'setfarm.manual-orphan-runner-result.v1',run:OWN_C,
  frameSha256:OWN_B,pid:102,parentPid:101,installationId:OWN_ID,oldEntry:ownedOldData(),newEntry:ownedNewData(),
  cleanup:{databaseAbsent:true,ownerRoleAbsent:true,runtimeRoleAbsent:true,baselineRestored:true,adminClose:'fulfilled'},
  sourcePinsClosed:true};}

const OWN_DIR_WIRE='{"dev":"1","ino":"2","uid":501,"gid":20,"mode":448}';
const OWN_FILE_WIRE='{"dev":"1","ino":"2","uid":501,"gid":20,"mode":420,"nlink":1,"bytes":1,"mtimeNs":"3","ctimeNs":"4","sha256":"'+OWN_H+'"}';
const OWN_M_WIRE='{"sha":"'+OWN_M+'","treeHash":"'+'9'.repeat(40)+'","buildHash":"'+OWN_B+'"}';
const OWN_T_WIRE='{"sha":"'+OWN_T+'","treeHash":"'+'9'.repeat(40)+'","buildHash":"'+OWN_B+'"}';
const OWN_CON_WIRE='{"pid":101,"ppid":100,"uid":501,"pgid":101,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/fixture/node","executableSha256":"'+OWN_H+'","commandSha256":"'+OWN_B+'"}';
const OWN_RUN_WIRE='{"pid":102,"ppid":101,"uid":501,"pgid":101,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/fixture/node","executableSha256":"'+OWN_H+'","commandSha256":"'+OWN_B+'"}';
const OWN_SERVER_WIRE='{"pid":103,"ppid":101,"uid":501,"pgid":101,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/fixture/node","executableSha256":"'+OWN_H+'","commandSha256":"'+OWN_B+'"}';
const OWN_INT_WIRE='{"pid":104,"ppid":102,"uid":501,"pgid":101,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/fixture/node","executableSha256":"'+OWN_H+'","commandSha256":"'+OWN_B+'"}';
const OWN_MECH_WIRE='{"pid":105,"ppid":104,"uid":501,"pgid":101,"startedAtUTC":"2026-10-21T00:00:00.000Z","executable":"/fixture/node","executableSha256":"'+OWN_H+'","commandSha256":"'+OWN_B+'"}';
const OWN_SOURCE_WIRE='{"maintenance":'+OWN_M_WIRE+',"target":'+OWN_T_WIRE+',"profileSha256":"'+OWN_C+'","files":{'
  +'"constructor":'+OWN_FILE_WIRE+',"constructorTests":'+OWN_FILE_WIRE+',"wrapper":'+OWN_FILE_WIRE
  +',"isolatedRunner":'+OWN_FILE_WIRE+',"builtinChild":'+OWN_FILE_WIRE+',"routeTests":'+OWN_FILE_WIRE
  +',"fixture":'+OWN_FILE_WIRE+',"integration":'+OWN_FILE_WIRE+',"journal":'+OWN_FILE_WIRE
  +',"pgPreflight":'+OWN_FILE_WIRE+',"profile":'+OWN_FILE_WIRE+'}}';
const OWN_CLUSTER_WIRE='{"root":'+OWN_DIR_WIRE+',"data":'+OWN_DIR_WIRE+',"port":55439,"postmasterStartedAtUTC":"2026-10-21T00:00:00.123456Z","systemIdentifier":"123","serverVersionNum":170001,"databaseBaselineSha256":"'+OWN_H+'","roleBaselineSha256":"'+OWN_B+'","membershipBaselineSha256":"'+OWN_C+'"}';
const OWN_CREATED_HEAD='{"installationId":"12345678-1234-4234-8234-123456789abc","operationId":"87654321-4321-4321-9321-cba987654321","directory":'+OWN_DIR_WIRE
  +',"databaseName":"setfarm_install_12345678123442348234123456789abc","databaseOid":7,"ownerRole":"sf_owner_12345678123442348234123456789abc","ownerOid":7,"runtimeRole":"sf_runtime_12345678123442348234123456789abc","runtimeOid":8,"sourceSha":"'+OWN_T+'","schemaCatalogHash":"'+OWN_H+'"';
const OWN_RECORDS_HEAD='{"planned.json":{"bytes":1,"sha256":"'+OWN_H+'"},"owner-created.json":{"bytes":2,"sha256":"'+OWN_H+'"},"runtime-created.json":{"bytes":3,"sha256":"'+OWN_H+'"},"database-created.json":{"bytes":4,"sha256":"'+OWN_H+'"},"runtime-credentials.json":{"bytes":4096,"sha256":"'+OWN_H+'"},"schema-prepared.json":{"bytes":6,"sha256":"'+OWN_H+'"},"schema-committed.json":{"bytes":32768,"sha256":"'+OWN_H+'"}';
const OWN_CREATED_WIRE=OWN_CREATED_HEAD+',"records":'+OWN_RECORDS_HEAD+'}}';
const OWN_ACTIVATED_WIRE=OWN_CREATED_HEAD+',"activationCatalogHash":"'+OWN_B+'","records":'+OWN_RECORDS_HEAD
  +',"activation-prepared.json":{"bytes":8,"sha256":"'+OWN_H+'"},"activated.json":{"bytes":9,"sha256":"'+OWN_H+'"}}}';
const OWN_OLD_WIRE='{"state":"old-entry-verified","maintenance":'+OWN_M_WIRE+',"target":'+OWN_T_WIRE
  +',"installationId":"'+OWN_ID+'","sameClient":true,"entryAssert":true,"databaseAssert":true,"close":"fulfilled","closedGetter":"refused"}';
const OWN_NEW_WIRE='{"state":"source-mismatch-refused","maintenance":'+OWN_M_WIRE+',"target":'+OWN_T_WIRE
  +',"installationId":"'+OWN_ID+'","mismatch":"maintenance-sha-vs-target-origin","close":"fulfilled","closedGetter":"refused"}';
const OWN_SETUP_OLD_WIRE='{"schema":"setfarm.manual-orphan-runner-setup.v1","run":"'+OWN_C+'","constructor":'+OWN_CON_WIRE
  +',"runner":'+OWN_RUN_WIRE+',"server":'+OWN_SERVER_WIRE+',"source":'+OWN_SOURCE_WIRE+',"cluster":'+OWN_CLUSTER_WIRE+',"adminPassword":"'+OWN_H+'"}\n';
// Coordinated unavailable setup-v1 refinement; old bytes above remain a negative oracle.
const OWN_SETUP_WIRE='{"schema":"setfarm.manual-orphan-runner-setup.v1","run":"'+OWN_C+'","constructor":'+OWN_CON_WIRE
  +',"runner":'+OWN_RUN_WIRE+',"server":'+OWN_SERVER_WIRE+',"source":'+OWN_SOURCE_WIRE+',"cluster":'+OWN_CLUSTER_WIRE+',"constructorAdminBackend":{"pid":104,"backendStartedAtUTC":"2026-10-21T00:00:00.234567Z"},"adminPassword":"'+OWN_H+'"}\n';
const OWN_PHASE_HEAD='{"schema":"setfarm.manual-orphan-owned-phase.v1","run":"'+OWN_C+'","constructor":'+OWN_CON_WIRE+',"runner":'+OWN_RUN_WIRE;
const OWN_PHASE_TAIL=',"server":'+OWN_SERVER_WIRE+',"source":'+OWN_SOURCE_WIRE+',"cluster":'+OWN_CLUSTER_WIRE+',"installations":'+OWN_DIR_WIRE;
const OWN_RESULT_HEAD='{"schema":"setfarm.manual-orphan-owned-phase-result.v1","run":"'+OWN_C+'","purpose":';
const OWN_RESULT_TAIL=',"frameSha256":"'+OWN_B+'","pid":105,"parentPid":104,"fd4Closed":true,"sourcePinsClosed":true,"result":';
const OWN_INTEGRATION_WIRE='{"schema":"setfarm.manual-orphan-integration-result.v1","run":"'+OWN_C+'","frameSha256":"'+OWN_B+'","pid":104,"parentPid":102,"oldEntry":'+OWN_OLD_WIRE+',"newEntry":'+OWN_NEW_WIRE+',"sourcePinsClosed":true}\n';
const OWN_RUNNER_WIRE='{"schema":"setfarm.manual-orphan-runner-result.v1","run":"'+OWN_C+'","frameSha256":"'+OWN_B+'","pid":102,"parentPid":101,"installationId":"'+OWN_ID+'","oldEntry":'+OWN_OLD_WIRE+',"newEntry":'+OWN_NEW_WIRE+',"cleanup":{"databaseAbsent":true,"ownerRoleAbsent":true,"runtimeRoleAbsent":true,"baselineRestored":true,"adminClose":"fulfilled"},"sourcePinsClosed":true}\n';
// Twelve positive alternatives: 1 setup + 5 phase purposes + 4 phase results
// + 1 integration result + 1 runner result. No arbitrary union cross-product.
const OWN_CASES=[
  ['runner setup','RunnerSetupFrame',ownedSetupData,OWN_SETUP_WIRE],
  ['provision phase','OwnedPhaseFrame',()=>ownedPhaseData('provision'),OWN_PHASE_HEAD+',"parent":'+OWN_RUN_WIRE+',"child":'+OWN_INT_WIRE+OWN_PHASE_TAIL+',"purpose":"provision","input":{"adminPassword":"'+OWN_H+'"}}\n'],
  ['activate phase','OwnedPhaseFrame',()=>ownedPhaseData('activate'),OWN_PHASE_HEAD+',"parent":'+OWN_RUN_WIRE+',"child":'+OWN_INT_WIRE+OWN_PHASE_TAIL+',"purpose":"activate","input":{"adminPassword":"'+OWN_H+'","installation":'+OWN_CREATED_WIRE+'}}\n'],
  ['integration phase','OwnedPhaseFrame',()=>ownedPhaseData('integration'),OWN_PHASE_HEAD+',"parent":'+OWN_RUN_WIRE+',"child":'+OWN_INT_WIRE+OWN_PHASE_TAIL+',"purpose":"integration","input":{"installation":'+OWN_ACTIVATED_WIRE+'}}\n'],
  ['old positive phase','OwnedPhaseFrame',()=>ownedPhaseData('old_entry_positive'),OWN_PHASE_HEAD+',"parent":'+OWN_INT_WIRE+',"child":'+OWN_MECH_WIRE+OWN_PHASE_TAIL+',"purpose":"old_entry_positive","input":{"installation":'+OWN_ACTIVATED_WIRE+'}}\n'],
  ['new refusal phase','OwnedPhaseFrame',()=>ownedPhaseData('new_entry_refusal'),OWN_PHASE_HEAD+',"parent":'+OWN_INT_WIRE+',"child":'+OWN_MECH_WIRE+OWN_PHASE_TAIL+',"purpose":"new_entry_refusal","input":{"installation":'+OWN_ACTIVATED_WIRE+'}}\n'],
  ['provision result','OwnedPhaseResult',()=>ownedPhaseResultData('provision'),OWN_RESULT_HEAD+'"provision"'+OWN_RESULT_TAIL+'{"state":"schema-verified","installation":'+OWN_CREATED_WIRE+',"factoryOwnerClose":"fulfilled"}}\n'],
  ['activate result','OwnedPhaseResult',()=>ownedPhaseResultData('activate'),OWN_RESULT_HEAD+'"activate"'+OWN_RESULT_TAIL+'{"state":"activation-verified","installation":'+OWN_ACTIVATED_WIRE+',"selectionBefore":"schema-committed-unactivated","selectionAfter":"stale-refused","databaseModuleClose":"fulfilled"}}\n'],
  ['old positive result','OwnedPhaseResult',()=>ownedPhaseResultData('old_entry_positive'),OWN_RESULT_HEAD+'"old_entry_positive"'+OWN_RESULT_TAIL+OWN_OLD_WIRE+'}\n'],
  ['new refusal result','OwnedPhaseResult',()=>ownedPhaseResultData('new_entry_refusal'),OWN_RESULT_HEAD+'"new_entry_refusal"'+OWN_RESULT_TAIL+OWN_NEW_WIRE+'}\n'],
  ['integration result','IntegrationResult',ownedIntegrationData,OWN_INTEGRATION_WIRE],
  ['runner result','RunnerResult',ownedRunnerData,OWN_RUNNER_WIRE],
];
const OWN_SCHEMAS=[OWN_CASES[0],OWN_CASES[1],OWN_CASES[6],OWN_CASES[10],OWN_CASES[11]];
function ownedCodec(direction,stem){
  const name=direction+'ManualOrphan'+stem+'V1';
  assert.ok(helper,'real helper namespace is required');
  assert.equal(typeof helper[name],'function','missing inert data contract: '+name);
  return helper[name];
}
function ownedFreezeAssertions(value,other){
  assert.equal(Object.getPrototypeOf(value),Object.prototype);assert.equal(Object.isFrozen(value),true);
  assert.notEqual(value,other,'every decoded object is detached');
  for(const key of Object.keys(value))if(value[key]!==null&&typeof value[key]==='object')
    ownedFreezeAssertions(value[key],other[key]);
}
function ownedReverseData(value){
  return value!==null&&typeof value==='object'?
    Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,ownedReverseData(item)])):value;
}
function ownedAt(value,keys){return keys.reduce((item,key)=>item[key],value);}
function ownedSet(value,keys,replacement){ownedAt(value,keys.slice(0,-1))[keys.at(-1)]=replacement;}
// Each malformed data case exercises both real boundaries, with independently
// serialized input. Wire-order refusals below separately test canonical syntax.
function ownedRejectData(stem,make,mutate,label){
  const encode=ownedCodec('encode',stem),decode=ownedCodec('decode',stem),value=make();
  mutate(value);frameRefusedV1(()=>encode(value),label+' encode');
  frameRefusedV1(()=>decode(Buffer.from(JSON.stringify(value)+'\n')),label+' decode');
}
for(const [label,stem,make,text] of OWN_CASES){
  test('owned data '+label+' encoder emits independent exact ordered bytes and fresh buffers',()=>{
    const encode=ownedCodec('encode',stem),input=make(),before=structuredClone(input),want=Buffer.from(text);
    const first=encode(input),second=encode(input);
    assert.ok(Buffer.isBuffer(first));assert.deepEqual(first,want);assert.deepEqual(second,want);
    assert.notEqual(first,second);assert.deepEqual(input,before,'encoder leaves input unchanged');
    first.fill(0);assert.deepEqual(second,want);
    assert.equal(want.at(-1),10);assert.ok(want.length<=16384);
  });
  test('owned data '+label+' encoder normalizes recursively reordered valid properties',()=>{
    const encode=ownedCodec('encode',stem),input=ownedReverseData(make()),before=structuredClone(input);
    assert.deepEqual(encode(input),Buffer.from(text));assert.deepEqual(input,before);
  });
  test('owned data '+label+' decoder returns deeply frozen detached records without changing wire',()=>{
    const decode=ownedCodec('decode',stem),input=Buffer.from(text),before=Buffer.from(input);
    const first=decode(input),second=decode(input);assert.deepEqual(input,before);
    assert.deepEqual(first,make());assert.deepEqual(second,make());ownedFreezeAssertions(first,second);
    input.fill(0);assert.deepEqual(first,make());
    assert.throws(()=>{first.run=OWN_H;},TypeError);
  });
}
for(const [,stem,make,text] of OWN_SCHEMAS)for(const direction of ['encode','decode']){
  test('owned data '+direction+stem+' requires exactly one data argument',()=>{
    const codec=ownedCodec(direction,stem),value=direction==='encode'?make():Buffer.from(text);
    assert.equal(codec.length,1);frameRefusedV1(()=>codec(),stem+' no arguments');
    frameRefusedV1(()=>codec(value,undefined),stem+' surplus undefined');
    frameRefusedV1(()=>codec(value,()=>{throw Error('must never call');}),stem+' surplus callback');
  });
}
for(const [label,stem] of OWN_SCHEMAS){
  for(const [otherLabel,otherStem,make,text] of OWN_SCHEMAS)if(stem!==otherStem){
    test('owned data '+label+' refuses schema crossing from '+otherLabel,()=>{
      const encode=ownedCodec('encode',stem),decode=ownedCodec('decode',stem);
      frameRefusedV1(()=>encode(make()),'crossed encoder');frameRefusedV1(()=>decode(Buffer.from(text)),'crossed decoder');
    });
  }
  test('owned data '+label+' and preserved probe refuse schema crossing in both directions',()=>{
    const encode=ownedCodec('encode',stem),decode=ownedCodec('decode',stem),row=OWN_SCHEMAS.find(item=>item[1]===stem);
    frameRefusedV1(()=>encode(codecFrameV1()),'probe object');frameRefusedV1(()=>decode(CODEC_EXPECTED_V1),'probe wire');
    frameRefusedV1(()=>helper.encodeManualOrphanProbeFrameV1(row[2]()),'owned object into probe');
    frameRefusedV1(()=>helper.decodeManualOrphanProbeFrameV1(Buffer.from(row[3])),'owned wire into probe');
  });
}

// Shared descriptor invariants use one representative of each nested record
// shape, rather than multiplying all twelve union alternatives by every check.
const OWN_SHAPE_LOCATIONS=[
  ['setup', 'RunnerSetupFrame',ownedSetupData,[]],
  ['process','RunnerSetupFrame',ownedSetupData,['constructor']],
  ['sources','RunnerSetupFrame',ownedSetupData,['source']],
  ['release','RunnerSetupFrame',ownedSetupData,['source','maintenance']],
  ['file map','RunnerSetupFrame',ownedSetupData,['source','files']],
  ['file pin','RunnerSetupFrame',ownedSetupData,['source','files','constructor']],
  ['cluster','RunnerSetupFrame',ownedSetupData,['cluster']],
  ['directory','RunnerSetupFrame',ownedSetupData,['cluster','root']],
  ['phase input','OwnedPhaseFrame',()=>ownedPhaseData('activate'),['input']],
  ['created installation','OwnedPhaseFrame',()=>ownedPhaseData('activate'),['input','installation']],
  ['record map','OwnedPhaseFrame',()=>ownedPhaseData('activate'),['input','installation','records']],
  ['record pin','OwnedPhaseFrame',()=>ownedPhaseData('activate'),['input','installation','records','planned.json']],
  ['cleanup','RunnerResult',ownedRunnerData,['cleanup']],
];
const OWN_SHAPE_KINDS=['array','null','null prototype','foreign prototype','symbol','nonenumerable',
  'getter','setter','proxy','missing key','extra key'];
for(const [location,stem,make,keys] of OWN_SHAPE_LOCATIONS)for(const kind of OWN_SHAPE_KINDS){
  test('owned data rejects '+kind+' on representative '+location+' without invoking accessors or proxy traps',()=>{
    const encode=ownedCodec('encode',stem),frame=make(),original=ownedAt(frame,keys),key=Object.keys(original)[0];
    let value=original,calls=0;
    if(kind==='array')value=Object.assign([],original);
    if(kind==='null')value=null;
    if(kind==='null prototype')value=Object.assign(Object.create(null),original);
    if(kind==='foreign prototype')value=Object.assign(Object.create({extra:true}),original);
    if(kind==='symbol')value[Symbol('private')]='hidden';
    if(kind==='nonenumerable')Object.defineProperty(value,'hidden',{value:1,enumerable:false});
    if(kind==='getter')Object.defineProperty(value,key,{enumerable:true,get(){calls++;return original[key];}});
    if(kind==='setter')Object.defineProperty(value,key,{enumerable:true,set(){calls++;}});
    if(kind==='proxy')value=new Proxy(value,{
      get(){calls++;throw Error('trap');},getPrototypeOf(){calls++;throw Error('trap');},
      ownKeys(){calls++;throw Error('trap');},getOwnPropertyDescriptor(){calls++;throw Error('trap');},
    });
    if(kind==='missing key')delete value[key];
    if(kind==='extra key')value.permission=true;
    if(keys.length)ownedSet(frame,keys,value);
    frameRefusedV1(()=>encode(keys.length?frame:value),location+' '+kind);assert.equal(calls,0);
  });
}
for(const [label,stem,make] of OWN_CASES)for(const kind of ['missing','extra']){
  test('owned data '+label+' rejects '+kind+' top-level fields',()=>{
    ownedRejectData(stem,make,value=>{if(kind==='missing')delete value.run;else value.permission=true;},label+' '+kind);
  });
}

const OWN_WIRE_REFUSALS=[
  ['string',text=>text],['Uint8Array',text=>new Uint8Array(Buffer.from(text))],
  ['empty Buffer',()=>Buffer.alloc(0)],['oversized Buffer',()=>Buffer.alloc(16385,32)],
  ['BOM',text=>Buffer.concat([Buffer.from([239,187,191]),Buffer.from(text)])],
  ['CRLF',text=>Buffer.from(text.slice(0,-1)+'\r\n')],
  ['no LF',text=>Buffer.from(text.slice(0,-1))],
  ['leading whitespace',text=>Buffer.from(' '+text)],
  ['space before LF',text=>Buffer.from(text.slice(0,-1)+' \n')],
  ['extra LF',text=>Buffer.from(text+'\n')],
  ['trailing record',text=>Buffer.from(text+'{}\n')],
  ['duplicate key',text=>Buffer.from(text.replace('{"schema":','{"run":"'+OWN_C+'","schema":'))],
  ['alternate order',text=>{const {schema,...rest}=JSON.parse(text);return Buffer.from(JSON.stringify({...rest,schema})+'\n');}],
  ['alternate escape',text=>Buffer.from(text.replace('setfarm','\\u0073etfarm'))],
  ['invalid UTF8',text=>Buffer.concat([Buffer.from(text.slice(0,12)),Buffer.from([255]),Buffer.from(text.slice(12))])],
  ['invalid JSON',()=>Buffer.from('{"schema":}\n')],
  ['Buffer proxy',text=>new Proxy(Buffer.from(text),{get(){throw Error('must not reflect proxy');}})],
];
for(const [label,stem,,text] of OWN_SCHEMAS)for(const [fault,make] of OWN_WIRE_REFUSALS){
  test('owned data '+label+' decoder refuses '+fault+' canonically',()=>{
    const decode=ownedCodec('decode',stem);frameRefusedV1(()=>decode(make(text)),fault);
  });
}
for(const [label,stem,make] of OWN_CASES){
  test('owned data '+label+' decoder rejects recursively reversed nested key order',()=>{
    const decode=ownedCodec('decode',stem),value=make(),key=stem==='RunnerSetupFrame'?'source':
      stem==='OwnedPhaseFrame'?(value.purpose==='provision'?'parent':'input'):
        stem==='OwnedPhaseResult'?'result':'oldEntry';
    value[key]=ownedReverseData(value[key]);
    frameRefusedV1(()=>decode(Buffer.from(JSON.stringify(value)+'\n')),'nested noncanonical order');
  });
}

// Finite domain inventory: one named test per row, with its explicit values.
// JSON cannot represent NaN/Infinity/-0 faithfully; encoder checks supplement
// the same finite wire value checks, including explicit textual -0 below.
const OWN_DOMAIN_REFUSALS=[
  ['schema',ownedSetupData,['schema'],[null,123,'setfarm.manual-orphan-runner-setup.v2']],
  ['process pid',ownedSetupData,['constructor','pid'],[0,-1,2147483648,1.5,'101',null,NaN,Infinity,-0]],
  ['process ppid',ownedSetupData,['constructor','ppid'],[0,-1,2147483648,-0]],
  ['process uid',ownedSetupData,['constructor','uid'],[-1,2147483648,-0]],
  ['process pgid',ownedSetupData,['constructor','pgid'],[0,2147483648,-0]],
  ['process timestamp',ownedSetupData,['constructor','startedAtUTC'],['2026-02-30T00:00:00.000Z','2026-10-21T00:00:00.001Z','2026-10-21T00:00:00Z',123]],
  ['process path',ownedSetupData,['constructor','executable'],['relative','/','/a//b','/a/../b','/a/./b','/a/','/a\n','/a\u007f','/a\ud800','/'+'x'.repeat(4096)]],
  ['run hash',ownedSetupData,['run'],[OWN_C.toUpperCase(),'a'.repeat(63),'g'.repeat(64),123]],
  ['executable hash',ownedSetupData,['constructor','executableSha256'],['A'.repeat(64),null]],
  ['command hash',ownedSetupData,['constructor','commandSha256'],['b'.repeat(65),false]],
  ['admin password',ownedSetupData,['adminPassword'],['a'.repeat(63),null]],
  ['directory dev',ownedSetupData,['cluster','root','dev'],[-1,1,'01','-0','+1','1.0','1e1','18446744073709551616']],
  ['directory ino',ownedSetupData,['cluster','root','ino'],['',null,'-1']],
  ['directory uid',ownedSetupData,['cluster','root','uid'],[0,500,502,'501',-0]],
  ['directory gid',ownedSetupData,['cluster','root','gid'],[0,19,21,'20',-0]],
  ['directory mode',ownedSetupData,['cluster','root','mode'],[0,449,511,'448',-0]],
  ['file dev',ownedSetupData,['source','files','constructor','dev'],[1,'00','18446744073709551616']],
  ['file ino',ownedSetupData,['source','files','constructor','ino'],['-1','1e2']],
  ['file uid',ownedSetupData,['source','files','constructor','uid'],[0,502,'501',-0]],
  ['file gid',ownedSetupData,['source','files','constructor','gid'],[-1,2147483648,'20',-0]],
  ['file mode',ownedSetupData,['source','files','constructor','mode'],[-1,4096,422,436,'420',-0]],
  ['file nlink',ownedSetupData,['source','files','constructor','nlink'],[0,2,'1',-0]],
  ['file bytes',ownedSetupData,['source','files','constructor','bytes'],[-1,16777217,1.5,'1',-0]],
  ['file mtime',ownedSetupData,['source','files','constructor','mtimeNs'],[3,'03','9223372036854775808','-1']],
  ['file ctime',ownedSetupData,['source','files','constructor','ctimeNs'],['1.0','+4','4e0']],
  ['file hash',ownedSetupData,['source','files','constructor','sha256'],['A'.repeat(64),0]],
  ['maintenance sha',ownedSetupData,['source','maintenance','sha'],['8'.repeat(39),'G'.repeat(40),0]],
  ['target sha',ownedSetupData,['source','target','sha'],[OWN_M,OWN_T.toUpperCase()]],
  ['tree hash',ownedSetupData,['source','maintenance','treeHash'],['9'.repeat(41),null]],
  ['build hash',ownedSetupData,['source','maintenance','buildHash'],['b'.repeat(63),null]],
  ['profile hash',ownedSetupData,['source','profileSha256'],['C'.repeat(64),null]],
  ['port',ownedSetupData,['cluster','port'],[1023,65536,5432,'55439',-0]],
  ['server timestamp',ownedSetupData,['cluster','postmasterStartedAtUTC'],['2026-02-30T00:00:00.123456Z','2026-10-21T00:00:00.123Z','2026-10-21T00:00:00.123456+00:00']],
  ['system id',ownedSetupData,['cluster','systemIdentifier'],[0,'0','01','18446744073709551616','-1']],
  ['server version',ownedSetupData,['cluster','serverVersionNum'],[169999,180000,'170001',170001.5,-0]],
  ['database baseline hash',ownedSetupData,['cluster','databaseBaselineSha256'],['A'.repeat(64)]],
  ['role baseline hash',ownedSetupData,['cluster','roleBaselineSha256'],[null]],
  ['membership baseline hash',ownedSetupData,['cluster','membershipBaselineSha256'],['c'.repeat(63)]],
];
for(const [label,make,keys,values] of OWN_DOMAIN_REFUSALS){
  test('owned data rejects finite '+label+' domain violations at encode and decode',()=>{
    const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame');
    for(const value of values){
      const input=make();ownedSet(input,keys,value);frameRefusedV1(()=>encode(input),label+' '+String(value));
      if(!Object.is(value,-0))frameRefusedV1(()=>decode(Buffer.from(JSON.stringify(input)+'\n')),label+' wire '+String(value));
    }
  });
}
test('owned data decoder refuses textual negative zero instead of normalizing it',()=>{
  const decode=ownedCodec('decode','RunnerSetupFrame');
  for(const [from,to] of [['"pid":101','"pid":-0'],['"uid":501','"uid":-0'],['"bytes":1','"bytes":-0']])
    frameRefusedV1(()=>decode(Buffer.from(OWN_SETUP_WIRE.replace(from,to))),'wire -0');
});

const OWN_INSTALLATION_REFUSALS=[
  ['installation UUID',['installationId'],['12345678-1234-1234-8234-123456789abc',OWN_ID.toUpperCase(),'12345678-1234-4234-7234-123456789abc']],
  ['operation UUID',['operationId'],['87654321-4321-1321-9321-cba987654321',null]],
  ['derived database name',['databaseName'],['setfarm_install_wrong','setfarm_install_'+OWN_ID]],
  ['derived owner name',['ownerRole'],['sf_owner_wrong','sf_runtime_'+OWN_SUFFIX]],
  ['derived runtime name',['runtimeRole'],['sf_runtime_wrong','sf_owner_'+OWN_SUFFIX]],
  ['database OID',['databaseOid'],[0,4294967296,'7',1.5,-0]],
  ['owner OID',['ownerOid'],[0,4294967296,'7',-0]],
  ['runtime OID',['runtimeOid'],[0,4294967296,7,'8',-0]],
  ['fixed source',['sourceSha'],[OWN_M,OWN_T.toUpperCase(),null]],
  ['schema catalog',['schemaCatalogHash'],['A'.repeat(64),null]],
  ['record bytes',['records','planned.json','bytes'],[0,32769,'1',1.5,-0]],
  ['credential record bytes',['records','runtime-credentials.json','bytes'],[0,4097,32768,-0]],
  ['record hash',['records','planned.json','sha256'],['A'.repeat(64),null]],
];
for(const [label,keys,values] of OWN_INSTALLATION_REFUSALS){
  test('owned data rejects finite '+label+' installation violations',()=>{
    const encode=ownedCodec('encode','OwnedPhaseFrame'),decode=ownedCodec('decode','OwnedPhaseFrame');
    for(const value of values){
      const frame=ownedPhaseData('activate');ownedSet(frame.input.installation,keys,value);
      frameRefusedV1(()=>encode(frame),label+' encode');
      if(!Object.is(value,-0))frameRefusedV1(()=>decode(Buffer.from(JSON.stringify(frame)+'\n')),label+' decode');
    }
  });
}
const OWN_PHASE_REFUSALS=[
  ['unknown purpose','provision',value=>{value.purpose='activation';}],
  ['provision with installation','provision',value=>{value.input.installation=ownedInstallationData();}],
  ['provision without password','provision',value=>{delete value.input.adminPassword;}],
  ['activate without password','activate',value=>{delete value.input.adminPassword;}],
  ['activate activated stage','activate',value=>{value.input.installation=ownedInstallationData(true);}],
  ['activate injected activation catalog','activate',value=>{value.input.installation.activationCatalogHash=OWN_B;}],
  ['activate injected activation record','activate',value=>{value.input.installation.records['activated.json']={bytes:1,sha256:OWN_H};}],
  ['integration committed stage','integration',value=>{value.input.installation=ownedInstallationData();}],
  ['old committed stage','old_entry_positive',value=>{value.input.installation=ownedInstallationData();}],
  ['new committed stage','new_entry_refusal',value=>{value.input.installation=ownedInstallationData();}],
  ['integration secret','integration',value=>{value.input.adminPassword=OWN_H;}],
  ['old secret','old_entry_positive',value=>{value.input.adminPassword=OWN_H;}],
  ['new secret','new_entry_refusal',value=>{value.input.adminPassword=OWN_H;}],
  ['phase top secret','integration',value=>{value.adminPassword=OWN_H;}],
  ['activated missing catalog','integration',value=>{delete value.input.installation.activationCatalogHash;}],
  ['activated bad catalog','integration',value=>{value.input.installation.activationCatalogHash=null;}],
  ['activated missing record','integration',value=>{delete value.input.installation.records['activated.json'];}],
  ['activated extra record','integration',value=>{value.input.installation.records['private.json']={bytes:1,sha256:OWN_H};}],
  ['record credential payload','activate',value=>{value.input.installation.records['runtime-credentials.json'].password=OWN_H;}],
  ['caller directory','activate',value=>{value.input.installation.directory='/private/tmp/caller';}],
  ['caller migration array','activate',value=>{value.input.installation.migrations=[];}],
  ['runner ancestry','provision',value=>{value.runner.ppid=999;}],
  ['server ancestry','provision',value=>{value.server.ppid=999;}],
  ['runner issuer copy','activate',value=>{value.parent.commandSha256=OWN_C;}],
  ['mechanical parent ancestry','old_entry_positive',value=>{value.parent.ppid=999;}],
  ['child parent relation','new_entry_refusal',value=>{value.child.ppid=999;}],
];
for(const [label,purpose,mutate] of OWN_PHASE_REFUSALS){
  test('owned data phase refuses '+label,()=>ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData(purpose),mutate,label));
}
for(const [label,stem,make] of OWN_CASES.slice(1,10))for(const kind of ['missing','extra']){
  test('owned data '+label+' rejects '+kind+' union fields',()=>{
    ownedRejectData(stem,make,value=>{
      const union=value.input??value.result;
      if(kind==='missing')delete union[Object.keys(union)[0]];else union.permission=true;
    },label+' union '+kind);
  });
}
for(const [label,mutate] of [
  ['runner ancestry',value=>{value.runner.ppid=999;}],
  ['server ancestry',value=>{value.server.ppid=999;}],
  ['fixed target release',value=>{value.source.target.sha=OWN_M;}],
  ['maintenance equals fixed target',value=>{value.source.maintenance.sha=OWN_T;}],
  ['missing eleven-file pin',value=>{delete value.source.files.integration;}],
  ['extra file selector',value=>{value.source.files.caller=ownedFileData();}],
]){
  test('owned data setup refuses '+label,()=>ownedRejectData('RunnerSetupFrame',ownedSetupData,mutate,label));
}

const OWN_RESULT_REFUSALS=[
  ['provision wrong state','provision',value=>{value.result.state='activation-verified';}],
  ['provision unclosed owner','provision',value=>{value.result.factoryOwnerClose='rejected';}],
  ['provision activated stage','provision',value=>{value.result.installation=ownedInstallationData(true);}],
  ['activation committed stage','activate',value=>{value.result.installation=ownedInstallationData();}],
  ['activation before selection','activate',value=>{value.result.selectionBefore='ordinary';}],
  ['activation after selection','activate',value=>{value.result.selectionAfter='unchanged';}],
  ['activation close','activate',value=>{value.result.databaseModuleClose='rejected';}],
  ['old state','old_entry_positive',value=>{value.result.state='source-mismatch-refused';}],
  ['old client identity','old_entry_positive',value=>{value.result.sameClient=false;}],
  ['old entry assertion','old_entry_positive',value=>{value.result.entryAssert=false;}],
  ['old database assertion','old_entry_positive',value=>{value.result.databaseAssert=false;}],
  ['old close','old_entry_positive',value=>{value.result.close='pending';}],
  ['old getter','old_entry_positive',value=>{value.result.closedGetter='open';}],
  ['new state','new_entry_refusal',value=>{value.result.state='old-entry-verified';}],
  ['new mismatch','new_entry_refusal',value=>{value.result.mismatch='error-text';}],
  ['new falsely instrumented stage','new_entry_refusal',value=>{value.result.stage='source';}],
  ['new close','new_entry_refusal',value=>{value.result.close='rejected';}],
  ['new getter','new_entry_refusal',value=>{value.result.closedGetter='open';}],
  ['mechanical target','old_entry_positive',value=>{value.result.target.sha=OWN_M;}],
  ['mechanical maintenance equals target','new_entry_refusal',value=>{value.result.maintenance.sha=OWN_T;}],
  ['integration purpose','provision',value=>{value.purpose='integration';}],
  ['wrong result purpose','old_entry_positive',value=>{value.purpose='new_entry_refusal';}],
  ['FD4 closure','provision',value=>{value.fd4Closed=false;}],
  ['source closure','provision',value=>{value.sourcePinsClosed=false;}],
  ['result secret','provision',value=>{value.result.adminPassword=OWN_H;}],
  ['result pid','provision',value=>{value.pid=0;}],
  ['result parent','provision',value=>{value.parentPid=-0;}],
  ['frame digest','provision',value=>{value.frameSha256='B'.repeat(64);}],
];
for(const [label,purpose,mutate] of OWN_RESULT_REFUSALS){
  test('owned data phase result refuses '+label,()=>{
    if(label==='result parent'){
      const encode=ownedCodec('encode','OwnedPhaseResult'),value=ownedPhaseResultData(purpose);mutate(value);
      frameRefusedV1(()=>encode(value),label);
      const decode=ownedCodec('decode','OwnedPhaseResult');
      frameRefusedV1(()=>decode(Buffer.from(OWN_CASES[6][3].replace('"parentPid":104','"parentPid":-0'))),label+' wire');
    }else ownedRejectData('OwnedPhaseResult',()=>ownedPhaseResultData(purpose),mutate,label);
  });
}
for(const [label,stem,make] of [['integration','IntegrationResult',ownedIntegrationData],['runner','RunnerResult',ownedRunnerData]]){
  for(const [fault,mutate] of [
    ['old and new crossed',value=>{[value.oldEntry,value.newEntry]=[value.newEntry,value.oldEntry];}],
    ['different installation ids',value=>{value.newEntry.installationId=OWN_OP;}],
    ['different maintenance release',value=>{value.newEntry.maintenance.treeHash='7'.repeat(40);}],
    ['different target release',value=>{value.newEntry.target.buildHash=OWN_C;}],
    ['unclosed sources',value=>{value.sourcePinsClosed=false;}],
    ['receipt secret',value=>{value.adminPassword=OWN_H;}],
    ['invalid pid',value=>{value.pid=2147483648;}],
    ['invalid parent pid',value=>{value.parentPid=0;}],
  ])test('owned data '+label+' result refuses '+fault,()=>ownedRejectData(stem,make,mutate,fault));
}
for(const key of ['databaseAbsent','ownerRoleAbsent','runtimeRoleAbsent','baselineRestored','adminClose']){
  test('owned data runner receipt refuses unconfirmed cleanup '+key,()=>{
    ownedRejectData('RunnerResult',ownedRunnerData,value=>{value.cleanup[key]=key==='adminClose'?'rejected':false;},key);
  });
}
test('owned data runner receipt binds its installation id to both mechanical results',()=>{
  ownedRejectData('RunnerResult',ownedRunnerData,value=>{value.installationId=OWN_OP;},'runner installation mismatch');
});

for(const [label,mutate,replace] of [
  ['minimum syntax domains',value=>{
    Object.assign(value.constructor,{pid:1,ppid:1,uid:0,pgid:1});value.runner.ppid=1;value.server.ppid=1;
    value.cluster.root.dev='0';value.cluster.root.ino='0';value.cluster.port=1024;value.cluster.systemIdentifier='1';
    value.cluster.serverVersionNum=170000;
    Object.assign(value.source.files.constructor,{dev:'0',ino:'0',gid:0,mode:0,bytes:0,mtimeNs:'0',ctimeNs:'0'});
  },text=>text.replace('"pid":101','"pid":1').replace('"ppid":100','"ppid":1')
    .replaceAll('"ppid":101','"ppid":1').replace('"uid":501,"pgid":101','"uid":0,"pgid":1')
    .replace('"root":'+OWN_DIR_WIRE,'"root":{"dev":"0","ino":"0","uid":501,"gid":20,"mode":448}')
    .replace('"port":55439','"port":1024').replace('"systemIdentifier":"123"','"systemIdentifier":"1"')
    .replace('"serverVersionNum":170001','"serverVersionNum":170000')
    .replace('"constructor":'+OWN_FILE_WIRE,'"constructor":{"dev":"0","ino":"0","uid":501,"gid":0,"mode":0,"nlink":1,"bytes":0,"mtimeNs":"0","ctimeNs":"0","sha256":"'+OWN_H+'"}')],
  ['maximum syntax domains',value=>{
    Object.assign(value.constructor,{pid:2147483647,ppid:2147483647,uid:2147483647,pgid:2147483647});
    value.runner.ppid=2147483647;value.server.ppid=2147483647;
    value.cluster.root.dev='18446744073709551615';value.cluster.root.ino='18446744073709551615';
    value.cluster.port=65535;value.cluster.systemIdentifier='18446744073709551615';value.cluster.serverVersionNum=179999;
    Object.assign(value.source.files.constructor,{dev:'18446744073709551615',ino:'18446744073709551615',gid:2147483647,
      mode:4077,bytes:16777216,mtimeNs:'9223372036854775807',ctimeNs:'9223372036854775807'});
  },text=>text.replace('"pid":101','"pid":2147483647').replace('"ppid":100','"ppid":2147483647')
    .replaceAll('"ppid":101','"ppid":2147483647').replace('"uid":501,"pgid":101','"uid":2147483647,"pgid":2147483647')
    .replace('"root":'+OWN_DIR_WIRE,'"root":{"dev":"18446744073709551615","ino":"18446744073709551615","uid":501,"gid":20,"mode":448}')
    .replace('"port":55439','"port":65535').replace('"systemIdentifier":"123"','"systemIdentifier":"18446744073709551615"')
    .replace('"serverVersionNum":170001','"serverVersionNum":179999')
    .replace('"constructor":'+OWN_FILE_WIRE,'"constructor":{"dev":"18446744073709551615","ino":"18446744073709551615","uid":501,"gid":2147483647,"mode":4077,"nlink":1,"bytes":16777216,"mtimeNs":"9223372036854775807","ctimeNs":"9223372036854775807","sha256":"'+OWN_H+'"}')],
]){
  test('owned data accepts '+label+' without claiming actual admitted process or Source ownership',()=>{
    const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame'),value=ownedSetupData();
    mutate(value);const want=Buffer.from(replace(OWN_SETUP_WIRE));assert.deepEqual(encode(value),want);
    assert.deepEqual(decode(want),value);
  });
}
for(const [label,databaseOid,ownerOid,runtimeOid] of [
  ['minimum database and maximum role OIDs',1,1,4294967295],
  ['maximum database OID may equal runtime OID',4294967295,1,4294967295],
]){
  test('owned data accepts '+label+' while distinct role OIDs remain required',()=>{
    const encode=ownedCodec('encode','OwnedPhaseFrame'),decode=ownedCodec('decode','OwnedPhaseFrame');
    const frame=ownedPhaseData('activate');Object.assign(frame.input.installation,{databaseOid,ownerOid,runtimeOid});
    const want=Buffer.from(OWN_CASES[2][3].replace('"databaseOid":7','"databaseOid":'+databaseOid)
      .replace('"ownerOid":7','"ownerOid":'+ownerOid).replace('"runtimeOid":8','"runtimeOid":'+runtimeOid));
    assert.deepEqual(encode(frame),want);assert.deepEqual(decode(want),frame);
  });
}
test('owned data accepts changed run correlation as data and produces changed exact bytes',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame'),frame=ownedSetupData();
  frame.run=OWN_H;const want=Buffer.from(OWN_SETUP_WIRE.replace('"run":"'+OWN_C+'"','"run":"'+OWN_H+'"'));
  assert.deepEqual(encode(frame),want);assert.deepEqual(decode(want),frame);
  assert.notEqual(createHash('sha256').update(want).digest('hex'),createHash('sha256').update(OWN_SETUP_WIRE).digest('hex'));
});
test('owned data encoding retains no input aliases even when valid equal pins share an object',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame'),frame=ownedSetupData();
  frame.cluster.data=frame.cluster.root;const bytes=encode(frame);assert.deepEqual(bytes,Buffer.from(OWN_SETUP_WIRE));
  const decoded=decode(bytes);frame.cluster.root.ino='999';assert.equal(decoded.cluster.root.ino,'2');
  assert.equal(decoded.cluster.data.ino,'2');assert.deepEqual(bytes,Buffer.from(OWN_SETUP_WIRE));
});
test('owned data decoder uses actual Buffer view length and never a forged own size',()=>{
  const decode=ownedCodec('decode','RunnerSetupFrame');
  const valid=Buffer.from(OWN_SETUP_WIRE);
  Object.defineProperty(valid,'length',{value:16385});Object.defineProperty(valid,'byteLength',{value:16385});
  assert.deepEqual(decode(valid),ownedSetupData());
  const oversized=Buffer.alloc(16385,32);Buffer.from(OWN_SETUP_WIRE).copy(oversized);
  Object.defineProperty(oversized,'length',{value:Buffer.byteLength(OWN_SETUP_WIRE)});
  Object.defineProperty(oversized,'byteLength',{value:Buffer.byteLength(OWN_SETUP_WIRE)});
  frameRefusedV1(()=>decode(oversized),'forged undersize');
});

// Task2 Phase A: bounded whole-helper PREFIX simulations, never a successful
// stock holder/observer or a release emulator. The first authenticated import
// is a terminal boundary. Complete inventories, resolution and returned-owner
// check/close still require Task7's actual reviewed finalized M.
const SOURCE_NODE_V1='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const SOURCE_NODE_HASH_V1='59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553';
const SOURCE_HOME_V1=TASK7_HOST_POLICY.home;
const SOURCE_WORKSPACE_V1=TASK7_HOST_POLICY.workspace;
const SOURCE_M_SHA_V1='8888888888888888888888888888888888888888';
const SOURCE_M_V1=SOURCE_WORKSPACE_V1+'/releases/setfarm-88888888';
const SOURCE_T_V1=SOURCE_WORKSPACE_V1+'/releases/setfarm-161297ff';
const SOURCE_SUFFIX_V1='/tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs';
const SOURCE_SCRIPT_V1='scripts/build-generation-retention.mjs';
const SOURCE_PROFILE_V1='src/installation/manual-orphan-target-dependencies-v1.json';
const SOURCE_FILES_V1=Object.freeze([
  'scripts/run-private-postgres-tests.mjs',
  'scripts/__tests__/private-postgres-test-cluster.test.js',
  'scripts/run-execution-attempt-tests.ts',
  'scripts/run-isolated-postgres-tests.ts',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs',
  'scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts',
  'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts',
  'scripts/private-postgres-test-journal-v1.mjs',
  'scripts/finding-test-preflight.mjs',
  SOURCE_PROFILE_V1,
]);
function requireOwnedSourceContractV1(){
  // Resolve through the ACTUAL imported namespace in each test callback. An
  // absent future API is the explicit RED, before fixture reads or VM setup.
  assert.equal(typeof helper?.holdManualOrphanOwnedSourcesV1,'function',
    'missing contract: holdManualOrphanOwnedSourcesV1');
  assert.equal(helper.holdManualOrphanOwnedSourcesV1.length,0,'fixed Source holder has exact arity zero');
}
function readAdmittedSourceNodeDataV1(){
  const bytes=Buffer.alloc(131072),fd=openFixtureFdV1(SOURCE_NODE_V1,constants.O_RDONLY|constants.O_NOFOLLOW);
  let count=0;
  try{
    while(count<bytes.length){
      const n=readFixtureFdV1(fd,bytes,count,bytes.length-count,count);
      if(n===0)break;count+=n;
    }
  }finally{closeFixtureFdV1(fd);}
  assert.equal(count,68032,'current admitted Node26 fixture byte count, bounded to131072 bytes read');
  return Buffer.from(bytes.subarray(0,count));
}
function sourcePrefixFixtureV1({root=SOURCE_M_V1,head=SOURCE_M_SHA_V1,suffix=SOURCE_SUFFIX_V1}={}){
  // Root's a6bacdf7 ruling permits this ONE current-host public executable as
  // DATA, lazily after the missing-contract assertion. Never execute/archive it.
  const node=readAdmittedSourceNodeDataV1();
  assert.ok(node.length>0&&node.length<=131072,'admitted Node fixture has a bounded size');
  assert.equal(node.length,68032,'current admitted Node26 fixture byte count');
  assert.equal(createHash('sha256').update(node).digest('hex'),SOURCE_NODE_HASH_V1,
    'real crypto verifies the sole admitted executable fixture');
  const files=new Map(),dirs=new Map(),gitBlobs=new Map();let ino=100;
  const state={root,head,moduleURL:url.pathToFileURL(root+suffix).href,files,dirs,gitBlobs,
    events:[],opened:[],closeAttempts:[],fds:new Map(),faults:[],unlisted:[],imports:[],locators:[],
    aliases:new Map(),closeFaultPath:null,openFaultPath:null,readFaultPath:null,
    heldDriftPath:null,nextFd:400};
  const unexpected=label=>{state.unlisted.push(label);throw Error('SOURCE_PREFIX_UNLISTED:'+label);};
  const checked=fn=>(...args)=>{try{return fn(...args);}catch(error){
    if(error?.code==='ERR_ASSERTION')state.faults.push(error.message);throw error;
  }};
  state.checked=checked;state.unexpected=unexpected;
  function addFile(locator,bytes,system=false){
    bytes=Buffer.from(bytes);const stat={...observationStatV1('file',ino++,bytes.length),birthtimeNs:1n};
    if(system){stat.uid=0n;stat.gid=0n;stat.mode=0o100755n;}
    files.set(locator,{bytes,stat});
    for(let at=path.dirname(locator);;at=path.dirname(at)){
      if(!dirs.has(at)){
        const value={...observationStatV1('directory',ino++),birthtimeNs:1n};
        if(at!==SOURCE_HOME_V1&&!at.startsWith(SOURCE_HOME_V1+'/')){value.uid=0n;value.gid=0n;}
        dirs.set(at,value);
      }
      if(at===path.dirname(at))break;
    }
  }
  addFile(SOURCE_NODE_V1,node,true);
  addFile('/usr/bin/git','bounded public system git DATA fixture\n',true);
  // Eleven comparison files are DATA, including the future integration. This
  // creates no integration file and cannot stand in for full retained Source.
  for(const locator of SOURCE_FILES_V1){
    const bytes=locator===SOURCE_PROFILE_V1
      ?readFileSync(new URL('../../'+SOURCE_PROFILE_V1,import.meta.url))
      :Buffer.from('bounded comparison DATA '+locator+'\n');
    addFile(root+'/'+locator,bytes);gitBlobs.set(locator,Buffer.from(bytes));
  }
  const retention=readFileSync(new URL('../build-generation-retention.mjs',import.meta.url));
  addFile(root+'/'+SOURCE_SCRIPT_V1,retention);gitBlobs.set(SOURCE_SCRIPT_V1,Buffer.from(retention));
  function entry(locator){
    assert.equal(typeof locator,'string','filesystem paths must be fixed strings');
    const value=files.get(locator)??dirs.get(locator);
    return value??unexpected('path '+locator);
  }
  function statValue(stat){
    const value={...stat};delete value.kind;
    return {...value,isFile:()=>stat.kind==='file',isDirectory:()=>stat.kind==='directory',
      isSymbolicLink:()=>false,isFIFO:()=>false,isSocket:()=>false};
  }
  function descriptor(fd){
    const record=state.fds.get(fd);assert.ok(record,'only captured local descriptors');
    assert.equal(record.closed,false,'no use after any close attempt');return record;
  }
  const realpath=checked(locator=>{
    state.events.push(['realpath',locator]);entry(locator);return state.aliases.get(locator)??locator;
  });realpath.native=realpath;
  state.fs={constants,realpathSync:realpath,
    lstatSync:checked((locator,options)=>{
      state.events.push(['lstat',locator]);assert.equal(options?.bigint,true);
      const value=entry(locator);return statValue(files.has(locator)?value.stat:value);
    }),
    openSync:checked((locator,flags)=>{
      state.events.push(['open',locator]);const value=entry(locator);
      assert.equal(typeof flags,'number');assert.ok((flags&constants.O_NOFOLLOW)!==0);
      assert.equal(flags&(constants.O_WRONLY|constants.O_RDWR|constants.O_CREAT|constants.O_TRUNC|constants.O_APPEND),0,
        'Source ownership is read only');
      if(locator===state.openFaultPath)throw Error('bounded local open failure');
      const record={fd:state.nextFd++,path:locator,entry:value,closed:false};
      state.opened.push(record);state.fds.set(record.fd,record);return record.fd;
    }),
    fstatSync:checked((fd,options)=>{
      state.events.push(['fstat',fd]);assert.equal(options?.bigint,true);const record=descriptor(fd);
      const stat=files.has(record.path)?record.entry.stat:record.entry;
      return statValue(record.path===state.heldDriftPath?{...stat,ino:stat.ino+1n}:stat);
    }),
    readSync:checked((fd,buffer,offset,length,position)=>{
      const record=descriptor(fd);state.events.push(['read',record.path]);
      assert.ok(files.has(record.path),'only fixed regular-file DATA may be read');
      assert.ok(Buffer.isBuffer(buffer));
      for(const n of [offset,length,position])assert.ok(Number.isSafeInteger(n)&&n>=0);
      assert.ok(offset+length<=buffer.length);assert.ok(length<=16777217);
      if(record.path===state.readFaultPath)throw Error('bounded local read failure');
      const n=Math.max(0,Math.min(length,record.entry.bytes.length-position));
      record.entry.bytes.copy(buffer,offset,position,position+n);return n;
    }),
    closeSync:checked(fd=>{
      const record=state.fds.get(fd);assert.ok(record,'no phantom descriptor cleanup');
      state.events.push(['close',fd]);state.closeAttempts.push(fd);
      assert.equal(record.closed,false,'no retry of possibly reused descriptors');record.closed=true;
      if(record.path===state.closeFaultPath)throw Error('bounded local close uncertainty');
    }),
    accessSync:checked((locator,mode)=>{
      state.events.push(['access',locator]);assert.equal(mode,constants.X_OK);entry(locator);
    }),
  };
  const gitReplies=new Map([
    ['rev-parse --verify HEAD',head+'\n'],['branch --show-current','main\n'],
    ['rev-parse --verify refs/remotes/origin/main',head+'\n'],
    ['rev-parse --git-common-dir',root+'/.git\n'],
    ['status --porcelain=v1 --untracked-files=all',''],
  ]);
  state.gitReplies=gitReplies;
  state.childProcess={spawnSync:checked((executable,args,options)=>{
    assert.equal(executable,'/usr/bin/git','only fixed sanitized Git prefix queries');
    const cells=Array.from(args);
    assert.deepEqual(cells.slice(0,4),['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false']);
    const query=cells.slice(4),key=query.join(' ');state.events.push(['git',key]);
    assert.deepEqual(Object.keys(options).sort(),['cwd','env','maxBuffer','shell','timeout']);
    assert.equal(options.cwd,root);assert.equal(options.shell,false);assert.equal(options.timeout,10000);
    assert.equal(options.maxBuffer,16777216);
    assert.deepEqual({...options.env},{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',
      GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'});
    let stdout;
    if(query.length===2&&query[0]==='show'&&query[1].startsWith(head+':')){
      const locator=query[1].slice(head.length+1);
      stdout=gitBlobs.get(locator)??unexpected('git blob '+locator);
    }else stdout=gitReplies.get(key)??unexpected('git query '+key);
    return {status:0,signal:null,error:undefined,stdout:Buffer.from(stdout),stderr:Buffer.alloc(0)};
  })};
  const env={PATH:path.dirname(SOURCE_NODE_V1)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
  state.process={execPath:SOURCE_NODE_V1,argv0:SOURCE_NODE_V1,execArgv:[],
    argv:[SOURCE_NODE_V1,root+suffix],platform:'darwin',arch:'arm64',version:'v26.4.0',
    versions:Object.freeze({node:'26.4.0'}),
    env:new Proxy(env,{set(){return unexpected('environment write');},deleteProperty(){return unexpected('environment delete');},
      defineProperty(){return unexpected('environment define');},setPrototypeOf(){return unexpected('environment prototype');}}),
    cwd:checked(()=>{state.events.push(['cwd']);return root;}),
  };
  for(const [name,value] of [['getuid',501],['geteuid',501],['getgid',20],['getegid',20]]){
    state.process[name]=checked(()=>{state.events.push([name]);return value;});
  }
  state.os={userInfo:checked((...args)=>{
    assert.equal(args.length,0);state.events.push(['userInfo']);
    return {uid:501,gid:20,username:'setrox',homedir:SOURCE_HOME_V1,shell:'/bin/zsh'};
  })};
  state.assertClosed=()=>{
    assert.deepEqual(state.closeAttempts,state.opened.map(record=>record.fd).reverse(),
      'every known local descriptor gets exactly one reverse-order close attempt');
    for(const record of state.opened)assert.equal(record.closed,true);
  };
  state.assertReached=(kind,value)=>assert.ok(state.events.some(event=>event[0]===kind&&event[1]===value),
    'intended predicate prerequisite reached: '+kind+' '+value);
  return state;
}
function sourcePrefixVmV1(state){
  let source=lowerFixedProbeEntryV1(readFileSync(HELPER,'utf8'));
  assert.equal([...source.matchAll(/\bimport\.meta\.url\b/g)].length,1,'reuse the single actual helper locator');
  source=replaceOnce(source,'import.meta.url',JSON.stringify(state.moduleURL),'fixed Source prefix module URL');
  const c=capture(),pureUtil=createRequire(import.meta.url)('node:util');
  const modules=new Map([
    ['node:fs',closedModule(c,'Source prefix fs',state.fs)],
    ['node:child_process',closedModule(c,'Source prefix child_process',state.childProcess)],
    ['node:net',closedModule(c,'Source prefix net')],['node:os',closedModule(c,'Source prefix os',state.os)],
    ['node:crypto',closedModule(c,'Source prefix crypto',{createHash})],
    ['node:util',closedModule(c,'Source prefix util',{TextDecoder:pureUtil.TextDecoder,types:pureUtil.types})],
    ['node:path',path],['node:url',closedModule(c,'Source prefix url',{
      fileURLToPath:state.checked(value=>{
        assert.equal(value,state.moduleURL,'derive the fixed root from the actual own helper locator');
        state.locators.push(value);return url.fileURLToPath(value);
      }),pathToFileURL:url.pathToFileURL,
    })],['node:buffer',{Buffer}],
  ]);
  const compiled=ts.transpileModule(source,{fileName:OBS_HELPER_PATH_V1+'.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'actual complete helper must transpile before a prefix result counts');
  const frontier=Error('TEST_ONLY_FIRST_AUTHENTICATED_RETENTION_IMPORT_FRONTIER');
  const context={exports:{},Buffer,URL,Error,TextDecoder:pureUtil.TextDecoder,
    process:new Proxy(closedModule(c,'Source prefix process',state.process),{
      set(){return state.unexpected('process write');},deleteProperty(){return state.unexpected('process delete');},
      defineProperty(){return state.unexpected('process define');},setPrototypeOf(){return state.unexpected('process prototype');},
    }),
    console:closedModule(c,'Source prefix console'),setTimeout:forbidden(c,'Source prefix timer'),
    clearTimeout:forbidden(c,'Source prefix clearTimer'),
    require(specifier){
      if(modules.has(specifier))return modules.get(specifier);
      state.imports.push(specifier);
      if(specifier===url.pathToFileURL(state.root+'/'+SOURCE_SCRIPT_V1).href)throw frontier;
      state.unlisted.push('import '+specifier);throw Error('SOURCE_PREFIX_UNLISTED_IMPORT');
    }};
  runInNewContext(compiled.outputText,context,{filename:OBS_HELPER_PATH_V1,timeout:5000});
  assert.deepEqual(state.events,[],'whole-helper module initialization performs no prefix IO');
  assert.deepEqual(state.imports,[],'whole-helper initialization imports builtins only');
  assert.deepEqual(state.locators,[],'whole-helper initialization does not derive an owner context');
  return {actual:context.exports,compiledDataAdmission:context.ownedSourceAuditedCompiledV1,assertContained(){
    assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));
    assert.deepEqual(state.unlisted,[],'swallowed unlisted calls cannot earn refusal coverage');
    assert.deepEqual(state.faults,[],'swallowed fixture assertion cannot earn refusal coverage');
  }};
}
async function sourcePrefixRefusedV1(state,{code='MANUAL_ORPHAN_OWNER_REFUSED',frontier=false}={}){
  const vm=sourcePrefixVmV1(state);
  assert.equal(typeof vm.actual.holdManualOrphanOwnedSourcesV1,'function','contained actual holder export');
  await assert.rejects(()=>vm.actual.holdManualOrphanOwnedSourcesV1(),error=>{
    assert.ok(error instanceof Error);assert.equal(error.message,code);return true;
  });
  state.assertClosed();vm.assertContained();
  assert.deepEqual(state.imports,frontier?[url.pathToFileURL(state.root+'/'+SOURCE_SCRIPT_V1).href]:[],
    'no observer, selection, runtime-config, db, package or later import is admitted');
  return vm;
}

test('Source PREFIX simulation exposes exact zeroarg API and rejects a passed argument before any acquisition IO',async()=>{
  requireOwnedSourceContractV1();
  const state=sourcePrefixFixtureV1(),vm=sourcePrefixVmV1(state);
  assert.equal(vm.actual.holdManualOrphanOwnedSourcesV1.length,0);
  await assert.rejects(()=>vm.actual.holdManualOrphanOwnedSourcesV1('caller-selected-root'),
    error=>error instanceof Error&&error.message==='MANUAL_ORPHAN_OWNER_REFUSED');
  assert.deepEqual(state.events,[]);assert.deepEqual(state.imports,[]);state.assertClosed();vm.assertContained();
});
test('Source PREFIX simulation reaches only the exact first authenticated retention import frontier',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  await sourcePrefixRefusedV1(state,{frontier:true});
  for(const query of ['rev-parse --verify HEAD','branch --show-current','rev-parse --verify refs/remotes/origin/main',
    'show '+SOURCE_M_SHA_V1+':'+SOURCE_SCRIPT_V1])state.assertReached('git',query);
  state.assertReached('read',SOURCE_NODE_V1);state.assertReached('read',SOURCE_M_V1+'/'+SOURCE_SCRIPT_V1);
  assert.ok(state.opened.length>1,'actual helper acquired local resources before the terminal frontier');
});
test('Source PREFIX simulation refuses wrong own helper suffix before filesystem or Git work',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1({suffix:SOURCE_SUFFIX_V1+'.wrong'});
  await sourcePrefixRefusedV1(state);assert.equal(state.opened.length,0);
  assert.ok(state.locators.includes(state.moduleURL),'actual consumer read the wrong-suffix own locator');
  assert.ok(!state.events.some(event=>['open','lstat','realpath','git'].includes(event[0])));
});
test('Source PREFIX simulation refuses a changed effective GID before acquisition or import IO',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  // Real gid/userInfo.gid and every other prefix fact stay at their valid
  // values. Only the independently modeled effective credential differs.
  state.process.getegid=state.checked(()=>{state.events.push(['getegid']);return 21;});
  const vm=sourcePrefixVmV1(state);
  await assert.rejects(()=>vm.actual.holdManualOrphanOwnedSourcesV1(),
    error=>error instanceof Error&&error.message==='MANUAL_ORPHAN_OWNER_REFUSED');
  state.assertReached('getegid',undefined);
  assert.equal(state.opened.length,0,'effective-GID refusal precedes descriptor acquisition');
  assert.ok(!state.events.some(event=>['open','lstat','realpath','fstat','read','close','access','git'].includes(event[0])),
    'effective-GID refusal precedes filesystem and Git IO');
  assert.deepEqual(state.imports,[],'effective-GID refusal precedes the first retention import');
  state.assertClosed();vm.assertContained();
});
test('Source PREFIX simulation refuses a physical maintenance alias at its actual realpath predicate',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  state.aliases.set(SOURCE_M_V1,SOURCE_M_V1+'.alias');
  await sourcePrefixRefusedV1(state);state.assertReached('realpath',SOURCE_M_V1);
  assert.ok(!state.events.some(event=>event[0]==='git'));
});
test('Source PREFIX simulation refuses maintenance basename versus head8 mismatch after the HEAD query',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1({head:'9999999999999999999999999999999999999999'});
  await sourcePrefixRefusedV1(state);state.assertReached('git','rev-parse --verify HEAD');
  assert.ok(!state.events.some(event=>event[0]==='git'&&event[1].startsWith('show ')));
});
test('Source PREFIX simulation refuses main versus origin-main mismatch after reading origin-main',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  state.gitReplies.set('rev-parse --verify refs/remotes/origin/main','9999999999999999999999999999999999999999\n');
  await sourcePrefixRefusedV1(state);state.assertReached('git','rev-parse --verify refs/remotes/origin/main');
  assert.ok(!state.events.some(event=>event[0]==='git'&&event[1].startsWith('show ')));
});
test('Source PREFIX simulation refuses maintenance equal to the fixed target with an otherwise matching basename and HEAD',async()=>{
  requireOwnedSourceContractV1();
  const state=sourcePrefixFixtureV1({root:SOURCE_T_V1,head:'161297ffca6adf2851918a93d492e1c9a77ce59d'});
  await sourcePrefixRefusedV1(state);
  assert.ok(state.locators.includes(url.pathToFileURL(SOURCE_T_V1+SOURCE_SUFFIX_V1).href),
    'actual own-locator derivation reached the equal fixed M/T root');
  assert.ok(!state.events.some(event=>event[0]==='git'),'equal fixed roots refuse before unrelated Git admission');
});
// Profile/Git and all-eleven-file acquisition may legitimately follow the
// first retention import. Their complete qualification remains Source review
// and Task7 work, rather than forcing an earlier algorithm for this prefix.
test('Source PREFIX simulation refuses retention versus Git bytes at its own authenticated comparison',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  state.gitBlobs.set(SOURCE_SCRIPT_V1,Buffer.from('different independent tracked blob\n'));
  await sourcePrefixRefusedV1(state);state.assertReached('read',SOURCE_M_V1+'/'+SOURCE_SCRIPT_V1);
  state.assertReached('git','show '+SOURCE_M_SHA_V1+':'+SOURCE_SCRIPT_V1);
});
test('Source local-FD simulation refuses changed executable content with retained metadata and closes acquired descriptors',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1(),file=state.files.get(SOURCE_NODE_V1);
  file.bytes=Buffer.from(file.bytes);file.bytes[0]^=1;
  await sourcePrefixRefusedV1(state);state.assertReached('read',SOURCE_NODE_V1);assert.ok(state.opened.length>1);
});
test('Source local-FD simulation refuses held versus named executable identity and closes all acquired descriptors',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();state.heldDriftPath=SOURCE_NODE_V1;
  await sourcePrefixRefusedV1(state);state.assertReached('open',SOURCE_NODE_V1);
  assert.ok(state.events.some(event=>event[0]==='fstat'&&state.fds.get(event[1])?.path===SOURCE_NODE_V1));
});
for(const [label,field,locator] of [
  ['later open','openFaultPath',SOURCE_SCRIPT_V1],['later read','readFaultPath',SOURCE_SCRIPT_V1],
]){
  test('Source local-FD simulation closes earlier acquisitions in reverse once after '+label+' failure',async()=>{
    requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();state[field]=SOURCE_M_V1+'/'+locator;
    await sourcePrefixRefusedV1(state);state.assertReached(label==='later open'?'open':'read',state[field]);
    assert.ok(state.opened.some(record=>record.path===SOURCE_NODE_V1),'failure follows an earlier acquired file');
  });
}
test('Source local-FD simulation keeps close UNKNOWN sticky and dominant while attempting every remaining close once',async()=>{
  requireOwnedSourceContractV1();const state=sourcePrefixFixtureV1();
  state.gitBlobs.set(SOURCE_SCRIPT_V1,Buffer.from('independent mismatched retention bytes\n'));
  state.closeFaultPath=SOURCE_NODE_V1;
  const vm=await sourcePrefixRefusedV1(state,{code:'MANUAL_ORPHAN_CLEANUP_UNKNOWN'});
  state.assertReached('git','show '+SOURCE_M_SHA_V1+':'+SOURCE_SCRIPT_V1);
  const fault=state.opened.find(record=>record.path===SOURCE_NODE_V1);assert.ok(fault);
  assert.equal(state.closeAttempts.filter(fd=>fd===fault.fd).length,1,'uncertain FD is never retried');
  assert.ok(state.closeAttempts.indexOf(fault.fd)<state.closeAttempts.length-1,
    'a close fault does not prevent attempts for remaining known earlier acquisitions');
  const before=state.events.length;
  await assert.rejects(()=>vm.actual.holdManualOrphanOwnedSourcesV1(),
    error=>error instanceof Error&&error.message==='MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  assert.equal(state.events.length,before,'sticky uncertainty does not reacquire or retry any descriptor');
  state.assertClosed();vm.assertContained();
});
for(const size of [16384,16385]){
  test('owned data '+(size===16384?'accepts':'refuses')+' syntactically valid total '+size+' bytes including LF within4096-byte ProcessPin paths',()=>{
    const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame'),frame=ownedSetupData();
    // Two paths use their4096-byte maximum. The third fills the remaining plain
    // budget, and constructor quotes supply any remaining escape-byte budget.
    // Every slash-free segment remains valid ProcessPin syntax, not FS proof.
    const remaining=16384-Buffer.byteLength(OWN_SETUP_WIRE)-2*(4096-13);
    const escapes=Math.max(0,remaining-(4096-13));
    const serverBytes=13+remaining-escapes,quotes=escapes+(size-16384);
    assert.ok(serverBytes>1&&serverBytes<=4096);
    assert.ok(quotes>=0&&quotes<=4095);
    const constructorPath='/'+'"'.repeat(quotes)+'x'.repeat(4095-quotes),runnerPath='/'+'y'.repeat(4095);
    const serverPath='/'+'z'.repeat(serverBytes-1);
    frame.constructor.executable=constructorPath;frame.runner.executable=runnerPath;frame.server.executable=serverPath;
    for(const pin of [frame.constructor,frame.runner,frame.server]){
      assert.ok(Buffer.byteLength(pin.executable)<=4096);assert.ok(/^\/[xyz"]+$/.test(pin.executable));
    }
    const want=Buffer.from(OWN_SETUP_WIRE.replace('"executable":"/fixture/node"','"executable":'+JSON.stringify(constructorPath))
      .replace('"executable":"/fixture/node"','"executable":"'+runnerPath+'"')
      .replace('"executable":"/fixture/node"','"executable":'+JSON.stringify(serverPath)));
    assert.equal(want.length,size);assert.equal(want.at(-1),10);
    if(size===16384){assert.deepEqual(encode(frame),want);assert.deepEqual(decode(want),frame);}
    else{frameRefusedV1(()=>encode(frame),'total cap encoder');frameRefusedV1(()=>decode(want),'total cap decoder');}
  });
}

// Source compiled DATA only: independent Root AST manifests, no application
// Source bytes, release reads, owner/observer doubles or custody authority.
// Own M62 artifact1767db82... and fixed T artifact40bba031... were read separately.
const COMPILED_DATA_M_V1=Object.freeze([
  ["dist/cli/runtime-guard.js","ee41f24c7666ede347507fb914ab4955ec3f14b9bd2a75b934389b86c8666e1e"],
  ["dist/contracts/operational-active-run-status-v1.js","f080d9873a6ecd138ba814eb06ac2ae8865d43276eec03242094da85f264317b"],
  ["dist/db-pg.js","9eef3c2eb47da21f527f06934029e926923af27a83f1141a925f93bc8a280afd"],
  ["dist/db/artifact-publication-batch-plan-migration.js","7bcd86a68b9481c10efd5fc031a7330bc8244c71777851d7fa04505b9818cc42"],
  ["dist/db/base-schema-readonly-verifier-v1.js","05c2e3e1e654ca4ba37a5d09596c957be5ea9abb2ca9a634190e74cf8cb1a253"],
  ["dist/db/bootstrap-main-claim-handoff-v1-migration.js","28bb3f513fc6f97c632a29241c7664fbcceb7f0c14a38d8aabdd8e7558c91d2e"],
  ["dist/db/contract-spine-migration-checksum.js","30eb6ef0ebd0784cd5382552d6a4d784e4f07bceb4041d2456fd910b766222dd"],
  ["dist/db/contract-spine-migration-digests.generated.js","6fa8a2e63afda64b228fdee46f13afe706b7dbbd94d413259d9c70247c9e0230"],
  ["dist/db/contract-spine-migration-source-integrity.js","c58beb0a0d63762f321591d3dfe59de46dc2d4714616ed3631e6c044b2f14082"],
  ["dist/db/contract-spine-migrations.js","34c13f415bbb01cfd90f259def8a4c704739637f2e9e047e09fe4234ef86eb99"],
  ["dist/db/contract-spine-readonly-verifier-v1.js","fb602847e89b3c5e57eb9ad3ff577ddc1f6e0400fb4cb0064ade8f774605d0eb"],
  ["dist/db/contract-spine-runtime-access-readonly-verifier-v1.js","0beceeed623e0e5415f421dc569408072f9b07234a966020ca35ad2c6b8534e3"],
  ["dist/db/dashboard-core-readonly-profile-v2.js","e21b6c7119885bac34a545e04c31a3aa6ae09236cf915e01bd0413774894a18c"],
  ["dist/db/dashboard-core-response-v2.js","b76bf17285c958593db2852205fabbb94d30dc35a6c35e09f544203fa0041d38"],
  ["dist/db/database-wall-clock.js","284d021bdbca651ae42773b33b92d17905c5f79be44543b52acc2106e05a4339"],
  ["dist/db/operational-failure-cause-authority-v2-migration.js","d2b53ee8c2b0a5966378dd4d63522eaedd5207a7f02a8468fdbc6aab49d62cf8"],
  ["dist/db/operational-failure-cause-authority-v3-catalog.js","756d2e5f7b5557e6d2418720a59ea0c4dc1ad1d441b5eecbcaea2b7db13a76bb"],
  ["dist/db/operational-failure-cause-authority-v3-migration.js","d0db39dad287cc2aa4bbcccdaf3ecfe9d604eda299bb626378b04e883b90e481"],
  ["dist/db/ordinary-base-schema-v1.js","3751600648e5bd13c5aea273f92cbcefa6c42c8ab4313461ebf0974eae014be7"],
  ["dist/db/platform-release-store-record-ledger-v3-migration.js","63e1e170382b670349e3cd5a5507c09fa8b1b97fc202ba1340801c311c00734b"],
  ["dist/db/preparation-authority-v2-migration.js","50e14c69f9f914c5c2c3788caa88b3dc75c31d7a5811a2be8e58312605a1474a"],
  ["dist/db/public-object-owner-readonly-verifier-v1.js","7776711349d5452c4e3c4425399a4d4918fb49f7be0d94dbd19eca465f9be0cf"],
  ["dist/db/runtime-completion-manifest-authority-migration.js","837ce4b4f769005fabe0d518ea24ce0a2fbfe37f86ece13f82894b6f33fb0e83"],
  ["dist/db/v3-story-claim-runtime-binding-v1-migration.js","0c2fae3417e1f1fe9f6186817ccfff71a77e63fbaf0e72b8060210221bc40d3a"],
  ["dist/evidence/runtime-evidence-contract-v1.js","f99f74f6a8bbd7c939018dcee532802c94ba86c6d58c03e968a21cd8f84a9d97"],
  ["dist/evidence/schemas/evidence-adapter-definition-catalog-v2.js","39bf4b4e6dda85754b84749dfafd5017e136cb7c1fa64425717348014f028f26"],
  ["dist/evidence/schemas/evidence-receipt-v2.js","82aa1ac6f7b4542900b959099f3a683a885b8c646033c95a0b3351f14d3d99c0"],
  ["dist/execution/operational-failure-cause-authority-v1.js","4780a8f028aa324037c5a5e3c1e63ee7dfb5373e77fc968f931f6f18af4d5d52"],
  ["dist/execution/operational-failure-cause-authority-v2.js","1f4eab1347bcbd069625944594525a333c972c47f7a8cf9bad393f558e90fb2b"],
  ["dist/execution/operational-failure-cause-authority-v3.js","a44fabe13a2e961a4d11c1a3a9d094a82a5cdedaa6ea17e138f05342d7d9f72b"],
  ["dist/execution/process-identity.js","2086adfc29854ba701723a9aa8e4e025ea4832f0b8fd6aeaea7c9f97936f70f1"],
  ["dist/execution/recovery-source-bootstrap-repository-v1.js","74a4e1d6c41a1479a1300736fb16affc873e7606f7ea010fe125aebee5c4e25c"],
  ["dist/execution/recovery-source-bootstrap-run-authority-v1.js","518b5bd9e51d6c8e7ee16084bac80bed324059eeba1bbbb9f8cd72c1a26755b5"],
  ["dist/execution/schemas/candidate-build-receipt-v2.js","1330eea9bd9a31fffd13ba49b94571b447446968fe388139262ba837957c7a17"],
  ["dist/execution/schemas/canonical-runtime-tree-v2.js","2476035648bd3cda08b99817a4f186d035344312fc86c81b7fd24465b8ef8280"],
  ["dist/execution/schemas/execution-attempt-v1.js","fb8bfe87aa7257f4228668f2b7fed82aa1f5493cc9c2a6284e4bc53eb6d2024b"],
  ["dist/execution/schemas/operational-event-v1.js","40aac0a92450154674b99f05f921171c216d5f3a9a11471d5618ce85bc961a42"],
  ["dist/execution/schemas/operational-failure-cause-v1.js","add3e1307724e62ad153da0662528c2b8477028c7f5d35feef1064a4a4fcd40b"],
  ["dist/execution/schemas/platform-release-common-v2.js","512312ea83d788ba7d89b87bbb291b5ee4a4cfbf000cd1817a67726a4bb69652"],
  ["dist/execution/schemas/platform-release-content-store-census-v3.js","47793f16a40e260df21e00c5e7fb7f6a4d042975e4b0a401b46556cd5ac22558"],
  ["dist/execution/schemas/platform-release-content-store-durable-record-test-v3.js","82e737e2b1a9e280d3a7e78a881c30093f989393f9ffcfc7ddbdf46f34ee6256"],
  ["dist/execution/schemas/platform-release-content-store-test-v3.js","705284102d8bd05404bc46edb7f09ccf4d47e5baf52638ea5003b4476416b58e"],
  ["dist/execution/schemas/process-identity-v1.js","40b74c6c524c18b0b4f904c27ebcfe38a0bae18a5e98389b1e6b53fc61b62d5c"],
  ["dist/execution/schemas/runtime-completion-plan-v1.js","2a166fd2aa38ebd463fe955288d993460758a134a872427029f56b01e80c91e9"],
  ["dist/execution/v3-git-revision.js","125f89bc2506a5622cfd13966a24febfe996a442fdf97d5552fbe7aa889c6d65"],
  ["dist/execution/v3-preparation-claim-authority-v2.js","28d4e72b405e86b33ffa2378fa25b6baf4f754cf931468701205d4db3f5dd3de"],
  ["dist/execution/v3-seal-capacity.js","a1d480c893f83d61823ee63095b8025083859167a17c0cf731b78f3ba6180dbc"],
  ["dist/findings/finding-publication-v1.js","e3c7c23f9857a0c8d57d2187333e6ec589ad9d626e8c487b992f4a38cd5b2ab3"],
  ["dist/findings/finding-set.js","f93d702dddca40fa860784121acb13dc4378c0a078f35623dc67743c9e9d64f9"],
  ["dist/findings/legacy-finding-publication-inventory-v1.js","334499e3edf6674250895117cc9ab5e6b4a5d585c4174139b3f1d6df9a00a0d4"],
  ["dist/installation/fresh-installation-activation-verifier-v1.js","805fc0254360d3136f0e2c8aace8175ed50ab031b0d95bdf2926952d3af4daca"],
  ["dist/installation/fresh-installation-artifact-policy-v1.js","b6a66167f15879a262889650d68a7fd28525fe32e087c012d57912019776bc64"],
  ["dist/installation/fresh-installation-catalog-v1.js","8c00e3b5bff662711321910c6abe954652d2eb7dccbae47971df954a8e544a37"],
  ["dist/installation/fresh-installation-entry-v1.js","1ffc6fd43eac8d489055d0297814eee2f35e540c9af9403dba7b93e081483511"],
  ["dist/installation/fresh-installation-origin-v1.js","0603e5a37aaa7650911d65cde0fd8c7ffc1d3ddb05b61778307462b3dc7173e8"],
  ["dist/installation/fresh-installation-owner-source-v1.js","d9652e3cfc364bc11b8273e18da2e4d46bfde112bfe8ec674528556e43b11756"],
  ["dist/installation/fresh-installation-private-assets-v1.js","97b3e5893356c2e0aab83c2528982245e837c929d4707bee6f347df6d02ae772"],
  ["dist/installation/fresh-installation-records-v1.js","df39e1174ebfcd4af1d575e11495699185e078411d75b73399da99f83037d2e3"],
  ["dist/installation/fresh-installation-runtime-v1.js","82ed84c3a1db68fffed4dc1bcab81f670eec6a22b7e3bfb910be6ef91f1aec29"],
  ["dist/installation/fresh-installation-selection-v1.js","f1298d4f9120f29c0f2109dcad40b16a6a33fcd2593764d886a9077628781a34"],
  ["dist/installation/fresh-installation-source-v1.js","d6ff0adb7796b9bf35c5d1598fa824a454d8e67d46c811a649ed428eaf0e134f"],
  ["dist/installation/fresh-installation-v1.js","5df0babbe6a4a5005ac7b63e150e1fc9544e826ec755468e5cc5ac325e7a8110"],
  ["dist/internal-production/baseline-deployment-cutover-records-v1.js","d00d01ecdb87e1dbbf3a7053acad277cb43757c9956e803193661d4b567b5714"],
  ["dist/internal-production/baseline-deployment-cutover-v1.js","b6c5a46db14ece55f903058ce0b3c4da8b91cf04b951de82a1eedd06e7119444"],
  ["dist/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.js","ce72a050211c0de9cf451fa9b7bc5b2448155cfa52aeff158832cf902b2adc18"],
  ["dist/internal-production/baseline-positive-worktree-active-row-snapshot-v2.js","227d1af7a204c2020b33e15eb866bbbff81f39db1b17f62ba340bee47e388ccf"],
  ["dist/internal-production/baseline-positive-worktree-binding-rows-v1.js","7bd5b43b89631952f31a324f245f6e2533bfa76236bd21cb3118032841970453"],
  ["dist/internal-production/baseline-post-handoff-receipt-v1.js","f9c7755d2cfc69ccc250fc1da08c21b02fce8835b527fe4eb2647534392151ea"],
  ["dist/internal-production/baseline-restart-authority-retirement-v1.js","a282c7693f7a7b46fce215e562e72a77a77074581341fe20ed9b9f277a0c2549"],
  ["dist/internal-production/baseline-spawner-launch-environment-v1.js","93332c4695aef240a3f8329ee0815c82215f040df42e2c0ba2e3c7557848c7fa"],
  ["dist/internal-production/baseline-workspace-authority-path-v1.js","34c2fb8322771699ef79fe5faac7b6bd9937640dbdbf09bef58a48d8af533455"],
  ["dist/internal-production/owner-admission-head-v1.js","2ac270a1e47834785dc59c5e25c050192badb6022f4e1e1f6b17891f2f6634dd"],
  ["dist/internal-production/owner-admission-v1.js","196a6df03c7ffde9bcba99d1fd61958711973b67483d8f0180250f3a2919f708"],
  ["dist/internal-production/product-build-authority-v2-delivery-evidence-v1.js","97c541b496d0e61e03dc1ca9714d303506069ab6249c7b5f590916d4002f784d"],
  ["dist/product-compiler/artifact-capacity.js","b6af9d10b945ad0776fc5e13b2383057287e9da8cdcb15663a10e2cf60ec28a5"],
  ["dist/product-compiler/artifact-closure.js","871444369e86b6235bac8956b924a08941b7c94dfb31188e2096aed5e4c720ef"],
  ["dist/product-compiler/artifact-envelope.js","5b12a2f748357b18671006a03d5f1c5daa19fae4e9908c9451769ca511042575"],
  ["dist/product-compiler/artifact-publication-batch-identity.js","295aa3e43f2bf7b228c2860a3dcecad5b59e367747123f0942d56e55ec9eb7e4"],
  ["dist/product-compiler/artifact-publication-batch-plan-binding.js","01d133814abe7bdd0c4a486f048620289c0d0e307aa71e00359ed6ecfee36099"],
  ["dist/product-compiler/artifact-store-batch-plan.js","f35ffa8e5819854eba470893625c0cbeb7070977f0f9c887fa5300da829c6c8a"],
  ["dist/product-compiler/bounded-canonical-json.js","13bcceb0e9579cc7b4bce5189520beda031a9e149969d67e0656360e46cb5a07"],
  ["dist/product-compiler/canonical-json.js","77db0704803dc51f28e1dc4ebd56788177e1c78ce1e3a4777ddac016da6fed2a"],
  ["dist/product-compiler/english-text-contract-v1.js","51a8878a2845f13f5bea44c2fc3f0a0493495b34392a8b358ad580d37145775e"],
  ["dist/product-compiler/product-delivery-profile-catalog-v2.js","3b13816a5ff53420b275ea680b8950c7bef88ee8625f1d6a180ad0e8d2aa0832"],
  ["dist/product-compiler/product-evidence-capability-policy-v2.js","58cca3060392a27d13d18762a1b4a96aed3a7bb99f52b8e750b23cb5e7de3406"],
  ["dist/product-compiler/requirements/task-requirements-v1.js","51887feea83b22b1c3366d10691d5d8fa6ed86e6de729eb450f741b778854035"],
  ["dist/product-compiler/schemas/action-input-transport-v2.js","633b18e74c1ad7a59cc11100468060cc2549c88984d7d45f97cb1763419b854e"],
  ["dist/product-compiler/schemas/action-invocation-interface-intent-v1.js","aec37eaddaceb632b2a056e9c4ebccce3c1e62865076530ce8a45454c79211b3"],
  ["dist/product-compiler/schemas/build-topology-v1.js","98fd62bb589fb1250099a227923dc858b71d5e3961ea2f893c566aa81af27512"],
  ["dist/product-compiler/schemas/build-topology-v3.js","c33f335b0f8fb824dd1721052eac088606c57858ae5d5d1626407e889a1da80e"],
  ["dist/product-compiler/schemas/byte-bundle-v1.js","a8a474fed4b6ba752dc2e0689df3231b58170adb16e8b48541f4c51de61e2fe1"],
  ["dist/product-compiler/schemas/common-v1.js","b18670317cfc9230b6d1de2723566185a32307a9f8803ea3cd62b4c38da41a9e"],
  ["dist/product-compiler/schemas/common-v2.js","5cd7ec1565141aa44deb69093fbe2e8f53d796a5bdb242a4198ffaeacf81aad7"],
  ["dist/product-compiler/schemas/deep-byte-bundle-verification-receipt-v2.js","50a9619d9fbe11bfd998a304269b2ebfd5a84b822bd0350b5dcff7604cf12c77"],
  ["dist/product-compiler/schemas/design-generation-targets-v1.js","f290cf55741639e44226f16a5850becabb9e866d486d3cfadaf3e1e03a43ee73"],
  ["dist/product-compiler/schemas/design-interaction-graph-v2.js","50d6b3c24ee50fdad053474a8efbef6348ca29a08ee25a62dbbb7ad6f8667c86"],
  ["dist/product-compiler/schemas/design-source-closure-v2.js","f09c7a03240976fa8e0f6965611ac46882d72119b23510504ea95ac1b1258f4f"],
  ["dist/product-compiler/schemas/file-tree-manifest-v3.js","98c1208df7bd8a434640f855ac2a4dff330961019ca2c1c5432535614ee134a3"],
  ["dist/product-compiler/schemas/generated-source-contract-v2.js","4ecac14f4fbfc076b05eb9d58a97538095ad85bffdcd7209b7cdc3c42e5bea6c"],
  ["dist/product-compiler/schemas/host-node-toolchain-receipt-v2.js","d0de20bc6329e82a036ead623254b6363008e609545735081d10a6f49d8029c9"],
  ["dist/product-compiler/schemas/implementation-slice-v2-legacy.js","21c07b61190c0188c4e873da8894571cb7a1fdaaac7a392562dc3cd72bb31bbe"],
  ["dist/product-compiler/schemas/implementation-slice-v2.js","cdee5776d2a413d2f07ffafd7b5d0c7467d7718f4ecac206abba46381a1373ca"],
  ["dist/product-compiler/schemas/implementation-source-map-v1.js","71ba32372504d37aa5284494097b6a47e3a8293a7d3ad0352fb1fe71aa39538a"],
  ["dist/product-compiler/schemas/implementation-source-map-v2.js","87521ee552485512ceae6cc9d5930bfed92d5093f426267f0a45b3f082d0dc62"],
  ["dist/product-compiler/schemas/invocation-input-transport-set-v2.js","4b20943250dba676c4f6be48909daeba10f9505aaf8f44bc4c32261efe7259db"],
  ["dist/product-compiler/schemas/invocation-input-transport-v2.js","0dde39a3be69a74b44d16504b4db662b28ad80b60534e86d9fb78f05cf5ca153"],
  ["dist/product-compiler/schemas/node-execution-layout-catalog-v2.js","e6c31257559032b4d1f315420b6255bea34a60527a4a2c601406881bfd9d7d1b"],
  ["dist/product-compiler/schemas/node-product-runtime-source-v2.js","f1d45cd9c7e605dd7d4d4a34335b32f5d368ab8ad1aa68e790b622507e9526de"],
  ["dist/product-compiler/schemas/node-product-test-source-v2.js","229932c25171b5537d8dcdc337eb5ef5882041c371b528563831305f504c23c0"],
  ["dist/product-compiler/schemas/node-scaffold-execution-environment-v2.js","562939eee1b3828d2cefed1c05b15091358ebe62d10253f4e8d857f786d87eb8"],
  ["dist/product-compiler/schemas/node-scaffold-private-materialization-v2.js","1865efaa194d95ff6f24bf4024b2e384e06f10fa3fc6b73d0b72c16b7945e83d"],
  ["dist/product-compiler/schemas/node-scaffold-toolchain-catalog-v2.js","e5df8a5397ec180519f762c2f6245ee4dd43adc5f08216aca6d4c33ef366cfb8"],
  ["dist/product-compiler/schemas/node-toolchain-archive-inventory-v2.js","b26c3fa59865c81db769aeabb0a09b77374cbcb1d7cafd0c91fd8c58c031554f"],
  ["dist/product-compiler/schemas/node-toolchain-distribution-v2.js","aac6e8e8093fb1c54e708373c8148c091d6a4efda562ad3a056e2c5c33c7441d"],
  ["dist/product-compiler/schemas/node-toolchain-private-tree-v2.js","dfb00e19d885bda03f659858e878137c39abd6dc11d87b3f1b7821486d594115"],
  ["dist/product-compiler/schemas/node-toolchain-provisioning-v2.js","2541635cc0453720165073b87c55aed093c35d997d8ff231c24ae0cdffe94431"],
  ["dist/product-compiler/schemas/npm-lock-v3-grammar-v2.js","93fd98a995109d81444e569dc9fc7c2496fed39f067547bd4760aa560883bbcd"],
  ["dist/product-compiler/schemas/path-token-v2.js","20be34c71d8f22b40c26f03a8d188a6ce65f8b0f49b3a1d8954468bf5c3342a0"],
  ["dist/product-compiler/schemas/plan-semantic-proposal-v1.js","56932d70fd233b51e723e234521c2ee2fc769cc9554f79735139baa3c7345761"],
  ["dist/product-compiler/schemas/product-build-packet-v3.js","51a655cc06a9009367b240a4f35c3abfbe98a9ba2b447ab4c0998b5e1ad8f894"],
  ["dist/product-compiler/schemas/product-build-packet-v4.js","dab2d4f87fdc507da77a6ebd5c06449bb315ee4ea2d3a5cbd9e925844c8e8579"],
  ["dist/product-compiler/schemas/product-compilation-attempt-v1.js","40f7e544ae3f0cfb38692709982437a6638f8c8109b02eb561f3c7d89e21aa14"],
  ["dist/product-compiler/schemas/product-runtime-behavior-contract-v1.js","60a16067dae6a398236694607424b402b2fe99ceb94a40fddc2a581735e05340"],
  ["dist/product-compiler/schemas/product-spec-v1.js","0663d49b73f92efdcd1884d3b6bff8fd78562e173fe89c02ba32f94988228fed"],
  ["dist/product-compiler/schemas/product-spec-v2.js","998afcfa443342a5a6c5e67544b858c294ea17a75a8890540771259ad3d966cf"],
  ["dist/product-compiler/schemas/runtime-data-contract-v1.js","300bfa3fd7d8830f420d073952ed0b1c6662f54fb92814e2b90d5bcbc50470a7"],
  ["dist/product-compiler/schemas/semantic-realization-plan-v2.js","cfdcd6eaf56adb6d960fe614076b24bba3a8b942b7b4a80ec33126f54c856ee0"],
  ["dist/product-compiler/schemas/semantic-source-intent-set-v1.js","74866cae206a665806d4f1370efe6ac811f502410e4e7d1ee047cd0869a91348"],
  ["dist/product-compiler/schemas/semantic-source-path-token-set-v2.js","80ba48a97d838e84d3dfb7e42de14568859fc0861c0171ae9d1d22ceb07b1f6f"],
  ["dist/product-compiler/schemas/stack-semantic-source-rules-v1.js","fe278f28c2e1d975ff6284665868b0ac044d4c0314d4b996e34db656d7c3ac55"],
  ["dist/product-compiler/schemas/stitch-rendered-semantics-v1.js","521607daf7d538eb580d66a2c4fea366e1e5bc463bdad352678a95fd2800388a"],
  ["dist/product-compiler/schemas/stitch-rendered-semantics-v2.js","7119950bd8b8b37551f036a75628fec5f2baec0e922f630801a012ee4451f663"],
  ["dist/product-compiler/schemas/stitch-screen-index-v2.js","dc5cd689e9d58d7a5e725405dc616f30a2c2fbe4d58cc45a40c6456f262251dc"],
  ["dist/product-compiler/schemas/story-plan-v2.js","8e77b97ab60d5d2530fb94220f6360adf40df28c622c07aafc32c4500ac388dd"],
  ["dist/product-compiler/schemas/story-plan-v3.js","628c35cd15320972e83b4a437d9626b1fd07ebf6d16efb8273b30d3b3148ea82"],
  ["dist/product-compiler/stack-semantic-source-rules-catalog-v1.js","a98cb2181dd60dec0576202003524d7760f93656c4dcf6659ff6c55e2f82cc59"],
  ["dist/product-compiler/stack-topology-catalog.js","184e78198d14b21d09a9df8dbc7493cda15b0cfb4b7c594a37b87e78f145d85a"],
  ["dist/recovery/recovery-case.js","2d1541a7514be60398b0868c6600956647451223e3df78c8090c15b953d5783b"],
  ["dist/recovery/recovery-delivery.js","570b3899e5b9ee776efb1b33c1938384479e3f46aff8ce81906127e4f149f88c"],
  ["dist/recovery/v3-downstream-terminal-cause-v1.js","3df78de50615b03ba182fbe9dc16e83560aca5f5e9f4ec5b6aa2253179b1d8cf"],
  ["dist/recovery/v3-recovery-claim-authority.js","5ce0f53899ccb0313e974732ac27f3e584ae234356025c03d4545bea3f11b3c3"],
  ["dist/runtime-config.js","c7cd91c4969e07cb3caf90f16cc37f33d0dda42c68ae0c2691e62663f1a34dbe"],
  ["dist/server/dashboard-core-projection-v2.js","1c07536b7ac1e14c3fc5aaa03b551a16b55dec8424d9950413a4b186095a5289"],
].map(([locator,sha256])=>Object.freeze({locator,sha256})));
const COMPILED_DATA_T_ONLY_V1=Object.freeze([
  ["dist/installation/fresh-installation-activation-v1.js","406d7d5619510596f7109ea3e7b2f1ede09ae3c95816e48cfda85700fc4d43fb"],
  ["dist/installation/fresh-installation-artifact-bootstrap-v1.js","d91ef03109e74a0dd0651dbb4dd80a5acdf0e6cb22b3ef0964fca643a00ff243"],
  ["dist/installation/fresh-installation-mission-control-schema-v1.js","a8c451e58487b6cf348864d575bd3dace4cca94af0537b9bf96e10d3b6900fde"],
  ["dist/installation/fresh-installation-provenance-v1.js","ee5f0a01378618fc0fe4c039613404674b4f78c587c87a0e2ab60a14397b7a35"],
  ["dist/installation/fresh-installation-runtime-grants-v1.js","b59bbe34e0cd0282237ad837eebd70d27321b458bc952bac9231424c6f40f4c1"],
  ["dist/product-compiler/artifact-index.js","bdaaac0ca4174433cc311c18f3d5cfafb3bfeae4fc8ec9638030a8635c2f69c1"],
  ["dist/product-compiler/artifact-inventory-store.js","cd1fb6dd7a523d8fcf15c3bc1c2075bde918256a1ac7cb17b40da4f4e4dd749d"],
  ["dist/product-compiler/artifact-store-authority.js","016c57266c4619c8a6383ee5eda8d407cd7375b387a5c9dbf00c93dd0e44aec5"],
  ["dist/product-compiler/artifact-store.js","204e2af9b6d41462a2faf724cee849236bcd8981e7530c0f561d3c401f350457"],
  ["dist/product-compiler/indexed-artifact-publisher.js","6aa25a5930e10f92ba5e7671998e20ddb5320fa585bd16ab3c39645179cee9e5"],
].map(([locator,sha256])=>Object.freeze({locator,sha256})));
const COMPILED_DATA_T_V1=Object.freeze([...COMPILED_DATA_M_V1,...COMPILED_DATA_T_ONLY_V1]
  .sort((a,b)=>Buffer.compare(Buffer.from(a.locator),Buffer.from(b.locator))));
function compiledDataVmV1(){
  // The pure predicate needs no Node binary fixture or filesystem facts. Every
  // effect remains the same closed/counted whole-helper boundary.
  const state={root:SOURCE_M_V1,moduleURL:url.pathToFileURL(SOURCE_M_V1+SOURCE_SUFFIX_V1).href,
    fs:{constants},childProcess:{},process:{},os:{},events:[],imports:[],locators:[],unlisted:[],faults:[]};
  state.checked=fn=>(...args)=>{try{return fn(...args);}catch(error){
    if(error?.code==='ERR_ASSERTION')state.faults.push(error.message);throw error;
  }};
  state.unexpected=label=>{state.unlisted.push(label);throw Error('COMPILED_DATA_UNLISTED:'+label);};
  const vm=sourcePrefixVmV1(state);
  assert.equal(typeof vm.compiledDataAdmission,'function','missing private contract: ownedSourceAuditedCompiledV1');
  return {vm,state};
}
function compiledManifestCopyV1(kind){
  return (kind==='maintenance'?COMPILED_DATA_M_V1:COMPILED_DATA_T_V1).map(row=>({...row}));
}
function assertCompiledDataOutcomeV1(manifest,kind,approved){
  const {vm,state}=compiledDataVmV1();
  if(approved)assert.equal(vm.compiledDataAdmission(manifest,kind),undefined);
  else ownerRefusedV1(()=>vm.compiledDataAdmission(manifest,kind),'finite compiled data admission');
  assert.deepEqual(state.events,[],'data predicate performs no IO or phase work');
  assert.deepEqual(state.imports,[],'data predicate imports no target');
  assert.deepEqual(state.locators,[],'data predicate derives no owner context');vm.assertContained();
}
test('Source compiled DATA-admission simulation accepts the independent approved M143 manifest',()=>{
  const manifest=compiledManifestCopyV1('maintenance');
  assert.equal(manifest.length,143);
  assert.equal(createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    'ec4d076a604601dff3618b4f7c54e8924d1d33b2b9177ac216aecce7e598a8de');
  assertCompiledDataOutcomeV1(manifest,'maintenance',true);
});
test('Source compiled DATA-admission simulation accepts the independent approved T153 manifest',()=>{
  const manifest=compiledManifestCopyV1('target');
  assert.equal(manifest.length,153);
  assert.equal(createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    'ef3696ca8b4cfcd387eb3cc77000a13781fde1cb17da9550abe2b88ed7656d2b');
  assertCompiledDataOutcomeV1(manifest,'target',true);
});
test('Source compiled DATA-admission simulation refuses one changed M byte hash',()=>{
  const manifest=compiledManifestCopyV1('maintenance');manifest[0].sha256='0'.repeat(64);
  assertCompiledDataOutcomeV1(manifest,'maintenance',false);
});
test('Source compiled DATA-admission simulation refuses one changed T-only byte hash',()=>{
  const manifest=compiledManifestCopyV1('target');
  manifest.find(row=>row.locator==='dist/installation/fresh-installation-activation-v1.js').sha256='0'.repeat(64);
  assertCompiledDataOutcomeV1(manifest,'target',false);
});
test('Source compiled DATA-admission simulation refuses one omitted M record',()=>{
  const manifest=compiledManifestCopyV1('maintenance');manifest.shift();
  assertCompiledDataOutcomeV1(manifest,'maintenance',false);
});
test('Source compiled DATA-admission simulation refuses one duplicate T record',()=>{
  const manifest=compiledManifestCopyV1('target');manifest.push({...manifest[0]});
  assertCompiledDataOutcomeV1(manifest,'target',false);
});
test('Source compiled DATA-admission simulation refuses one extra M record',()=>{
  const manifest=compiledManifestCopyV1('maintenance');
  manifest.push({locator:'dist/unadmitted-compiled-data-fixture-v1.js',sha256:'a'.repeat(64)});
  assertCompiledDataOutcomeV1(manifest,'maintenance',false);
});
test('Source compiled DATA-admission simulation refuses the T manifest crossed into M admission',()=>{
  assertCompiledDataOutcomeV1(compiledManifestCopyV1('target'),'maintenance',false);
});

// Task3 transport contracts. Every callback gates both future APIs BEFORE any
// contained evaluation or native work. These are DATA witnesses, never owners.
function task3ContractsV1(actual=helper){
  assert.equal(typeof actual?.observeManualOrphanOwnedChildV1,'function','missing Task3 observeManualOrphanOwnedChildV1');
  assert.equal(typeof actual?.readManualOrphanOwnedFd4V1,'function','missing Task3 readManualOrphanOwnedFd4V1');
}
const TASK3_PURPOSES_V1=[
  ['initdb',60000,262144,false],['server',960000,262144,false],['runner',840000,262144,true],
  ['provision',300000,262144,true],['activate',180000,262144,true],['integration',300000,1048576,true],
  ['old_entry_positive',120000,262144,true],['new_entry_refusal',120000,262144,true],
];
function task3ClockV1(check=()=>{}){
  const state={ms:0,accesses:0,calls:0,mode:null,faults:[]};
  const access=()=>{state.accesses++;check();if(state.mode==='accessor')throw Error('PRIVATE_CLOCK_ACCESS');};
  const read=()=>{state.calls++;check();if(state.mode==='throw')throw Error('PRIVATE_CLOCK_CALL');
    return state.mode==='invalid'?NaN:state.ms;};
  const hrtime={};Object.defineProperty(hrtime,'bigint',{get(){access();return ()=>{
    const value=read();return Number.isFinite(value)?BigInt(Math.trunc(value*1000000)):undefined;
  };}});
  return {state,hrtime};
}
function task3VmV1(bindings={},check){
  const monotonic=bindings.monotonic??task3ClockV1(check);
  const processBinding=bindings.process??{};processBinding.hrtime=monotonic.hrtime;
  const vm=fixedProbeVmV1({...bindings,process:processBinding},bindings.expose===true);
  return {...vm,monotonic};
}
function task3EventFixtureV1(purpose='provision'){
  const f=eventFixtureV1();if(purpose==='initdb'||purpose==='server')f.bindings.stdio[4]=null;return f;
}
function task3CompleteV1(f,purpose='provision',code=0){
  for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
  if(purpose!=='initdb'&&purpose!=='server'){
    f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.channels.fd4.emit('close');
  }
  f.child.emit('exit',code,null);f.child.emit('close',code,null);
}
function task3FrozenV1(snapshot){
  assert.deepEqual(Object.keys(snapshot),['purpose','state','exit','close','stdout','stderr','fd4','reason']);
  for(const value of Object.values(snapshot))if(value!==null&&typeof value==='object')assert.equal(Object.isFrozen(value),true);
  assert.equal(Object.isFrozen(snapshot),true);
}
async function task3UnknownV1(w,reason){
  const now=w.snapshot();assert.equal(now.state,'unknown');assert.equal(now.reason,reason);task3FrozenV1(now);
  const first=await w.settled;assert.equal(first.state,'unknown');assert.equal(first.reason,reason);return first;
}
function task3AllBoundV1(f){
  for(const name of ['spawn','error','exit','close'])assert.ok(f.child.listenerCount(name)>0,'original '+name);
  for(const name of ['stdout','stderr','fd4'])if(name!=='fd4'||f.bindings.stdio[4]){
    for(const event of name==='fd4'?['data','error','finish','end','close']:['data','error','end','close'])
      assert.ok(f.channels[name].listenerCount(event)>0,name+'.'+event+' before clock');
  }
}
async function task3EventV1(body,purpose='provision',prepare){
  task3ContractsV1();const f=task3EventFixtureV1(purpose);if(prepare)prepare(f);
  const vm=task3VmV1(),w=vm.actual.observeManualOrphanOwnedChildV1(f.child,purpose);
  try{return await body(f,w,vm);}finally{
    if(w.snapshot().state==='pending')f.child.emit('error',Error('SIMULATED_COMPONENT_END'));
    f.assertGuarded();vm.assertContained();
  }
}
const task3WireV1=purpose=>Buffer.from(OWN_CASES.find(row=>row[0]===({integration:'integration phase',provision:'provision phase',
  activate:'activate phase',old_entry_positive:'old positive phase',new_entry_refusal:'new refusal phase'}[purpose]))[3]);
function task3ReaderV1(options={}){
  task3ContractsV1();const f=probeReaderFixtureV1(options),vm=task3VmV1({...f,fs:{...f.fs,
    fstatSync:(...args)=>f.fs.fstatSync(...args),closeSync:(...args)=>f.fs.closeSync(...args)}});
  f.task3Vm=vm;return {f,vm};
}
function task3FinishReadV1(f,bytes,{eof=true,hadError=false}={}){
  if(bytes!==undefined)f.ledger.socket.emit('data',bytes);
  if(eof)f.ledger.socket.emit('end');f.ledger.closed=true;f.ledger.socket.emit('close',hadError);
}
function task3IoV1(f){return {fstats:f.ledger.fstats.length,constructs:f.ledger.constructs.length,
  closes:f.ledger.rawCloses.length,destroys:f.ledger.destroys,
  clock:f.task3Vm?{calls:f.task3Vm.monotonic.state.calls,accesses:f.task3Vm.monotonic.state.accesses,
    timers:f.task3Vm.timers.length,cleared:f.task3Vm.cleared.length}:null,
  listeners:f.ledger.socket?.eventNames().map(name=>[name,f.ledger.socket.listenerCount(name)])??[]};}
function task3FrozenDataV1(data){
  if(data===null||typeof data!=='object')return;
  assert.equal(Object.isFrozen(data),true);for(const child of Object.values(data))task3FrozenDataV1(child);
}

// A:4 registrations. Breaks caught: absent APIs, widened argument surfaces,
// mutable diagnostics and module-init transport effects.
test('Task3 A observer API exists with exact public arity',()=>{task3ContractsV1();
  assert.equal(helper.observeManualOrphanOwnedChildV1.length,2);const vm=task3VmV1();
  const w=vm.actual.observeManualOrphanOwnedChildV1();assert.equal(w.snapshot().purpose,null);
  assert.equal(w.snapshot().state,'unknown');assert.equal(w.snapshot().reason,'purpose');vm.assertContained();
});
test('Task3 A reader API exists with exact public arity',()=>{task3ContractsV1();assert.equal(helper.readManualOrphanOwnedFd4V1.length,1);});
test('Task3 A exact copied frozen witness surface retains no mutable output',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w,vm)=>{
    assert.equal(Object.isFrozen(w),true);assert.deepEqual(Object.keys(w).sort(),['output','settled','snapshot']);
    const before=w.snapshot();task3FrozenV1(before);assert.equal(before.purpose,'provision');assert.equal(before.state,'pending');
    f.channels.stdout.emit('data',Buffer.from('bounded diagnostic'));const out=w.output();out.stdout.fill(0);
    assert.deepEqual(w.output().stdout,Buffer.from('bounded diagnostic'));assert.equal(before.stdout.bytes,0);
    assert.notEqual(w.snapshot(),before);task3CompleteV1(f);assert.equal((await w.settled).state,'observed');
    assert.equal(vm.timers.length,1);
  });
});
test('Task3 A actual complete helper module initialization has no clock timer or IO',()=>{task3ContractsV1();
  const vm=task3VmV1();task3ContractsV1(vm.actual);
  assert.equal(vm.monotonic.state.calls,0);assert.equal(vm.monotonic.state.accesses,0);assert.deepEqual(vm.timers,[]);vm.assertContained();
});
// B:8 literal purpose profiles; byte+deadline checks belong to each actual wrapper.
for(const [purpose,deadline,cap,fd] of TASK3_PURPOSES_V1){
  test('Task3 B '+purpose+' uses bounded profile and complete natural lifecycle',async()=>{task3ContractsV1();
    await task3EventV1(async(f,w,vm)=>{
      assert.equal(vm.timers.length,1);assert.equal(vm.timers[0].delay,deadline);
      assert.deepEqual(observedDataV1(w.snapshot().fd4),fd?{finish:false,end:false,close:false}:null);
      const bytes=Buffer.alloc(cap,0x61);f.channels.stdout.emit('data',bytes);
      assert.equal(w.snapshot().state,'pending');assert.equal(w.output().stdout.length,65536);
      task3CompleteV1(f,purpose);const first=await w.settled;task3FrozenV1(first);
      assert.equal(first.state,'observed');assert.equal(first.stdout.bytes,cap);
      assert.equal(first.stdout.sha256,createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual(observedDataV1(first.fd4),fd?{finish:true,end:true,close:true}:null);
      assert.deepEqual(vm.cleared,[vm.timers[0].handle]);
      const overflow=task3EventFixtureV1(purpose),other=vm.actual.observeManualOrphanOwnedChildV1(overflow.child,purpose);
      overflow.channels.stdout.emit('data',Buffer.alloc(cap+1,0x62));await task3UnknownV1(other,'limit');
      assert.equal(other.output().stdout.length,65536);task3CompleteV1(overflow,purpose);overflow.assertGuarded();
    },purpose);
  });
}
// C:18 explicit rows: throwing access/binding and duplicate end/close each get
// independent subrows so an earlier unrelated fault cannot mask their predicate.
const TASK3_EVENTS_V1=[
  ['exit only',f=>f.child.emit('exit',0,null),null],
  ['close before exit',f=>f.child.emit('close',0,null),'exit-close'],
  ['duplicate exit',f=>{f.child.emit('exit',0,null);f.child.emit('exit',0,null);},'exit-close'],
  ['duplicate close',f=>{f.child.emit('exit',0,null);f.child.emit('close',0,null);f.child.emit('close',0,null);},'exit-close'],
  ['disagreeing close',f=>{f.child.emit('exit',0,null);f.child.emit('close',1,null);},'exit-close'],
  ['signal termination',f=>f.child.emit('exit',null,'SIGTERM'),'exit-close'],
  ['spawn error',f=>f.child.emit('error',Error('PRIVATE_DETAIL')),'spawn-error'],
  ['later child error',f=>{f.child.emit('spawn');f.child.emit('error',Error('PRIVATE_DETAIL'));},'child-error'],
  ['duplicate spawn',f=>{f.child.emit('spawn');f.child.emit('spawn');},'binding'],
  ['missing stdout',()=>{},'stdout',f=>{f.bindings.stdout=null;f.bindings.stdio[1]=null;}],
  ['missing required4',()=>{},'fd4',f=>{f.bindings.stdio[4]=null;}],
  ['unexpected4',()=>{},'binding',f=>{f.bindings.stdio[4]=f.channels.fd4;},'initdb'],
  ['throwing channel binding',()=>{},'binding',f=>{f.channels.stdout.on=()=>{throw Error('PRIVATE_BINDING');};}],
  ['throwing channel access',()=>{},'binding',f=>{f.child=new Proxy(f.child,{get(target,key,receiver){
    if(key==='stdout'){f.inspections.push('stdout');throw Error('PRIVATE_ACCESS');}return Reflect.get(target,key,receiver);
  }});}],
  ['post EOF data',f=>{f.channels.stdout.emit('end');f.channels.stdout.emit('data',Buffer.from('late'));},'stdout'],
  ['close without EOF',f=>f.channels.stderr.emit('close'),'stderr'],
  ['output duplicate end',f=>{f.channels.stdout.emit('end');f.channels.stdout.emit('end');},'stdout'],
  ['output duplicate close',f=>{f.channels.stderr.emit('end');f.channels.stderr.emit('close');f.channels.stderr.emit('close');},'stderr'],
];
for(const [label,emit,reason,prepare,purpose='provision'] of TASK3_EVENTS_V1){
  test('Task3 C '+label+' preserves facts and drains independent channels',async()=>{task3ContractsV1();
    await task3EventV1(async(f,w)=>{
      emit(f);if(reason)await task3UnknownV1(w,reason);else assert.equal(w.snapshot().state,'pending');
      assert.ok(f.channels.stderr.listenerCount('data')>0);
      if(f.bindings.stdio[4])assert.ok(f.channels.fd4.listenerCount('error')>0);
      f.channels.stderr.emit('data',Buffer.from('independent'));assert.equal(w.snapshot().stderr.bytes,11);
      assert.equal(JSON.stringify(w.snapshot()).includes('PRIVATE_'),false);
      if(reason){const first=await w.settled;f.child.emit('error',Error('later'));assert.equal(w.snapshot().reason,reason);assert.equal(await w.settled,first);}
    },purpose,prepare);
  });
}
// D:9 registrations: two omissions, two premature closes, error, inbound data,
// and independent duplicate finish/end/close rows.
const TASK3_FD_V1=[
  ['missing finish',s=>{s.emit('end');},null],['missing end',s=>{s.emit('finish');},null],
  ['close before finish',s=>{s.emit('end');s.emit('close');},'fd4'],
  ['close before end',s=>{s.emit('finish');s.emit('close');},'fd4'],
  ['writer error',s=>s.emit('error',Error('PRIVATE_WRITER')),'fd4'],
  ['inbound data',s=>s.emit('data',Buffer.from('inbound')),'fd4'],
  ['duplicate finish',s=>{s.emit('finish');s.emit('finish');},'fd4'],
  ['duplicate end',s=>{s.emit('end');s.emit('end');},'fd4'],
  ['duplicate close',s=>{s.emit('finish');s.emit('end');s.emit('close');s.emit('close');},'fd4'],
];
for(const [label,emit,reason] of TASK3_FD_V1){
  test('Task3 D '+label+' never invents writer closure or operates foreign handles',async()=>{task3ContractsV1();
    await task3EventV1(async(f,w)=>{
      emit(f.channels.fd4);if(reason)await task3UnknownV1(w,reason);else{
        for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
        f.child.emit('exit',0,null);f.child.emit('close',0,null);assert.equal(w.snapshot().state,'pending');
        assert.equal(w.snapshot().fd4[label==='missing finish'?'finish':'end'],false);
      }
    });
  });
}
// E:11 registrations.
for(const [purpose,size,state] of [['provision',262144,'observed'],['provision',262145,'unknown'],
  ['integration',1048576,'observed'],['integration',1048577,'unknown']]){
  test('Task3 E '+purpose+' '+size+' byte boundary counts full stream with64KiB copy',async()=>{task3ContractsV1();
    await task3EventV1(async(f,w)=>{
      const bytes=Buffer.alloc(size,0x72);f.channels.stdout.emit('data',bytes);task3CompleteV1(f,purpose);
      assert.equal((await w.settled).state,state);assert.equal(w.snapshot().stdout.bytes,size);
      assert.equal(w.snapshot().stdout.sha256,createHash('sha256').update(bytes).digest('hex'));
      assert.deepEqual(w.output().stdout,bytes.subarray(0,65536));if(state==='unknown')assert.equal(w.snapshot().reason,'limit');
    },purpose);
  });
}
test('Task3 E independent channel budgets do not combine',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w)=>{for(const name of ['stdout','stderr'])f.channels[name].emit('data',Buffer.alloc(262144,0x61));
    task3CompleteV1(f);assert.equal((await w.settled).state,'observed');assert.equal(w.snapshot().stderr.bytes,262144);});
});
test('Task3 E overflow keeps draining full count digest and immutable first history',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w)=>{
    const bytes=Buffer.alloc(262145,0x62);f.channels.stdout.emit('data',bytes);const first=await task3UnknownV1(w,'limit');
    f.channels.stdout.emit('data',Buffer.from('tail'));assert.equal(first.stdout.bytes,262145);assert.equal(w.snapshot().stdout.bytes,262149);
    assert.equal(w.snapshot().stdout.sha256,createHash('sha256').update(bytes).update('tail').digest('hex'));assert.equal(w.output().stdout.length,65536);
  });
});
test('Task3 E complete nonzero exit is observed refusal DATA',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w)=>{task3CompleteV1(f,'provision',1);assert.equal((await w.settled).state,'observed');
    assert.deepEqual(observedDataV1(w.snapshot().exit),{code:1,signal:null});assert.deepEqual(observedDataV1(w.snapshot().close),{code:1,signal:null});});
});
test('Task3 E first observed history never masks current late uncertainty',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w)=>{task3CompleteV1(f);const first=await w.settled;f.channels.stderr.emit('error',Error('late'));
    assert.equal(first.state,'observed');assert.equal(w.snapshot().state,'unknown');assert.equal(w.snapshot().reason,'stderr');assert.equal(await w.settled,first);});
});
test('Task3 E timer with absent close remains unknown after natural late close',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w,vm)=>{f.child.emit('exit',0,null);vm.timers[0].callback();const first=await task3UnknownV1(w,'deadline');
    f.child.emit('close',0,null);assert.equal(first.close,null);assert.equal(w.snapshot().reason,'deadline');assert.deepEqual(observedDataV1(w.snapshot().close),{code:0,signal:null});});
});
test('Task3 E elapsed overrun without timer callback is deadline uncertainty',async()=>{task3ContractsV1();
  await task3EventV1(async(_f,w,vm)=>{vm.monotonic.state.ms=300000;await task3UnknownV1(w,'deadline');});
});
test('Task3 E timely completion survives later ordinary clock passage',async()=>{task3ContractsV1();
  await task3EventV1(async(f,w,vm)=>{task3CompleteV1(f);const first=await w.settled;vm.monotonic.state.ms=600000;
    assert.equal(w.snapshot().state,'observed');assert.equal(await w.settled,first);assert.equal(w.output().stdout.length,0);});
});

// F:10 allowlist registrations (the helper-purpose refusal category expands4).
const TASK3_ROLES_V1=[
  ['runner setup','runner',()=>Buffer.from(OWN_SETUP_WIRE),ownedSetupData,null],
  ['integration phase','integration',()=>task3WireV1('integration'),()=>ownedPhaseData('integration'),null],
  ['runner rejects integration','runner',()=>task3WireV1('integration'),null,'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['integration rejects setup','integration',()=>Buffer.from(OWN_SETUP_WIRE),null,'MANUAL_ORPHAN_FRAME_REFUSED'],
  ...['provision','activate','old_entry_positive','new_entry_refusal'].map(purpose=>[
    'integration rejects '+purpose,'integration',()=>task3WireV1(purpose),null,'MANUAL_ORPHAN_FRAME_REFUSED']),
];
for(const [label,role,bytes,data,error] of TASK3_ROLES_V1){
  test('Task3 F actual role decoder '+label,async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1(role));
    task3FinishReadV1(f,bytes());
    if(error)await assertProbeRejectedV1(t,error);else{
      const result=await t.done;assert.equal(result.error,undefined);assert.deepEqual(observedDataV1(result.value),data());task3FrozenDataV1(result.value);
      assert.equal(Buffer.isBuffer(result.value),false);assert.equal(Object.hasOwn(result.value,'close'),false);
    }
    assert.deepEqual(f.ledger.fstats,[4]);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
  });
}
test('Task3 F invalid receiver table consumes one raw claim without inspecting caller',async()=>{task3ContractsV1();
  let traps=0;const proxy=new Proxy({},{get(){traps++;throw Error('PRIVATE_PROXY');},ownKeys(){traps++;throw Error('PRIVATE_PROXY');}});
  for(const args of [[],['runner','extra'],[undefined],[null],[proxy],['unknown']]){
    const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1(...args));
    await assertProbeRejectedV1(t,'MANUAL_ORPHAN_FRAME_REFUSED');assert.deepEqual(f.ledger.rawCloses,[4]);
    assert.deepEqual(f.ledger.constructs,[]);assert.deepEqual(f.ledger.fstats,[]);vm.assertContained();
    const before=task3IoV1(f);
    await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner')),'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(task3IoV1(f),before);vm.assertContained();
  }
  assert.equal(traps,0);
});
test('Task3 F canonical returned data is detached and recursively frozen',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),bytes=Buffer.from(OWN_SETUP_WIRE),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  task3FinishReadV1(f,bytes);const result=await t.done;assert.equal(result.error,undefined);bytes.fill(0);
  task3FrozenDataV1(result.value);assert.deepEqual(observedDataV1(result.value),ownedSetupData());vm.assertContained();
});
// G: transport is driven through the complete owned reader, never a copy of its
// decoder/close machine. All missing-close and faulty-close tests are simulated.
for(const kind of ['fifo','socket']){
  test('Task3 G '+kind+' waits for actual EOF and close before canonical DATA',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1({kind}),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));f.ledger.socket.emit('end');await Promise.resolve();
    assert.equal(t.outcome,null);assert.equal(f.ledger.destroys,1);assert.equal(vm.timers[0].delay,5000);
    f.ledger.closed=true;f.ledger.socket.emit('close',false);assert.deepEqual(observedDataV1((await t.done).value),ownedSetupData());vm.assertContained();
  });
}
test('Task3 G exact16KiB fragmented canonical owned frame is accepted',async()=>{task3ContractsV1();
  const data=ownedSetupData();
  // Only inert fixture padding: three bounded path fields, no codec algorithm.
  for(const name of ['constructor','runner','server']){
    const need=16384-Buffer.byteLength(JSON.stringify(data)+'\n');
    if(need>0){
      data[name].executable+='"'.repeat(Math.min(4096-data[name].executable.length,Math.floor(need/2)));
      if(Buffer.byteLength(JSON.stringify(data)+'\n')<16384&&data[name].executable.length<4096)data[name].executable+='x';
    }
  }
  const bytes=Buffer.from(JSON.stringify(data)+'\n');assert.equal(bytes.length,16384);
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',bytes.subarray(0,8000));f.ledger.socket.emit('data',bytes.subarray(8000));
  task3FinishReadV1(f);assert.deepEqual(observedDataV1((await t.done).value),data);vm.assertContained();
});
const TASK3_MALFORMED_V1=[
  ['aggregate16385',()=>Buffer.alloc(16385,0x20)],['invalid UTF8',()=>Buffer.from([0xff,0x0a])],
  ['missing LF',()=>Buffer.from(OWN_SETUP_WIRE.slice(0,-1))],['empty EOF',()=>Buffer.alloc(0)],
  ['duplicate key',()=>Buffer.from(OWN_SETUP_WIRE.replace('{"schema":','{"run":"'+OWN_C+'","schema":'))],
  ['noncanonical bytes',()=>Buffer.from(' '+OWN_SETUP_WIRE)],
];
for(const [label,bytes] of TASK3_MALFORMED_V1){
  test('Task3 G '+label+' refuses only after actual adopted close',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    f.ledger.socket.emit('data',bytes());f.ledger.socket.emit('end');await Promise.resolve();assert.equal(t.outcome,null);
    f.ledger.closed=true;f.ledger.socket.emit('close',false);await assertProbeRejectedV1(t,'MANUAL_ORPHAN_FRAME_REFUSED');
    assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
  });
}
test('Task3 G actual close without EOF is cleanup unknown',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE),{eof:false});await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');vm.assertContained();
});
test('Task3 G overflow then actual close refuses FRAME without invented EOF',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',Buffer.alloc(16385));await Promise.resolve();assert.equal(t.outcome,null);
  task3FinishReadV1(f,undefined,{eof:false});await assertProbeRejectedV1(t,'MANUAL_ORPHAN_FRAME_REFUSED');vm.assertContained();
});
for(const label of ['read error','hadError close','frame fault then read error']){
  test('Task3 G '+label+' cleanup uncertainty dominates frame refusal',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    if(label==='frame fault then read error')f.ledger.socket.emit('data',Buffer.alloc(16385));
    else f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));
    if(label!=='hadError close')f.ledger.socket.emit('error',Error('PRIVATE_READ'));
    await Promise.resolve();assert.equal(t.outcome,null);task3FinishReadV1(f,undefined,{hadError:label==='hadError close'});
    await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
  });
}
test('Task3 G deadline requires actual close and never fabricates EOF',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));assert.equal(vm.timers[0].delay,5000);vm.timers[0].callback();
  await Promise.resolve();assert.equal(t.outcome,null);assert.equal(f.ledger.destroys,1);
  task3FinishReadV1(f,undefined,{eof:false});await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');vm.assertContained();
});
test('Task3 G simulated forever missing close remains retained pending after timeout',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));f.ledger.socket.emit('end');vm.timers[0].callback();
  await Promise.resolve();await Promise.resolve();assert.equal(t.outcome,null);assert.equal(f.ledger.closed,false);
  assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
});
for(const [label,options,error] of [
  ['wrong FD kind',{kind:'file'},'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['fstat uncertainty',{fstatError:true},'MANUAL_ORPHAN_CLEANUP_UNKNOWN'],
  ['raw close failure',{kind:'file',rawCloseError:true},'MANUAL_ORPHAN_CLEANUP_UNKNOWN'],
  ['constructor failure',{constructorError:true},'MANUAL_ORPHAN_CLEANUP_UNKNOWN'],
  ['constructor and raw close failure',{constructorError:true,rawCloseError:true},'MANUAL_ORPHAN_CLEANUP_UNKNOWN'],
]){
  test('Task3 G '+label+' uses exactly one raw close before adoption',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(options),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    await assertProbeRejectedV1(t,error);assert.deepEqual(f.ledger.rawCloses,[4]);assert.equal(f.ledger.adopted,false);vm.assertContained();
  });
}
test('Task3 G destroy throw retains adopted close obligation and unknown precedence',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1({destroyError:true}),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));f.ledger.socket.emit('end');await Promise.resolve();assert.equal(t.outcome,null);
  task3FinishReadV1(f,undefined,{eof:false});await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
});
test('Task3 G synchronous destroy close then throw cannot resolve valid DATA',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.destroy=function(){f.ledger.destroys++;f.ledger.closed=true;this.emit('close',false);throw Error('PRIVATE_AFTER_CLOSE');};
  f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));f.ledger.socket.emit('end');
  await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.equal(f.ledger.destroys,1);assert.deepEqual(f.ledger.rawCloses,[]);vm.assertContained();
});
test('Task3 G elapsed deadline at actual close dominates otherwise valid canonical bytes',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),t=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  f.ledger.socket.emit('data',Buffer.from(OWN_SETUP_WIRE));f.ledger.socket.emit('end');vm.monotonic.state.ms=5000;
  f.ledger.closed=true;f.ledger.socket.emit('close',false);await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');vm.assertContained();
  // One bounded subcase consumes the entire interval inside fstat. A clock
  // origin obtained after that fallible prelude must not earn canonical DATA.
  const slow=probeReaderFixtureV1(),clock=task3ClockV1(),faults=[],stat=slow.fs.fstatSync;
  slow.fs.fstatSync=(...args)=>{
    try{assert.ok(clock.state.calls>0,'owned reader origin precedes fstat');}catch(error){faults.push(error.message);throw error;}
    clock.state.ms=5000;return stat(...args);
  };
  const vm2=task3VmV1({...slow,monotonic:clock}),second=trackProbePromiseV1(vm2.actual.readManualOrphanOwnedFd4V1('runner'));
  if(slow.ledger.socket)task3FinishReadV1(slow,Buffer.from(OWN_SETUP_WIRE));
  await assertProbeRejectedV1(second,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.deepEqual(faults,[]);
  if(slow.ledger.adopted)assert.deepEqual(slow.ledger.rawCloses,[]);else assert.deepEqual(slow.ledger.rawCloses,[4]);vm2.assertContained();
});

// Addendum1–2: private inherited4 reservation, fresh contained module per
// independent case. Repeats must neither receive first DATA nor operate fd4.
for(const [firstRole,nextRole] of [['runner','runner'],['runner','integration'],['integration','runner']]){
  test('Task3 R concurrent '+firstRole+' then '+nextRole+' has one claim and independent outcomes',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(),firstRaw=vm.actual.readManualOrphanOwnedFd4V1(firstRole),first=trackProbePromiseV1(firstRaw),before=task3IoV1(f);
    const nextRaw=vm.actual.readManualOrphanOwnedFd4V1(nextRole),next=trackProbePromiseV1(nextRaw);assert.notEqual(firstRaw,nextRaw);
    await assertProbeRejectedV1(next,'MANUAL_ORPHAN_OWNER_REFUSED');assert.deepEqual(task3IoV1(f),before);assert.equal(first.outcome,null);
    const bytes=firstRole==='runner'?Buffer.from(OWN_SETUP_WIRE):task3WireV1('integration');
    f.ledger.socket.emit('data',bytes);f.ledger.socket.emit('end');await Promise.resolve();assert.equal(first.outcome,null);
    f.ledger.closed=true;f.ledger.socket.emit('close',false);assert.equal((await first.done).error,undefined);vm.assertContained();
  });
}
function task3SentinelV1(f){
  const hits=[];f.fs.fstatSync=()=>{hits.push('fstat');throw Error('REUSED4_SENTINEL');};
  f.fs.closeSync=()=>{hits.push('close');throw Error('REUSED4_SENTINEL');};
  f.net.Socket=class{constructor(){hits.push('adopt');throw Error('REUSED4_SENTINEL');}};
  return hits;
}
test('Task3 R known successful first read never reopens a simulated replacement4',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),first=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));const result=await first.done;assert.equal(result.error,undefined);
  const before=task3IoV1(f),hits=task3SentinelV1(f);
  await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('integration')),'MANUAL_ORPHAN_OWNER_REFUSED');
  assert.deepEqual(hits,[]);assert.deepEqual(task3IoV1(f),before);assert.deepEqual(observedDataV1(result.value),ownedSetupData());vm.assertContained();
});
for(const [label,options,args,error] of [
  ['FRAME',{},['runner'],'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['definite wrong FD',{kind:'file'},['runner'],'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['invalid first role',{},['invalid'],'MANUAL_ORPHAN_FRAME_REFUSED'],
]){
  test('Task3 R repeat after known '+label+' cannot inspect replacement4',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(options),first=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1(...args));
    if(label==='FRAME')task3FinishReadV1(f,Buffer.from([0xff,0x0a]));await assertProbeRejectedV1(first,error);
    const before=task3IoV1(f),hits=task3SentinelV1(f);
    await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner')),'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(hits,[]);assert.deepEqual(task3IoV1(f),before);vm.assertContained();
  });
}
for(const [label,options] of [['raw close failure',{kind:'file',rawCloseError:true}],['constructor uncertainty',{constructorError:true}],
  ['adopted read error',{}],['deadline uncertainty',{}]]){
  test('Task3 R repeat after '+label+' is UNKNOWN with no second cleanup',async()=>{task3ContractsV1();
    const {f,vm}=task3ReaderV1(options),first=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    if(label==='adopted read error')f.ledger.socket.emit('error',Error('PRIVATE_READ'));
    if(label==='deadline uncertainty')vm.timers[0].callback();
    const before=task3IoV1(f);
    await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('integration')),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.deepEqual(task3IoV1(f),before);
    if(f.ledger.adopted){assert.equal(first.outcome,null);task3FinishReadV1(f,undefined,{eof:false});}
    await assertProbeRejectedV1(first,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');vm.assertContained();
  });
}
test('Task3 R before then after uncertainty is OWNER then UNKNOWN and first stays retained',async()=>{task3ContractsV1();
  const {f,vm}=task3ReaderV1(),first=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
  await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner')),'MANUAL_ORPHAN_OWNER_REFUSED');
  assert.equal(first.outcome,null);f.ledger.socket.emit('error',Error('PRIVATE_FIRST_UNKNOWN'));const before=task3IoV1(f);
  await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner')),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  assert.equal(first.outcome,null,'no actual first close; simulated obligation remains pending');assert.deepEqual(task3IoV1(f),before);vm.assertContained();
});
for(const boundary of ['fstat','constructor']){
  test('Task3 R reentrant '+boundary+' sees already reserved inherited4',async()=>{task3ContractsV1();
    const f=probeReaderFixtureV1();let vm,reentered=null,count=0;
    if(boundary==='fstat'){
      const original=f.fs.fstatSync;f.fs.fstatSync=(...args)=>{count++;if(count===1)reentered=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('integration'));return original(...args);};
    }else{
      const Original=f.net.Socket;f.net.Socket=class extends Original{constructor(...args){count++;if(count===1)reentered=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('integration'));super(...args);}};
    }
    vm=task3VmV1(f);const first=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    assert.ok(reentered);await assertProbeRejectedV1(reentered,'MANUAL_ORPHAN_OWNER_REFUSED');assert.equal(count,1);
    task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));assert.equal((await first.done).error,undefined);vm.assertContained();
  });
}
test('Task3 R legacy public reader preserves arity mapping timeout and closure policy',async()=>{task3ContractsV1();
  const f=probeReaderFixtureV1(),vm=task3VmV1(f);
  assert.equal(vm.actual.readManualOrphanProbeFd4V1.length,0);
  const first=trackProbePromiseV1(vm.actual.readManualOrphanProbeFd4V1());assert.equal(vm.timers[0].delay,5000);
  task3FinishReadV1(f,Buffer.from(CODEC_EXPECTED_V1));assert.deepEqual(observedDataV1((await first.done).value),codecFrameV1());vm.assertContained();
  assert.equal(vm.monotonic.state.calls,0);assert.equal(vm.monotonic.state.accesses,0);
  const f2=probeReaderFixtureV1(),vm2=task3VmV1(f2),extra=trackProbePromiseV1(vm2.actual.readManualOrphanProbeFd4V1('extra'));
  await assertProbeRejectedV1(extra,'MANUAL_ORPHAN_OWNER_REFUSED');assert.deepEqual(f2.ledger.rawCloses,[4]);vm2.assertContained();
  // No claim is made about arbitrary mixed legacy/new invocations.
});
// Addendum11:7 specified invalid-purpose rows plus missing arity1; caller traps
// are independent evidence so caught proxy access cannot earn unknown/purpose.
const TASK3_INVALID_PURPOSE_V1=[
  ['proxy',counter=>new Proxy({},{get(){counter.hits++;throw Error('PRIVATE_ARGUMENT');},ownKeys(){counter.hits++;throw Error('PRIVATE_ARGUMENT');},
    getOwnPropertyDescriptor(){counter.hits++;throw Error('PRIVATE_ARGUMENT');},getPrototypeOf(){counter.hits++;throw Error('PRIVATE_ARGUMENT');}})],
  ['accessor object',counter=>Object.defineProperty({},'purpose',{get(){counter.hits++;throw Error('PRIVATE_ARGUMENT');}})],
  ['symbol',()=>Symbol('PRIVATE_ARGUMENT')],['null',()=>null],['undefined',()=>undefined],['unknown string',()=>'PRIVATE_ARGUMENT'],
  ['valid plus extra',()=> 'provision','extra'],['missing purpose',()=>undefined,'missing'],
];
for(const [label,make,arity] of TASK3_INVALID_PURPOSE_V1){
  test('Task3 R invalid observer '+label+' normalizes null and still binds drains',async()=>{task3ContractsV1();
    const counter={hits:0},argument=make(counter),f=eventFixtureV1(),vm=task3VmV1();
    const args=arity==='missing'?[f.child]:arity==='extra'?[f.child,argument,{secret:'PRIVATE_ARGUMENT'}]:[f.child,argument];
    const w=vm.actual.observeManualOrphanOwnedChildV1(...args),first=await task3UnknownV1(w,'purpose');
    assert.equal(first.purpose,null);assert.equal(w.snapshot().purpose,null);assert.equal(counter.hits,0);task3AllBoundV1(f);
    f.channels.stdout.emit('data',Buffer.alloc(65537,0x6b));f.channels.stderr.emit('data',Buffer.from('still drained'));
    assert.equal(w.snapshot().stdout.bytes,65537);assert.equal(w.output().stdout.length,65536);assert.equal(w.snapshot().stderr.bytes,13);
    assert.equal(w.snapshot().reason,'purpose');assert.equal(JSON.stringify(first).includes('PRIVATE_ARGUMENT'),false);
    assert.equal(vm.timers.length,0);f.assertGuarded();vm.assertContained();
  });
}
// Addendum12: one failing crypto operation per fresh complete-module instance.
for(const stage of ['createHash','update','copy','digest']){
  test('Task3 R owned '+stage+' failure is sticky nullable digest with independent drain',async()=>{task3ContractsV1();
    let creations=0,faultCalls=0;const f=eventFixtureV1(),bindingFaults=[];
    const crypto={createHash(...args){
      try{task3AllBoundV1(f);}catch(error){bindingFaults.push(error.message);throw error;}
      const index=creations++;if(index===0&&stage==='createHash'){faultCalls++;throw Error('PRIVATE_HASH');}
      const actual=createHash(...args);if(index!==0)return actual;
      const wrapped={update(...values){if(stage==='update'){faultCalls++;throw Error('PRIVATE_HASH');}actual.update(...values);return wrapped;},
        copy(){if(stage==='copy'){faultCalls++;throw Error('PRIVATE_HASH');}const copy=actual.copy();return {digest(...values){
          if(stage==='digest'){faultCalls++;throw Error('PRIVATE_HASH');}return copy.digest(...values);
        }};}};return wrapped;
    }};
    const vm=task3VmV1({crypto}),w=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');
    f.channels.stdout.emit('data',Buffer.from('count despite hash failure'));f.channels.stderr.emit('data',Buffer.from('other stream'));
    let triggered;assert.doesNotThrow(()=>{triggered=w.snapshot();});assert.equal(triggered.state,'unknown');assert.equal(triggered.stdout.sha256,null);
    await task3UnknownV1(w,'binding');const attempts=faultCalls;
    for(let i=0;i<3;i++){assert.equal(w.snapshot().stdout.sha256,null);assert.equal(w.output().stdout.length,26);}
    assert.equal(w.snapshot().stdout.bytes,26);assert.equal(w.snapshot().stderr.bytes,12);
    assert.equal(w.snapshot().stderr.sha256,createHash('sha256').update('other stream').digest('hex'));
    f.channels.stdout.emit('data',Buffer.from('tail'));assert.equal(w.snapshot().stdout.sha256,null);assert.equal(w.snapshot().stdout.bytes,30);
    assert.equal(faultCalls,attempts,'unavailable hash is never recursively retried');assert.equal(creations,2);assert.equal(attempts,1);
    assert.deepEqual(bindingFaults,[]);task3AllBoundV1(f);f.assertGuarded();vm.assertContained();
  });
}
// Addendum13:5 clock faults. A caught fixture ordering assertion remains a
// separately failing ledger, never a valid production unknown observation.
for(const mode of ['accessor','first throw','invalid first result','later throw','backwards']){
  test('Task3 R '+mode+' monotonic clock never interrupts binding or repeatedly throws',async()=>{task3ContractsV1();
    const f=eventFixtureV1(),faults=[];
    const monotonic=task3ClockV1(()=>{try{task3AllBoundV1(f);}catch(error){faults.push(error.message);throw error;}});
    monotonic.state.mode=mode==='accessor'?'accessor':mode==='first throw'?'throw':mode==='invalid first result'?'invalid':null;
    if(mode==='backwards')monotonic.state.ms=10;
    const vm=task3VmV1({monotonic});let w;
    assert.doesNotThrow(()=>{w=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');});
    if(mode==='later throw')monotonic.state.mode='throw';if(mode==='backwards')monotonic.state.ms=9;
    let triggered;assert.doesNotThrow(()=>{triggered=w.snapshot();});assert.equal(triggered.state,'unknown');
    await task3UnknownV1(w,'binding');const calls=monotonic.state.calls,accesses=monotonic.state.accesses;
    for(let i=0;i<3;i++){w.snapshot();w.output();}assert.equal(monotonic.state.calls,calls);assert.equal(monotonic.state.accesses,accesses);
    f.channels.stdout.emit('data',Buffer.from('drain'));f.channels.stderr.emit('data',Buffer.from('drain'));
    assert.equal(w.snapshot().stdout.bytes,5);assert.equal(w.snapshot().stderr.bytes,5);assert.deepEqual(faults,[]);
    assert.equal(monotonic.state.calls,calls);assert.equal(monotonic.state.accesses,accesses);
    assert.deepEqual([...new Set(f.resumed)].sort(),['fd4','stderr','stdout']);f.assertGuarded();vm.assertContained();
  });
}
test('Task3 R local monotonic origin follows listener binding and cannot certify pre-spawn interval',async()=>{task3ContractsV1();
  const g=task3EventFixtureV1('initdb'),clock=task3ClockV1(),before=clock.state.ms;
  for(const target of [g.child,g.channels.stdout,g.channels.stderr]){const on=target.on;
    target.on=function(...args){clock.state.ms+=6000;return on.apply(this,args);};}
  const vm2=task3VmV1({monotonic:clock}),actual=vm2.actual.observeManualOrphanOwnedChildV1(g.child,'initdb');
  assert.ok(clock.state.ms-before>=60000);assert.equal(actual.snapshot().state,'pending','observation-local clock starts only after binding');
  task3CompleteV1(g,'initdb');assert.equal((await actual.settled).state,'observed');g.assertGuarded();vm2.assertContained();
});

// H uses the complete private fixed-entry body via existing exact entry-line
// lowering. Only launch/FD/native import boundaries are contained, no handlers
// or predicate bodies are replaced. New profile models fixed Node/account.
const TASK3_NODE_V1='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const TASK3_PATH_V1=TASK7_HOST_POLICY.path;
function task3EntryV1(bytes,{profile='new',auto=true,readerOptions={},configure}={}){
  task3ContractsV1();const f=probeCompositionFixtureV1('child'),effects=[],calls=[],faults=[];
  const reader=probeReaderFixtureV1({...readerOptions,...(auto?{autoBytes:Buffer.from(bytes)}:{})});
  f.control.reader=reader;f.net=reader.net;
  const fs0=f.state.fs;f.fs={...fs0,fstatSync:(...args)=>reader.fs.fstatSync(...args),closeSync:(...args)=>reader.fs.closeSync(...args)};
  const noEffect=label=>(..._args)=>{effects.push(label);throw Error('FORBIDDEN_TASK3_EFFECT');};
  f.fs.openSync=noEffect('source/open');f.childProcess={spawn:noEffect('spawn'),spawnSync:noEffect('process observation')};
  const account={username:'setrox',uid:501,gid:20,shell:'/bin/zsh',homedir:TASK7_HOST_POLICY.home};
  f.os={userInfo(...args){try{assert.equal(args.length,0);}catch(error){faults.push(error.message);throw error;}
    calls.push('userInfo');return {...account};}};
  if(profile==='new'){
    f.state.files.set(TASK3_NODE_V1,f.state.files.get(OBS_EXE_V1));
    f.process.execPath=TASK3_NODE_V1;f.process.argv0=TASK3_NODE_V1;f.process.argv=[TASK3_NODE_V1,OBS_HELPER_PATH_V1];
    f.process.env={PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C'};
  }
  if(configure)configure({f,reader,account,calls,effects});
  const oldClean=f.assertClean;f.assertClean=()=>{oldClean();reader.assertClean();assert.deepEqual(faults,[]);
    assert.deepEqual(effects,[],'caught Source/native/effect boundary cannot count as a refusal');assert.equal(f.state.opened.length,0);};
  const vm=task3VmV1({...f,expose:true});
  reader.task3Vm=vm;
  return {f,reader,vm,account,calls,effects};
}
function task3EntryRefusedV1(entry,code){
  assert.equal(entry.f.control.stdout,'');assert.equal(entry.f.control.stderr,code+'\n');assert.equal(entry.f.process.exitCode,1);
  entry.vm.assertContained();
}
test('Task3 H private union preserves complete existing legacy probe positive consumer',async()=>{task3ContractsV1();
  const f=probeCompositionFixtureV1('child'),vm=task3VmV1({...f,expose:true});await vm.childMain();
  assert.equal(f.process.exitCode,0);assert.equal(f.control.stderr,'');assert.equal(f.control.stdout,JSON.stringify({
    schema:'setfarm.manual-orphan-lifecycle-probe-result.v1',frameSha256:createHash('sha256').update(JSON.stringify(f.frame())+'\n').digest('hex'),
    pid:123,parentPid:122,fd4Closed:true,sourcePinsClosed:true})+'\n');
  assert.equal(f.control.reader.ledger.closed,true);assert.deepEqual(f.control.reader.ledger.fstats,[4]);
  assert.equal(vm.monotonic.state.calls,0,'legacy probe does not acquire owned monotonic obligation');vm.assertContained();
});
const TASK3_ENV_V1=[
  ['legacy','legacy',null,true],['new fixed baseline','new',null,true],
  ['new allowed CF','new',({f})=>{f.process.env.__CF_USER_TEXT_ENCODING='0x1F5:0x23:0x18';},true],
  ['new extra HOME','new',({f})=>{f.process.env.HOME=TASK7_HOST_POLICY.home;},false],
  ['new wrong locale','new',({f})=>{f.process.env.LANG='en_US';},false],
  ['new wrong physical Node','new',({f})=>{f.process.execPath=OBS_EXE_V1;f.process.argv0=OBS_EXE_V1;f.process.argv[0]=OBS_EXE_V1;},false],
  ['new wrong account home','new',({account})=>{account.homedir='/other/home';},false],
];
for(const [label,profile,configure,admitted] of TASK3_ENV_V1){
  test('Task3 H exact launch admission '+label,async()=>{task3ContractsV1();
    const entry=task3EntryV1(task3WireV1('provision'),{profile,configure});await entry.vm.childMain();
    task3EntryRefusedV1(entry,admitted?'MANUAL_ORPHAN_OWNER_REFUSED':'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(entry.reader.ledger.fstats,admitted?[4]:[]);
    assert.deepEqual(entry.reader.ledger.rawCloses,admitted?[]:[4]);assert.equal(entry.reader.ledger.adopted,admitted);
    if(admitted)assert.equal(entry.reader.ledger.closed,true);
    if(profile==='legacy')assert.deepEqual(entry.calls,[],'legacy launch has no account-home obligation');
  });
}
test('Task3 H probe under new baseline is read once then strict legacy context refuses',async()=>{task3ContractsV1();
  const entry=task3EntryV1(Buffer.from(CODEC_EXPECTED_V1));await entry.vm.childMain();
  task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');assert.equal(entry.reader.ledger.closed,true);
  assert.deepEqual(entry.reader.ledger.fstats,[4]);assert.equal(entry.reader.ledger.constructs.length,1);
});
for(const [label,bytes] of [['runner setup',()=>Buffer.from(OWN_SETUP_WIRE)],['integration purpose',()=>task3WireV1('integration')]]){
  test('Task3 H helper union rejects '+label+' without Source or effect calls',async()=>{task3ContractsV1();
    const entry=task3EntryV1(bytes());await entry.vm.childMain();task3EntryRefusedV1(entry,'MANUAL_ORPHAN_FRAME_REFUSED');
    assert.equal(entry.reader.ledger.closed,true);assert.deepEqual(entry.reader.ledger.rawCloses,[]);
  });
}
for(const purpose of ['provision','activate','old_entry_positive','new_entry_refusal']){
  test('Task3 H canonical '+purpose+' reaches only known-close SETUP capability barrier',async()=>{task3ContractsV1();
    const entry=task3EntryV1(task3WireV1(purpose));await entry.vm.childMain();task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(entry.reader.ledger.fstats,[4]);assert.equal(entry.reader.ledger.constructs.length,1);
    assert.equal(entry.reader.ledger.closed,true);assert.equal(entry.reader.ledger.destroys,1);
  });
}
test('Task3 H invalid union bytes reach FRAME only after actual close',async()=>{task3ContractsV1();
  const entry=task3EntryV1(Buffer.from([0xff,0x0a]));await entry.vm.childMain();task3EntryRefusedV1(entry,'MANUAL_ORPHAN_FRAME_REFUSED');
  assert.equal(entry.reader.ledger.closed,true);
});
for(const [profile,code] of [['legacy','MANUAL_ORPHAN_CHILD_UNKNOWN'],['new','MANUAL_ORPHAN_CLEANUP_UNKNOWN']]){
  test('Task3 H '+profile+' uncertainty dominates malformed input with profile-specific sanitized code',async()=>{task3ContractsV1();
    const entry=task3EntryV1(Buffer.alloc(0),{profile,auto:false}),main=trackProbePromiseV1(entry.vm.childMain());
    const socket=entry.reader.ledger.socket;assert.ok(socket);socket.emit('data',Buffer.alloc(16385));socket.emit('error',Error('PRIVATE_READ'));
    await Promise.resolve();assert.equal(main.outcome,null);entry.reader.ledger.closed=true;socket.emit('close',true);
    assert.equal((await main.done).error,undefined);task3EntryRefusedV1(entry,code);
  });
}
for(const profile of ['legacy','new']){
  test('Task3 H '+profile+' preprofile launch refusal raw-close uncertainty preserves legacy unknown mapping',async()=>{task3ContractsV1();
    const entry=task3EntryV1(Buffer.alloc(0),{profile,readerOptions:{rawCloseError:true},configure({f}){f.process.execArgv=['--forbidden'];}});
    await entry.vm.childMain();task3EntryRefusedV1(entry,'MANUAL_ORPHAN_CHILD_UNKNOWN');
    assert.deepEqual(entry.reader.ledger.rawCloses,[4]);assert.deepEqual(entry.reader.ledger.fstats,[]);assert.equal(entry.reader.ledger.adopted,false);
  });
}
// Remaining reservation cases exercise that SAME private entry composition.
for(const order of ['owned then union','union then owned']){
  test('Task3 R '+order+' shares one inherited4 reservation',async()=>{task3ContractsV1();
    const entry=task3EntryV1(Buffer.alloc(0),{auto:false});let first,second;
    if(order==='owned then union'){
      first=trackProbePromiseV1(entry.vm.actual.readManualOrphanOwnedFd4V1('runner'));const before=task3IoV1(entry.reader);
      second=trackProbePromiseV1(entry.vm.childMain());await second.done;assert.deepEqual(task3IoV1(entry.reader),before);
      task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');assert.equal(first.outcome,null);
      task3FinishReadV1(entry.reader,Buffer.from(OWN_SETUP_WIRE));assert.equal((await first.done).error,undefined);
    }else{
      first=trackProbePromiseV1(entry.vm.childMain());const before=task3IoV1(entry.reader);
      second=trackProbePromiseV1(entry.vm.actual.readManualOrphanOwnedFd4V1('runner'));
      await assertProbeRejectedV1(second,'MANUAL_ORPHAN_OWNER_REFUSED');assert.deepEqual(task3IoV1(entry.reader),before);assert.equal(first.outcome,null);
      task3FinishReadV1(entry.reader,task3WireV1('provision'));await first.done;task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');
    }
    assert.deepEqual(entry.reader.ledger.fstats,[4]);assert.equal(entry.reader.ledger.constructs.length,1);entry.vm.assertContained();
  });
}
test('Task3 R launch guard reentrant owned call sees reserved claim before fallible realpath',async()=>{task3ContractsV1();
  let vm,reentered=null;const entry=task3EntryV1(Buffer.alloc(0),{auto:false,configure({f}){
    const original=f.fs.realpathSync;f.fs.realpathSync=(...args)=>{
      if(!reentered)reentered=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));return original(...args);
    };
  }});vm=entry.vm;const main=trackProbePromiseV1(vm.childMain());assert.ok(reentered);
  await assertProbeRejectedV1(reentered,'MANUAL_ORPHAN_OWNER_REFUSED');assert.equal(main.outcome,null);
  task3FinishReadV1(entry.reader,task3WireV1('provision'));await main.done;task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');
});
test('Task3 R launch refusal raw closes once and reentry never touches replacement4',async()=>{task3ContractsV1();
  const entry=task3EntryV1(Buffer.alloc(0),{configure({f}){f.process.env.EXTRA='refused';}});await entry.vm.childMain();
  task3EntryRefusedV1(entry,'MANUAL_ORPHAN_OWNER_REFUSED');assert.deepEqual(entry.reader.ledger.rawCloses,[4]);
  const before=task3IoV1(entry.reader),hits=task3SentinelV1(entry.reader);
  await entry.vm.childMain();assert.deepEqual(hits,[]);assert.deepEqual(task3IoV1(entry.reader),before);entry.vm.assertContained();
});
test('Task3 R legacy probe private union consumes decoded frame once and never public reader again',async()=>{task3ContractsV1();
  const f=probeCompositionFixtureV1('child'),vm=task3VmV1({...f,expose:true});await vm.childMain();
  assert.equal(f.process.exitCode,0);assert.deepEqual(f.control.reader.ledger.fstats,[4]);assert.equal(f.control.reader.ledger.constructs.length,1);
  assert.deepEqual(f.control.reader.ledger.rawCloses,[]);assert.equal(f.control.reader.ledger.closed,true);vm.assertContained();
});

// I:8 REAL fixed-helper negative callbacks. These are never launched at initial
// missing-API RED. Their originals/writers/channel joins are independently owned;
// uncertain joins stop subsequent launches and retain the original for Root.
let task3NativeStoppedV1=false,task3NativeBusyV1=false;
const task3RetainedNativeV1=[];
async function task3ActualNegativeV1(bytes,expected){
  task3ContractsV1();assert.equal(task3NativeStoppedV1,false,'prior actual uncertainty stops new native launches');
  assert.equal(task3NativeBusyV1,false,'serialize all new actual helper originals');task3NativeBusyV1=true;
  let original=null,witness=null,pins=null,endAttempted=false,watchdog=null,primary=null;
  const record={original:null,witness:null,joins:null,complete:false,exit:null,close:null,channels:{},uncertain:false};
  const endOnce=data=>{if(!endAttempted&&original){endAttempted=true;original.stdio[4].end(data);}};
  const current=()=>{const snapshot=witness.snapshot();assert.notEqual(snapshot.state,'unknown','current original observation cannot be historical-only');return snapshot;};
  try{
    const native=createRequire(import.meta.url)('node:child_process'),fs=createRequire(import.meta.url)('node:fs');
    assert.equal(process.platform,'darwin');assert.match(process.versions.node,/^26\./);
    assert.equal(fs.realpathSync(process.execPath),TASK3_NODE_V1);assert.equal(fs.realpathSync(OBS_HELPER_PATH_V1),OBS_HELPER_PATH_V1);
    original=native.spawn(TASK3_NODE_V1,[OBS_HELPER_PATH_V1],{cwd:path.resolve(path.dirname(OBS_TEST_PATH_V1),'../..'),
      argv0:TASK3_NODE_V1,shell:false,detached:false,env:{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C'},
      stdio:['ignore','pipe','pipe','ignore','pipe']});
    record.original=original;task3RetainedNativeV1.push(record);let observationError=null;
    try{witness=helper.observeManualOrphanOwnedChildV1(original,'new_entry_refusal');}catch(error){observationError=error;}
    record.witness=witness;
    // No await, hashing, pin acquisition or PID observation precedes the witness
    // and these independent original/channel listener joins.
    const joinExit=new Promise(resolve=>original.once('exit',(code,signal)=>{record.exit={code,signal};resolve();}));
    const joinClose=new Promise(resolve=>original.once('close',(code,signal)=>{record.close={code,signal};resolve();}));
    original.on('error',()=>{record.uncertain=true;task3NativeStoppedV1=true;});
    const channelJoins=[];
    for(const [name,stream] of [['stdout',original.stdout],['stderr',original.stderr],['fd4',original.stdio[4]]]){
      const facts=record.channels[name]={end:false,close:false,...(name==='fd4'?{finish:false}:{})};
      stream.on('error',()=>{record.uncertain=true;task3NativeStoppedV1=true;});
      channelJoins.push(new Promise(resolve=>stream.once('end',()=>{facts.end=true;resolve();})));
      channelJoins.push(new Promise(resolve=>stream.once('close',()=>{facts.close=true;resolve();})));
      if(name==='fd4')channelJoins.push(new Promise(resolve=>stream.once('finish',()=>{facts.finish=true;resolve();})));
    }
    record.joins=Promise.all([joinExit,joinClose,...channelJoins]).then(()=>{record.complete=true;return true;});
    const joined=()=>Promise.race([record.joins,new Promise(resolve=>{watchdog=setTimeout(()=>resolve(false),15000);})]);
    if(observationError){
      // A broken future observer must not lose a launched original. These are
      // only the harness's own channels; bind independent joins before drain.
      for(const stream of [original.stdout,original.stderr,original.stdio[4]])stream.resume();
      throw observationError;
    }
    current();pins=helper.pinManualOrphanProbeSourcesV1();current();pins.check();current();
    endOnce(Buffer.from(bytes));current();
    const completed=await joined();current();clearTimeout(watchdog);watchdog=null;
    if(!completed){record.uncertain=true;task3NativeStoppedV1=true;assert.fail('actual original/channel join unresolved; retained for Root');}
    await witness.settled;const snapshot=current();assert.equal(snapshot.state,'observed');
    assert.equal(record.uncertain,false,'independent original/channel error ledger stays clear');
    assert.deepEqual(record.exit,{code:1,signal:null});assert.deepEqual(record.close,{code:1,signal:null});
    assert.deepEqual(snapshot.exit,snapshot.close);assert.equal(snapshot.close.code,1);assert.equal(snapshot.close.signal,null);
    for(const facts of Object.values(record.channels)){assert.equal(facts.end,true);assert.equal(facts.close,true);}
    assert.equal(record.channels.fd4.finish,true);assert.equal(endAttempted,true);
    assert.deepEqual(snapshot.fd4,{finish:true,end:true,close:true});
    for(const name of ['stdout','stderr']){assert.equal(snapshot[name].end,true);assert.equal(snapshot[name].close,true);}
    const output=witness.output();assert.equal(output.stdout.length,0,'no receipt or other stdout');
    assert.equal(output.stderr.equals(Buffer.from(expected+'\n')),true,'exact sanitized refusal only');
    pins.check();current();
  }catch(error){
    primary=error;if(original){task3NativeStoppedV1=true;record.uncertain=true;
      try{endOnce();}catch{/* retain the original and its independent joins */}
      if(record.joins&&!record.complete){
        const completed=await Promise.race([record.joins,new Promise(resolve=>{
          if(watchdog!==null)clearTimeout(watchdog);watchdog=setTimeout(()=>resolve(false),15000);
        })]);
        if(!completed)record.uncertain=true;
        try{if(witness)current();}catch{record.uncertain=true;}
      }
    }
  }finally{
    if(watchdog!==null)clearTimeout(watchdog);
    if(pins){
      const ownedPins=pins;pins=null;
      for(const operation of [()=>{if(witness)current();},()=>ownedPins.close(),()=>{if(witness)current();}]){
        try{operation();}catch(error){if(!primary)primary=error;task3NativeStoppedV1=true;record.uncertain=true;}
      }
    }
    task3NativeBusyV1=false;
  }
  if(primary)throw primary;
}
const TASK3_ACTUAL_NEGATIVES_V1=[
  ['invalid UTF8',()=>Buffer.from([0xff,0x0a]),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['empty EOF',()=>Buffer.alloc(0),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['missing LF',()=>Buffer.from(OWN_SETUP_WIRE.slice(0,-1)),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['duplicate key',()=>Buffer.from(OWN_SETUP_WIRE.replace('{"schema":','{"run":"'+OWN_C+'","schema":')),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['runner setup schema',()=>Buffer.from(OWN_SETUP_WIRE),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['forbidden helper integration',()=>task3WireV1('integration'),'MANUAL_ORPHAN_FRAME_REFUSED'],
  ['canonical provision',()=>task3WireV1('provision'),'MANUAL_ORPHAN_OWNER_REFUSED'],
  ['canonical mechanical refusal',()=>task3WireV1('new_entry_refusal'),'MANUAL_ORPHAN_OWNER_REFUSED'],
];
for(const [label,bytes,expected] of TASK3_ACTUAL_NEGATIVES_V1){
  test('Task3 I actual physical fixed helper '+label+' has natural owned joins and no receipt',async()=>{task3ContractsV1();
    await task3ActualNegativeV1(bytes(),expected);
  });
}

// Task3 I1: only these two cases have one deliberately unavailable listener
// slot. eventFixtureV1 and every preexisting strict resume expectation stay
// unchanged. All observer callbacks below are the complete actual consumer.
async function task3SelectiveBindingV1(target,unavailable){
  task3ContractsV1();const f=eventFixtureV1();
  const slots={original:['spawn','error','exit','close'],stdout:['error','end','close','data'],
    stderr:['error','end','close','data'],fd4:['error','finish','end','close','data']};
  const required=Object.entries(slots).flatMap(([name,events])=>events.map(event=>name+'.'+event));
  const attempts=[],boundaries=[],resumeBoundaries=[],lateAttempts=[],pauseViolations=[],faults=[],unavailableAttempts=[],delivered={stdout:0,stderr:0,fd4:0};
  const paused=new Set(),resumes=[];
  const originalOn=f.child.on;
  f.child.on=function(event,handler){
    const slot='original.'+event;attempts.push(slot);if(boundaries.length)lateAttempts.push(slot);
    return originalOn.call(this,event,handler);
  };
  for(const name of ['stdout','stderr','fd4']){
    const stream=f.channels[name],on=stream.on,pause=stream.pause,resume=stream.resume;
    stream.pause=function(...args){paused.add(name);return pause.apply(this,args);};
    stream.resume=function(...args){
      resumeBoundaries.push({name,missing:required.filter(slot=>!attempts.includes(slot))});return resume.apply(this,args);
    };
    stream.on=function(event,handler){
      const slot=name+'.'+event;attempts.push(slot);if(boundaries.length)lateAttempts.push(slot);
      if(name===target&&event===unavailable){unavailableAttempts.push(slot);throw Error('SIMULATED_ONE_UNAVAILABLE_LISTENER_SLOT');}
      if(event==='data'){
        if(!paused.has(name))pauseViolations.push(slot);
        return on.call(this,event,function(...args){delivered[name]+=args[0].length;return handler.apply(this,args);});
      }
      return on.call(this,event,handler);
    };
  }
  // Closed per-fault expectation: one unavailable slot, every other handler
  // remains mandatory. This override applies ONLY to the faulted channel.
  f.channels[target].resume=function(){
    resumeBoundaries.push({name:target,missing:required.filter(slot=>!attempts.includes(slot))});
    try{
      assert.equal(paused.has(target),true,'faulted channel pauses before data binding/resume');
      for(const event of slots[target]){
        assert.equal(this.listenerCount(event)>0,event!==unavailable,target+'.'+event+' has its exact per-fault availability');
      }
    }catch(error){faults.push(error.message);throw error;}
    resumes.push(target);f.resumed.push(target);return this;
  };
  const boundary=kind=>{
    // Record rather than throwing inside production's catch. Missing attempts
    // must fail the outer assertions, never manufacture acceptable UNKNOWN.
    boundaries.push({kind,missing:required.filter(slot=>!attempts.includes(slot))});
  };
  const monotonic=task3ClockV1(()=>boundary('clock'));
  const vm=task3VmV1({monotonic,crypto:{createHash(...args){boundary('hash');return createHash(...args);}}});
  let w;
  try{
    w=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');
    assert.deepEqual([...new Set(attempts)].sort(),[...required].sort(),'selective failure cannot suppress any remaining listener attempt');
    for(const slot of required)assert.equal(attempts.filter(attempt=>attempt===slot).length,1,'exactly one bounded attempt for '+slot);
    assert.deepEqual(unavailableAttempts,[target+'.'+unavailable]);
    assert.ok(boundaries.some(item=>item.kind==='clock'),'actual owned clock boundary reached');
    assert.ok(boundaries.some(item=>item.kind==='hash'),'actual crypto boundary reached');
    for(const item of boundaries)assert.deepEqual(item.missing,[],'every slot attempted before fallible '+item.kind);
    assert.deepEqual(lateAttempts,[]);assert.deepEqual(pauseViolations,[]);assert.deepEqual(faults,[],'no swallowed fixture assertion may count as binding refusal');
    assert.deepEqual([...paused].sort(),['fd4','stderr','stdout']);
    assert.deepEqual([...new Set(f.resumed)].sort(),['fd4','stderr','stdout']);assert.deepEqual(resumes,[target]);
    assert.equal(resumeBoundaries.length,3);for(const item of resumeBoundaries)assert.deepEqual(item.missing,[],'all binding attempts precede deliberate '+item.name+' resume');
    const first=await w.settled;assert.equal(first.state,'unknown');assert.equal(first.reason,'binding');task3FrozenV1(first);
    const faultBytes=Buffer.from('faulted channel still drains'),otherBytes=Buffer.from('independent stderr still drains');
    f.channels[target].emit('data',faultBytes);f.channels.stderr.emit('data',otherBytes);
    assert.equal(delivered[target],faultBytes.length,'real faulted-channel data callback still receives/drains its bytes');
    assert.equal(delivered.stderr,otherBytes.length);const current=w.snapshot();task3FrozenV1(current);
    assert.equal(current.state,'unknown');assert.equal(current.reason,'binding');assert.equal(current.stderr.bytes,otherBytes.length);
    assert.deepEqual(w.output().stderr,otherBytes);
    if(target==='stdout'){
      assert.equal(current.stdout.bytes,faultBytes.length);assert.deepEqual(w.output().stdout,faultBytes);
      assert.equal(current.stdout.end,false);
    }else assert.equal(current.fd4.finish,false,'unavailable finish handler cannot manufacture a writer fact');
    assert.equal(await w.settled,first);assert.equal(first.reason,'binding');
    assert.deepEqual(faults,[]);assert.deepEqual(lateAttempts,[]);assert.deepEqual(pauseViolations,[]);
  }finally{f.assertGuarded();vm.assertContained();}
}
test('Task3 I1 selective stdout.end failure still attempts binds and drains all safe channels',async()=>{task3ContractsV1();
  await task3SelectiveBindingV1('stdout','end');
});
test('Task3 I1 selective fd4.finish failure still attempts binds and drains all safe channels',async()=>{task3ContractsV1();
  await task3SelectiveBindingV1('fd4','finish');
});

// Task4A TESTS ONLY: real pure DATA namespace, no SQL/session/Source authority.
// The first statement of every canonicalizer test checks the future export.
function task4aCanonicalizerV1(){
  assert.ok(helper,'real helper namespace is required');
  assert.equal(typeof helper.canonicalizeManualOrphanClusterBaselineV1,'function',
    'Task4A absent pure DATA API: canonicalizeManualOrphanClusterBaselineV1');
  return helper.canonicalizeManualOrphanClusterBaselineV1;
}
function task4aCatalogV1(){return {
  databases:[
    {name:'template1',oid:1,ownerOid:3,allowConnections:true,connectionLimit:2147483647},
    {name:'postgres',oid:5,ownerOid:1,allowConnections:true,connectionLimit:-1},
    {name:'template0',oid:4,ownerOid:1,allowConnections:false,connectionLimit:0},
  ],
  roles:[
    {name:'root',oid:1,superuser:true,inherit:false,createRole:true,createDb:false,
      login:true,replication:false,bypassRls:true,connectionLimit:-1,validUntilUTC:null},
    {name:'z',oid:2,superuser:false,inherit:false,createRole:false,createDb:false,
      login:false,replication:false,bypassRls:false,connectionLimit:2147483647,validUntilUTC:'infinity'},
    {name:'A',oid:3,superuser:false,inherit:true,createRole:false,createDb:true,
      login:false,replication:true,bypassRls:false,connectionLimit:0,validUntilUTC:'2024-02-29T23:59:59.123456Z'},
  ],
  memberships:[
    {roleOid:3,memberOid:1,grantorOid:1,adminOption:true,inheritOption:true,setOption:false},
    {roleOid:1,memberOid:2,grantorOid:3,adminOption:true,inheritOption:false,setOption:true},
    {roleOid:1,memberOid:2,grantorOid:1,adminOption:false,inheritOption:true,setOption:false},
  ],
};}
// Literal sorted strings, byte counts and SHA256s calculated independently of
// the helper. Delimiters/escapes count; no envelope or final LF is hashed.
const TASK4A_DB_JSON_V1='[{"name":"postgres","oid":5,"ownerOid":1,"allowConnections":true,"connectionLimit":-1},{"name":"template0","oid":4,"ownerOid":1,"allowConnections":false,"connectionLimit":0},{"name":"template1","oid":1,"ownerOid":3,"allowConnections":true,"connectionLimit":2147483647}]';
const TASK4A_ROLE_JSON_V1='[{"name":"A","oid":3,"superuser":false,"inherit":true,"createRole":false,"createDb":true,"login":false,"replication":true,"bypassRls":false,"connectionLimit":0,"validUntilUTC":"2024-02-29T23:59:59.123456Z"},{"name":"root","oid":1,"superuser":true,"inherit":false,"createRole":true,"createDb":false,"login":true,"replication":false,"bypassRls":true,"connectionLimit":-1,"validUntilUTC":null},{"name":"z","oid":2,"superuser":false,"inherit":false,"createRole":false,"createDb":false,"login":false,"replication":false,"bypassRls":false,"connectionLimit":2147483647,"validUntilUTC":"infinity"}]';
const TASK4A_MEM_JSON_V1='[{"roleOid":1,"memberOid":2,"grantorOid":1,"adminOption":false,"inheritOption":true,"setOption":false},{"roleOid":1,"memberOid":2,"grantorOid":3,"adminOption":true,"inheritOption":false,"setOption":true},{"roleOid":3,"memberOid":1,"grantorOid":1,"adminOption":true,"inheritOption":true,"setOption":false}]';
function task4aLiteralOutputV1(){return {
  databases:JSON.parse(TASK4A_DB_JSON_V1),roles:JSON.parse(TASK4A_ROLE_JSON_V1),memberships:JSON.parse(TASK4A_MEM_JSON_V1),
  canonicalBytes:1164,
  databaseBaselineSha256:'bb76048d47ee235365f864509ed15cad36b1020c013aae18ef35f1fd7de32cce',
  roleBaselineSha256:'805e3de5d7926e50e6c566e021110b654408c01aa45c8996e2eb4616b2150a3e',
  membershipBaselineSha256:'1cd136273a1cffdab688441c0298d89f29a3d3866205c919350b8710b14156e8',
};}
function task4aFrozenTreeV1(value){
  assert.equal(Object.isFrozen(value),true);
  assert.equal(Object.getPrototypeOf(value),Array.isArray(value)?Array.prototype:Object.prototype);
  const keys=Object.keys(value),own=Reflect.ownKeys(value);
  assert.deepEqual(own,Array.isArray(value)?[...keys,'length']:keys,'no hidden keys symbols or methods');
  for(const key of keys){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    assert.equal(descriptor.enumerable,true);assert.equal(Object.hasOwn(descriptor,'value'),true);
    const item=descriptor.value;if(item!==null&&typeof item==='object')task4aFrozenTreeV1(item);
  }
}
function task4aReverseKeysV1(value){
  if(Array.isArray(value))return value.map(task4aReverseKeysV1);
  return value!==null&&typeof value==='object'?
    Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,task4aReverseKeysV1(item)])):value;
}
function task4aTrapV1(value,hit){return new Proxy(value,{
  get(){hit();throw Error('private get');},getPrototypeOf(){hit();throw Error('private proto');},
  ownKeys(){hit();throw Error('private keys');},getOwnPropertyDescriptor(){hit();throw Error('private descriptor');},
});}
function task4aRefusedV1(normalize,value,label){
  const first=frameRefusedV1(()=>normalize(value),label),second=frameRefusedV1(()=>normalize(value),label+' repeat');
  assert.notEqual(first,second,'every refusal creates a fresh Error');
  assert.equal(Object.hasOwn(first,'cause'),false,'no private cause escapes');
  assert.deepEqual(Object.keys(first),[],'no private data is attached');
}
function task4aWideCatalogV1(){
  const value=task4aCatalogV1();value.databases.forEach(row=>{row.ownerOid=1;});
  // Explicit finite128/256 catalog fixtures; no random or Cartesian generation.
  value.roles=Array.from({length:128},(_,index)=>({...value.roles[1],oid:index+1,
    name:'r'+String(index).padStart(3,'0'),connectionLimit:-1,validUntilUTC:null}));
  value.memberships=Array.from({length:256},(_,index)=>({roleOid:1,memberOid:2+index%127,
    grantorOid:1+Math.floor(index/127),adminOption:false,inheritOption:true,setOption:false}));
  return value;
}
function task4aBoundaryCatalogV1(){
  const value=task4aWideCatalogV1();
  // 50891 unpadded bytes +124*59*2 quote bytes +6*2+1 =65536.
  for(let index=0;index<124;index++)value.roles[index].name+='"'.repeat(59);
  value.roles[124].name+='"'.repeat(6)+'x';
  return value;
}

test('Task4A canonical API is synchronous exactarity1 and checks call arity before reflecting input',()=>{
  const normalize=task4aCanonicalizerV1();assert.equal(normalize.length,1);let hits=0;
  const poison=task4aTrapV1({},()=>{hits++;});
  const a=frameRefusedV1(()=>normalize(),'absent argument');
  const b=frameRefusedV1(()=>normalize(poison,undefined),'surplus argument before reflection');
  frameRefusedV1(()=>normalize(poison,()=>{hits++;}),'callback has no authority');
  assert.notEqual(a,b);assert.equal(hits,0);
  const result=normalize(task4aCatalogV1());assert.equal(typeof result.then,'undefined');
});
test('Task4A canonical output matches independent sorted bytes ordered keys counts and three complete digests',()=>{
  const normalize=task4aCanonicalizerV1(),output=normalize(task4aCatalogV1());
  assert.deepEqual(output,task4aLiteralOutputV1());
  assert.deepEqual(Object.keys(output),['databases','roles','memberships','canonicalBytes',
    'databaseBaselineSha256','roleBaselineSha256','membershipBaselineSha256']);
  assert.equal(JSON.stringify(output.databases),TASK4A_DB_JSON_V1);
  assert.equal(JSON.stringify(output.roles),TASK4A_ROLE_JSON_V1);
  assert.equal(JSON.stringify(output.memberships),TASK4A_MEM_JSON_V1);
  assert.deepEqual(Object.keys(output.databases[0]),['name','oid','ownerOid','allowConnections','connectionLimit']);
  assert.deepEqual(Object.keys(output.roles[0]),['name','oid','superuser','inherit','createRole','createDb','login',
    'replication','bypassRls','connectionLimit','validUntilUTC']);
  assert.deepEqual(Object.keys(output.memberships[0]),['roleOid','memberOid','grantorOid','adminOption','inheritOption','setOption']);
});
test('Task4A canonical normalization ignores input key insertion and catalog row order',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aReverseKeysV1(task4aCatalogV1());
  value.databases.reverse();value.roles.reverse();value.memberships.reverse();
  assert.deepEqual(normalize(value),task4aLiteralOutputV1());
});
test('Task4A canonical result is detached deeply frozen new each call and leaves caller fully mutable',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1(),before=structuredClone(value);
  const first=normalize(value),second=normalize(value);assert.deepEqual(value,before);
  task4aFrozenTreeV1(first);task4aFrozenTreeV1(second);assert.notEqual(first,second);
  for(const key of ['databases','roles','memberships']){
    assert.notEqual(first[key],second[key]);assert.notEqual(first[key],value[key]);
    assert.equal(Object.isFrozen(value[key]),false);
    for(const row of first[key])assert.ok(!value[key].includes(row)&&!second[key].includes(row));
    for(const row of value[key])assert.equal(Object.isFrozen(row),false);
  }
  assert.equal(Object.isFrozen(value),false);value.roles[0].name='changed';value.databases.reverse();
  value.memberships[0].adminOption=false;assert.deepEqual(first,task4aLiteralOutputV1());
  assert.throws(()=>{first.roles[0].name='changed';},TypeError);
});
test('Task4A canonical UTF8 sorting preserves numeric case whitespace normalization and supplementary bytes',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();
  const names=['\u{10000}','\ue000','é','e\u0301','a','A','10','2',' root ','\n','quote"slash\\'];
  value.roles=names.map((name,index)=>({...value.roles[0],name,oid:index+1}));
  const output=normalize(value);
  assert.deepEqual(output.roles.map(row=>row.name),['\n',' root ','10','2','A','a','e\u0301','quote"slash\\','é','\ue000','\u{10000}']);
  assert.equal(output.roles.find(row=>row.name==='e\u0301').oid,4);
  assert.equal(output.roles.find(row=>row.name==='é').oid,3);
  assert.equal(output.canonicalBytes,Buffer.byteLength(JSON.stringify(output.databases),'utf8')
    +Buffer.byteLength(JSON.stringify(output.roles),'utf8')+Buffer.byteLength(JSON.stringify(output.memberships),'utf8'));
});
test('Task4A canonical accepts nonempty single role and empty memberships without guessed stock catalog count',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();
  value.roles=[value.roles[0]];value.memberships=[];value.databases.forEach(row=>{row.ownerOid=1;});
  const output=normalize(value);assert.equal(output.roles.length,1);assert.deepEqual(output.memberships,[]);
  assert.equal(output.membershipBaselineSha256,'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
});
test('Task4A canonical preserves independent catalog OID namespaces and permitted grantor equalities',()=>{
  const normalize=task4aCanonicalizerV1(),output=normalize(task4aCatalogV1());
  assert.equal(output.databases[2].oid,output.roles[1].oid);
  assert.equal(output.memberships[0].grantorOid,output.memberships[0].roleOid);
  assert.equal(output.memberships[2].grantorOid,output.memberships[2].memberOid);
  assert.equal(output.memberships.filter(row=>row.roleOid===1&&row.memberOid===2).length,2);
});
test('Task4A canonical accepts finite128 role256 membership ceilings with complete references',()=>{
  const normalize=task4aCanonicalizerV1(),output=normalize(task4aWideCatalogV1());
  assert.equal(output.roles.length,128);assert.equal(output.memberships.length,256);assert.equal(output.canonicalBytes,50891);
});
test('Task4A canonical accepts exactly65536 UTF8 bytes including escaped names before hashing',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aBoundaryCatalogV1();
  assert.equal(value.roles[0].name.length,63);assert.equal(value.roles[124].name.length,11);
  const output=normalize(value);assert.equal(output.canonicalBytes,65536);
  assert.equal(output.roles.length,128);assert.equal(output.memberships.length,256);
});
test('Task4A canonical refuses65537 UTF8 bytes despite all catalog row name and count bounds',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aBoundaryCatalogV1();value.roles[125].name+='x';
  assert.equal(value.roles.length,128);assert.equal(value.memberships.length,256);
  task4aRefusedV1(normalize,value,'canonical byte overflow');
});

test('Task4A canonical refuses null on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=null;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog null");assert.equal(hits,0);
});
test('Task4A canonical refuses null prototype on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Object.create(null),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses class on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new (class CatalogRecord {})(),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog class");assert.equal(hits,0);
});
test('Task4A canonical refuses Date on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new Date(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog Date");assert.equal(hits,0);
});
test('Task4A canonical refuses Buffer on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Buffer.alloc(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog Buffer");assert.equal(hits,0);
});
test('Task4A canonical refuses array on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign([],original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog array");assert.equal(hits,0);
});
test('Task4A canonical refuses symbol on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target[Symbol('hidden')]=1;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses nonenumerable on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,'hidden',{value:1,enumerable:false});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog nonenumerable");assert.equal(hits,0);
});
test('Task4A canonical refuses getter on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,get(){hits++;return old;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog getter");assert.equal(hits,0);
});
test('Task4A canonical refuses setter on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,set(){hits++;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog setter");assert.equal(hits,0);
});
test('Task4A canonical refuses proxy on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=task4aTrapV1(original,()=>{hits++;});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses missing key on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  delete target[key];
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog missing key");assert.equal(hits,0);
});
test('Task4A canonical refuses extra key on catalog without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=[],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target.permission=true;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"catalog extra key");assert.equal(hits,0);
});
test('Task4A canonical refuses null on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=null;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row null");assert.equal(hits,0);
});
test('Task4A canonical refuses null prototype on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Object.create(null),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses class on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new (class CatalogRecord {})(),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row class");assert.equal(hits,0);
});
test('Task4A canonical refuses Date on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new Date(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row Date");assert.equal(hits,0);
});
test('Task4A canonical refuses Buffer on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Buffer.alloc(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row Buffer");assert.equal(hits,0);
});
test('Task4A canonical refuses array on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign([],original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row array");assert.equal(hits,0);
});
test('Task4A canonical refuses symbol on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target[Symbol('hidden')]=1;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses nonenumerable on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,'hidden',{value:1,enumerable:false});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row nonenumerable");assert.equal(hits,0);
});
test('Task4A canonical refuses getter on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,get(){hits++;return old;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row getter");assert.equal(hits,0);
});
test('Task4A canonical refuses setter on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,set(){hits++;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row setter");assert.equal(hits,0);
});
test('Task4A canonical refuses proxy on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=task4aTrapV1(original,()=>{hits++;});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses missing key on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  delete target[key];
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row missing key");assert.equal(hits,0);
});
test('Task4A canonical refuses extra key on database row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["databases",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target.permission=true;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"database row extra key");assert.equal(hits,0);
});
test('Task4A canonical refuses null on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=null;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row null");assert.equal(hits,0);
});
test('Task4A canonical refuses null prototype on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Object.create(null),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses class on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new (class CatalogRecord {})(),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row class");assert.equal(hits,0);
});
test('Task4A canonical refuses Date on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new Date(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row Date");assert.equal(hits,0);
});
test('Task4A canonical refuses Buffer on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Buffer.alloc(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row Buffer");assert.equal(hits,0);
});
test('Task4A canonical refuses array on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign([],original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row array");assert.equal(hits,0);
});
test('Task4A canonical refuses symbol on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target[Symbol('hidden')]=1;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses nonenumerable on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,'hidden',{value:1,enumerable:false});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row nonenumerable");assert.equal(hits,0);
});
test('Task4A canonical refuses getter on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,get(){hits++;return old;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row getter");assert.equal(hits,0);
});
test('Task4A canonical refuses setter on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,set(){hits++;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row setter");assert.equal(hits,0);
});
test('Task4A canonical refuses proxy on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=task4aTrapV1(original,()=>{hits++;});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses missing key on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  delete target[key];
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row missing key");assert.equal(hits,0);
});
test('Task4A canonical refuses extra key on role row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["roles",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target.permission=true;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"role row extra key");assert.equal(hits,0);
});
test('Task4A canonical refuses null on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=null;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row null");assert.equal(hits,0);
});
test('Task4A canonical refuses null prototype on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Object.create(null),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses class on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new (class CatalogRecord {})(),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row class");assert.equal(hits,0);
});
test('Task4A canonical refuses Date on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(new Date(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row Date");assert.equal(hits,0);
});
test('Task4A canonical refuses Buffer on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign(Buffer.alloc(0),original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row Buffer");assert.equal(hits,0);
});
test('Task4A canonical refuses array on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=Object.assign([],original);
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row array");assert.equal(hits,0);
});
test('Task4A canonical refuses symbol on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target[Symbol('hidden')]=1;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses nonenumerable on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,'hidden',{value:1,enumerable:false});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row nonenumerable");assert.equal(hits,0);
});
test('Task4A canonical refuses getter on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,get(){hits++;return old;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row getter");assert.equal(hits,0);
});
test('Task4A canonical refuses setter on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  Object.defineProperty(target,key,{enumerable:true,set(){hits++;}});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row setter");assert.equal(hits,0);
});
test('Task4A canonical refuses proxy on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target=task4aTrapV1(original,()=>{hits++;});
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses missing key on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  delete target[key];
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row missing key");assert.equal(hits,0);
});
test('Task4A canonical refuses extra key on membership row without supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),keys=["memberships",0],original=ownedAt(value,keys),key=Object.keys(original)[0];
  let target=original,hits=0;const old=original[key];
  target.permission=true;
  if(keys.length)ownedSet(value,keys,target);
  task4aRefusedV1(normalize,keys.length?value:target,"membership row extra key");assert.equal(hits,0);
});
test('Task4A canonical refuses databases null prototype before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  Object.setPrototypeOf(target,null);
  value.databases=target;task4aRefusedV1(normalize,value,"databases null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses databases subclass before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target=new (class CatalogRows extends Array {})(...original);
  value.databases=target;task4aRefusedV1(normalize,value,"databases subclass");assert.equal(hits,0);
});
test('Task4A canonical refuses databases hole before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  delete target[0];
  value.databases=target;task4aRefusedV1(normalize,value,"databases hole");assert.equal(hits,0);
});
test('Task4A canonical refuses databases nonenumerable index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{value:first,enumerable:false});
  value.databases=target;task4aRefusedV1(normalize,value,"databases nonenumerable index");assert.equal(hits,0);
});
test('Task4A canonical refuses databases accessor index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{enumerable:true,get(){hits++;return first;}});
  value.databases=target;task4aRefusedV1(normalize,value,"databases accessor index");assert.equal(hits,0);
});
test('Task4A canonical refuses databases extra property before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target.permission=true;
  value.databases=target;task4aRefusedV1(normalize,value,"databases extra property");assert.equal(hits,0);
});
test('Task4A canonical refuses databases symbol before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target[Symbol('hidden')]=1;
  value.databases=target;task4aRefusedV1(normalize,value,"databases symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses databases proxy before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target=task4aTrapV1(original,()=>{hits++;});
  value.databases=target;task4aRefusedV1(normalize,value,"databases proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses databases inherited index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  delete target[0];Object.setPrototypeOf(target,Object.assign(Object.create(Array.prototype),{0:first}));
  value.databases=target;task4aRefusedV1(normalize,value,"databases inherited index");assert.equal(hits,0);
});
test('Task4A canonical refuses databases iterator before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target[Symbol.iterator]=()=>{hits++;throw Error('iterator');};
  value.databases=target;task4aRefusedV1(normalize,value,"databases iterator");assert.equal(hits,0);
});
test('Task4A canonical refuses databases sort method before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target.sort=()=>{hits++;throw Error('sort');};
  value.databases=target;task4aRefusedV1(normalize,value,"databases sort method");assert.equal(hits,0);
});
test('Task4A canonical refuses databases toJSON before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.databases;let target=original,hits=0;const first=original[0];
  target.toJSON=()=>{hits++;throw Error('toJSON');};
  value.databases=target;task4aRefusedV1(normalize,value,"databases toJSON");assert.equal(hits,0);
});
test('Task4A canonical refuses roles null prototype before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  Object.setPrototypeOf(target,null);
  value.roles=target;task4aRefusedV1(normalize,value,"roles null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses roles subclass before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target=new (class CatalogRows extends Array {})(...original);
  value.roles=target;task4aRefusedV1(normalize,value,"roles subclass");assert.equal(hits,0);
});
test('Task4A canonical refuses roles hole before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  delete target[0];
  value.roles=target;task4aRefusedV1(normalize,value,"roles hole");assert.equal(hits,0);
});
test('Task4A canonical refuses roles nonenumerable index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{value:first,enumerable:false});
  value.roles=target;task4aRefusedV1(normalize,value,"roles nonenumerable index");assert.equal(hits,0);
});
test('Task4A canonical refuses roles accessor index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{enumerable:true,get(){hits++;return first;}});
  value.roles=target;task4aRefusedV1(normalize,value,"roles accessor index");assert.equal(hits,0);
});
test('Task4A canonical refuses roles extra property before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target.permission=true;
  value.roles=target;task4aRefusedV1(normalize,value,"roles extra property");assert.equal(hits,0);
});
test('Task4A canonical refuses roles symbol before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target[Symbol('hidden')]=1;
  value.roles=target;task4aRefusedV1(normalize,value,"roles symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses roles proxy before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target=task4aTrapV1(original,()=>{hits++;});
  value.roles=target;task4aRefusedV1(normalize,value,"roles proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses roles inherited index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  delete target[0];Object.setPrototypeOf(target,Object.assign(Object.create(Array.prototype),{0:first}));
  value.roles=target;task4aRefusedV1(normalize,value,"roles inherited index");assert.equal(hits,0);
});
test('Task4A canonical refuses roles iterator before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target[Symbol.iterator]=()=>{hits++;throw Error('iterator');};
  value.roles=target;task4aRefusedV1(normalize,value,"roles iterator");assert.equal(hits,0);
});
test('Task4A canonical refuses roles sort method before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target.sort=()=>{hits++;throw Error('sort');};
  value.roles=target;task4aRefusedV1(normalize,value,"roles sort method");assert.equal(hits,0);
});
test('Task4A canonical refuses roles toJSON before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.roles;let target=original,hits=0;const first=original[0];
  target.toJSON=()=>{hits++;throw Error('toJSON');};
  value.roles=target;task4aRefusedV1(normalize,value,"roles toJSON");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships null prototype before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  Object.setPrototypeOf(target,null);
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships null prototype");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships subclass before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target=new (class CatalogRows extends Array {})(...original);
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships subclass");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships hole before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  delete target[0];
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships hole");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships nonenumerable index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{value:first,enumerable:false});
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships nonenumerable index");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships accessor index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  Object.defineProperty(target,'0',{enumerable:true,get(){hits++;return first;}});
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships accessor index");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships extra property before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target.permission=true;
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships extra property");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships symbol before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target[Symbol('hidden')]=1;
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships symbol");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships proxy before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target=task4aTrapV1(original,()=>{hits++;});
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships proxy");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships inherited index before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  delete target[0];Object.setPrototypeOf(target,Object.assign(Object.create(Array.prototype),{0:first}));
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships inherited index");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships iterator before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target[Symbol.iterator]=()=>{hits++;throw Error('iterator');};
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships iterator");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships sort method before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target.sort=()=>{hits++;throw Error('sort');};
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships sort method");assert.equal(hits,0);
});
test('Task4A canonical refuses memberships toJSON before supplied behavior',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1(),original=value.memberships;let target=original,hits=0;const first=original[0];
  target.toJSON=()=>{hits++;throw Error('toJSON');};
  value.memberships=target;task4aRefusedV1(normalize,value,"memberships toJSON");assert.equal(hits,0);
});
test('Task4A canonical refuses two database rows as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.databases.pop();
  task4aRefusedV1(normalize,value,"two database rows");
});
test('Task4A canonical refuses fourth database row as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.databases.push({name:'other',oid:6,ownerOid:1,allowConnections:true,connectionLimit:-1});
  task4aRefusedV1(normalize,value,"fourth database row");
});
test('Task4A canonical refuses empty roles as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.roles=[];
  task4aRefusedV1(normalize,value,"empty roles");
});
test('Task4A canonical refuses 129th role as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aWideCatalogV1();value.roles.push({...value.roles[0],oid:129,name:'r128'});
  task4aRefusedV1(normalize,value,"129th role");
});
test('Task4A canonical refuses 257th membership as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aWideCatalogV1();value.memberships.push({roleOid:1,memberOid:2,grantorOid:4,adminOption:true,inheritOption:false,setOption:true});
  task4aRefusedV1(normalize,value,"257th membership");
});
test('Task4A canonical refuses array length4294967295 as bounded catalog overflow or underflow',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.roles.length=4294967295;
  task4aRefusedV1(normalize,value,"array length4294967295");
});
test('Task4A canonical refuses nonnumber and out of range database oid values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["databases", 0, "oid"],bad);
    task4aRefusedV1(normalize,value,'database oid');
  }
});
test('Task4A canonical refuses nonnumber and out of range database owner values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["databases", 0, "ownerOid"],bad);
    task4aRefusedV1(normalize,value,'database owner');
  }
});
test('Task4A canonical refuses nonnumber and out of range role oid values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "oid"],bad);
    task4aRefusedV1(normalize,value,'role oid');
  }
});
test('Task4A canonical refuses nonnumber and out of range membership role values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "roleOid"],bad);
    task4aRefusedV1(normalize,value,'membership role');
  }
});
test('Task4A canonical refuses nonnumber and out of range membership member values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "memberOid"],bad);
    task4aRefusedV1(normalize,value,'membership member');
  }
});
test('Task4A canonical refuses nonnumber and out of range membership grantor values',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,-1,-0,4294967296,1.5,NaN,Infinity,-Infinity,'1',1n,null,undefined,new Number(1)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "grantorOid"],bad);
    task4aRefusedV1(normalize,value,'membership grantor');
  }
});
test('Task4A canonical refuses invalid database limit without integer coercion',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [-2,-0,2147483648,1.5,NaN,Infinity,-Infinity,'-1',null,undefined,1n]){
    const value=task4aCatalogV1();ownedSet(value,["databases", 0, "connectionLimit"],bad);
    task4aRefusedV1(normalize,value,'database limit');
  }
});
test('Task4A canonical refuses invalid role limit without integer coercion',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [-2,-0,2147483648,1.5,NaN,Infinity,-Infinity,'-1',null,undefined,1n]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "connectionLimit"],bad);
    task4aRefusedV1(normalize,value,'role limit');
  }
});
test('Task4A canonical refuses nonboolean database allowConnections',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["databases", 0, "allowConnections"],bad);
    task4aRefusedV1(normalize,value,'database allowConnections');
  }
});
test('Task4A canonical refuses nonboolean role superuser',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "superuser"],bad);
    task4aRefusedV1(normalize,value,'role superuser');
  }
});
test('Task4A canonical refuses nonboolean role inherit',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "inherit"],bad);
    task4aRefusedV1(normalize,value,'role inherit');
  }
});
test('Task4A canonical refuses nonboolean role createRole',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "createRole"],bad);
    task4aRefusedV1(normalize,value,'role createRole');
  }
});
test('Task4A canonical refuses nonboolean role createDb',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "createDb"],bad);
    task4aRefusedV1(normalize,value,'role createDb');
  }
});
test('Task4A canonical refuses nonboolean role login',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "login"],bad);
    task4aRefusedV1(normalize,value,'role login');
  }
});
test('Task4A canonical refuses nonboolean role replication',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "replication"],bad);
    task4aRefusedV1(normalize,value,'role replication');
  }
});
test('Task4A canonical refuses nonboolean role bypassRls',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["roles", 0, "bypassRls"],bad);
    task4aRefusedV1(normalize,value,'role bypassRls');
  }
});
test('Task4A canonical refuses nonboolean membership adminOption',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "adminOption"],bad);
    task4aRefusedV1(normalize,value,'membership adminOption');
  }
});
test('Task4A canonical refuses nonboolean membership inheritOption',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "inheritOption"],bad);
    task4aRefusedV1(normalize,value,'membership inheritOption');
  }
});
test('Task4A canonical refuses nonboolean membership setOption',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const bad of [0,1,'true',null,undefined,new Boolean(false)]){
    const value=task4aCatalogV1();ownedSet(value,["memberships", 0, "setOption"],bad);
    task4aRefusedV1(normalize,value,'membership setOption');
  }
});
test('Task4A canonical refuses duplicate database names with distinct OIDs',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.databases[0].name='postgres';
  task4aRefusedV1(normalize,value,"duplicate database names with distinct OIDs");
});
test('Task4A canonical refuses duplicate database OIDs with distinct names',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.databases[0].oid=5;
  task4aRefusedV1(normalize,value,"duplicate database OIDs with distinct names");
});
test('Task4A canonical refuses duplicate role names with distinct OIDs',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.roles[1].name='root';
  task4aRefusedV1(normalize,value,"duplicate role names with distinct OIDs");
});
test('Task4A canonical refuses duplicate role OIDs with distinct names',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.roles[1].oid=1;
  task4aRefusedV1(normalize,value,"duplicate role OIDs with distinct names");
});
test('Task4A canonical refuses duplicate membership triple despite changed flags',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.memberships.push({...value.memberships[0],adminOption:false});
  task4aRefusedV1(normalize,value,"duplicate membership triple despite changed flags");
});
test('Task4A canonical refuses unknown database owner',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.databases[0].ownerOid=99;
  task4aRefusedV1(normalize,value,"unknown database owner");
});
test('Task4A canonical refuses unknown membership role',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.memberships[0].roleOid=99;
  task4aRefusedV1(normalize,value,"unknown membership role");
});
test('Task4A canonical refuses unknown membership member',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.memberships[0].memberOid=99;
  task4aRefusedV1(normalize,value,"unknown membership member");
});
test('Task4A canonical refuses unknown membership grantor',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.memberships[0].grantorOid=99;
  task4aRefusedV1(normalize,value,"unknown membership grantor");
});
test('Task4A canonical refuses self membership',()=>{
  const normalize=task4aCanonicalizerV1();
  const value=task4aCatalogV1();value.memberships[0].memberOid=3;
  task4aRefusedV1(normalize,value,"self membership");
});
test('Task4A canonical rejects nonrecord top primitives without coercing them',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const value of [undefined,false,0,'catalog',1n,Symbol('catalog'),()=>{}])task4aRefusedV1(normalize,value,'top primitive');
});
test('Task4A canonical accepts OID4294967295 with complete role references',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();value.roles[0].oid=4294967295;
  value.databases.forEach(row=>{if(row.ownerOid===1)row.ownerOid=4294967295;});
  for(const row of value.memberships)for(const key of ['roleOid','memberOid','grantorOid'])if(row[key]===1)row[key]=4294967295;
  value.databases[1].oid=4294967295;const output=normalize(value);
  assert.equal(output.roles[1].oid,4294967295);assert.equal(output.databases[0].oid,4294967295);
  assert.equal(output.memberships.at(-1).roleOid,4294967295);
});
test('Task4A canonical preserves role names at1 and63 UTF8 bytes including multibyte names',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const name of ['x','x'.repeat(63),'é'.repeat(31)+'x','\u{10000}'.repeat(15)+'xyz']){
    const value=task4aCatalogV1();value.roles[0].name=name;
    assert.equal(normalize(value).roles.some(row=>row.name===name),true);
  }
});
test('Task4A canonical refuses malformed or oversized role names before coercion',()=>{
  const normalize=task4aCanonicalizerV1();let hits=0;
  for(const name of ['', 'x'.repeat(64),'é'.repeat(32),'a\0b','\ud800','\udc00','x\ud800y',
    1,1n,null,undefined,new String('root'),{toString(){hits++;throw Error('coercion');}}]){
    const value=task4aCatalogV1();value.roles[0].name=name;task4aRefusedV1(normalize,value,'role name');
  }
  assert.equal(hits,0);
});
test('Task4A canonical refuses database names outside the exact three literals',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const name of ['POSTGRES',' postgres','postgres ','other','',1,new String('postgres')]){
    const value=task4aCatalogV1();value.databases[1].name=name;task4aRefusedV1(normalize,value,'database name');
  }
});
test('Task4A canonical preserves null infinities and all microseconds across PG year boundaries',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const expiry of [null,'infinity','-infinity','0001-01-01T00:00:00.000001Z',
    '9999-12-31T23:59:59.999999Z','2000-02-29T12:34:56.123456Z','2026-10-21T00:00:00.000000Z']){
    const value=task4aCatalogV1();value.roles[0].validUntilUTC=expiry;
    assert.equal(normalize(value).roles.find(row=>row.name==='root').validUntilUTC,expiry);
  }
});
test('Task4A canonical refuses expiry calendar shape precision year0000 and coercion faults',()=>{
  const normalize=task4aCanonicalizerV1();
  for(const expiry of ['0000-01-01T00:00:00.000000Z','1900-02-29T00:00:00.000000Z',
    '2026-02-30T00:00:00.123456Z','2026-13-01T00:00:00.123456Z','2026-01-01T24:00:00.123456Z',
    '2026-01-01T00:60:00.123456Z','2026-01-01T00:00:60.123456Z','2026-01-01T00:00:00.123Z',
    '2026-01-01T00:00:00.1234567Z','2026-01-01 00:00:00.123456Z','2026-01-01T00:00:00.123456z',
    '2026-01-01T00:00:00.123456+00:00','+010000-01-01T00:00:00.123456Z',
    'INFINITY','Infinity','-Infinity',0,undefined,new Date(0),new String('infinity')]){
    const value=task4aCatalogV1();value.roles[0].validUntilUTC=expiry;task4aRefusedV1(normalize,value,'expiry');
  }
});
test('Task4A canonical rejects revoked proxies without reflective traps or private causes',()=>{
  const normalize=task4aCanonicalizerV1(),revocable=Proxy.revocable({},{});revocable.revoke();
  task4aRefusedV1(normalize,revocable.proxy,'revoked proxy');
});
test('Task4A canonical finite array bounds are checked before indexed getter access',()=>{
  const normalize=task4aCanonicalizerV1();let hits=0;
  for(const [key,length] of [['databases',4],['roles',129],['memberships',257]]){
    const value=task4aCatalogV1();value[key].length=length;
    Object.defineProperty(value[key],'0',{enumerable:true,get(){hits++;throw Error('index getter');}});
    task4aRefusedV1(normalize,value,key+' bounds before index');
  }
  assert.equal(hits,0);
});
// A complete-helper VM has its own Object/Array prototypes. Copy the fixed
// literal catalog into that realm through native constructors obtained from
// its real legacy decoder; no callback, copied validator or Source owner fake.
function task4aRealmCatalogV1(vm){
  const record=vm.actual.decodeManualOrphanProbeFrameV1(CODEC_EXPECTED_V1);
  const Plain=Object.getPrototypeOf(record).constructor;
  const Dense=Object.getPrototypeOf(Plain.getOwnPropertyNames(record)).constructor;
  const copy=value=>Array.isArray(value)?Dense.from(value,copy):value!==null&&typeof value==='object'?
    Plain.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)])):value;
  return copy(task4aCatalogV1());
}
test('Task4A canonical complete helper DATA call has no IO process timer or owner acquisition',()=>{
  task4aCanonicalizerV1();const vm=fixedProbeVmV1();
  const output=vm.actual.canonicalizeManualOrphanClusterBaselineV1(task4aRealmCatalogV1(vm));
  assert.deepEqual(observedDataV1(output),task4aLiteralOutputV1());
  assert.deepEqual(vm.timers,[]);vm.assertContained();
});
test('Task4A canonical sanitizes actual crypto createHash failure without fallback digest',()=>{
  task4aCanonicalizerV1();let calls=0;
  const vm=fixedProbeVmV1({crypto:{createHash(algorithm,...args){
    assert.equal(algorithm,'sha256');calls++;
    throw Error('PRIVATE_HASH_FAILURE');
  }}});
  task4aRefusedV1(vm.actual.canonicalizeManualOrphanClusterBaselineV1,task4aRealmCatalogV1(vm),'createHash fault');
  assert.ok(calls>=2&&calls<=6,'each refused call reaches real crypto without unbounded fallback');
  assert.deepEqual(vm.timers,[]);vm.assertContained();
});
test('Task4A canonical sanitizes actual crypto update failure without fallback digest',()=>{
  task4aCanonicalizerV1();let calls=0;
  const vm=fixedProbeVmV1({crypto:{createHash(algorithm,...args){
    assert.equal(algorithm,'sha256');calls++;
    const hash=createHash(algorithm,...args);
    hash.update=()=>{throw Error('PRIVATE_HASH_FAILURE');};return hash;
  }}});
  task4aRefusedV1(vm.actual.canonicalizeManualOrphanClusterBaselineV1,task4aRealmCatalogV1(vm),'update fault');
  assert.ok(calls>=2&&calls<=6,'each refused call reaches real crypto without unbounded fallback');
  assert.deepEqual(vm.timers,[]);vm.assertContained();
});
test('Task4A canonical sanitizes actual crypto digest failure without fallback digest',()=>{
  task4aCanonicalizerV1();let calls=0;
  const vm=fixedProbeVmV1({crypto:{createHash(algorithm,...args){
    assert.equal(algorithm,'sha256');calls++;
    const hash=createHash(algorithm,...args);
    hash.digest=()=>{throw Error('PRIVATE_HASH_FAILURE');};return hash;
  }}});
  task4aRefusedV1(vm.actual.canonicalizeManualOrphanClusterBaselineV1,task4aRealmCatalogV1(vm),'digest fault');
  assert.ok(calls>=2&&calls<=6,'each refused call reaches real crypto without unbounded fallback');
  assert.deepEqual(vm.timers,[]);vm.assertContained();
});

// Setup-only coordinated field development. All phase and result schemas stay
// unchanged; these assertions are DATA predicates and never ownership proofs.
test('Task4A setup old independent bytes and old missing member object now refuse',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame');
  const old=JSON.parse(OWN_SETUP_OLD_WIRE);assert.equal(Object.hasOwn(old,'constructorAdminBackend'),false);
  frameRefusedV1(()=>encode(old),'old missing backend object');
  frameRefusedV1(()=>decode(Buffer.from(OWN_SETUP_OLD_WIRE)),'old missing backend bytes');
});
test('Task4A setup new exact field and nested order are canonical with independent wire bytes',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame');
  const value=ownedSetupData(),output=decode(Buffer.from(OWN_SETUP_WIRE));
  assert.deepEqual(Object.keys(output),['schema','run','constructor','runner','server','source','cluster','constructorAdminBackend','adminPassword']);
  assert.deepEqual(Object.keys(output.constructorAdminBackend),['pid','backendStartedAtUTC']);
  assert.deepEqual(encode(value),Buffer.from(OWN_SETUP_WIRE));assert.deepEqual(output,value);
  assert.equal(Object.isFrozen(output.constructorAdminBackend),true);
  value.constructorAdminBackend.pid=999;assert.equal(output.constructorAdminBackend.pid,104);
});
test('Task4A setup carries backend DATA without invented process PID inequality',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame');
  for(const pid of [1,101,102,103,2147483647]){
    const value=ownedSetupData();value.constructorAdminBackend.pid=pid;
    const want=Buffer.from(OWN_SETUP_WIRE.replace('"constructorAdminBackend":{"pid":104,',
      '"constructorAdminBackend":{"pid":'+pid+','));
    assert.deepEqual(encode(value),want);assert.equal(decode(want).constructorAdminBackend.pid,pid);
  }
});
test('Task4A setup refuses backend PID coercions and complete unsafe integer domain',()=>{
  for(const pid of [0,-0,-1,2147483648,1.5,NaN,Infinity,-Infinity,'104',104n,null,undefined,new Number(104)]){
    const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData();value.constructorAdminBackend.pid=pid;
    frameRefusedV1(()=>encode(value),'backend pid encoder');
    if(typeof pid!=='bigint'&&!(pid instanceof Number))frameRefusedV1(()=>ownedCodec('decode','RunnerSetupFrame')(Buffer.from(JSON.stringify(value)+'\n')),'backend pid decoder');
  }
});
test('Task4A setup preserves PG year1 through9999 and six backend start fractional digits',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),decode=ownedCodec('decode','RunnerSetupFrame');
  for(const timestamp of ['0001-01-01T00:00:00.000001Z','9999-12-31T23:59:59.999999Z','2000-02-29T12:34:56.123456Z']){
    const value=ownedSetupData();value.constructorAdminBackend.backendStartedAtUTC=timestamp;
    const want=Buffer.from(OWN_SETUP_WIRE.replace('2026-10-21T00:00:00.234567Z',timestamp));
    assert.deepEqual(encode(value),want);assert.equal(decode(want).constructorAdminBackend.backendStartedAtUTC,timestamp);
  }
});
test('Task4A setup refuses backend calendar precision UTC year0000 and timestamp coercions',()=>{
  for(const timestamp of ['0000-01-01T00:00:00.000000Z','1900-02-29T00:00:00.000000Z',
    '2026-02-30T00:00:00.234567Z','2026-13-01T00:00:00.234567Z','2026-01-01T24:00:00.234567Z',
    '2026-01-01T00:60:00.234567Z','2026-01-01T00:00:60.234567Z','2026-10-21T00:00:00.234Z',
    '2026-10-21T00:00:00.2345670Z','2026-10-21 00:00:00.234567Z','2026-10-21T00:00:00.234567z',
    '2026-10-21T00:00:00.234567+00:00','+010000-01-01T00:00:00.234567Z','infinity','-infinity',
    null,undefined,0,new Date(0),new String('2026-10-21T00:00:00.234567Z')]){
    if(timestamp instanceof String){
      const value=ownedSetupData();value.constructorAdminBackend.backendStartedAtUTC=timestamp;
      frameRefusedV1(()=>ownedCodec('encode','RunnerSetupFrame')(value),'boxed timestamp');
    }else ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{value.constructorAdminBackend.backendStartedAtUTC=timestamp;},'backend timestamp');
  }
});
test('Task4A setup rejects textual backend PID negative zero at decode',()=>{
  const decode=ownedCodec('decode','RunnerSetupFrame');
  const wire=OWN_SETUP_WIRE.replace('"constructorAdminBackend":{"pid":104,','"constructorAdminBackend":{"pid":-0,');
  frameRefusedV1(()=>decode(Buffer.from(wire)),'backend negative zero wire');
});
test('Task4A setup encoder reorders backend keys but decoder rejects noncanonical nested order',()=>{
  const value=ownedSetupData(),backend=value.constructorAdminBackend;
  value.constructorAdminBackend={backendStartedAtUTC:backend.backendStartedAtUTC,pid:backend.pid};
  assert.deepEqual(ownedCodec('encode','RunnerSetupFrame')(value),Buffer.from(OWN_SETUP_WIRE));
  frameRefusedV1(()=>ownedCodec('decode','RunnerSetupFrame')(Buffer.from(JSON.stringify(value)+'\n')),'backend reversed wire');
});
test('Task4A setup wire hash binds backend PID and submillisecond timestamp DATA',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),original=createHash('sha256').update(OWN_SETUP_WIRE).digest('hex');
  for(const [field,replacement,oldText,newText] of [['pid',105,'"constructorAdminBackend":{"pid":104,','"constructorAdminBackend":{"pid":105,'],
    ['backendStartedAtUTC','2026-10-21T00:00:00.234568Z','2026-10-21T00:00:00.234567Z','2026-10-21T00:00:00.234568Z']]){
    const value=ownedSetupData();value.constructorAdminBackend[field]=replacement;
    const want=Buffer.from(OWN_SETUP_WIRE.replace(oldText,newText)),actual=encode(value);
    assert.deepEqual(actual,want);const digest=createHash('sha256').update(actual).digest('hex');
    assert.equal(digest,createHash('sha256').update(want).digest('hex'));assert.notEqual(digest,original);
  }
});
test('Task4A setup rejects getter on new top member before reading supplied backend',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData();let hits=0;
  Object.defineProperty(value,'constructorAdminBackend',{enumerable:true,get(){hits++;throw Error('private backend');}});
  frameRefusedV1(()=>encode(value),'top backend getter');assert.equal(hits,0);
});
test('Task4A setup refuses null backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend=null;
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend null");assert.equal(hits,0);
});
test('Task4A setup refuses array backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend=Object.assign([],original);
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend array");assert.equal(hits,0);
});
test('Task4A setup refuses null prototype backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend=Object.assign(Object.create(null),original);
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend null prototype");assert.equal(hits,0);
});
test('Task4A setup refuses class backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend=Object.assign(new (class BackendData {})(),original);
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend class");assert.equal(hits,0);
});
test('Task4A setup refuses symbol backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend[Symbol('hidden')]=1;
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend symbol");assert.equal(hits,0);
});
test('Task4A setup refuses nonenumerable backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  Object.defineProperty(backend,'hidden',{value:1,enumerable:false});
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend nonenumerable");assert.equal(hits,0);
});
test('Task4A setup refuses getter backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  Object.defineProperty(backend,'pid',{enumerable:true,get(){hits++;return pid;}});
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend getter");assert.equal(hits,0);
});
test('Task4A setup refuses setter backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  Object.defineProperty(backend,'pid',{enumerable:true,set(){hits++;}});
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend setter");assert.equal(hits,0);
});
test('Task4A setup refuses proxy backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend=task4aTrapV1(backend,()=>{hits++;});
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend proxy");assert.equal(hits,0);
});
test('Task4A setup refuses missing key backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  delete backend.pid;
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend missing key");assert.equal(hits,0);
});
test('Task4A setup refuses extra key backend descriptor shape without supplied behavior',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame'),value=ownedSetupData(),original=value.constructorAdminBackend;
  let backend=original,hits=0;const pid=original.pid;
  backend.refresh=true;
  value.constructorAdminBackend=backend;frameRefusedV1(()=>encode(value),"backend extra key");assert.equal(hits,0);
});
test('Task4A provision phase refuses setup-only backend on frame and shared cluster',()=>{
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('provision'),value=>{
    value.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'phase top backend');
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('provision'),value=>{
    value.cluster.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'shared cluster backend');
});
test('Task4A activate phase refuses setup-only backend on frame and shared cluster',()=>{
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('activate'),value=>{
    value.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'phase top backend');
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('activate'),value=>{
    value.cluster.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'shared cluster backend');
});
test('Task4A integration phase refuses setup-only backend on frame and shared cluster',()=>{
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('integration'),value=>{
    value.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'phase top backend');
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('integration'),value=>{
    value.cluster.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'shared cluster backend');
});
test('Task4A old_entry_positive phase refuses setup-only backend on frame and shared cluster',()=>{
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('old_entry_positive'),value=>{
    value.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'phase top backend');
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('old_entry_positive'),value=>{
    value.cluster.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'shared cluster backend');
});
test('Task4A new_entry_refusal phase refuses setup-only backend on frame and shared cluster',()=>{
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('new_entry_refusal'),value=>{
    value.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'phase top backend');
  ownedRejectData('OwnedPhaseFrame',()=>ownedPhaseData('new_entry_refusal'),value=>{
    value.cluster.constructorAdminBackend={pid:104,backendStartedAtUTC:'2026-10-21T00:00:00.234567Z'};
  },'shared cluster backend');
});
test('Task4A setup refuses backend start getter missing key and alias without compatibility defaults',()=>{
  const encode=ownedCodec('encode','RunnerSetupFrame');let hits=0;
  const getter=ownedSetupData();Object.defineProperty(getter.constructorAdminBackend,'backendStartedAtUTC',{
    enumerable:true,get(){hits++;throw Error('private start');}});
  frameRefusedV1(()=>encode(getter),'backend start getter');assert.equal(hits,0);
  ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{delete value.constructorAdminBackend.backendStartedAtUTC;},'missing start');
  ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{
    value.constructorAdminBackend.startedAtUTC=value.constructorAdminBackend.backendStartedAtUTC;
    delete value.constructorAdminBackend.backendStartedAtUTC;
  },'backend start alias');
});
test('Task4A setup refuses backend selector or catalog arrays added to unchanged cluster schema',()=>{
  ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{
    value.cluster.constructorAdminBackend=value.constructorAdminBackend;
  },'backend inside cluster');
  ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{value.cluster.databases=[];},'catalog arrays inside cluster');
  ownedRejectData('RunnerSetupFrame',ownedSetupData,value=>{value.cluster.canonicalBytes=1164;},'byte count inside cluster');
});
test('Task4A canonical sorts complete membership triples numerically at role member and grantor positions',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();
  value.roles.push({...value.roles[0],name:'ten',oid:10});
  value.memberships=[[10,2,1],[1,10,3],[2,10,1],[1,2,10],[1,2,3]].map(([roleOid,memberOid,grantorOid])=>({
    roleOid,memberOid,grantorOid,adminOption:false,inheritOption:true,setOption:false}));
  assert.deepEqual(normalize(value).memberships.map(row=>[row.roleOid,row.memberOid,row.grantorOid]),
    [[1,2,3],[1,2,10],[1,10,3],[2,10,1],[10,2,1]]);
});
test('Task4A canonical hashes actual UTF8 Unicode role bytes with independent digest and byte oracle',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();value.roles[0].name='é';
  const output=normalize(value);assert.deepEqual(output.roles.map(row=>row.name),['A','z','é']);
  assert.equal(output.canonicalBytes,1162);
  assert.equal(output.roleBaselineSha256,'8f24b84382fb68cfc6b1d77218256efb9f37d9a45751f8e85be8be81f840f54c');
  assert.equal(output.databaseBaselineSha256,'bb76048d47ee235365f864509ed15cad36b1020c013aae18ef35f1fd7de32cce');
  assert.equal(output.membershipBaselineSha256,'1cd136273a1cffdab688441c0298d89f29a3d3866205c919350b8710b14156e8');
});
test('Task4A canonical refuses databases arraylike object despite Array prototype and dense data indexes',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1(),original=value.databases;
  const impostor=Object.assign(Object.create(Array.prototype),original);
  Object.defineProperty(impostor,'length',{value:original.length,writable:true,enumerable:false,configurable:false});
  value.databases=impostor;task4aRefusedV1(normalize,value,'non Array arraylike');
});
test('Task4A canonical refuses databases setter-only array index without invocation',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();let hits=0;
  Object.defineProperty(value.databases,'0',{enumerable:true,set(){hits++;}});
  task4aRefusedV1(normalize,value,'array index setter');assert.equal(hits,0);
});
test('Task4A canonical refuses roles arraylike object despite Array prototype and dense data indexes',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1(),original=value.roles;
  const impostor=Object.assign(Object.create(Array.prototype),original);
  Object.defineProperty(impostor,'length',{value:original.length,writable:true,enumerable:false,configurable:false});
  value.roles=impostor;task4aRefusedV1(normalize,value,'non Array arraylike');
});
test('Task4A canonical refuses roles setter-only array index without invocation',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();let hits=0;
  Object.defineProperty(value.roles,'0',{enumerable:true,set(){hits++;}});
  task4aRefusedV1(normalize,value,'array index setter');assert.equal(hits,0);
});
test('Task4A canonical refuses memberships arraylike object despite Array prototype and dense data indexes',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1(),original=value.memberships;
  const impostor=Object.assign(Object.create(Array.prototype),original);
  Object.defineProperty(impostor,'length',{value:original.length,writable:true,enumerable:false,configurable:false});
  value.memberships=impostor;task4aRefusedV1(normalize,value,'non Array arraylike');
});
test('Task4A canonical refuses memberships setter-only array index without invocation',()=>{
  const normalize=task4aCanonicalizerV1(),value=task4aCatalogV1();let hits=0;
  Object.defineProperty(value.memberships,'0',{enumerable:true,set(){hits++;}});
  task4aRefusedV1(normalize,value,'array index setter');assert.equal(hits,0);
});

// Task5A collector component regressions. These literal registrations exercise
// the complete actual shared engine, never a Source holder, runner or owner.
// Each callback gates the real future export before any VM/fixture work.
function task5aCollectorGateV1(actual=helper){
  assert.equal(typeof actual?.observeManualOrphanOwnedIntegrationChildV1,'function',
    'missing Task5A observeManualOrphanOwnedIntegrationChildV1 (collector scaffolding RED)');
}
const TASK5A_MARKER_PREFIX_V1='MANUAL_ORPHAN_INTEGRATION_RESULT ';
const TASK5A_PASS_NAME_V1='manual orphan bootstrap v1 preserves old entry and refuses maintenance source';
const TASK5A_SUMMARY_LINES_V1=['ℹ tests 1','ℹ suites 0','ℹ pass 1','ℹ fail 0','ℹ cancelled 0','ℹ skipped 0','ℹ todo 0'];
function task5aReportV1(passDuration='2.674667',summaryDuration='58.297125'){
  return ['✔ '+TASK5A_PASS_NAME_V1+' ('+passDuration+'ms)',...TASK5A_SUMMARY_LINES_V1,
    'ℹ duration_ms '+summaryDuration].join('\n')+'\n';
}
function task5aWireV1(){
  const bytes=helper.encodeManualOrphanIntegrationResultV1(ownedIntegrationData());
  assert.deepEqual(bytes,Buffer.from(OWN_INTEGRATION_WIRE),'real codec agrees with independent existing literal');
  return Buffer.concat([Buffer.from(TASK5A_MARKER_PREFIX_V1),bytes,Buffer.from(task5aReportV1())]);
}
function task5aMarkerV1(payload=OWN_INTEGRATION_WIRE){return TASK5A_MARKER_PREFIX_V1+payload;}
function task5aIntegrationV1(w,state){
  const output=w.output();
  assert.equal(output.integration.state,state);
  if(state!=='observed')assert.deepEqual(observedDataV1(output.integration),{state,marker:null,summary:null});
  return output;
}
function task5aAcceptedV1(w){
  assert.equal(w.snapshot().state,'observed');const output=task5aIntegrationV1(w,'observed');
  assert.deepEqual(observedDataV1(output.integration.marker),ownedIntegrationData());
  assert.deepEqual(observedDataV1(output.integration.summary),{tests:1,suites:0,pass:1,fail:0,cancelled:0,skipped:0,todo:0});
  return output;
}
function task5aAllBytesV1(w,stdout,stderr=Buffer.alloc(0)){
  const now=w.snapshot();
  for(const [name,bytes] of [['stdout',stdout],['stderr',stderr]]){
    assert.equal(now[name].bytes,bytes.length,name+' full byte count');
    assert.equal(now[name].sha256,createHash('sha256').update(bytes).digest('hex'),name+' full digest');
  }
}
async function task5aTranscriptV1(vm,bytes,{chunks,stderr,code=0,configure,afterData}={}){
  task5aCollectorGateV1(vm.actual);const f=task3EventFixtureV1('integration');if(configure)configure(f);
  const w=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
  try{
    for(const chunk of chunks??[bytes])f.channels.stdout.emit('data',chunk);
    if(stderr)f.channels.stderr.emit('data',stderr);
    if(afterData)afterData(f,w);
    task3CompleteV1(f,'integration',code);await w.settled;
    return {f,w};
  }finally{
    if(w.snapshot().state==='pending')f.child.emit('error',Error('COMPONENT_END'));
    f.assertGuarded();vm.assertContained();
  }
}
async function task5aRefusedTranscriptV1(vm,bytes,{unknown=false,...options}={}){
  const {w}=await task5aTranscriptV1(vm,bytes,options);task5aIntegrationV1(w,'refused');
  if(unknown)assert.equal(w.snapshot().state,'unknown');
  else assert.equal(w.snapshot().state,'observed','deterministic content refusal preserves actual transport facts');
  task5aAllBytesV1(w,bytes,options.stderr);return w;
}

// Break: marker/report credit must wait for every actual terminal observation.
test('Task5A 01 calibrated collector publishes only after complete original lifecycle',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1();task5aCollectorGateV1(vm.actual);
  const f=task3EventFixtureV1('integration'),w=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child),bytes=task5aWireV1();
  try{
    assert.equal(helper.observeManualOrphanOwnedIntegrationChildV1.length,1);
    assert.equal(vm.actual.observeManualOrphanOwnedIntegrationChildV1.length,1);
    assert.equal(Object.isFrozen(w),true);assert.deepEqual(Object.keys(w),['settled','snapshot','output']);
    task5aIntegrationV1(w,'pending');f.child.emit('spawn');f.channels.stdout.emit('data',bytes);
    task5aIntegrationV1(w,'pending');
    for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');task5aIntegrationV1(w,'pending');}
    f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.child.emit('exit',0,null);f.child.emit('close',0,null);
    assert.equal(w.snapshot().state,'pending');task5aIntegrationV1(w,'pending');
    f.channels.fd4.emit('close');assert.equal((await w.settled).state,'observed');task5aAcceptedV1(w);task5aAllBytesV1(w,bytes);
    assert.equal(vm.timers.length,1);assert.equal(vm.timers[0].delay,300000);assert.deepEqual(vm.cleared,[vm.timers[0].handle]);
    task3FrozenV1(w.snapshot());
  }finally{if(w.snapshot().state==='pending')f.child.emit('error',Error('COMPONENT_END'));f.assertGuarded();vm.assertContained();}
});

// Break: scanning the retained diagnostic prefix loses a later real marker.
test('Task5A 02 collector scans beyond diagnostic prefix and long neutral lines',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),tail=task5aWireV1();
  for(const preamble of ['neutral\n'.repeat(8193),'n'.repeat(70000)+'\n']){
    const bytes=Buffer.concat([Buffer.from(preamble),tail]),{w}=await task5aTranscriptV1(vm,bytes);
    const out=task5aAcceptedV1(w);assert.equal(out.stdout.length,65536);assert.deepEqual(out.stdout,bytes.subarray(0,65536));
    assert.equal(out.stdout.includes(Buffer.from(TASK5A_MARKER_PREFIX_V1)),false);task5aAllBytesV1(w,bytes);
  }
});

// Break: chunk boundaries cannot reset UTF8, marker, decimal or line state.
test('Task5A 03 every finite transcript byte split has identical collector data',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),bytes=task5aWireV1();
  for(let split=1;split<bytes.length;split++){
    const {w}=await task5aTranscriptV1(vm,bytes,{chunks:[bytes.subarray(0,split),bytes.subarray(split)]});
    task5aAcceptedV1(w);task5aAllBytesV1(w,bytes);
  }
  for(const chunks of [[bytes],Array.from(bytes,byte=>Buffer.from([byte]))]){
    const {w}=await task5aTranscriptV1(vm,bytes,{chunks});task5aAcceptedV1(w);task5aAllBytesV1(w,bytes);
  }
  vm.assertContained();
});

// Break: a marker alone, report alone or nonzero exit is never integration success.
test('Task5A 04 marker and exact report are jointly necessary for success',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),marker=task5aMarkerV1(),report=task5aReportV1();
  for(const text of [marker,report,report+marker,marker+report.replace(TASK5A_PASS_NAME_V1,'another test')])
    await task5aRefusedTranscriptV1(vm,Buffer.from(text));
  await task5aRefusedTranscriptV1(vm,task5aWireV1(),{code:1});
});

// Break: reserved-family output cannot hide in preamble, indentation or a long line.
test('Task5A 05 reserved marker family rejects duplicates partials and embedded bytes',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),marker=task5aMarkerV1(),report=task5aReportV1();
  const rows=[
    ['duplicate before PASS',marker+marker+report],
    ['duplicate after PASS',marker+report.split('\n')[0]+'\n'+marker+report.split('\n').slice(1).join('\n')],
    ['malformed family','MANUAL_ORPHAN_UNSUPPORTED\n'+marker+report],
    ['embedded','neutral '+marker+report],['indented',' '+marker+report],
    ['partial LF','MANUAL_ORPHAN_INTEGRATION_RESUL\n'+marker+report],
    ['partial EOF','MANUAL_ORPHAN_INTEGRATION_RESUL'],
    ['family LF','MANUAL_ORPHAN_\n'+marker+report],['family EOF','MANUAL_ORPHAN_'],
    ['spaced partial','   MANUAL_ORPHAN_INTEGRATION\n'+marker+report],
    ['missing separator','MANUAL_ORPHAN_INTEGRATION_RESULT'+OWN_INTEGRATION_WIRE+report],
    ['overflow line',TASK5A_MARKER_PREFIX_V1+'x'.repeat(16351)+'\n'+report],
    ['deep embedded','n'.repeat(70000)+marker+report],
    ['second family in preamble','MANUAL_ORPHAN_INTEGRATION_RESULTx MANUAL_ORPHAN_\n'+marker+report],
  ];
  for(const [label,text] of rows){
    const bytes=Buffer.from(text);const w=await task5aRefusedTranscriptV1(vm,bytes);
    assert.equal(w.snapshot().stdout.bytes,bytes.length,label);
  }
  const bytes=Buffer.from('n'.repeat(65535)+'\n'+marker+report);
  const {w}=await task5aTranscriptV1(vm,bytes,{chunks:[bytes.subarray(0,65536+17),bytes.subarray(65536+17)]});
  task5aAcceptedV1(w);task5aAllBytesV1(w,bytes);
});

// Break: JSON permissiveness must not bypass the existing canonical codec;
// its indistinguishable thrown failures conservatively burn engine certainty.
test('Task5A 06 actual strict codec exceptions differ from scanner content refusal',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),report=task5aReportV1();
  const codecRows=[
    ['duplicate key',OWN_INTEGRATION_WIRE.replace('{','{"schema":"setfarm.manual-orphan-integration-result.v1",')],
    ['reordered keys',OWN_INTEGRATION_WIRE.replace('"pid":104,"parentPid":102','"parentPid":102,"pid":104')],
    ['wrong schema',OWN_INTEGRATION_WIRE.replace('integration-result.v1','integration-result.v2')],
    ['wrong type',OWN_INTEGRATION_WIRE.replace('"pid":104','"pid":"104"')],
    ['extra field',OWN_INTEGRATION_WIRE.replace('"sourcePinsClosed":true','"sourcePinsClosed":true,"extra":0')],
    ['whitespace',' '+OWN_INTEGRATION_WIRE],
    ['suffix',OWN_INTEGRATION_WIRE.replace('}\n','}suffix\n')],
    ['empty payload','\n'],
    ['line exactly16384',OWN_INTEGRATION_WIRE.slice(0,-1)+' '.repeat(16351-Buffer.byteLength(OWN_INTEGRATION_WIRE))+'\n'],
  ];
  for(const [label,payload] of codecRows){
    const bytes=Buffer.from(task5aMarkerV1(payload)+report);
    const w=await task5aRefusedTranscriptV1(vm,bytes,{unknown:true});assert.equal(w.snapshot().reason,'binding',label);
  }
  const invalidUtf8=Buffer.concat([Buffer.from(TASK5A_MARKER_PREFIX_V1+'{"schema":"'),Buffer.from([255]),Buffer.from('"}\n'+report)]);
  for(const bytes of [invalidUtf8,Buffer.from(TASK5A_MARKER_PREFIX_V1+'x'.repeat(16351)+'\n'+report),
    Buffer.from(TASK5A_MARKER_PREFIX_V1+'x'.repeat(16383)+'\n'+report),
    Buffer.from(task5aMarkerV1(OWN_INTEGRATION_WIRE.slice(0,-1)))]){
    await task5aRefusedTranscriptV1(vm,bytes);
  }
});

// Break: neither marker presence nor familiar counters may supply missing PASS/count credit.
test('Task5A 07 report requires one PASS and every ordered exact summary count',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),marker=task5aMarkerV1(),lines=task5aReportV1().trimEnd().split('\n');
  const reports=[
    [lines[0],...lines].join('\n')+'\n',lines.join('\n').replace('✔','✖')+'\n',
    lines.join('\n').replace(TASK5A_PASS_NAME_V1,'unexpected test')+'\n',
    [lines[0],lines[0].replace(TASK5A_PASS_NAME_V1,'second test'),...lines.slice(1)].join('\n')+'\n',
    [lines[0],'▶ extra suite',...lines.slice(1)].join('\n')+'\n',
    [lines[0],lines[1],...lines.slice(1)].join('\n')+'\n',lines.slice(1).join('\n')+'\n',
    lines.slice(0,-1).join('\n')+'\n',lines.join('\n').replace('ℹ tests 1','ℹ tests 01')+'\n',
    lines.join('\n').replace('ℹ fail 0','ℹ fail -1')+'\n',lines.join('\n').replace('ℹ tests 1','ℹ tests 1.0')+'\n',
    lines.join('\n').replace('ℹ tests 1','ℹ tests 9007199254740993')+'\n',lines.join('\n').replace('ℹ tests 1','ℹ Tests 1')+'\n',
  ];
  for(let index=1;index<=7;index++){
    reports.push(lines.filter((_,at)=>at!==index).join('\n')+'\n');
    const changed=[...lines];changed[index]=changed[index].slice(0,-1)+(index===1||index===3?'2':'1');reports.push(changed.join('\n')+'\n');
  }
  for(let first=1;first<=7;first++)for(let second=first+1;second<=7;second++){
    const swapped=[...lines];[swapped[first],swapped[second]]=[swapped[second],swapped[first]];reports.push(swapped.join('\n')+'\n');
  }
  assert.equal(reports.length,48);
  for(const report of reports)await task5aRefusedTranscriptV1(vm,Buffer.from(marker+report));
});

// Break: unsupported reporter families may not pass as neutral preamble/noise.
test('Task5A 08 unsupported TAP status families and interleaved noise refuse',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),marker=task5aMarkerV1(),report=task5aReportV1();
  const tap='TAP version 13\n# Subtest: '+TASK5A_PASS_NAME_V1+'\nok 1 - '+TASK5A_PASS_NAME_V1+'\n1..1\n# tests 1\n# pass 1\n';
  const preambles=['✔ other','✖ other','✓ other','✗ other','ℹ unknown 0','▶ suite','► suite','- skipped',
    'TAP version 13','ok','ok 1','not ok','not ok 1','Bail out!','# Subtest: other','# tests 1','# suites 0','# pass 1',
    '# fail 0','# cancelled 0','# skipped 0','# todo 0','# duration_ms 1','1..1','999999999999999999999999999999999999..1',
    ...TASK5A_SUMMARY_LINES_V1];
  for(const prefix of preambles)for(const indent of ['','   '])
    await task5aRefusedTranscriptV1(vm,Buffer.from(indent+prefix+'\n'+marker+report));
  for(const text of [tap,tap+marker+report,marker+'neutral interleaved\n'+report,
    marker+report.replace('ℹ suites 0','ℹ unknown 0'),marker+report.replace('ℹ pass 1','neutral\nℹ pass 1')])
    await task5aRefusedTranscriptV1(vm,Buffer.from(text));
  const {w}=await task5aTranscriptV1(vm,Buffer.from('Mango\nMANUAL_OTHER\nneutral UTF8 café\n'+marker+report));task5aAcceptedV1(w);
});

// Break: decimal spellings, controls, malformed UTF8 and trailing bytes are never normalized.
test('Task5A 09 strict decimals UTF8 controls and natural final LF are enforced',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),marker=task5aMarkerV1();
  const accepted=['0','1','1.0','999999999999','999999999999.999999999999','0.000000000001','2.674667','58.297125'];
  const refused=['','00','01','-1','+1','1e1','NaN','Infinity','.1','1.','1.0000000000000','1000000000000',' 1','1 '];
  for(const token of accepted)for(const where of ['pass','summary']){
    const report=where==='pass'?task5aReportV1(token):task5aReportV1('2.674667',token);
    const {w}=await task5aTranscriptV1(vm,Buffer.from(marker+report));task5aAcceptedV1(w);
  }
  for(const token of refused)for(const where of ['pass','summary'])
    await task5aRefusedTranscriptV1(vm,Buffer.from(marker+(where==='pass'?task5aReportV1(token):task5aReportV1('2.674667',token))));
  const good=task5aWireV1(),report=task5aReportV1();
  const bytesRows=[Buffer.from((marker+report).replaceAll('\n','\r\n')),Buffer.from('\x1b[32mneutral\n'+marker+report),
    Buffer.from('neutral\x00\n'+marker+report),Buffer.from('neutral\t\n'+marker+report),Buffer.from('neutral\x7f\n'+marker+report),
    Buffer.concat([Buffer.from([239,187,191]),good]),Buffer.concat([Buffer.from([192,175,10]),good]),
    Buffer.concat([Buffer.from([237,160,128,10]),good]),Buffer.concat([Buffer.from([244,144,128,128,10]),good]),
    Buffer.concat([Buffer.from([255,10]),good]),Buffer.concat([good,Buffer.from([226,132])]),
    Buffer.concat([Buffer.from([226,132])]),Buffer.concat([good,Buffer.from('trailing\n')]),
    Buffer.concat([good,Buffer.from('\n')]),Buffer.concat([good,Buffer.from('x')]),good.subarray(0,good.length-1),
    Buffer.from('unfinished ordinary line')];
  for(const bytes of bytesRows)await task5aRefusedTranscriptV1(vm,bytes);
});

// Break: all-byte channel caps remain independent of parser and copied-prefix limits.
test('Task5A 10 full channel limits count hash drain and dominate content refusal',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),tail=task5aWireV1();
  for(const total of [1048575,1048576,1048577]){
    const bytes=Buffer.concat([Buffer.alloc(total-tail.length-1,0x6e),Buffer.from('\n'),tail]);
    assert.equal(bytes.length,total);const {w}=await task5aTranscriptV1(vm,bytes);
    if(total<=1048576)task5aAcceptedV1(w);else{task5aIntegrationV1(w,'refused');assert.equal(w.snapshot().state,'unknown');assert.equal(w.snapshot().reason,'limit');}
    task5aAllBytesV1(w,bytes);assert.equal(w.output().stdout.length,65536);
  }
  for(const total of [1,1048576,1048577]){
    const stderr=Buffer.alloc(total,0x65),{w}=await task5aTranscriptV1(vm,tail,{stderr});
    task5aIntegrationV1(w,'refused');assert.equal(w.snapshot().state,total>1048576?'unknown':'observed');
    if(total>1048576)assert.equal(w.snapshot().reason,'limit');task5aAllBytesV1(w,tail,stderr);
  }
  const bytes=Buffer.concat([Buffer.alloc(1048576-tail.length-1,0x6e),Buffer.from('\n'),tail]),stderr=Buffer.alloc(1048576,0x65);
  const {w}=await task5aTranscriptV1(vm,bytes,{stderr});assert.equal(w.snapshot().state,'observed');task5aIntegrationV1(w,'refused');task5aAllBytesV1(w,bytes,stderr);
});

// Break: parsed report cannot invent any absent natural stream/FD4/original join.
test('Task5A 11 absent required lifecycle facts stay pending then deadline unknown',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),bytes=task5aWireV1();
  const events=[['stdout','end'],['stdout','close'],['stderr','end'],['stderr','close'],
    ['fd4','finish'],['fd4','end'],['fd4','close'],['child','exit'],['child','close']];
  const omissions=[['stdout.end','stdout.close'],['stdout.close'],['stderr.end','stderr.close'],
    ['fd4.finish','fd4.close'],['fd4.end','fd4.close'],['fd4.close'],['child.close']];
  for(const omitted of omissions){
    const f=task3EventFixtureV1('integration'),w=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
    try{
      f.channels.stdout.emit('data',bytes);
      for(const [name,event] of events)if(!omitted.includes(name+'.'+event))
        (name==='child'?f.child:f.channels[name]).emit(event,...(name==='child'?[0,null]:[]));
      assert.equal(w.snapshot().state,'pending',omitted.join(','));task5aIntegrationV1(w,'pending');
      vm.timers.at(-1).callback();assert.equal((await w.settled).state,'unknown');assert.equal(w.snapshot().reason,'deadline');task5aIntegrationV1(w,'refused');
      for(const [name,event] of events)if(omitted.includes(name+'.'+event))
        (name==='child'?f.child:f.channels[name]).emit(event,...(name==='child'?[0,null]:[]));
      assert.equal(w.snapshot().state,'unknown');task5aIntegrationV1(w,'refused');task5aAllBytesV1(w,bytes);
    }finally{f.assertGuarded();vm.assertContained();}
  }
});

// Break: invalid arity may neither inspect extra arguments nor abandon bindable drains.
test('Task5A 12 invalid arity refuses without inspecting hostile extra arguments',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1();task5aCollectorGateV1(vm.actual);
  const empty=vm.actual.observeManualOrphanOwnedIntegrationChildV1();await task3UnknownV1(empty,'purpose');task5aIntegrationV1(empty,'refused');
  let hits=0;const trap=()=>{hits++;throw Error('PRIVATE_EXTRA_ARGUMENT');};
  const extra=new Proxy({},{get:trap,ownKeys:trap,getOwnPropertyDescriptor:trap,getPrototypeOf:trap,has:trap});
  const f=task3EventFixtureV1('integration'),forbiddenCalls=[];
  for(const [target,names] of [[f.child,['close','destroy','unref']],
    ...Object.values(f.channels).map(stream=>[stream,['close','unref']])])for(const name of names)
    target[name]=()=>{forbiddenCalls.push(name);throw Error('FORBIDDEN_FOREIGN_EFFECT');};
  const w=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child,extra);
  try{
    await task3UnknownV1(w,'purpose');task3AllBoundV1(f);assert.deepEqual([...new Set(f.resumed)].sort(),['fd4','stderr','stdout']);
    const bytes=Buffer.alloc(1048576,0x61),stderr=Buffer.from('drained');
    f.channels.stdout.emit('data',bytes);f.channels.stderr.emit('data',stderr);task3CompleteV1(f,'integration');
    assert.equal(hits,0);assert.equal(w.snapshot().reason,'purpose');task5aIntegrationV1(w,'refused');task5aAllBytesV1(w,bytes,stderr);
    assert.equal(w.output().stdout.length,65536);assert.equal(JSON.stringify(w.snapshot()).includes('PRIVATE_EXTRA_ARGUMENT'),false);
  }finally{assert.deepEqual(forbiddenCalls,[]);f.assertGuarded();vm.assertContained();}
});

// Break: scanner binds before resume; incomplete binding must not fabricate digest evidence.
test('Task5A 13 synchronous data and failed binding preserve current drain uncertainty',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),bytes=task5aWireV1();
  const resumed=await task5aTranscriptV1(vm,Buffer.alloc(0),{configure(f){
    const resume=f.channels.stdout.resume;f.channels.stdout.resume=function(){resume.call(this);this.emit('data',bytes);return this;};
  }});task5aAcceptedV1(resumed.w);task5aAllBytesV1(resumed.w,bytes);
  const during=await task5aTranscriptV1(vm,Buffer.alloc(0),{configure(f){
    const on=f.channels.stdout.on;f.channels.stdout.on=function(event,callback){
      const result=on.call(this,event,callback);if(event==='data')this.emit('data',bytes);return result;
    };
  }});
  assert.equal(during.w.snapshot().state,'unknown');assert.equal(during.w.snapshot().reason,'binding');
  assert.equal(during.w.snapshot().stdout.bytes,bytes.length);assert.equal(during.w.snapshot().stdout.sha256,null);task5aIntegrationV1(during.w,'refused');
  for(const missing of ['end','error']){
    task5aCollectorGateV1(vm.actual);const f=task3EventFixtureV1('integration');let attempts=0,drains=0;
    const on=f.channels.stdout.on;f.channels.stdout.on=function(event,callback){
      if(event===missing){attempts++;throw Error('PRIVATE_BINDING_SLOT');}return on.call(this,event,callback);
    };
    f.channels.stdout.resume=function(){
      assert.ok(this.listenerCount('error')>0);assert.ok(this.listenerCount('data')>0);drains++;return this;
    };
    const w=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
    try{
      assert.equal(attempts,1);assert.equal(drains,missing==='error'?0:1);
      assert.ok(f.resumed.includes('stderr'));assert.ok(f.resumed.includes('fd4'));assert.ok(f.channels.stdout.listenerCount('data')>0);
      f.channels.stdout.emit('data',bytes);f.channels.stderr.emit('data',Buffer.from('drain'));
      await task3UnknownV1(w,'binding');task5aIntegrationV1(w,'refused');assert.equal(w.snapshot().stdout.bytes,bytes.length);assert.equal(w.snapshot().stderr.bytes,5);
    }finally{f.assertGuarded();vm.assertContained();}
  }
});

// Break: historical settled/accepted DATA cannot conceal a current late fault.
test('Task5A 14 late lifecycle hash and clock faults revoke current publication',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),bytes=task5aWireV1();
  const events=[['child error',(f)=>f.child.emit('error',Error('PRIVATE_LATE'))],
    ['stdout error',f=>f.channels.stdout.emit('error',Error('PRIVATE_LATE'))],
    ['stderr error',f=>f.channels.stderr.emit('error',Error('PRIVATE_LATE'))],
    ['fd4 error',f=>f.channels.fd4.emit('error',Error('PRIVATE_LATE'))],
    ['duplicate original close',f=>f.child.emit('close',0,null)],
    ['duplicate stdout end',f=>f.channels.stdout.emit('end')],
    ['duplicate stderr close',f=>f.channels.stderr.emit('close')],
    ['duplicate fd4 finish',f=>f.channels.fd4.emit('finish')],
    ['stdout data after EOF',f=>f.channels.stdout.emit('data',Buffer.from('late'))],
    ['fd4 inbound data',f=>f.channels.fd4.emit('data',Buffer.from('late'))]];
  async function revoke(actualVm,emit){
    const {f,w}=await task5aTranscriptV1(actualVm,bytes),history=await w.settled,old=task5aAcceptedV1(w);
    emit(f);assert.equal(w.snapshot().state,'unknown');task5aIntegrationV1(w,'refused');
    assert.equal(await w.settled,history);assert.equal(history.state,'observed');assert.equal(old.integration.state,'observed');
    task3FrozenDataV1(old.integration);f.child.emit('close',0,null);task5aIntegrationV1(w,'refused');
    assert.equal(actualVm.timers.filter(timer=>!actualVm.cleared.includes(timer.handle)).length,0,'late fault does not rearm deadline');
    f.assertGuarded();actualVm.assertContained();
  }
  for(const [,emit] of events)await revoke(vm,emit);
  let copyFault=false;const hashVm=task3VmV1({crypto:{createHash(...args){
    const actual=createHash(...args);return {update(...values){actual.update(...values);return this;},copy(){
      if(copyFault)throw Error('PRIVATE_LATE_HASH');return actual.copy();
    }};
  }}});await revoke(hashVm,()=>{copyFault=true;});
  for(const mode of ['throw','backwards']){
    const clock=task3ClockV1();clock.state.ms=10;const clockVm=task3VmV1({monotonic:clock});
    await revoke(clockVm,()=>{if(mode==='throw')clock.state.mode='throw';else clock.state.ms=9;});
  }
});

// Break: output aliases, widened surfaces or attacker Buffer access can corrupt current evidence.
test('Task5A 15 detached exact output preserves old facades and intrinsic Buffer reads',async()=>{
  task5aCollectorGateV1();const vm=task3VmV1(),bytes=task5aWireV1();
  const {w}=await task5aTranscriptV1(vm,bytes),out=task5aAcceptedV1(w);
  assert.equal(Object.isFrozen(out),true);assert.deepEqual(Object.keys(out),['stdout','stderr','integration']);
  assert.deepEqual(Object.keys(out.integration),['state','marker','summary']);
  assert.deepEqual(Object.keys(out.integration.marker),['schema','run','frameSha256','pid','parentPid','oldEntry','newEntry','sourcePinsClosed']);
  assert.deepEqual(Object.keys(out.integration.summary),['tests','suites','pass','fail','cancelled','skipped','todo']);
  task3FrozenDataV1(out.integration);out.stdout.fill(0);out.stderr.fill(0);assert.deepEqual(w.output().stdout,bytes);
  for(const api of ['observeManualOrphanOwnedChildV1','observeManualOrphanOriginalChildV1']){
    const f=task3EventFixtureV1('integration'),old=api==='observeManualOrphanOwnedChildV1'?vm.actual[api](f.child,'integration'):vm.actual[api](f.child);
    f.channels.stdout.emit('data',Buffer.from('ordinary legacy diagnostic\n'));task3CompleteV1(f,'integration');
    assert.equal((await old.settled).state,'observed');assert.deepEqual(Object.keys(old.output()),['stdout','stderr']);
    assert.deepEqual(old.output().stdout,Buffer.from('ordinary legacy diagnostic\n'));f.assertGuarded();
  }
  let methodHits=0;const hostile=Buffer.from(bytes);
  for(const key of ['toString','values','entries',Symbol.iterator])Object.defineProperty(hostile,key,{value(){methodHits++;throw Error('PRIVATE_BUFFER_METHOD');}});
  const trusted=await task5aTranscriptV1(vm,hostile);task5aAcceptedV1(trusted.w);assert.equal(methodHits,0);task5aAllBytesV1(trusted.w,bytes);
  let lengthHits=0;const hostileLength=Buffer.from(bytes);
  Object.defineProperty(hostileLength,'length',{get(){lengthHits++;throw Error('PRIVATE_BUFFER_LENGTH');}});
  task5aCollectorGateV1(vm.actual);const f=task3EventFixtureV1('integration'),intrinsic=vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
  try{
    assert.doesNotThrow(()=>f.channels.stdout.emit('data',hostileLength));assert.equal(lengthHits,0,'intrinsic Buffer reads ignore own length getter');
    task3CompleteV1(f,'integration');assert.equal((await intrinsic.settled).state,'observed');task5aAcceptedV1(intrinsic);
    assert.equal(intrinsic.snapshot().stdout.bytes,bytes.length);assert.equal(intrinsic.snapshot().stdout.sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(intrinsic.output().stdout,bytes);assert.equal(lengthHits,0);assert.equal(f.resumed.includes('stdout'),true);
    assert.equal(f.resumed.includes('stderr'),true);assert.equal(f.resumed.includes('fd4'),true);
  }finally{f.assertGuarded();vm.assertContained();}
});

// Task5B Phase A: narrow private consumers only. No caller-created Source or
// phase owner enters these tests. Root executes RED; this author does not.
function task5bPrivateExposureV1(){return `
;globalThis.__task5bPrivateV1={
  requireManualOrphanOwnedHelperContextV1:typeof requireManualOrphanOwnedHelperContextV1==='function'?requireManualOrphanOwnedHelperContextV1:null,
  checkManualOrphanPhaseGraphV1:typeof checkManualOrphanPhaseGraphV1==='function'?checkManualOrphanPhaseGraphV1:null,
  deriveManualOrphanPhaseEndpointV1:typeof deriveManualOrphanPhaseEndpointV1==='function'?deriveManualOrphanPhaseEndpointV1:null,
  validateManualOrphanPhaseIdentityV1:typeof validateManualOrphanPhaseIdentityV1==='function'?validateManualOrphanPhaseIdentityV1:null,
  validateManualOrphanPhaseBaselineV1:typeof validateManualOrphanPhaseBaselineV1==='function'?validateManualOrphanPhaseBaselineV1:null,
  projectManualOrphanPhaseInstallationV1:typeof projectManualOrphanPhaseInstallationV1==='function'?projectManualOrphanPhaseInstallationV1:null,
  createManualOrphanPhaseSqlLedgerV1:typeof createManualOrphanPhaseSqlLedgerV1==='function'?createManualOrphanPhaseSqlLedgerV1:null,
  captureManualOrphanPhaseDatabaseV1:typeof captureManualOrphanPhaseDatabaseV1==='function'?captureManualOrphanPhaseDatabaseV1:null,
  manualOrphanEntryErrorV1:typeof manualOrphanEntryErrorV1==='function'?manualOrphanEntryErrorV1:null,
  provisionManualOrphanOwnedPhaseV1:typeof provisionManualOrphanOwnedPhaseV1==='function',
  activateManualOrphanOwnedPhaseV1:typeof activateManualOrphanOwnedPhaseV1==='function',
  oldEntryManualOrphanOwnedPhaseV1:typeof oldEntryManualOrphanOwnedPhaseV1==='function',
  newEntryManualOrphanOwnedPhaseV1:typeof newEntryManualOrphanOwnedPhaseV1==='function',
  runManualOrphanOwnedPhaseV1:typeof runManualOrphanOwnedPhaseV1==='function',
  probePolicy:probeFd4PolicyV1,
  ownedPolicy:ownedFd4PolicyV1,
  dataFromJson(text){return JSON.parse(text);}
};
`;}
function task5bGateV1(){
  task3ContractsV1();
  let importing=true,environment;
  const importReads=[],processBinding={},osBinding={};
  Object.defineProperty(processBinding,'env',{enumerable:true,get(){
    if(importing){importReads.push('process.env');throw Error('TEST_INERT_ENV_READ');}return environment;
  },set(value){environment=value;}});
  const vm=task3VmV1({task5bPrivate:true,process:processBinding,os:osBinding});importing=false;
  const api=vm.task5bPrivate;assert.ok(api,'missing Task5B private exposure');
  for(const name of ['requireManualOrphanOwnedHelperContextV1','checkManualOrphanPhaseGraphV1',
    'deriveManualOrphanPhaseEndpointV1','validateManualOrphanPhaseIdentityV1','validateManualOrphanPhaseBaselineV1',
    'projectManualOrphanPhaseInstallationV1','createManualOrphanPhaseSqlLedgerV1','captureManualOrphanPhaseDatabaseV1',
    'manualOrphanEntryErrorV1','dataFromJson'])assert.equal(typeof api[name],'function','missing-private-consumer '+name);
  for(const name of ['provisionManualOrphanOwnedPhaseV1','activateManualOrphanOwnedPhaseV1',
    'oldEntryManualOrphanOwnedPhaseV1','newEntryManualOrphanOwnedPhaseV1','runManualOrphanOwnedPhaseV1'])
    assert.equal(api[name],true,'missing-private-handler '+name);
  assert.equal(Object.isFrozen(api.probePolicy),true);assert.equal(api.probePolicy.owned,false);
  assert.equal(Object.isFrozen(api.ownedPolicy),true);assert.equal(api.ownedPolicy.owned,true);
  assert.deepEqual(importReads,[],'no caught module-time selection/environment observation');
  vm.assertContained();return {...vm,api,processBinding,osBinding};
}
const task5bDataV1=(vm,value)=>vm.api.dataFromJson(JSON.stringify(value));
const task5bPlainV1=value=>JSON.parse(JSON.stringify(value));
function task5bRefusedV1(fn,code='MANUAL_ORPHAN_OWNER_REFUSED'){
  assert.throws(fn,error=>error?.message===code);
}
async function task5bRejectV1(promise,code='MANUAL_ORPHAN_CLEANUP_UNKNOWN'){
  await assert.rejects(promise,error=>error?.message===code);
}
function task5bCasesV1(count){
  const reached=[];return {run(name,body){assert.ok(!reached.includes(name));body();reached.push(name);},
    async wait(name,body){assert.ok(!reached.includes(name));await body();reached.push(name);},
    done(){assert.equal(reached.length,count,'all enumerated consumer scenarios reached');}};
}
function task5bDerivedV1(){return {maintenanceRoot:SOURCE_M_V1,targetRoot:SOURCE_T_V1,
  node:TASK3_NODE_V1,helper:SOURCE_M_V1+SOURCE_SUFFIX_V1,workspace:SOURCE_WORKSPACE_V1,
  nativeTools:{postgres:{path:'/opt/homebrew/Cellar/postgresql@17/17.6/bin/postgres',sha256:OWN_H}},
  root:'/tmp/setfarm-task6a-pg.T5b123',physicalRoot:'/private/tmp/setfarm-task6a-pg.T5b123',
  dataDirectory:'/tmp/setfarm-task6a-pg.T5b123/data',port:55439,
  installationsDirectory:'/private/tmp/setfarm-task6a-pg.T5b123/installations'};}
function task5bContextV1(vm){
  const d=task5bDerivedV1(),frame=task5bGraphV1().frame;
  const context={root:d.maintenanceRoot,node:d.node,helper:d.helper,
    issuer:d.maintenanceRoot+'/scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js'};
  const account={homedir:TASK7_HOST_POLICY.home,uid:501,gid:20};
  Object.assign(vm.processBinding,{execPath:d.node,argv0:d.node,execArgv:[],argv:[d.node,d.helper],
    cwd:()=>context.root,env:{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C'},platform:'darwin',arch:'arm64',version:'v26.4.0',
    getuid:()=>501,geteuid:()=>501,getgid:()=>20,getegid:()=>20,pid:104,ppid:102});
  vm.osBinding.userInfo=()=>account;
  return {context,frame,account,policy:vm.api.ownedPolicy,d};
}
function task5bGraphV1(mechanical=false){
  const d=task5bDerivedV1(),frame=ownedPhaseData(mechanical?'old_entry_positive':'provision');
  const raw={constructor:TASK3_NODE_V1+' '+SOURCE_M_V1+'/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap',
    runner:TASK3_NODE_V1+' --import tsx scripts/run-isolated-postgres-tests.ts -- '+VECTOR.join(' '),
    parent:mechanical?TASK3_NODE_V1+' --import tsx --test --test-isolation=none '+FILE:
      TASK3_NODE_V1+' --import tsx scripts/run-isolated-postgres-tests.ts -- '+VECTOR.join(' '),
    child:TASK3_NODE_V1+' '+d.helper,
    server:'/opt/homebrew/opt/postgresql@17/bin/postgres -D '+d.dataDirectory+' -h 127.0.0.1 -p 55439 -k '+d.root+
      ' -c unix_socket_permissions=0700 -c shared_buffers=32MB -c max_connections=50'};
  const observations={};
  for(const key of ['constructor','runner','parent','child','server']){
    frame[key].executable=key==='server'?d.nativeTools.postgres.path:TASK3_NODE_V1;
    frame[key].executableSha256=key==='server'?d.nativeTools.postgres.sha256:SOURCE_NODE_HASH_V1;
    frame[key].commandSha256=createHash('sha256').update(raw[key]).digest('hex');
    observations[key]={pin:{...frame[key]},rawCommand:raw[key]};
  }
  return {frame,observations,derived:d};
}
function task5bIdentityV1(){
  const i=ownedInstallationData(true),cluster=ownedClusterData();
  const expected={cluster,databaseName:i.databaseName,databaseOid:7,ownerOid:7,
    currentRole:i.runtimeRole,sessionRole:i.runtimeRole,runtimeOid:8,userOid:8};
  const rows=[{systemIdentifier:'123',postmasterStartedAtUTC:'2026-10-21T00:00:00.123456Z',
    serverVersionNum:'170001',serverAddress:'127.0.0.1',serverPort:55439,database:i.databaseName,
    databaseOid:'7',ownerOid:'7',currentUser:i.runtimeRole,sessionUser:i.runtimeRole,runtimeOid:'8',
    pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:'7',usesysid:'8'}];
  return {rows,expected};
}
const TASK5B_PAIR_V1={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:7,usesysid:8};
function task5bIdentityCallV1(vm,f,pair=null){return vm.api.validateManualOrphanPhaseIdentityV1(
  task5bDataV1(vm,f.rows),task5bDataV1(vm,f.expected),pair);}
function task5bBaselineV1(stage='initial'){
  const rows=task4aCatalogV1(),literal=task4aLiteralOutputV1(),expected={
    databaseBaselineSha256:literal.databaseBaselineSha256,roleBaselineSha256:literal.roleBaselineSha256,
    membershipBaselineSha256:literal.membershipBaselineSha256};
  const installation=stage==='initial'?null:ownedInstallationData(stage==='activated');
  if(installation){
    rows.databases.push({name:installation.databaseName,oid:7,ownerOid:7,allowConnections:true,connectionLimit:-1});
    rows.roles.push({name:installation.ownerRole,oid:7,superuser:false,inherit:false,createRole:false,createDb:false,
      login:false,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null},
    {name:installation.runtimeRole,oid:8,superuser:false,inherit:false,createRole:false,createDb:false,
      login:true,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null});
  }
  return {rows,expected,installation};
}
function task5bBaselineCallV1(vm,f){return vm.api.validateManualOrphanPhaseBaselineV1(
  task5bDataV1(vm,f.rows),task5bDataV1(vm,f.expected),task5bDataV1(vm,f.installation));}
function task5bProjectionV1(activated=false){
  const installation=ownedInstallationData(activated),d=task5bDerivedV1();
  // Finite detached migration observations, compared to independent expected
  // identities. These are not an imported stock manifest or a Source claim.
  const migrations=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33]
    .map(version=>({version,name:'fixture-migration-'+version,checksum:OWN_H,migrationClass:version===32?'guarded':'automatic'}));
  const origin={schema:'setfarm.fresh-installation-origin.v1',installationId:OWN_ID,operationId:OWN_OP,
    systemIdentifier:'123',databaseOid:7,databaseName:installation.databaseName,ownerRole:installation.ownerRole,
    runtimeRole:installation.runtimeRole,sourceSha:OWN_T,migrations};
  const prepared={origin,catalogHash:OWN_H,ownerOid:7,runtimeOid:8,
    runtimeUrl:'postgresql://'+installation.runtimeRole+':'+OWN_C+'@127.0.0.1:55439/'+installation.databaseName,
    committed:true,baseRecordBytes:36880,baseRecordPins:ownedInstallationData().records};
  const selectedDirectory=d.installationsDirectory+'/'+OWN_ID;
  // Projection carries only fields consumed from already validated stock
  // activation state; SourceAuthority/current validation remains stock's job.
  const activation=activated?{prepared:{origin,catalogHash:OWN_B,
    directoryIdentity:{realpath:selectedDirectory,...ownedDirData()},schemaRecordPins:{
      'schema-prepared.json':installation.records['schema-prepared.json'],
      'schema-committed.json':installation.records['schema-committed.json']}},
    preparedPin:installation.records['activation-prepared.json'],activatedPin:installation.records['activated.json'],
    acknowledged:true,baseRecordBytes:36880,baseRecordPins:prepared.baseRecordPins}:null;
  const recordView={prepared,directory:{realpath:selectedDirectory,...ownedDirData()},activation,
    observedSchemaCatalogHash:OWN_H,observedActivationCatalogHash:activated?OWN_B:null,
    activationAbsenceObserved:!activated,staleAbsenceRefused:activated,selectedDirectory,
    activationReturn:activated?{schema:'setfarm.fresh-installation-activation-verification.v1',state:'activated',
      installationId:OWN_ID,sourceSha:OWN_T,catalogHash:OWN_B}:null};
  const expected={cluster:ownedClusterData(),sourceSha:OWN_T,migrations:task5bPlainV1(migrations),
    installationsDirectory:d.installationsDirectory,installation:activated?ownedInstallationData():null};
  return {recordView,expected,stage:activated?'activated':'committed',installation};
}
function task5bProjectV1(vm,f){return vm.api.projectManualOrphanPhaseInstallationV1(
  task5bDataV1(vm,f.recordView),task5bDataV1(vm,f.expected),f.stage);}

// Break: new private declarations must stay inert and must not become exports.
test('Task5B private contracts and inert module',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(4);
  cases.run('all13 present',()=>assert.equal(Object.keys(vm.api).length,17));
  cases.run('public exports match adopted fixed observation',()=>assert.deepEqual(Object.keys(vm.actual).sort(),[
    'MANUAL_ORPHAN_BASENAME_V1','MANUAL_ORPHAN_VECTOR_V1','mentionsManualOrphanFileV1','classifyManualOrphanVectorV1',
    'encodeManualOrphanProbeFrameV1','decodeManualOrphanProbeFrameV1','canonicalizeManualOrphanClusterBaselineV1',
    'encodeManualOrphanRunnerSetupFrameV1','decodeManualOrphanRunnerSetupFrameV1',
    'encodeManualOrphanOwnedPhaseFrameV1','decodeManualOrphanOwnedPhaseFrameV1',
    'encodeManualOrphanOwnedPhaseResultV1','decodeManualOrphanOwnedPhaseResultV1',
    'encodeManualOrphanIntegrationResultV1','decodeManualOrphanIntegrationResultV1',
    'encodeManualOrphanRunnerResultV1','decodeManualOrphanRunnerResultV1','holdManualOrphanOwnedSourcesV1',
    'pinManualOrphanProbeSourcesV1','observeManualOrphanProcessV1','observeManualOrphanOriginalChildV1',
    'observeManualOrphanOwnedChildV1','observeManualOrphanOwnedIntegrationChildV1',
    'readManualOrphanProbeFd4V1','readManualOrphanOwnedFd4V1','observeManualOrphanOwnedFd4V1','runManualOrphanLifecycleProbeV1',
  ].sort()));
  cases.run('no import timer IO selection',()=>{assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);
    assert.equal(vm.monotonic.state.accesses,0);assert.deepEqual(Object.keys(vm.processBinding),['env','hrtime']);vm.assertContained();});
  cases.run('deferred imports unrequested',()=>{assert.equal(Object.hasOwn(vm.actual,'runManualOrphanOwnedPhaseV1'),false);vm.assertContained();});
  cases.done();
});
// Break: pre-Source owned context must reject the writer and old transport.
test('Task5B actual owned context before effects',()=>{
  const gate=task5bGateV1(),cases=task5bCasesV1(12);gate.assertContained();
  for(const [name,mutate,valid] of [
    ['valid physical context',()=>{},true],['W',f=>{f.context.root=TASK7_HOST_POLICY.workspace+'/.worktrees/writer';},false],
    ['target as M',f=>{f.context.root=SOURCE_T_V1;},false],['other release parent',f=>{f.context.root='/other/releases/setfarm-88888888';},false],
    ['malformed release name',f=>{f.context.root=SOURCE_WORKSPACE_V1+'/releases/setfarm-zzzzzzzz';},false],
    ['legacy policy',(f,vm)=>{f.policy=vm.api.probePolicy;},false],['wrong node',(f,vm)=>{vm.processBinding.execPath='/wrong/node';},false],
    ['execArgv',(f,vm)=>{vm.processBinding.execArgv=['--inspect'];},false],
    ['cwd',(f,vm)=>{vm.processBinding.cwd=()=>'/wrong';},false],
    ['env extra',(f,vm)=>{vm.processBinding.env.HOME=TASK7_HOST_POLICY.home;},false],
    ['account IDs',f=>{f.account.uid=502;f.account.gid=21;},false],
    ['selected env preexisting',(f,vm)=>{vm.processBinding.env.SETFARM_INSTALLATION_DIR='/synthetic';},false],
  ])cases.run(name,()=>{const vm=task5bGateV1(),f=task5bContextV1(vm);mutate(f,vm);
    if(f.context.root!==f.d.maintenanceRoot){
      f.context.helper=f.context.root+SOURCE_SUFFIX_V1;
      f.context.issuer=f.context.root+'/scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js';
      vm.processBinding.argv[1]=f.context.helper;
    }
    const call=()=>vm.api.requireManualOrphanOwnedHelperContextV1(task5bDataV1(vm,f.context),task5bDataV1(vm,f.frame),f.policy);
    if(valid){const got=call();assert.equal(got.maintenanceRoot,SOURCE_M_V1);assert.equal(got.targetRoot,SOURCE_T_V1);}
    else task5bRefusedV1(call);assert.equal(vm.timers.length,0);vm.assertContained();
  });cases.done();
});
// Break: independently observed pins and exact raw commands must agree.
test('Task5B graph and raw vector comparator',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(12);
  for(const [name,mechanical,mutate,valid] of [
    ['valid direct parent',false,()=>{},true],['valid mechanical parent',true,()=>{},true],
    ['wrong childPID',false,f=>{f.observations.child.pin.pid=106;},false],
    ['PPID',false,f=>{f.observations.child.pin.ppid=101;},false],
    ['runnerPID',false,f=>{f.observations.runner.pin.pid=108;},false],
    ['constructorPID',false,f=>{f.observations.constructor.pin.pid=109;},false],
    ['serverPID',false,f=>{f.observations.server.pin.pid=110;},false],
    ['uid',false,f=>{f.observations.child.pin.uid=502;},false],
    ['startedAt',false,f=>{f.observations.child.pin.startedAtUTC='2026-10-21T00:00:01.000Z';},false],
    ['executablehash',false,f=>{f.observations.child.pin.executableSha256=OWN_C;},false],
    ['commandhash',false,f=>{f.observations.child.pin.commandSha256=OWN_C;},false],
    ['raw vector extra operand',false,f=>{f.observations.server.rawCommand+=' --extra';
      const digest=createHash('sha256').update(f.observations.server.rawCommand).digest('hex');
      f.observations.server.pin.commandSha256=digest;f.frame.server.commandSha256=digest;},false],
  ])cases.run(name,()=>{const f=task5bGraphV1(mechanical);mutate(f);
    const call=()=>vm.api.checkManualOrphanPhaseGraphV1(task5bDataV1(vm,f.frame),task5bDataV1(vm,f.observations),task5bDataV1(vm,f.derived));
    if(valid){const got=call();assert.equal(got.port,55439);assert.equal(got.physicalRoot,'/private/tmp/setfarm-task6a-pg.T5b123');}
    else task5bRefusedV1(call);vm.assertContained();
  });cases.done();
});
// Break: mechanical phases cannot borrow admin credentials or alternate URLs.
test('Task5B purpose-specific endpoint consumer',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(12);
  for(const [name,purpose,mutate,valid] of [
    ['valid provision','provision',()=>{},true],['activate','activate',()=>{},true],
    ['mechanical runtime','old_entry_positive',()=>{},true],
    ['absent admin','provision',f=>{delete f.input.adminPassword;},false],
    ['extra admin on mechanical','old_entry_positive',f=>{f.input.adminPassword=OWN_H;},false],
    ['hostlocalhost','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace('127.0.0.1','localhost');},false],
    ['missing port','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace(':55439','');},false],
    ['port5432','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace(':55439',':5432');},false],
    ['wrong derived port','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace(':55439',':55440');},false],
    ['wrong DB','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace('/setfarm_install_','/other_');},false],
    ['wrong role','old_entry_positive',f=>{f.prepared.runtimeUrl=f.prepared.runtimeUrl.replace('sf_runtime_','sf_owner_');},false],
    ['query fragment options','old_entry_positive',f=>{f.prepared.runtimeUrl+='?options=-c%20role%3Dpostgres#extra';},false],
  ])cases.run(name,()=>{const f={input:ownedPhaseData(purpose).input,prepared:task5bProjectionV1(true).recordView.prepared};mutate(f);
    const call=()=>vm.api.deriveManualOrphanPhaseEndpointV1(purpose,task5bDataV1(vm,task5bDerivedV1()),task5bDataV1(vm,f.input),task5bDataV1(vm,f.prepared));
    if(valid){const got=call();assert.equal(got,purpose==='old_entry_positive'?f.prepared.runtimeUrl:
      'postgresql://postgres:'+OWN_H+'@127.0.0.1:55439/postgres');}else task5bRefusedV1(call);vm.assertContained();
  });cases.done();
});
// Break: canonical uint64/OID and PG17 identity boundaries must be lossless.
test('Task5B identity exact valid DATA',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(5);
  for(const [name,mutate] of [
    ['ordinary runtime',()=>{}],['explicit admin expectedidentity',f=>{Object.assign(f.expected,{databaseName:'postgres',databaseOid:5,
      ownerOid:1,currentRole:'postgres',sessionRole:'postgres',runtimeOid:null,userOid:1});Object.assign(f.rows[0],{
      database:'postgres',databaseOid:'5',ownerOid:'1',currentUser:'postgres',sessionUser:'postgres',runtimeOid:null,datid:'5',usesysid:'1'});} ],
    ['maximal permitted uint64string',f=>{f.expected.cluster.systemIdentifier=f.rows[0].systemIdentifier='18446744073709551615';}],
    ['high unsigned OIDs',f=>{Object.assign(f.expected,{databaseOid:4294967295,ownerOid:4294967294,runtimeOid:4294967293,userOid:4294967293});
      Object.assign(f.rows[0],{databaseOid:'4294967295',ownerOid:'4294967294',runtimeOid:'4294967293',datid:'4294967295',usesysid:'4294967293'});}],
    ['microsecond PG17 upperbound',f=>{f.expected.cluster.serverVersionNum=179999;f.rows[0].serverVersionNum='179999';
      f.expected.cluster.postmasterStartedAtUTC=f.rows[0].postmasterStartedAtUTC='2024-02-29T23:59:59.999999Z';}],
  ])cases.run(name,()=>{const f=task5bIdentityV1();mutate(f);const got=task5bIdentityCallV1(vm,f);
    assert.deepEqual(task5bPlainV1(got),{pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:f.expected.databaseOid,usesysid:f.expected.userOid});
    assert.equal(Object.isFrozen(got),true);vm.assertContained();
  });cases.done();
});
// Break: each identity field is checked against independently held expectation.
test('Task5B identity mismatch refuses',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(16);
  for(const [name,key,value] of [
    ['systemID','systemIdentifier','124'],['start','postmasterStartedAtUTC','2026-10-21T00:00:00.123457Z'],
    ['millisecond truncated start','postmasterStartedAtUTC','2026-10-21T00:00:00.123Z'],['PG18','serverVersionNum','180000'],
    ['versiontext noncanonical','serverVersionNum','0170001'],['hostCIDR','serverAddress','127.0.0.1/32'],
    ['NULLhost','serverAddress',null],['port','serverPort',55440],['DBname','database','postgres'],
    ['DB OID','databaseOid','9'],['ownerOID','ownerOid','9'],['currentrole','currentUser','postgres'],
    ['sessionrole','sessionUser','postgres'],['runtimeOID','runtimeOid','9'],
  ])cases.run(name,()=>{const f=task5bIdentityV1();f.rows[0][key]=value;task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));vm.assertContained();});
  cases.run('missing row',()=>{const f=task5bIdentityV1();f.rows=[];task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));});
  cases.run('duplicate row',()=>{const f=task5bIdentityV1();f.rows.push({...f.rows[0]});task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));});
  cases.done();vm.assertContained();
});
// Break: a changed connection cannot refresh the retained own backend pair.
test('Task5B immutable own backend pair',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(9);
  cases.run('firstcapture',()=>{const f=task5bIdentityV1(),got=task5bIdentityCallV1(vm,f);f.rows[0].pid=999;
    assert.deepEqual(task5bPlainV1(got),TASK5B_PAIR_V1);assert.equal(Object.isFrozen(got),true);});
  cases.run('identical repeat',()=>{const f=task5bIdentityV1(),pair=task5bIdentityCallV1(vm,f);
    assert.deepEqual(task5bPlainV1(task5bIdentityCallV1(vm,f,pair)),TASK5B_PAIR_V1);});
  for(const [name,key,value] of [['pid drift','pid',701],['backendstart drift','backendStartedAtUTC','2026-10-21T00:00:01.234568Z'],
    ['datid drift','datid','9'],['usesysid drift','usesysid','9'],['missing ownrow','pid',undefined],['null ownstart','backendStartedAtUTC',null]])
    cases.run(name,()=>{const f=task5bIdentityV1(),pair=task5bIdentityCallV1(vm,f);f.rows[0][key]=value;
      task5bRefusedV1(()=>task5bIdentityCallV1(vm,f,pair));assert.deepEqual(task5bPlainV1(pair),TASK5B_PAIR_V1);});
  await cases.wait('pair refresh attempt after fault',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);
    f.nextRows=task5bIdentityV1().rows;f.nextRows[0].pid=701;
    await task5bRejectV1(f.ledger.query('identity',task5bDataV1(vm,task5bIdentityV1().expected)));
    const count=f.calls.queries.length;f.nextRows=task5bIdentityV1().rows;
    await task5bRejectV1(f.ledger.query('identity',task5bDataV1(vm,task5bIdentityV1().expected)));
    assert.equal(f.calls.queries.length,count);assert.deepEqual(task5bPlainV1(f.ledger.current().pair),TASK5B_PAIR_V1);
    await task5bRejectV1(f.ledger.close());f.check();});
  cases.done();vm.assertContained();
});
// Break: generated exact rows must be removed only after positive matching.
test('Task5B baseline stage success DATA',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(3);
  for(const stage of ['initial','committed','activated'])cases.run(stage,()=>{
    const got=task5bBaselineCallV1(vm,task5bBaselineV1(stage));assert.deepEqual(task5bPlainV1(got),task4aLiteralOutputV1());vm.assertContained();
  });cases.done();
});
// Break: residual canonicalization must see all unrelated and generated facts.
test('Task5B residual baseline refusal',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(12);
  for(const [name,mutate] of [
    ['extra DB',f=>{f.rows.databases.push({...f.rows.databases[3],name:'extra',oid:9});}],
    ['missing generatedDB',f=>{f.rows.databases.pop();}],['DB OID reuse',f=>{f.rows.databases[3].oid=5;}],
    ['ownerOID drift',f=>{f.rows.databases[3].ownerOid=1;}],
    ['extra role',f=>{f.rows.roles.push({...f.rows.roles[4],name:'extra',oid:9});}],
    ['runtimeflags',f=>{f.rows.roles[4].superuser=true;}],['ownerflags',f=>{f.rows.roles[3].login=true;}],
    ['generatedmembership role',f=>{f.rows.memberships.push({roleOid:7,memberOid:1,grantorOid:1,adminOption:false,inheritOption:false,setOption:false});}],
    ['generatedmembership member',f=>{f.rows.memberships.push({roleOid:1,memberOid:8,grantorOid:1,adminOption:false,inheritOption:false,setOption:false});}],
    ['generatedmembership grantor',f=>{f.rows.memberships.push({roleOid:1,memberOid:2,grantorOid:7,adminOption:false,inheritOption:false,setOption:false});}],
    ['overflow',f=>{f.rows.memberships=Array.from({length:257},()=>({...f.rows.memberships[0]}));}],
    ['framedigest mismatch',f=>{f.expected.membershipBaselineSha256=OWN_C;}],
  ])cases.run(name,()=>{const f=task5bBaselineV1('committed');mutate(f);task5bRefusedV1(()=>task5bBaselineCallV1(vm,f));vm.assertContained();});
  cases.done();
});
// Break: a void verifier result cannot stand in for actual record observations.
test('Task5B actual installation projection',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(8);
  cases.run('valid seven',()=>{const f=task5bProjectionV1();assert.deepEqual(task5bPlainV1(task5bProjectV1(vm,f)),f.installation);});
  cases.run('valid nine',()=>{const f=task5bProjectionV1(true);assert.deepEqual(task5bPlainV1(task5bProjectV1(vm,f)),f.installation);});
  cases.run('privateURL omitted',()=>{const f=task5bProjectionV1(),got=task5bProjectV1(vm,f);
    assert.equal(JSON.stringify(got).includes('runtimeUrl'),false);assert.equal(JSON.stringify(got).includes(OWN_C),false);});
  cases.run('void verifyRuntime does not supply state',()=>{const f=task5bProjectionV1();f.recordView.prepared=null;
    task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.run('wrong origin OIDs',()=>{const f=task5bProjectionV1(true);f.recordView.prepared.origin.databaseOid=9;
    task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.run('migration mismatch',()=>{const f=task5bProjectionV1();f.recordView.prepared.origin.migrations[32].checksum=OWN_B;
    task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.run('changed oldpin',()=>{const f=task5bProjectionV1(true);f.recordView.prepared.baseRecordPins['planned.json'].sha256=OWN_B;
    task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.run('catalog stage mismatch',()=>{const f=task5bProjectionV1(true);f.recordView.observedActivationCatalogHash=OWN_H;
    task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.done();vm.assertContained();
});
// Break: the projection must require actual absence/staleness observations.
test('Task5B activation-stage DATA comparisons',()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(8);
  cases.run('unactivated observed absence',()=>{const f=task5bProjectionV1();f.stage='before-activation';f.expected.installation=ownedInstallationData();
    assert.deepEqual(task5bPlainV1(task5bProjectV1(vm,f)),f.installation);});
  cases.run('activated required record view',()=>{const f=task5bProjectionV1(true);assert.deepEqual(task5bPlainV1(task5bProjectV1(vm,f)),f.installation);});
  cases.run('observed stale oldselection predicate',()=>{const f=task5bProjectionV1(true);assert.equal(f.recordView.staleAbsenceRefused,true);
    assert.deepEqual(task5bPlainV1(task5bProjectV1(vm,f)),f.installation);});
  for(const [name,mutate] of [
    ['missing expected stale observation',f=>{f.recordView.staleAbsenceRefused=false;}],
    ['missing newpin',f=>{f.recordView.activation.activatedPin=null;}],
    ['changed oldpin',f=>{f.recordView.prepared.baseRecordPins['schema-committed.json'].bytes++;}],
    ['activation return mismatch',f=>{f.recordView.activationReturn.catalogHash=OWN_H;}],
    ['selected directory mismatch',f=>{f.recordView.selectedDirectory+='/other';}],
  ])cases.run(name,()=>{const f=task5bProjectionV1(true);mutate(f);task5bRefusedV1(()=>task5bProjectV1(vm,f));});
  cases.done();vm.assertContained();
});

function task5bDeferredV1(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};}
async function task5bPumpV1(){
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
}
function task5bDeadlineV1(vm){
  const live=vm.timers.filter(timer=>!vm.cleared.includes(timer.handle));assert.equal(live.length,1,'one actual outstanding operation budget');
  assert.equal(live[0].delay,5000);vm.monotonic.state.ms+=5000;live[0].callback();
}
function task5bGuardV1(faults,fn){return (...args)=>{try{return fn(...args);}catch(error){
  if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;
}};}
function task5bSqlFixtureV1(vm,{catalogRows=null}={}){
  const faults=[],calls={log:[],reserves:0,releases:0,ends:0,queries:[]};
  const f={vm,faults,calls,reserveValue:null,reserveThrows:false,queryThrows:false,queryRejects:false,
    nextValue:null,nextRows:null,releaseThrows:false,endThrows:false,endRejects:false,endValue:null,
    shapeThrows:false,releaseMicrotask:false,oncloseDuringEnd:false};
  const guard=fn=>task5bGuardV1(faults,fn);
  const reservation=guard(()=>assert.fail('qualification uses fixed unsafe SELECT, never an unclassified query'));
  reservation.unsafe=guard((sql,...rest)=>{
    assert.equal(typeof sql,'string');assert.deepEqual(rest,[],'fixed read-only SQL has no caller parameter channel');
    assert.equal(calls.releases,0);assert.equal(calls.ends,0);assert.equal(calls.reserves,1);
    assert.match(sql,/^\s*(?:WITH\b|SELECT\b)/i);assert.match(sql,/pg_backend_pid\s*\(/i);
    assert.match(sql,/pg_stat_activity/i);assert.match(sql,/backend_start/i);assert.match(sql,/datid/i);assert.match(sql,/usesysid/i);
    assert.doesNotMatch(sql,/pg_authid|data_directory|unix_socket_directories|\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|GRANT|REVOKE)\b/i);
    let kind;
    if(/pg_control_system/i.test(sql))kind='identity';
    else if(/pg_auth_members/i.test(sql))kind='memberships';
    else if(/pg_roles/i.test(sql))kind='roles';
    else if(/pg_database/i.test(sql))kind='databases';
    else assert.fail('query is one fixed qualification kind');
    if(kind==='identity')assert.match(sql,/host\s*\(\s*(?:pg_catalog\.)?inet_server_addr\s*\(/i);
    else assert.match(sql,/LIMIT\s+(?:4|5|129|131|257)\b/i);
    calls.queries.push(kind);calls.log.push('query:'+kind);
    if(f.queryThrows)throw Error('PRIVATE_QUERY_THROW');
    if(f.queryRejects)return Promise.reject(Error('PRIVATE_QUERY_REJECT'));
    if(f.nextValue!==null){const value=f.nextValue;f.nextValue=null;return value;}
    const own={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:'7',usesysid:'8'};
    const raw=f.nextRows??(kind==='identity'?task5bIdentityV1().rows:[{...own,rows:(catalogRows??task4aCatalogV1())[kind]}]);f.nextRows=null;
    // Driver-owned array metadata is deliberately present; it is not baseline
    // DATA and must be removed by the real consumer's explicit projection.
    const rows=task5bDataV1(vm,raw);rows.count=rows.length;rows.command='SELECT';return Promise.resolve(rows);
  });
  reservation.release=guard(()=>{calls.releases++;calls.log.push('release');assert.equal(calls.releases,1);
    queueMicrotask(()=>{f.releaseMicrotask=true;});if(f.releaseThrows)throw Error('PRIVATE_RELEASE_THROW');});
  const pool=guard(()=>assert.fail('no unreserved pool query'));
  Object.defineProperty(pool,'reserve',{get:guard(()=>{
    if(f.shapeThrows)throw Error('PRIVATE_RESERVE_PROPERTY');
    return guard(()=>{calls.reserves++;calls.log.push('reserve');assert.equal(calls.reserves,1);
      if(f.reserveThrows)return Promise.reject(Error('PRIVATE_RESERVE_REJECT'));
      return f.reserveValue??Promise.resolve(reservation);});
  })});
  pool.end=guard(options=>{calls.ends++;calls.log.push('end');assert.equal(calls.ends,1);
    assert.deepEqual(task5bPlainV1(options),{timeout:5});assert.equal(f.releaseMicrotask,false,'end invoked synchronously after release');
    if(f.oncloseDuringEnd)f.ledger.onclose();
    if(f.endThrows)throw Error('PRIVATE_END_THROW');if(f.endRejects)return Promise.reject(Error('PRIVATE_END_REJECT'));
    return f.endValue??Promise.resolve();
  });
  f.pool=pool;f.reservation=reservation;f.ledger=vm.api.createManualOrphanPhaseSqlLedgerV1();
  assert.deepEqual(Object.keys(f.ledger).sort(),['capturePool','close','current','onclose','query','reserve']);
  f.check=()=>{assert.deepEqual(faults,[],'consumer catches must not swallow retained-client fixture assertions');
    const now=f.ledger.current();assert.deepEqual(Object.keys(now).sort(),[
      'closed','endAttempted','pair','pending','poolCaptured','releaseAttempted','reservationCaptured','stopped','unknown']);
    assert.equal(now.releaseAttempted,calls.releases===1);assert.equal(now.endAttempted,calls.ends===1);
    assert.equal(Object.isFrozen(now),true);vm.assertContained();};
  return f;
}
async function task5bSqlReadyV1(f){
  f.ledger.capturePool(f.pool);await f.ledger.reserve();
  const identity=await f.ledger.query('identity',task5bDataV1(f.vm,task5bIdentityV1().expected));
  assert.deepEqual(task5bPlainV1(identity),TASK5B_PAIR_V1);assert.equal(Object.isFrozen(identity),true);
  assert.deepEqual(task5bPlainV1(f.ledger.current().pair),TASK5B_PAIR_V1);f.check();
}
function task5bSqlUnknownV1(f){assert.equal(f.ledger.current().unknown,true);assert.equal(f.ledger.current().closed,false);f.check();}
async function task5bTrackUnknownV1(t){const outcome=await t.done;assert.equal(outcome.error?.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');}
function task5bQueryV1(f,kind='identity'){return f.ledger.query(kind,task5bDataV1(f.vm,task5bIdentityV1().expected));}

// Break: a late reserve must remain retained even after its budget has expired.
test('Task5B retained SQL acquire/reserve',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(7);
  await cases.wait('pool retained before shape failure',async()=>{const f=task5bSqlFixtureV1(vm);f.shapeThrows=true;
    // Capture is retention-only. Fallible member access belongs to reserve.
    f.ledger.capturePool(f.pool);assert.equal(f.ledger.current().poolCaptured,true);
    await task5bRejectV1(f.ledger.reserve());await task5bRejectV1(f.ledger.close());
    assert.equal(f.calls.reserves,0);assert.equal(f.calls.ends,1);task5bSqlUnknownV1(f);});
  await cases.wait('reserve once',async()=>{const f=task5bSqlFixtureV1(vm);f.ledger.capturePool(f.pool);await f.ledger.reserve();
    assert.equal(f.calls.reserves,1);assert.equal(f.ledger.current().reservationCaptured,true);
    assert.equal(f.ledger.current().pending,null);await f.ledger.close();assert.equal(f.ledger.current().closed,true);f.check();});
  await cases.wait('reserve rejection',async()=>{const f=task5bSqlFixtureV1(vm);f.reserveThrows=true;f.ledger.capturePool(f.pool);
    await task5bRejectV1(f.ledger.reserve());await task5bRejectV1(f.ledger.close());assert.equal(f.calls.releases,0);assert.equal(f.calls.ends,1);f.check();});
  await cases.wait('reserve pending',async()=>{const f=task5bSqlFixtureV1(vm),d=task5bDeferredV1();f.reserveValue=d.promise;f.ledger.capturePool(f.pool);
    const pending=trackProbePromiseV1(f.ledger.reserve());await task5bPumpV1();assert.equal(pending.outcome,null);
    assert.equal(f.ledger.current().pending,'reserve');assert.equal(f.calls.ends,0);
    d.resolve(f.reservation);await pending.done;assert.equal(pending.outcome.error,undefined);await f.ledger.close();f.check();});
  await cases.wait('late returned reservation after deadline',async()=>{const f=task5bSqlFixtureV1(vm),d=task5bDeferredV1();f.reserveValue=d.promise;f.ledger.capturePool(f.pool);
    const reserve=trackProbePromiseV1(f.ledger.reserve());await task5bPumpV1();task5bDeadlineV1(vm);
    const close=trackProbePromiseV1(f.ledger.close());await task5bPumpV1();assert.equal(reserve.outcome,null);assert.equal(close.outcome,null);
    assert.equal(f.calls.releases,0);assert.equal(f.calls.ends,0);d.resolve(f.reservation);
    await task5bTrackUnknownV1(reserve);await task5bTrackUnknownV1(close);assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);task5bSqlUnknownV1(f);});
  await cases.wait('unexpected onclose',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.ledger.onclose();
    task5bSqlUnknownV1(f);const count=f.calls.queries.length;await task5bRejectV1(task5bQueryV1(f));assert.equal(f.calls.queries.length,count);
    await task5bRejectV1(f.ledger.close());f.check();});
  await cases.wait('repeated reserve blocked',async()=>{const f=task5bSqlFixtureV1(vm);f.ledger.capturePool(f.pool);await f.ledger.reserve();
    await task5bRejectV1(f.ledger.reserve());assert.equal(f.calls.reserves,1);await task5bRejectV1(f.ledger.close());f.check();});
  cases.done();vm.assertContained();
});
// Break: pending qualification is never abandoned to release/end or refreshed.
test('Task5B actual pending query ledger',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(10);
  await cases.wait('retain actual thenable',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);
    const d=task5bDeferredV1();let assimilations=0;f.nextValue={then(resolve,reject){assimilations++;return d.promise.then(resolve,reject);}};
    const query=trackProbePromiseV1(task5bQueryV1(f));await task5bPumpV1();assert.equal(assimilations,1);assert.equal(query.outcome,null);
    assert.equal(f.ledger.current().pending,'query');d.resolve(task5bDataV1(vm,task5bIdentityV1().rows));
    await query.done;assert.equal(query.outcome.error,undefined);await f.ledger.close();f.check();});
  await cases.wait('serial query',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);await task5bQueryV1(f);
    assert.deepEqual(f.calls.queries,['identity','identity']);assert.deepEqual(task5bPlainV1(f.ledger.current().pair),TASK5B_PAIR_V1);
    // A completed query's cleared budget cannot expire because later work takes time.
    const before=vm.cleared.length;vm.monotonic.state.ms+=6000;assert.equal(f.ledger.current().unknown,false);assert.ok(before>0);
    await f.ledger.close();f.check();});
  await cases.wait('concurrent query denied',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.nextValue=d.promise;
    const first=trackProbePromiseV1(task5bQueryV1(f));await task5bPumpV1();await task5bRejectV1(task5bQueryV1(f));
    assert.equal(f.calls.queries.length,2);d.resolve(task5bDataV1(vm,task5bIdentityV1().rows));await task5bTrackUnknownV1(first);
    await task5bRejectV1(f.ledger.close());f.check();});
  await cases.wait('synchronous throw',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.queryThrows=true;
    await task5bRejectV1(task5bQueryV1(f));await task5bRejectV1(f.ledger.close());task5bSqlUnknownV1(f);});
  await cases.wait('rejection',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.queryRejects=true;
    await task5bRejectV1(task5bQueryV1(f));await task5bRejectV1(f.ledger.close());task5bSqlUnknownV1(f);});
  await cases.wait('pending deadline',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.nextValue=d.promise;
    const query=trackProbePromiseV1(task5bQueryV1(f));await task5bPumpV1();task5bDeadlineV1(vm);await task5bPumpV1();
    assert.equal(query.outcome,null);assert.equal(f.ledger.current().pending,'query');task5bSqlUnknownV1(f);
    d.resolve(task5bDataV1(vm,task5bIdentityV1().rows));await task5bTrackUnknownV1(query);await task5bRejectV1(f.ledger.close());f.check();});
  await cases.wait('late fulfill staysunknown',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.nextValue=d.promise;
    const query=trackProbePromiseV1(task5bQueryV1(f));await task5bPumpV1();task5bDeadlineV1(vm);d.resolve(task5bDataV1(vm,task5bIdentityV1().rows));
    await task5bTrackUnknownV1(query);assert.equal(f.ledger.current().pending,null);task5bSqlUnknownV1(f);
    await task5bRejectV1(f.ledger.close());f.check();});
  await cases.wait('late reject staysunknown',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.nextValue=d.promise;
    const query=trackProbePromiseV1(task5bQueryV1(f));await task5bPumpV1();task5bDeadlineV1(vm);d.reject(Error('PRIVATE_LATE_QUERY'));
    await task5bTrackUnknownV1(query);await task5bRejectV1(f.ledger.close());task5bSqlUnknownV1(f);});
  await cases.wait('close waits pending no early release',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.nextValue=d.promise;
    const query=trackProbePromiseV1(task5bQueryV1(f)),close=trackProbePromiseV1(f.ledger.close());await task5bPumpV1();
    assert.equal(close.outcome,null);assert.equal(f.calls.releases,0);assert.equal(f.calls.ends,0);
    assert.equal(f.ledger.current().stopped,true);d.resolve(task5bDataV1(vm,task5bIdentityV1().rows));
    await query.done;await close.done;assert.equal(query.outcome.error,undefined);assert.equal(close.outcome.error,undefined);
    assert.deepEqual(f.calls.log.slice(-2),['release','end']);f.check();});
  await cases.wait('empty membership envelope still checks pair',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);
    f.nextRows=[{pid:701,backendStartedAtUTC:TASK5B_PAIR_V1.backendStartedAtUTC,datid:'7',usesysid:'8',rows:[]}];
    await task5bRejectV1(task5bQueryV1(f,'memberships'));assert.equal(f.calls.queries.at(-1),'memberships');
    assert.deepEqual(task5bPlainV1(f.ledger.current().pair),TASK5B_PAIR_V1);await task5bRejectV1(f.ledger.close());f.check();});
  cases.done();vm.assertContained();
});
// Break: release/end ordering, one-attempt flags and elapsed proof are required.
test('Task5B qualification release/end',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(8);
  await cases.wait('exact synchronous release end',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.oncloseDuringEnd=true;
    await f.ledger.close();assert.deepEqual(f.calls.log.slice(-2),['release','end']);assert.equal(f.ledger.current().closed,true);
    assert.equal(f.ledger.current().unknown,false);f.check();});
  await cases.wait('release throw',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.releaseThrows=true;
    await task5bRejectV1(f.ledger.close());assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);task5bSqlUnknownV1(f);});
  await cases.wait('end throw',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.endThrows=true;
    await task5bRejectV1(f.ledger.close());assert.equal(f.calls.ends,1);task5bSqlUnknownV1(f);});
  await cases.wait('end rejection',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.endRejects=true;
    await task5bRejectV1(f.ledger.close());assert.equal(f.calls.ends,1);task5bSqlUnknownV1(f);});
  await cases.wait('end pending deadline',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.endValue=d.promise;
    const close=trackProbePromiseV1(f.ledger.close());await task5bPumpV1();assert.equal(f.ledger.current().pending,'end');task5bDeadlineV1(vm);
    await task5bPumpV1();assert.equal(close.outcome,null);task5bSqlUnknownV1(f);d.resolve();await task5bTrackUnknownV1(close);f.check();});
  await cases.wait('late fulfill cannotclear',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);const d=task5bDeferredV1();f.endValue=d.promise;
    const close=trackProbePromiseV1(f.ledger.close());await task5bPumpV1();vm.monotonic.state.ms+=5001;d.resolve();
    await task5bTrackUnknownV1(close);task5bSqlUnknownV1(f);assert.equal(f.ledger.current().pending,null);});
  await cases.wait('secondclose no retry',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);f.endRejects=true;
    await task5bRejectV1(f.ledger.close());await task5bRejectV1(f.ledger.close());assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);f.check();});
  await cases.wait('no query reconnect afterstop',async()=>{const f=task5bSqlFixtureV1(vm);await task5bSqlReadyV1(f);await f.ledger.close();
    const before={...f.calls,log:[...f.calls.log],queries:[...f.calls.queries]};await task5bRejectV1(task5bQueryV1(f));await task5bRejectV1(f.ledger.reserve());
    assert.deepEqual(f.calls,before);f.check();});
  cases.done();vm.assertContained();
});

function task5bNamespaceFixtureV1(vm,{code='FRESH_INSTALLATION_DATABASE_NOT_PREPARED'}={}){
  const faults=[],calls=[],d=task5bDeferredV1();
  const f={vm,faults,calls,d,getterMode:'refused',closeMode:'deferred',gets:0,closes:0,forbidden:[],resolved:false};
  const guard=fn=>task5bGuardV1(faults,fn);
  const namespace={pgClose:guard(()=>{f.closes++;calls.push('pgClose');assert.equal(f.closes,1);
    if(f.closeMode==='throw')throw Error('PRIVATE_PGCLOSE_THROW');
    if(f.closeMode==='reject')return Promise.reject(Error('PRIVATE_PGCLOSE_REJECT'));
    return d.promise;
  }),getSql:guard(()=>{f.gets++;calls.push('getSql');assert.equal(f.closes,1,'getter fences occur after sole explicit close');
    if(f.getterMode==='resolves'||(f.getterMode==='post-resolves'&&f.gets>1))return {};
    if(f.getterMode==='unexpected')throw Error('PRIVATE_GETTER_DETAIL');
    throw Error(code);
  })};
  const forbidden=name=>guard(()=>{f.forbidden.push(name);assert.fail('forbidden postclose '+name);});
  namespace.assertSelectedFreshInstallationOperationalDatabaseV1=forbidden('db.assert');
  namespace.prepareSelectedFreshInstallationDatabaseV1=forbidden('db.prepare');
  namespace.assertFreshInstallationOperationalEntryV1=forbidden('entry.assert');
  namespace.prepareFreshInstallationOperationalEntryV1=forbidden('entry.prepare');
  f.namespace=namespace;f.capture=()=>vm.api.captureManualOrphanPhaseDatabaseV1(namespace);
  f.fulfill=()=>{f.resolved=true;d.resolve();};
  f.check=()=>{assert.deepEqual(faults,[],'consumer catch cannot swallow captured-namespace fixture assertion');
    assert.deepEqual(f.forbidden,[]);vm.assertContained();};
  return f;
}
function task5bCloseObjectV1(f){const captured=f.capture();assert.deepEqual(Object.keys(captured).sort(),['close','current']);
  const now=captured.current();assert.deepEqual(task5bPlainV1(now),{closeAttempted:false,pending:false,unknown:false,closed:false});
  assert.equal(Object.isFrozen(now),true);return captured;}
function task5bCloseUnknownV1(captured){assert.equal(captured.current().unknown,true);assert.equal(captured.current().closed,false);}
// Break: getter fences must use one captured namespace around actual settlement.
test('Task5B captured namespace normal fence',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(4);
  await cases.wait('immediate refusal before await',async()=>{const f=task5bNamespaceFixtureV1(vm),c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());assert.deepEqual(f.calls,['pgClose','getSql']);assert.equal(close.outcome,null);
    f.fulfill();await close.done;assert.equal(close.outcome.error,undefined);assert.equal(c.current().closed,true);f.check();});
  await cases.wait('deferred close fulfillment',async()=>{const f=task5bNamespaceFixtureV1(vm),c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(close.outcome,null);assert.equal(c.current().pending,true);
    f.fulfill();await close.done;assert.equal(close.outcome.error,undefined);assert.equal(c.current().pending,false);f.check();});
  await cases.wait('postawait refusal',async()=>{const f=task5bNamespaceFixtureV1(vm,{code:'FRESH_INSTALLATION_SELECTION_REFUSED'}),c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());f.fulfill();await close.done;assert.equal(close.outcome.error,undefined);
    assert.deepEqual(f.calls,['pgClose','getSql','getSql']);const cleared=vm.cleared.length;
    vm.monotonic.state.ms+=6000;assert.equal(c.current().closed,true);assert.equal(c.current().unknown,false);assert.ok(cleared>0);f.check();});
  await cases.wait('same namespace despite unused namespace',async()=>{const f=task5bNamespaceFixtureV1(vm),unused=task5bNamespaceFixtureV1(vm);
    const c=task5bCloseObjectV1(f),close=trackProbePromiseV1(c.close());f.fulfill();await close.done;
    assert.equal(close.outcome.error,undefined);assert.deepEqual(f.calls,['pgClose','getSql','getSql']);assert.deepEqual(unused.calls,[]);f.check();unused.check();});
  cases.done();vm.assertContained();
});
// Break: close uncertainty is sticky and cannot be repaired by a later fulfill.
test('Task5B captured namespace close failures',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(8);
  await cases.wait('close throw',async()=>{const f=task5bNamespaceFixtureV1(vm);f.closeMode='throw';const c=task5bCloseObjectV1(f);
    await task5bRejectV1(c.close());assert.equal(f.closes,1);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('rejected promise',async()=>{const f=task5bNamespaceFixtureV1(vm);f.closeMode='reject';const c=task5bCloseObjectV1(f);
    await task5bRejectV1(c.close());task5bCloseUnknownV1(c);f.check();});
  await cases.wait('deadline pending',async()=>{const f=task5bNamespaceFixtureV1(vm),c=task5bCloseObjectV1(f),close=trackProbePromiseV1(c.close());
    await task5bPumpV1();task5bDeadlineV1(vm);await task5bPumpV1();assert.equal(close.outcome,null);assert.equal(c.current().pending,true);
    task5bCloseUnknownV1(c);f.fulfill();await task5bTrackUnknownV1(close);f.check();});
  await cases.wait('late fulfillment unknown',async()=>{const f=task5bNamespaceFixtureV1(vm),c=task5bCloseObjectV1(f),close=trackProbePromiseV1(c.close());
    await task5bPumpV1();vm.monotonic.state.ms+=5001;f.fulfill();await task5bTrackUnknownV1(close);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('immediate getter resolves',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());f.fulfill();await task5bTrackUnknownV1(close);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('postawait getter resolves',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='post-resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());f.fulfill();await task5bTrackUnknownV1(close);assert.equal(f.gets,2);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('close property fault',async()=>{const f=task5bNamespaceFixtureV1(vm);Object.defineProperty(f.namespace,'pgClose',{
    get(){f.calls.push('close-property');throw Error('PRIVATE_CLOSE_PROPERTY');}});const c=task5bCloseObjectV1(f);
    await task5bRejectV1(c.close());assert.equal(c.current().closeAttempted,true);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('repeat close no secondinvoke',async()=>{const f=task5bNamespaceFixtureV1(vm),c=task5bCloseObjectV1(f);
    const first=trackProbePromiseV1(c.close()),second=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(f.closes,1);
    assert.equal(first.outcome,null);assert.equal(second.outcome,null);f.fulfill();await first.done;await second.done;
    assert.equal(first.outcome.error,undefined);assert.equal(second.outcome.error,undefined);assert.equal(f.closes,1);f.check();});
  cases.done();vm.assertContained();
});
// Break: an immediate fence fault must not discard the already-started pgClose.
test('Task5B failed immediate fence still joins',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(5);
  await cases.wait('getter resolves pending',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(close.outcome,null);assert.equal(c.current().pending,true);
    task5bCloseUnknownV1(c);f.fulfill();await task5bTrackUnknownV1(close);assert.equal(f.closes,1);f.check();});
  await cases.wait('getter unexpected behavior pending',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='unexpected';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(close.outcome,null);task5bCloseUnknownV1(c);
    f.fulfill();await task5bTrackUnknownV1(close);f.check();});
  await cases.wait('later close fulfillment',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(close.outcome,null);f.getterMode='refused';f.fulfill();
    await task5bTrackUnknownV1(close);assert.equal(c.current().pending,false);task5bCloseUnknownV1(c);assert.equal(f.closes,1);f.check();});
  await cases.wait('later rejection',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();assert.equal(close.outcome,null);f.d.reject(Error('PRIVATE_CLOSE_LATE_REJECT'));
    await task5bTrackUnknownV1(close);assert.equal(c.current().pending,false);task5bCloseUnknownV1(c);f.check();});
  await cases.wait('late fault while waiting',async()=>{const local=task5bGateV1(),f=task5bNamespaceFixtureV1(local);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());await task5bPumpV1();local.monotonic.state.mode='throw';f.getterMode='refused';f.fulfill();
    await task5bTrackUnknownV1(close);task5bCloseUnknownV1(c);assert.equal(f.closes,1);f.check();});
  cases.done();vm.assertContained();
});
// Break: close must never call entry/prepare/database assertions afterward.
test('Task5B postclose forbidden APIs',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(3);
  for(const [name,code] of [['old namespace','FRESH_INSTALLATION_DATABASE_NOT_PREPARED'],
    ['activation namespace','FRESH_INSTALLATION_SELECTION_REFUSED'],['new namespace','FRESH_INSTALLATION_DATABASE_NOT_PREPARED']])
    await cases.wait(name,async()=>{const f=task5bNamespaceFixtureV1(vm,{code}),c=task5bCloseObjectV1(f),close=trackProbePromiseV1(c.close());
      f.fulfill();await close.done;assert.equal(close.outcome.error,undefined);assert.deepEqual(f.calls,['pgClose','getSql','getSql']);
      assert.equal(c.current().closed,true);assert.deepEqual(f.forbidden,[]);f.check();});
  cases.done();vm.assertContained();
});
// Break: private diagnostics are fixed and cleanup uncertainty dominates case.
test('Task5B fixed diagnostic precedence',async()=>{
  const vm=task5bGateV1(),cases=task5bCasesV1(8),owned=vm.api.ownedPolicy,legacy=vm.api.probePolicy;
  for(const [name,message,want] of [['FRAME','MANUAL_ORPHAN_FRAME_REFUSED','MANUAL_ORPHAN_FRAME_REFUSED'],
    ['OWNER','MANUAL_ORPHAN_OWNER_REFUSED','MANUAL_ORPHAN_OWNER_REFUSED'],
    ['SETUP','MANUAL_ORPHAN_SETUP_REFUSED','MANUAL_ORPHAN_SETUP_REFUSED'],
    ['CASE owned','MANUAL_ORPHAN_CASE_REFUSED','MANUAL_ORPHAN_CASE_REFUSED'],
    ['CLEANUP_UNKNOWN','MANUAL_ORPHAN_CLEANUP_UNKNOWN','MANUAL_ORPHAN_CLEANUP_UNKNOWN'],
    ['arbitrary private exception redacted','PRIVATE_SECRET_SQL_DETAIL','MANUAL_ORPHAN_OWNER_REFUSED']])
    cases.run(name,()=>assert.equal(vm.api.manualOrphanEntryErrorV1(Error(message),owned).message,want));
  await cases.wait('unknown dominates case',async()=>{const f=task5bNamespaceFixtureV1(vm);f.getterMode='resolves';const c=task5bCloseObjectV1(f);
    const close=trackProbePromiseV1(c.close());f.d.reject(Error('MANUAL_ORPHAN_CASE_REFUSED'));const outcome=await close.done;
    assert.equal(outcome.error?.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(vm.api.manualOrphanEntryErrorV1(outcome.error,owned).message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');f.check();});
  cases.run('legacy mapping preserved',()=>assert.equal(vm.api.manualOrphanEntryErrorV1(Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN'),legacy).message,
    'MANUAL_ORPHAN_CHILD_UNKNOWN'));cases.done();vm.assertContained();
});

// Break: provisional admin identity must admit only the all-null bootstrap,
// preserve the actual pair, and leave catalog binding/effect authority separate.
test('Task5B initial admin identity bootstrap is provisional and bounded',()=>{
  task3ContractsV1();
  let importing=true,environment;
  const importReads=[],processBinding={};
  Object.defineProperty(processBinding,'env',{enumerable:true,get(){
    if(importing){importReads.push('process.env');throw Error('TEST_INERT_ENV_READ');}return environment;
  },set(value){environment=value;}});
  const contained=task3VmV1({task5bPrivate:true,process:processBinding,os:{}});importing=false;
  const api=contained.task5bPrivate;assert.ok(api,'missing Task5B private exposure');
  assert.equal(typeof api.validateManualOrphanPhaseIdentityV1,'function',
    'missing-private-consumer validateManualOrphanPhaseIdentityV1');
  assert.deepEqual(importReads,[],'no caught module-time selection/environment observation');
  contained.assertContained();
  const vm={...contained,api},cases=task5bCasesV1(4);
  const admin=()=>{
    const f=task5bIdentityV1();
    Object.assign(f.expected,{databaseName:'postgres',databaseOid:null,ownerOid:null,
      currentRole:'postgres',sessionRole:'postgres',runtimeOid:null,userOid:null});
    Object.assign(f.rows[0],{database:'postgres',databaseOid:'5',ownerOid:'1',currentUser:'postgres',
      sessionUser:'postgres',runtimeOid:null,datid:'5',usesysid:'1'});
    return f;
  };
  try{
    cases.run('all-null admin then concrete same pair',()=>{
      const f=admin(),pair=task5bIdentityCallV1(vm,f);
      const wanted={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:5,usesysid:1};
      assert.deepEqual(task5bPlainV1(pair),wanted);assert.equal(Object.isFrozen(pair),true);
      // Independently fixed fixture OIDs model the later binding; this pure DATA
      // case does not claim the required complete catalog/effect barrier ran.
      const concrete=admin();Object.assign(concrete.expected,{databaseOid:5,ownerOid:1,userOid:1});
      const repeated=task5bIdentityCallV1(vm,concrete,pair);
      assert.deepEqual(task5bPlainV1(repeated),wanted);assert.equal(Object.isFrozen(repeated),true);
      assert.deepEqual(task5bPlainV1(pair),wanted);vm.assertContained();
    });
    cases.run('mechanical all-null expected refuses',()=>{
      const f=task5bIdentityV1();Object.assign(f.expected,{databaseOid:null,ownerOid:null,userOid:null});
      task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));vm.assertContained();
    });
    cases.run('admin mixed-null expected refuses',()=>{
      const f=admin();f.expected.ownerOid=1;
      task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));vm.assertContained();
    });
    cases.run('admin actual owner and own user OIDs disagree',()=>{
      const f=admin();f.rows[0].ownerOid='2';
      task5bRefusedV1(()=>task5bIdentityCallV1(vm,f));vm.assertContained();
    });
    cases.done();
  }finally{
    assert.deepEqual(importReads,[],'no caught module-time selection/environment observation');
    vm.assertContained();
  }
});

// Task5B fix1: real private direct entry and retained input, with only finite
// output event boundaries. No successful Source/phase owner is manufactured.
function task5bFix1OutputBoundaryV1(){
  const faults=[],calls=[],emitted=[],channels={stdout:new EventEmitter(),stderr:new EventEmitter()};
  return {
    configure({f}){
      for(const name of ['stdout','stderr']){
        const stream=f.process[name];
        // Preserve the existing contained write binding; capture only actual
        // direct-entry listener registration on this output channel.
        stream.on=task5bGuardV1(faults,(event,listener,...rest)=>{
          assert.equal(event,'error');assert.equal(typeof listener,'function');assert.deepEqual(rest,[]);
          assert.equal(channels[name].listenerCount('error'),0,'one direct-entry output listener');
          calls.push(name);channels[name].on(event,listener);return stream;
        });
      }
    },
    emit(name){
      assert.ok(name==='stdout'||name==='stderr');assert.equal(channels[name].listenerCount('error'),1);
      emitted.push(name);assert.equal(channels[name].emit('error',Error('PRIVATE_TASK5B_FIX1_OUTPUT_DETAIL')),true);
    },
    check(name){
      assert.deepEqual(faults,[],'output-boundary assertions cannot disappear inside production catches');
      assert.deepEqual(calls,['stderr','stdout']);assert.deepEqual(emitted,[name]);
      assert.equal(channels.stdout.listenerCount('error'),1);assert.equal(channels.stderr.listenerCount('error'),1);
    },
  };
}
async function task5bFix1OutputCaseV1(channel,timing){
  assert.ok(channel==='stdout'||channel==='stderr');assert.ok(timing==='pending'||timing==='after-close');
  const boundary=task5bFix1OutputBoundaryV1(),bytes=task3WireV1('provision');
  const entry=task3EntryV1(bytes,{profile:'new',auto:false,configure:boundary.configure});
  const main=trackProbePromiseV1(entry.vm.childMain()),socket=entry.reader.ledger.socket;
  assert.ok(socket);assert.equal(main.outcome,null);assert.equal(entry.reader.ledger.closed,false);
  assert.equal(entry.reader.ledger.adopted,true);assert.deepEqual(entry.reader.ledger.fstats,[4]);
  assert.equal(entry.reader.ledger.constructs.length,1);
  if(timing==='pending'){
    boundary.emit(channel);await task5bPumpV1();
    assert.equal(main.outcome,null,'output fault/exitCode/requested destroy cannot fabricate input close');
    assert.equal(entry.reader.ledger.closed,false);assert.equal(entry.f.control.stdout,'');
    assert.deepEqual(entry.reader.ledger.rawCloses,[]);entry.vm.assertContained();
  }
  socket.emit('data',Buffer.from(bytes));socket.emit('end');
  await task5bPumpV1();assert.equal(main.outcome,null,'EOF still waits for the actual retained close');
  assert.equal(entry.reader.ledger.destroys,1);assert.equal(entry.reader.ledger.closed,false);
  entry.reader.ledger.closed=true;socket.emit('close',false);
  // Intentionally no await between actual close and this output error: the
  // reader has resolved, but direct entry has not resumed its await continuation.
  if(timing==='after-close')boundary.emit(channel);
  const outcome=await main.done;
  assert.equal(outcome.error,undefined);assert.equal(Object.hasOwn(outcome,'value'),true);
  assert.equal(main.outcome,outcome);assert.equal(entry.reader.ledger.closed,true);
  assert.deepEqual(entry.reader.ledger.fstats,[4]);assert.equal(entry.reader.ledger.constructs.length,1);
  assert.equal(entry.reader.ledger.destroys,1);assert.deepEqual(entry.reader.ledger.rawCloses,[]);
  assert.equal(entry.vm.timers.length,1);assert.deepEqual(entry.vm.cleared,[entry.vm.timers[0].handle]);
  boundary.check(channel);entry.reader.assertClean();entry.f.assertClean();entry.vm.assertContained();
  assert.deepEqual(entry.effects,[]);assert.equal(entry.f.state.opened.length,0);
  assert.equal(entry.f.control.stdout,'','a retained output fault never yields a receipt');
  assert.equal(entry.f.process.exitCode,1);
  const diagnostic=entry.f.control.stderr;
  assert.equal(diagnostic.includes('PRIVATE_TASK5B_FIX1_OUTPUT_DETAIL'),false);
  assert.ok(diagnostic.endsWith('\n'),'terminal fixed refusal has a complete line');
  const lines=diagnostic.slice(0,-1).split('\n');
  assert.equal(lines.at(-1),'MANUAL_ORPHAN_CLEANUP_UNKNOWN','the final refusal must remain unknown, not merely an earlier output diagnostic');
  assert.ok(lines.every(line=>line==='MANUAL_ORPHAN_CLEANUP_UNKNOWN'),'only fixed unknown diagnostics, never raw details or another refusal');
}
// Break: stdout uncertainty must join the still-pending inherited reader.
test('Task5B fix1 stdout fault retains pending input and dominates dispatch',async()=>{
  const cases=task5bCasesV1(1);
  await cases.wait('stdout error while reader pending',()=>task5bFix1OutputCaseV1('stdout','pending'));
  cases.done();
});
// Break: stderr uncertainty needs the same sticky custody as stdout uncertainty.
test('Task5B fix1 stderr fault retains pending input and dominates dispatch',async()=>{
  const cases=task5bCasesV1(1);
  await cases.wait('stderr error while reader pending',()=>task5bFix1OutputCaseV1('stderr','pending'));
  cases.done();
});
// Break: a resolved input promise cannot erase a newer stdout error.
test('Task5B fix1 stdout fault after input close remains absorbing',async()=>{
  const cases=task5bCasesV1(1);
  await cases.wait('stdout error synchronously after actual close',()=>task5bFix1OutputCaseV1('stdout','after-close'));
  cases.done();
});
// Break: late stderr uncertainty must dominate the subsequent owner dispatch.
test('Task5B fix1 stderr fault after input close remains absorbing',async()=>{
  const cases=task5bCasesV1(1);
  await cases.wait('stderr error synchronously after actual close',()=>task5bFix1OutputCaseV1('stderr','after-close'));
  cases.done();
});

// Task5C Phase A. Preserve the entire reviewed Task5B prefix except the three
// explicitly reversible opt-in hooks in fixedProbeVmV1. No genuine owner is
// exposed here: only fourteen natural consumers and same-realm JSON DATA.
const TASK5C_FIXTURE_V1=new URL('../../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts',import.meta.url);
function task5cEvaluateFixtureV1(context,bindings,c,faults){
  const original=readFileSync(TASK5C_FIXTURE_V1,'utf8');
  const rootSite='const root = new URL("../../../", import.meta.url);';
  const resolverSite='["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", program]';
  let source=replaceOnce(original,rootSite,'const root = new URL("../../../", '+JSON.stringify(TASK5C_FIXTURE_V1.href)+');','Task5C active root URL');
  source=replaceOnce(source,resolverSite,'["--import", __task5cForbiddenResolveV1("tsx"), "--input-type=module", "-e", program]','Task5C dormant active resolver');
  const refuse=label=>(..._args)=>{faults.push('Task5C forbidden '+label);throw Error('TASK5C_CONTAINMENT');};
  const guarded=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const actual=context.exports;
  const facade=Object.freeze({
    MANUAL_ORPHAN_VECTOR_V1:actual.MANUAL_ORPHAN_VECTOR_V1,
    encodeManualOrphanOwnedPhaseFrameV1:actual.encodeManualOrphanOwnedPhaseFrameV1,
    decodeManualOrphanOwnedPhaseResultV1:actual.decodeManualOrphanOwnedPhaseResultV1,
    canonicalizeManualOrphanClusterBaselineV1:actual.canonicalizeManualOrphanClusterBaselineV1,
    encodeManualOrphanIntegrationResultV1:actual.encodeManualOrphanIntegrationResultV1,
    decodeManualOrphanIntegrationResultV1:actual.decodeManualOrphanIntegrationResultV1,
    encodeManualOrphanRunnerResultV1:actual.encodeManualOrphanRunnerResultV1,
    readManualOrphanOwnedFd4V1:bindings.task4cActualFd4Negative===true?actual.readManualOrphanOwnedFd4V1:refuse('readManualOrphanOwnedFd4V1'),
    observeManualOrphanOwnedFd4V1:actual.observeManualOrphanOwnedFd4V1,
    holdManualOrphanOwnedSourcesV1:refuse('holdManualOrphanOwnedSourcesV1'),
    observeManualOrphanProcessV1:refuse('observeManualOrphanProcessV1'),
    observeManualOrphanOwnedChildV1:bindings.task5cFiniteObservers===true?actual.observeManualOrphanOwnedChildV1:refuse('observeManualOrphanOwnedChildV1'),
    observeManualOrphanOwnedIntegrationChildV1:bindings.task5cFiniteObservers===true?actual.observeManualOrphanOwnedIntegrationChildV1:refuse('observeManualOrphanOwnedIntegrationChildV1'),
  });
  const boundedHash=guarded(algorithm=>{assert.equal(algorithm,'sha256');let bytes=0;const hash=createHash(algorithm);
    const result={update:guarded((value,encoding)=>{assert.ok(typeof value==='string'||Buffer.isBuffer(value));
      bytes+=Buffer.byteLength(value,encoding);assert.ok(bytes<=65536,'Task5C hashes bounded DATA only');hash.update(value,encoding);return result;}),
      digest:guarded(encoding=>{assert.equal(encoding,'hex');return hash.digest(encoding);})};return result;});
  const modules=new Map([
    ['node:assert/strict',assert],['node:path',path],['node:url',url],
    ['node:fs',closedModule(c,'Task5C fs',{constants,...bindings.fs})],
    ['node:os',closedModule(c,'Task5C os',bindings.task6InputNegativeV1===true?{userInfo:bindings.task6InputNegativeAccountV1}:{})],['node:child_process',closedModule(c,'Task5C child_process')],
    ['node:crypto',closedModule(c,'Task5C crypto',{createHash:boundedHash,randomBytes:refuse('randomBytes')})],
    ['./manual-control-orphan-bootstrap-child-v1.mjs',facade],
  ]);
  context.__task5cFixtureRequireV1=specifier=>{
    if(!modules.has(specifier)){faults.push('Task5C unexpected import '+String(specifier));throw Error('TASK5C_UNLISTED_IMPORT');}
    return modules.get(specifier);
  };
  context.__task5cForbiddenResolveV1=refuse('legacy tsx resolution');
  const compiled=ts.transpileModule(source,{fileName:url.fileURLToPath(TASK5C_FIXTURE_V1),
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[]);
  // Complete TS output in a fresh lexical scope in the ALREADY contextified
  // helper realm. Literal guarded names make preimplementation RED causal.
  runInNewContext('(function(exports,require){\n'+compiled.outputText+`\n;
    globalThis.__task5cFixtureLexicalV1={
      claimManualOrphanFixtureEntryV1:typeof claimManualOrphanFixtureEntryV1==='function'?claimManualOrphanFixtureEntryV1:null,
      qualifyManualOrphanFixtureLaunchV1:typeof qualifyManualOrphanFixtureLaunchV1==='function'?qualifyManualOrphanFixtureLaunchV1:null,
      joinManualOrphanInstallationFactsV1:typeof joinManualOrphanInstallationFactsV1==='function'?joinManualOrphanInstallationFactsV1:null,
      checkManualOrphanDeliveryMetadataV1:typeof checkManualOrphanDeliveryMetadataV1==='function'?checkManualOrphanDeliveryMetadataV1:null,
      deliverManualOrphanOwnedFrameV1:typeof deliverManualOrphanOwnedFrameV1==='function'?deliverManualOrphanOwnedFrameV1:null,
      correlateManualOrphanPhaseResultV1:typeof correlateManualOrphanPhaseResultV1==='function'?correlateManualOrphanPhaseResultV1:null,
      correlateManualOrphanIntegrationResultV1:typeof correlateManualOrphanIntegrationResultV1==='function'?correlateManualOrphanIntegrationResultV1:null,
      advanceManualOrphanRouteLedgerV1:typeof advanceManualOrphanRouteLedgerV1==='function'?advanceManualOrphanRouteLedgerV1:null,
      qualifyManualOrphanRunnerCatalogV1:typeof qualifyManualOrphanRunnerCatalogV1==='function'?qualifyManualOrphanRunnerCatalogV1:null,
      retainManualOrphanRunnerAdminV1:typeof retainManualOrphanRunnerAdminV1==='function'?retainManualOrphanRunnerAdminV1:null,
      advanceManualOrphanCleanupLedgerV1:typeof advanceManualOrphanCleanupLedgerV1==='function'?advanceManualOrphanCleanupLedgerV1:null,
      inspectManualOrphanPartialInstallationV1:typeof inspectManualOrphanPartialInstallationV1==='function'?inspectManualOrphanPartialInstallationV1:null,
      finalizeManualOrphanFixtureResultV1:typeof finalizeManualOrphanFixtureResultV1==='function'?finalizeManualOrphanFixtureResultV1:null,
      planManualOrphanFixtureChildV1:typeof planManualOrphanFixtureChildV1==='function'?planManualOrphanFixtureChildV1:null,
      dataFromJson(text){return JSON.parse(text);}
    };
    globalThis.__task5cFixtureFix1LexicalV1={
      retainManualOrphanOriginalChildLifetimeV1:typeof retainManualOrphanOriginalChildLifetimeV1==='function'?retainManualOrphanOriginalChildLifetimeV1:null,
      retainManualOrphanFixtureCompletionV1:typeof retainManualOrphanFixtureCompletionV1==='function'?retainManualOrphanFixtureCompletionV1:null
    };
    globalThis.__task6CompletionChildV1=typeof retainManualOrphanCompletionChildV1==='function'?retainManualOrphanCompletionChildV1:null;
    globalThis.__task6Fix1PrivateV1={
      holdManualOrphanRunnerInstallationsV1:typeof holdManualOrphanRunnerInstallationsV1==='function'?holdManualOrphanRunnerInstallationsV1:null,
      projectManualOrphanInstallationsPinV1:typeof projectManualOrphanInstallationsPinV1==='function'?projectManualOrphanInstallationsPinV1:null
    };
  })(globalThis.__task5cFixtureExportsV1={},globalThis.__task5cFixtureRequireV1);`,context,
    {filename:url.fileURLToPath(TASK5C_FIXTURE_V1),timeout:5000});
}
function task5cVmV1(required=[],options={}){
  const reads=[],monotonic=task3ClockV1(),binding={};let importing=true;
  for(const key of ['env','argv','execArgv','pid','ppid','cwd'])Object.defineProperty(binding,key,{get(){
    reads.push(key);throw Error('TASK5C_PROCESS_READ');}});
  const vm=task3VmV1({task5cFixture:true,task5cFiniteObservers:options.observers===true,
    process:binding,monotonic,fs:options.fs??{}});importing=false;
  const api=vm.fixtureLexical;assert.ok(api,'Task5C fixture lexical wrapper');
  for(const name of required)assert.equal(typeof api[name],'function','missing Task5C private consumer '+name+' (scaffolding RED)');
  const check=()=>{assert.equal(importing,false);assert.deepEqual(reads,[],'no swallowed process access');vm.assertContained();};
  check();return {...vm,api,check};
}
const task5cDataV1=(vm,value)=>vm.api.dataFromJson(JSON.stringify(value));
const task5cPlainV1=value=>JSON.parse(JSON.stringify(value));
const task5cCasesV1=task5bCasesV1;
function task5cRefusedV1(body,code='MANUAL_ORPHAN_OWNER_REFUSED'){
  let caught;assert.throws(body,error=>{caught=error;return error?.message===code;});return caught;
}
async function task5cRejectedV1(promise,code='MANUAL_ORPHAN_CLEANUP_UNKNOWN'){
  let caught;await assert.rejects(promise,error=>{caught=error;return error?.message===code;});return caught;
}
function task5cFrozenV1(value){
  assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))if(child!==null&&typeof child==='object')task5cFrozenV1(child);
}
function task5cIssuedV1(purpose='integration'){
  const result=purpose==='integration'?ownedIntegrationData():ownedPhaseResultData(purpose);
  return {purpose,run:result.run,frameSha256:result.frameSha256,pid:result.pid,parentPid:result.parentPid,
    installation:purpose==='provision'?null:ownedInstallationData(purpose!=='activate')};
}

// 1 / 4. Missing exports fail before fixtures or boundary calls.
test('Task5C fixture exports stay inert and exact',()=>{
  const vm=task5cVmV1();
  assert.equal(typeof vm.fixtureExports.runManualOrphanBootstrapRouteV1,'function','missing Task5C runner export (scaffolding RED)');
  assert.equal(typeof vm.fixtureExports.runManualOrphanBootstrapIntegrationV1,'function','missing Task5C integration export (scaffolding RED)');
  const cases=task5cCasesV1(4);
  cases.run('zero module counters',()=>{assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);assert.equal(vm.monotonic.state.accesses,0);});
  cases.run('four exports',()=>assert.deepEqual(Object.keys(vm.fixtureExports).sort(),[
    'runManualOrphanBootstrapIntegrationV1','runManualOrphanBootstrapRouteV1','runManualOrphanCompiledCliNegativeV1','runManualOrphanSourceContextNegativeV1']));
  cases.run('zero argument exports and exact private arities',()=>{
    assert.equal(vm.fixtureExports.runManualOrphanBootstrapRouteV1.length,0);assert.equal(vm.fixtureExports.runManualOrphanBootstrapIntegrationV1.length,0);
    const expected={claimManualOrphanFixtureEntryV1:2,qualifyManualOrphanFixtureLaunchV1:3,joinManualOrphanInstallationFactsV1:4,
      checkManualOrphanDeliveryMetadataV1:1,deliverManualOrphanOwnedFrameV1:4,correlateManualOrphanPhaseResultV1:3,
      correlateManualOrphanIntegrationResultV1:3,advanceManualOrphanRouteLedgerV1:2,qualifyManualOrphanRunnerCatalogV1:5,
      retainManualOrphanRunnerAdminV1:3,advanceManualOrphanCleanupLedgerV1:2,inspectManualOrphanPartialInstallationV1:2,
      finalizeManualOrphanFixtureResultV1:2,planManualOrphanFixtureChildV1:2,dataFromJson:1};
    assert.deepEqual(Object.keys(vm.api).sort(),Object.keys(expected).sort());
    for(const [name,arity] of Object.entries(expected)){assert.equal(typeof vm.api[name],'function',name);assert.equal(vm.api[name].length,arity,name);}
  });
  cases.run('dormant resolver and imports remain unreachable',()=>vm.check());cases.done();vm.check();
});
// 2 / 6. Entry claim only: never enter the FD4 reader or an owner.
test('Task5C fixture entry claim is single attempt',async()=>{
  const first=task5cVmV1(['claimManualOrphanFixtureEntryV1']),cases=task5cCasesV1(6);
  assert.equal(typeof first.fixtureExports.runManualOrphanBootstrapRouteV1,'function');
  assert.equal(typeof first.fixtureExports.runManualOrphanBootstrapIntegrationV1,'function');
  for(const [name,kind,count,next] of [
    ['wrong route arity','runner',1,'runner'],['wrong integration arity','integration',1,'integration'],
    ['repeat route','runner',0,'runner'],['repeat integration','integration',0,'integration'],
    ['route then integration','runner',0,'integration'],['integration then route','integration',0,'runner'],
  ])await cases.wait(name,async()=>{
    const vm=task5cVmV1(['claimManualOrphanFixtureEntryV1']);const fn=vm.api.claimManualOrphanFixtureEntryV1;
    if(count)task5cRefusedV1(()=>fn(kind,count));else assert.equal(fn(kind,count),undefined);
    const a=task5cRefusedV1(()=>fn(next,0)),b=task5cRefusedV1(()=>fn(next,0));assert.notEqual(a,b);
    if(count){
      const exported=task5cVmV1();let accesses=0;const hostile={};
      Object.defineProperty(hostile,'value',{get(){accesses++;throw Error('ARGUMENT_VALUE_READ');}});
      const firstCall=kind==='runner'?exported.fixtureExports.runManualOrphanBootstrapRouteV1:exported.fixtureExports.runManualOrphanBootstrapIntegrationV1;
      const otherCall=kind==='runner'?exported.fixtureExports.runManualOrphanBootstrapIntegrationV1:exported.fixtureExports.runManualOrphanBootstrapRouteV1;
      assert.equal(typeof firstCall,'function');assert.equal(typeof otherCall,'function');
      const one=await task5cRejectedV1(firstCall(hostile),'MANUAL_ORPHAN_OWNER_REFUSED');
      const two=await task5cRejectedV1(otherCall(),'MANUAL_ORPHAN_OWNER_REFUSED');
      assert.notEqual(one,two);assert.equal(accesses,0);exported.check();
    }
    assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
  });cases.done();first.check();
});
function task5cLaunchV1(kind){
  const graph=task5bGraphV1(),m=SOURCE_M_V1;
  const frame=kind==='runner'?ownedSetupData():ownedPhaseData('integration');
  if(kind==='runner')frame.constructor=task5cPlainV1(graph.frame.constructor);
  else frame.runner=task5cPlainV1(graph.frame.runner);
  const self=kind==='runner'?frame.runner:frame.child,parent=kind==='runner'?frame.constructor:frame.runner;
  const args=kind==='runner'?['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',...VECTOR]:['--import','tsx','--test','--test-isolation=none',FILE];
  const rawCommand=TASK3_NODE_V1+' '+args.join(' ');
  self.executable=TASK3_NODE_V1;self.executableSha256=SOURCE_NODE_HASH_V1;self.commandSha256=createHash('sha256').update(rawCommand).digest('hex');
  const actual={node:TASK3_NODE_V1,maintenanceRoot:m,targetRoot:SOURCE_T_V1,workspace:SOURCE_WORKSPACE_V1,
    cwd:m,execPath:TASK3_NODE_V1,argv0:TASK3_NODE_V1,argv:[TASK3_NODE_V1,m+'/'+(kind==='runner'?'scripts/run-isolated-postgres-tests.ts':FILE),...(kind==='runner'?['--',...VECTOR]:[])],
    execArgv:kind==='runner'?['--import','tsx']:['--import','tsx','--test','--test-isolation=none'],
    env:{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C',TSX_DISABLE_CACHE:'1'},worker:kind==='integration'?{NODE_TEST_WORKER_ID:'1'}:null,
    self:{pin:task5cPlainV1(self),rawCommand},parent:{pin:task5cPlainV1(parent),rawCommand:kind==='runner'?graph.observations.constructor.rawCommand:graph.observations.runner.rawCommand},
    maintenance:ownedReleaseData(OWN_M),target:ownedReleaseData(OWN_T)};
  return {kind,actual,frame};
}
// 3 / 8. Independently observed launch DATA, never acquired authority.
test('Task5C launch comparison rejects mismatched originals',()=>{
  const vm=task5cVmV1(['qualifyManualOrphanFixtureLaunchV1']),cases=task5cCasesV1(8);
  const call=f=>vm.api.qualifyManualOrphanFixtureLaunchV1(f.kind,task5cDataV1(vm,f.actual),task5cDataV1(vm,f.frame));
  for(const kind of ['runner','integration'])cases.run('exact '+kind,()=>{const result=call(task5cLaunchV1(kind));task5cFrozenV1(result);
    assert.deepEqual(task5cPlainV1(result),{node:TASK3_NODE_V1,maintenanceRoot:SOURCE_M_V1,targetRoot:SOURCE_T_V1,
      workspace:SOURCE_WORKSPACE_V1,helper:SOURCE_M_V1+SOURCE_SUFFIX_V1,integration:SOURCE_M_V1+'/'+FILE});});
  for(const [name,mutate] of [
    ['parent mismatch',f=>{f.actual.parent.pin.pid++;}],['raw absolute spelling',f=>{f.actual.self.rawCommand=f.actual.self.rawCommand.replace('scripts/run-isolated',SOURCE_M_V1+'/scripts/run-isolated');}],
    ['extra loader',f=>{f.actual.execArgv.push('--loader','unapproved');}],['selected environment',f=>{f.actual.env.SETFARM_INSTALLATION_ID=OWN_ID;}],
    ['worker forwarded',f=>{f.actual.env.NODE_TEST_CONTEXT='child-v8';}],['workspace masquerades maintenance',f=>{f.actual.maintenanceRoot=SOURCE_WORKSPACE_V1;}],
  ])cases.run(name,()=>{const f=task5cLaunchV1('runner');mutate(f);task5cRefusedV1(()=>call(f));});cases.done();vm.check();
});
function task5cInstallationV1(activated=false){
  const projection=task5bProjectionV1(activated),purpose=activated?'activate':'provision';
  const baseline=task4aLiteralOutputV1();
  for(const key of ['databaseBaselineSha256','roleBaselineSha256','membershipBaselineSha256'])projection.expected.cluster[key]=baseline[key];
  return {stage:activated?'activated':'committed',receipt:ownedPhaseResultData(purpose),records:projection.recordView,
    catalogs:{expected:projection.expected,rows:task5bBaselineV1(activated?'activated':'committed').rows,
      schemaCatalogHash:OWN_H,activationCatalogHash:activated?OWN_B:null}};
}
// 4 / 8. Actual receipt codec and stock-shaped detached observations only.
test('Task5C installation facts join real stage projections',()=>{
  const vm=task5cVmV1(['joinManualOrphanInstallationFactsV1']),cases=task5cCasesV1(8);
  const call=f=>vm.api.joinManualOrphanInstallationFactsV1(f.stage,task5cDataV1(vm,f.receipt),task5cDataV1(vm,f.records),task5cDataV1(vm,f.catalogs));
  cases.run('prepared join',()=>assert.deepEqual(task5cPlainV1(call(task5cInstallationV1())),ownedInstallationData()));
  cases.run('activated join',()=>assert.deepEqual(task5cPlainV1(call(task5cInstallationV1(true))),ownedInstallationData(true)));
  for(const [name,mutate] of [
    ['origin change',f=>{f.records.prepared.origin.sourceSha=OWN_M;}],['database OID',f=>{f.catalogs.rows.databases.at(-1).oid=9;}],
    ['equal role OIDs',f=>{f.receipt.result.installation.runtimeOid=7;}],['base pin changed',f=>{f.records.prepared.baseRecordPins['planned.json'].sha256=OWN_C;}],
    ['missing activation pin',f=>{delete f.records.activation.activatedPin;}],['stage catalog',f=>{f.catalogs.activationCatalogHash=OWN_C;}],
  ])cases.run(name,()=>{const f=task5cInstallationV1(true);mutate(f);task5cRefusedV1(()=>call(f));});cases.done();vm.check();
});
const TASK5C_LEAVES_V1=[
  'scripts/run-private-postgres-tests.mjs','scripts/__tests__/private-postgres-test-cluster.test.js',
  'scripts/run-execution-attempt-tests.ts','scripts/run-isolated-postgres-tests.ts',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs',
  'scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js',
  'tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts',FILE,
  'scripts/private-postgres-test-journal-v1.mjs','scripts/finding-test-preflight.mjs',
  'src/installation/manual-orphan-target-dependencies-v1.json',
];
const TASK5C_ANCESTORS_V1=['/',path.dirname(TASK7_HOST_POLICY.home),TASK7_HOST_POLICY.home,path.dirname(TASK7_HOST_POLICY.workspace),TASK7_HOST_POLICY.workspace,
  TASK7_HOST_POLICY.releases,SOURCE_M_V1,SOURCE_M_V1+'/scripts',SOURCE_M_V1+'/scripts/__tests__',
  SOURCE_M_V1+'/tests',SOURCE_M_V1+'/tests/execution-attempts',SOURCE_M_V1+'/tests/execution-attempts/helpers',
  SOURCE_M_V1+'/src',SOURCE_M_V1+'/src/installation'];
function task5cPinFixtureV1(stage='integration'){
  const calls=[],faults=[],named=new Map(),held=new Map();let nextFd=40;
  const row=(name,kind,policy,bytes=0)=>{
    const fd=nextFd++,identity={dev:'1',ino:String(fd),uid:501,gid:20,mode:kind==='file'?33152:16832,
      nlink:kind==='file'?1:2,size:String(bytes),mtimeNs:'3000000',ctimeNs:'4000000',birthtimeNs:'2000000'};
    const stat=()=>({...identity,dev:BigInt(identity.dev),ino:BigInt(identity.ino),size:BigInt(identity.size),
      uid:BigInt(identity.uid),gid:BigInt(identity.gid),mode:BigInt(identity.mode),nlink:BigInt(identity.nlink),
      mtimeNs:BigInt(identity.mtimeNs),ctimeNs:BigInt(identity.ctimeNs),birthtimeNs:BigInt(identity.birthtimeNs),
      isFile:()=>kind==='file',isDirectory:()=>kind==='directory',isSymbolicLink:()=>false});
    named.set(name,stat());held.set(fd,stat());return {path:name,fd,kind,policy,identity};
  };
  const source=[...TASK5C_LEAVES_V1.map(name=>row(SOURCE_M_V1+'/'+name,'file','immutable-file',1)),
    ...TASK5C_ANCESTORS_V1.map((name,index)=>row(name,'directory',index<6?'shared-ancestor':'immutable-directory'))];
  const installation=ownedInstallationData(stage!=='activate'),directory=task5bDerivedV1().installationsDirectory+'/'+OWN_ID;
  const records=stage==='provision'?[]:Object.entries(installation.records).map(([name,pin])=>row(directory+'/'+name,'file','immutable-file',pin.bytes));
  const d=task5bDerivedV1(),mutablePaths=[d.physicalRoot,d.physicalRoot+'/data',d.installationsDirectory];
  if(stage!=='provision')mutablePaths.push(directory);
  const mutable=mutablePaths.map(name=>row(name,'directory','mutable-directory'));
  const guard=fn=>task5bGuardV1(faults,fn);
  const fs={lstatSync:guard((name,options)=>{assert.deepEqual(task5cPlainV1(options),{bigint:true});assert.ok(named.has(name),'named metadata only');calls.push(['lstat',name]);return named.get(name);}),
    fstatSync:guard((fd,options)=>{assert.deepEqual(task5cPlainV1(options),{bigint:true});assert.ok(held.has(fd),'retained FD metadata only');calls.push(['fstat',fd]);return held.get(fd);})};
  return {pins:{stage,maintenanceRoot:SOURCE_M_V1,source,records,mutable},fs,calls,named,held,faults,
    check(){assert.deepEqual(faults,[],'no swallowed metadata binding assertion');}};
}
// 5 / 4. Metadata validates the fixed independent FD scope; E is unexposed.
test('Task5C delivery pin scope is fixed by stage',()=>{
  const gate=task5cVmV1(['checkManualOrphanDeliveryMetadataV1']),cases=task5cCasesV1(4);
  for(const [stage,count] of [['provision',0],['activate',7],['integration',9],['old_entry_positive',9]])cases.run(stage,()=>{
    const f=task5cPinFixtureV1(stage),vm=task5cVmV1(['checkManualOrphanDeliveryMetadataV1'],{fs:f.fs});
    assert.equal(vm.api.checkManualOrphanDeliveryMetadataV1(task5cDataV1(vm,f.pins)),true);
    assert.equal(f.pins.source.length,25);assert.equal(f.pins.records.length,count);
    const mutableCount=stage==='provision'?3:4;
    assert.equal(f.calls.length,2*(25+count+mutableCount));assert.equal(new Set(f.calls.filter(c=>c[0]==='fstat').map(c=>c[1])).size,25+count+mutableCount);
    f.check();vm.check();
  });cases.done();gate.check();
});
// 6 / 10. Immutable timestamps and mutable identity are different policies.
test('Task5C delivery metadata rejects current drift',()=>{
  const gate=task5cVmV1(['checkManualOrphanDeliveryMetadataV1']),cases=task5cCasesV1(10);
  for(const [name,mutate,accepted] of [
    ['named held identity',(f,row)=>{f.held.get(row.fd).ino++;},false],
    ['symlink type',(f,row)=>{f.named.get(row.path).isSymbolicLink=()=>true;},false],
    ['uid',(f,row)=>{f.named.get(row.path).uid=502n;},false],['mode',(f,row)=>{f.held.get(row.fd).mode=33206n;},false],
    ['nlink',(f,row)=>{f.named.get(row.path).nlink=2n;},false],['size',(f,row)=>{f.held.get(row.fd).size++;},false],
    ['mtime',(f,row)=>{f.named.get(row.path).mtimeNs++;},false],['ctime',(f,row)=>{f.held.get(row.fd).ctimeNs++;},false],
    ['legitimate mutable mtime',f=>{const row=f.pins.mutable.at(-1);f.named.get(row.path).mtimeNs++;f.held.get(row.fd).mtimeNs++;},true],
    ['mutable inode change',f=>{f.held.get(f.pins.mutable.at(-1).fd).ino++;},false],
  ])cases.run(name,()=>{
    const f=task5cPinFixtureV1(),vm=task5cVmV1(['checkManualOrphanDeliveryMetadataV1'],{fs:f.fs});mutate(f,f.pins.source[0]);
    const call=()=>vm.api.checkManualOrphanDeliveryMetadataV1(task5cDataV1(vm,f.pins));
    if(accepted)assert.equal(call(),true);else task5cRefusedV1(call);
    assert.ok(f.calls.length<=2*(25+9+4));f.check();vm.check();
  });cases.done();gate.check();
});
function task5cWriterV1(){
  const pins=task5cPinFixtureV1('provision'),vm=task5cVmV1(['deliverManualOrphanOwnedFrameV1'],{fs:pins.fs,observers:true});
  const f=task3EventFixtureV1('provision'),graph=task5bGraphV1(),frame=graph.frame,calls=[],faults=[];
  f.child.pid=frame.child.pid;
  const witness=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');
  const state={endThrows:false,lateEnd:false};
  f.channels.fd4.end=task5bGuardV1(faults,bytes=>{
    assert.equal(calls.length,0,'one retained writer end');assert.ok(Buffer.isBuffer(bytes));
    assert.ok(vm.monotonic.state.ms<5000,'never begin a valid end at deadline');
    assert.equal(pins.calls.length,4*(25+3),'both metadata passes precede valid end');
    assert.equal(delivery.ended,true,'burn writer before invoking fallible end');
    assert.equal(delivery.issued.frameSha256,createHash('sha256').update(bytes).digest('hex'),'retain issued DATA before end');
    calls.push(Buffer.from(bytes));if(state.endThrows)throw Error('PRIVATE_END_THROW');
    if(state.lateEnd)vm.monotonic.state.ms=5000;return f.channels.fd4;
  });
  // Root refinement: C obtains these fixed-order postspawn DATA observations.
  // This fixture does not claim C's process observation/retention proof.
  const delivery=task5cDataV1(vm,{purpose:'provision',startedAtNs:'0',lastAtNs:'0',pins:pins.pins,
    retainedGraph:graph.observations,postspawn:[graph.observations.parent,graph.observations.server,graph.observations.child],
    ended:false,issued:null,unknown:false});
  const call=()=>vm.api.deliverManualOrphanOwnedFrameV1(f.child,witness,task5cDataV1(vm,frame),delivery);
  const check=()=>{assert.deepEqual(faults,[],'no swallowed writer assertion');pins.check();f.assertGuarded();vm.check();};
  const finish=async()=>{task3CompleteV1(f);await witness.settled;check();};
  return {vm,f,pins,witness,frame,delivery,state,calls,call,check,finish};
}
// 7 / 8. Retained original writer/observer and same interval, no C/E owner.
test('Task5C delivery cutoff never accepts a late writer end',async()=>{
  const gate=task5cVmV1(['deliverManualOrphanOwnedFrameV1']),cases=task5cCasesV1(8);
  await cases.wait('just under five seconds',async()=>{const f=task5cWriterV1();f.vm.monotonic.state.ms=4999.999;
    const issued=f.call();assert.equal(f.calls.length,1);assert.equal(issued.frameSha256,createHash('sha256').update(f.calls[0]).digest('hex'));
    assert.deepEqual(task5cPlainV1(issued),{purpose:'provision',run:f.frame.run,frameSha256:createHash('sha256').update(f.calls[0]).digest('hex'),
      pid:f.frame.child.pid,parentPid:f.frame.parent.pid,installation:null});task5cFrozenV1(issued);await f.finish();});
  for(const [name,configure] of [
    ['exact five seconds',f=>{f.vm.monotonic.state.ms=5000;}],['over five seconds',f=>{f.vm.monotonic.state.ms=5001;}],
    ['initial clock fault',f=>{f.vm.monotonic.state.mode='throw';}],['backward clock',f=>{f.delivery.lastAtNs='2000000';f.vm.monotonic.state.ms=1;}],
  ])await cases.wait(name,async()=>{const f=task5cWriterV1();configure(f);task5cRefusedV1(f.call,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.calls.length,0);assert.equal(f.delivery.unknown,true);await f.finish();});
  await cases.wait('end throws',async()=>{const f=task5cWriterV1();f.state.endThrows=true;task5cRefusedV1(f.call,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.calls.length,1);assert.equal(f.delivery.unknown,true);await f.finish();});
  await cases.wait('late end return burns validity',async()=>{const f=task5cWriterV1();f.state.lateEnd=true;task5cRefusedV1(f.call,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.calls.length,1);assert.equal(f.delivery.unknown,true);await f.finish();});
  await cases.wait('repeat never duplicates',async()=>{const f=task5cWriterV1();f.call();task5cRefusedV1(f.call,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.calls.length,1);await f.finish();});cases.done();gate.check();
});
async function task5cObservedV1(vm,purpose='integration',wire=null){
  const f=task3EventFixtureV1(purpose),data=purpose==='integration'?ownedIntegrationData():ownedPhaseResultData(purpose);f.child.pid=data.pid;
  const witness=purpose==='integration'?vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child):vm.actual.observeManualOrphanOwnedChildV1(f.child,purpose);
  f.channels.stdout.emit('data',wire??(purpose==='integration'?task5aWireV1():helper.encodeManualOrphanOwnedPhaseResultV1(data)));
  task3CompleteV1(f,purpose);await witness.settled;
  return {f,witness,issued:task5cDataV1(vm,task5cIssuedV1(purpose)),check(){f.assertGuarded();vm.check();}};
}
// 8 / 10. Original transport first; each mutation changes a separate fact.
test('Task5C phase result correlates issued facts and closure',async()=>{
  const vm=task5cVmV1(['correlateManualOrphanPhaseResultV1'],{observers:true}),cases=task5cCasesV1(10);
  await cases.wait('exact phase result',async()=>{const f=await task5cObservedV1(vm,'old_entry_positive');
    const result=vm.api.correlateManualOrphanPhaseResultV1(f.issued,f.witness.snapshot(),f.witness.output());
    assert.deepEqual(task5cPlainV1(result),ownedPhaseResultData('old_entry_positive'));task5cFrozenV1(result);f.check();});
  for(const [name,change] of [
    ['wrong run',f=>{f.issued.run=OWN_H;}],['purpose',f=>{f.issued.purpose='new_entry_refusal';}],
    ['digest',f=>{f.issued.frameSha256=OWN_C;}],['pid',f=>{f.issued.pid++;}],['parent',f=>{f.issued.parentPid++;}],
    ['installation',f=>{f.issued.installation.installationId=OWN_OP;}],
    ['stderr',f=>{f.f.channels.stderr.emit('data',Buffer.from('private detail'));}],
    ['missing FD4 close',f=>{f.snapshot=task5cDataV1(vm,f.witness.snapshot());f.snapshot.fd4.close=false;}],
    ['late unknown',f=>{f.f.channels.stdout.emit('error',Error('late'));}],
  ])await cases.wait(name,async()=>{const f=await task5cObservedV1(vm,'old_entry_positive');change(f);
    task5cRefusedV1(()=>vm.api.correlateManualOrphanPhaseResultV1(f.issued,f.snapshot??f.witness.snapshot(),f.witness.output()));f.check();});cases.done();vm.check();
});
// 9 / 9. Collector state is never inferred by reparsing a copied prefix.
test('Task5C integration result requires collector and issued facts',async()=>{
  const vm=task5cVmV1(['correlateManualOrphanIntegrationResultV1'],{observers:true}),cases=task5cCasesV1(9);
  await cases.wait('exact marker and counts',async()=>{const f=await task5cObservedV1(vm);
    const result=vm.api.correlateManualOrphanIntegrationResultV1(f.issued,f.witness.snapshot(),f.witness.output());
    assert.deepEqual(task5cPlainV1(result),ownedIntegrationData());task5cFrozenV1(result);f.check();});
  for(const [name,change] of [
    ['pending collector',(f,out)=>{out.integration=task5cDataV1(vm,{state:'pending',marker:null,summary:null});}],
    ['refused collector observed transport',(f,out)=>{out.integration=task5cDataV1(vm,{state:'refused',marker:null,summary:null});}],
    ['observed collector unknown transport',f=>{f.f.channels.stderr.emit('error',Error('late'));}],
    ['wrong run',f=>{f.issued.run=OWN_H;}],['digest',f=>{f.issued.frameSha256=OWN_C;}],
    ['child parent pair',f=>{f.issued.pid++;f.issued.parentPid++;}],
    ['mechanical pair',(f,out)=>{out.integration.marker.newEntry.installationId=OWN_OP;}],
    ['counts',(f,out)=>{out.integration.summary.pass=2;}],
  ])await cases.wait(name,async()=>{const f=await task5cObservedV1(vm),original=f.witness.output();
    const output=task5cDataV1(vm,{integration:original.integration});output.stdout=original.stdout;output.stderr=original.stderr;
    change(f,output);task5cRefusedV1(()=>vm.api.correlateManualOrphanIntegrationResultV1(f.issued,f.witness.snapshot(),output));f.check();});cases.done();vm.check();
});
function task5cRouteLedgerV1(state='empty'){
  return {state,installation:state==='empty'?null:ownedInstallationData(state!=='schema-verified'),
    oldEntry:['cases-settled','database-dropped','runtime-dropped','owner-dropped','clean'].includes(state)?ownedOldData():null,
    newEntry:['cases-settled','database-dropped','runtime-dropped','owner-dropped','clean'].includes(state)?ownedNewData():null,unknown:false};
}
function task5cClosureFactsV1(){return {input:'fulfilled',source:'fulfilled',admin:'fulfilled',
  children:'fulfilled',queries:'settled',pending:0,fault:null};}
function task5cRouteEventV1(type){
  return {type,phase:type==='schema-verified'?ownedPhaseResultData('provision'):
    type==='activation-verified'?ownedPhaseResultData('activate'):null,
    integration:type==='cases-settled'?ownedIntegrationData():null,
    installation:ownedInstallationData(type!=='schema-verified'),baseline:task4aLiteralOutputV1(),
    source:ownedSourceData(),closures:task5cClosureFactsV1(),cleanup:type==='clean'?ownedRunnerData().cleanup:null};
}
// 10 / 8. The finite private ledger consumes structured joins, not verified:true.
test('Task5C route ledger cannot skip admitted stages',()=>{
  const vm=task5cVmV1(['advanceManualOrphanRouteLedgerV1']),cases=task5cCasesV1(8);
  const call=(ledger,event)=>vm.api.advanceManualOrphanRouteLedgerV1(task5cDataV1(vm,ledger),task5cDataV1(vm,event));
  for(const [from,to] of [['empty','schema-verified'],['schema-verified','activation-verified'],['activation-verified','cases-settled'],['owner-dropped','clean']])cases.run(from+' to '+to,()=>{
    const result=call(task5cRouteLedgerV1(from),task5cRouteEventV1(to));assert.deepEqual(task5cPlainV1(result),task5cRouteLedgerV1(to));task5cFrozenV1(result);});
  for(const [name,from,to] of [['skip activation','empty','activation-verified'],['cases before activation','schema-verified','cases-settled'],['duplicate','schema-verified','schema-verified']])cases.run(name,()=>{
    task5cRefusedV1(()=>call(task5cRouteLedgerV1(from),task5cRouteEventV1(to)));});
  cases.run('unknown absorbing',()=>{const ledger=task5cRouteLedgerV1('activation-verified');ledger.unknown=true;
    const result=call(ledger,task5cRouteEventV1('cases-settled'));assert.equal(result.unknown,true);assert.notEqual(result.state,'cases-settled');});cases.done();vm.check();
});
function task5cCatalogV1(stage='initial'){
  const baseline=task4aLiteralOutputV1(),f=task5bBaselineV1(stage),pair={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:5,usesysid:1};
  const constructor={pid:701,backendStartedAtUTC:'2026-10-21T00:00:01.345678Z',datid:5,usesysid:1};
  const row=p=>({...p,database:'postgres',user:'root',backendType:'client backend',clientAddress:'127.0.0.1'});
  return {stage,baseline,generated:f.installation,rows:f.rows,sessions:{own:pair,constructor,database:'postgres',user:'root',rows:[row(pair),row(constructor)]}};
}
function task5cCatalogCallV1(vm,f){return vm.api.qualifyManualOrphanRunnerCatalogV1(f.stage,
  task5cDataV1(vm,f.baseline),task5cDataV1(vm,f.generated),task5cDataV1(vm,f.rows),task5cDataV1(vm,f.sessions));}
// 11 / 9. OS PIDs/application_name never replace either backend pair.
test('Task5C admin census preserves actual backend pairs',()=>{
  const vm=task5cVmV1(['qualifyManualOrphanRunnerCatalogV1']),cases=task5cCasesV1(9);
  cases.run('exact two',()=>{const result=task5cCatalogCallV1(vm,task5cCatalogV1());assert.deepEqual(task5cPlainV1(result),task4aLiteralOutputV1());task5cFrozenV1(result);});
  for(const [name,mutate] of [
    ['missing constructor',f=>{f.sessions.rows.pop();}],['constructor start',f=>{f.sessions.rows[1].backendStartedAtUTC=f.sessions.rows[0].backendStartedAtUTC;}],
    ['own start',f=>{f.sessions.rows[0].backendStartedAtUTC=f.sessions.rows[1].backendStartedAtUTC;}],['same pid',f=>{f.sessions.constructor.pid=700;f.sessions.rows[1].pid=700;}],
    ['wrong datid usesysid',f=>{f.sessions.rows[0].datid=7;f.sessions.rows[0].usesysid=8;}],
    ['unknown client',f=>{f.sessions.rows.push({...f.sessions.rows[0],pid:702});}],
    ['generated database client',f=>{f.sessions.rows.push({...f.sessions.rows[0],pid:702,database:ownedInstallationData().databaseName,datid:7});}],
  ])cases.run(name,()=>{const f=task5cCatalogV1();mutate(f);task5cRefusedV1(()=>task5cCatalogCallV1(vm,f));});
  cases.run('allowed background extras',()=>{const f=task5cCatalogV1();
    f.sessions.rows.push({pid:702,backendStartedAtUTC:'2026-10-21T00:00:01.456789Z',datid:null,usesysid:null,database:null,user:null,backendType:'checkpointer',clientAddress:null},
      {pid:703,backendStartedAtUTC:'2026-10-21T00:00:01.567890Z',datid:null,usesysid:null,database:null,user:null,backendType:'walwriter',clientAddress:null});
    assert.deepEqual(task5cPlainV1(task5cCatalogCallV1(vm,f)),task4aLiteralOutputV1());});cases.done();vm.check();
});
// 12 / 8. Residual baseline is the complete actual canonicalizer output.
test('Task5C catalog residuals preserve the complete baseline',()=>{
  const vm=task5cVmV1(['qualifyManualOrphanRunnerCatalogV1']),cases=task5cCasesV1(8);
  for(const stage of ['initial','activated'])cases.run(stage,()=>{
    assert.deepEqual(task5cPlainV1(task5cCatalogCallV1(vm,task5cCatalogV1(stage))),task4aLiteralOutputV1());});
  for(const [name,mutate] of [
    ['extra database',f=>{f.rows.databases.push({...f.rows.databases[0],name:'unrelated',oid:9});}],
    ['OID name substitution',f=>{f.rows.databases.at(-1).name='setfarm_install_not_owned';}],
    ['flags and connection limit',f=>{f.rows.roles.at(-1).superuser=true;f.rows.roles.at(-1).connectionLimit=1;}],
    ['generated membership',f=>{f.rows.memberships.push({roleOid:7,memberOid:8,grantorOid:1,adminOption:false,inheritOption:true,setOption:true});}],
    ['overflow',f=>{f.rows.roles=Array.from({length:131},(_,index)=>({...f.rows.roles[0],name:'r'+index,oid:100+index}));}],
    ['baseline digest',f=>{f.baseline.membershipBaselineSha256=OWN_H;}],
  ])cases.run(name,()=>{const f=task5cCatalogV1('activated');mutate(f);task5cRefusedV1(()=>task5cCatalogCallV1(vm,f));});cases.done();vm.check();
});
function task5cCleanupLedgerV1(){return {state:'cases-settled',databaseAck:null,runtimeAck:null,ownerAck:null,unknown:false};}
function task5cCleanupEventV1(type){
  const installation=ownedInstallationData(true),object=type.startsWith('database')?{kind:'database',name:installation.databaseName,oid:7}:
    type.startsWith('runtime')?{kind:'runtime',name:installation.runtimeRole,oid:8}:{kind:'owner',name:installation.ownerRole,oid:7};
  return {type,installation,object,completion:'fulfilled',absence:{nameAbsent:true,oidAbsent:true},
    baseline:task4aLiteralOutputV1(),closures:task5cClosureFactsV1()};
}
function task5cCleanupAdvanceV1(vm,ledger,type){return vm.api.advanceManualOrphanCleanupLedgerV1(ledger,task5cDataV1(vm,task5cCleanupEventV1(type)));}
function task5cCleanupAtV1(vm,state){
  let ledger=task5cDataV1(vm,task5cCleanupLedgerV1());
  if(state==='cases-settled')return ledger;
  ledger=task5cCleanupAdvanceV1(vm,ledger,'database-ack');ledger=task5cCleanupAdvanceV1(vm,ledger,'database-absent');
  if(state==='database-dropped')return ledger;
  ledger=task5cCleanupAdvanceV1(vm,ledger,'runtime-ack');ledger=task5cCleanupAdvanceV1(vm,ledger,'runtime-absent');return ledger;
}
// 13 / 9. ACKs come from fulfilled effects; this DATA consumer issues no DROP.
test('Task5C cleanup ledger requires each DROP acknowledgment',()=>{
  const vm=task5cVmV1(['advanceManualOrphanCleanupLedgerV1']),cases=task5cCasesV1(9);
  for(const [name,from,object,to] of [['database ACK absence','cases-settled','database','database-dropped'],
    ['runtime ACK absence','database-dropped','runtime','runtime-dropped'],['owner ACK absence','runtime-dropped','owner','owner-dropped']])cases.run(name,()=>{
    const start=task5cCleanupAtV1(vm,from),ack=task5cCleanupAdvanceV1(vm,start,object+'-ack');assert.equal(ack.state,from);
    assert.deepEqual(task5cPlainV1(ack[object+'Ack']),{object:task5cCleanupEventV1(object+'-ack').object,installation:ownedInstallationData(true)});
    const result=task5cCleanupAdvanceV1(vm,ack,object+'-absent');assert.equal(result.state,to);assert.equal(result.unknown,false);task5cFrozenV1(result);});
  for(const [name,state,type] of [['lost database ACK','cases-settled','database-absent'],['lost runtime ACK','database-dropped','runtime-absent'],['lost owner ACK','runtime-dropped','owner-absent']])cases.run(name,()=>{
    task5cRefusedV1(()=>task5cCleanupAdvanceV1(vm,task5cCleanupAtV1(vm,state),type));});
  cases.run('absence before any ACK',()=>task5cRefusedV1(()=>task5cCleanupAdvanceV1(vm,task5cDataV1(vm,task5cCleanupLedgerV1()),'owner-absent')));
  cases.run('repeated ACK',()=>{const ack=task5cCleanupAdvanceV1(vm,task5cCleanupAtV1(vm,'cases-settled'),'database-ack');
    task5cRefusedV1(()=>task5cCleanupAdvanceV1(vm,ack,'database-ack'));});
  cases.run('wrong object OID',()=>{const ack=task5cCleanupAdvanceV1(vm,task5cCleanupAtV1(vm,'cases-settled'),'database-ack'),event=task5cCleanupEventV1('database-absent');
    event.object.oid=9;task5cRefusedV1(()=>vm.api.advanceManualOrphanCleanupLedgerV1(ack,task5cDataV1(vm,event)));});cases.done();vm.check();
});
// 14 / 7. Each uncertainty permanently denies a later permitted mutation.
test('Task5C cleanup uncertainty is absorbing',()=>{
  const vm=task5cVmV1(['advanceManualOrphanCleanupLedgerV1']),cases=task5cCasesV1(7);
  for(const [name,change] of [
    ['pending query',event=>{event.closures.pending=1;}],['query rejection',event=>{event.completion='rejected';}],
    ['Source fault',event=>{event.closures.source='rejected';}],['clock fault',event=>{event.closures.fault='clock';}],
    ['premature onclose',event=>{event.closures.fault='onclose';}],['case failure missing closure',event=>{event.closures.children='pending';}],
    ['late completion after unknown',event=>{event.closures.fault='late-completion';}],
  ])cases.run(name,()=>{const event=task5cCleanupEventV1('database-ack'),ledger=task5cCleanupLedgerV1();change(event);
    if(name==='late completion after unknown'){ledger.unknown=true;event.closures.fault=null;}
    const lost=vm.api.advanceManualOrphanCleanupLedgerV1(task5cDataV1(vm,ledger),task5cDataV1(vm,event));
    assert.equal(lost.unknown,true);const later=task5cCleanupAdvanceV1(vm,lost,'database-ack');
    assert.equal(later.unknown,true);assert.equal(later.databaseAck,null);assert.equal(later.state,'cases-settled');});cases.done();vm.check();
});
function task5cAdminFixtureV1(){
  const vm=task5cVmV1(['retainManualOrphanRunnerAdminV1']),faults=[],calls={queries:[],order:[],reserve:0,releases:0,ends:0};
  const pair={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:5,usesysid:1};
  const expected={pair,cluster:ownedClusterData(),database:'postgres',databaseOid:5,user:'root',userOid:1};
  const identity={...pair,datid:'5',usesysid:'1',database:'postgres',databaseOid:'5',
    currentUser:'root',sessionUser:'root',userOid:'1',serverAddress:'127.0.0.1',serverPort:55439,
    systemIdentifier:'123',postmasterStartedAtUTC:'2026-10-21T00:00:00.123456Z',serverVersionNum:'170001'};
  const f={vm,faults,calls,expected,identity,next:null,row:null,queryReject:false,releaseThrows:false,endReject:false,endValue:null,releaseMicrotask:false};
  const guard=fn=>task5bGuardV1(faults,fn);
  const reserved=guard(()=>assert.fail('only finite unsafe operations on original reservation'));
  reserved.unsafe=guard((sql,...rest)=>{
    assert.equal(typeof sql,'string');assert.deepEqual(rest,[]);assert.equal(calls.releases,0);assert.equal(calls.ends,0);
    assert.match(sql,/^\s*(?:SELECT|WITH)\b/i);assert.match(sql,/pg_backend_pid\s*\(/i);
    assert.match(sql,/pg_stat_activity/);assert.match(sql,/backend_start/);assert.match(sql,/datid/);assert.match(sql,/usesysid/);
    assert.doesNotMatch(sql,/pg_authid|\b(?:DROP|CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE)\b/i);
    calls.queries.push(sql);calls.order.push('query');
    if(f.queryReject)return Promise.reject(Error('PRIVATE_ADMIN_QUERY'));
    if(f.next!==null){const result=f.next;f.next=null;return result;}
    const rows=task5cDataV1(vm,f.row??[identity]);
    rows.count=rows.length;rows.command='SELECT';return Promise.resolve(rows);
  });
  reserved.release=guard(()=>{calls.releases++;calls.order.push('release');assert.equal(calls.releases,1);
    queueMicrotask(()=>{f.releaseMicrotask=true;});if(f.releaseThrows)throw Error('PRIVATE_ADMIN_RELEASE');});
  const pool=guard(()=>assert.fail('no unreserved pool query'));
  Object.defineProperty(pool,'reserve',{get:guard(()=>{calls.reserve++;assert.fail('never inspect or reacquire a reservation');})});
  pool.end=guard(options=>{calls.ends++;calls.order.push('end');assert.equal(calls.ends,1);
    assert.equal(f.releaseMicrotask,false,'end immediately follows release in the same turn');
    assert.deepEqual(task5cPlainV1(options),{timeout:5});
    if(f.endReject)return Promise.reject(Error('PRIVATE_ADMIN_END'));return f.endValue??Promise.resolve();});
  f.admin=vm.api.retainManualOrphanRunnerAdminV1(pool,reserved,task5cDataV1(vm,expected));
  assert.deepEqual(Object.keys(f.admin).sort(),['beginCleanup','close','current','endCleanup','onclose','query','stop']);
  assert.equal(f.admin.beginCleanup.length,0);assert.equal(f.admin.endCleanup.length,0);
  f.query=()=>f.admin.query('identity');
  f.check=()=>{assert.deepEqual(faults,[],'caught client-boundary assertions cannot masquerade as refusal');assert.equal(calls.reserve,0);
    const now=f.admin.current();assert.deepEqual(Object.keys(now).sort(),['closed','endAttempted','pair','pending','releaseAttempted','stopped','unknown']);
    assert.deepEqual(task5cPlainV1(now.pair),pair);assert.equal(now.releaseAttempted,calls.releases===1);assert.equal(now.endAttempted,calls.ends===1);
    task5cFrozenV1(now);vm.check();};
  f.check();return f;
}
// 15 / 8. This is an already retained client; no postgres/factory success bind.
test('Task5C retained admin consumer serializes actual promises',async()=>{
  const gate=task5cVmV1(['retainManualOrphanRunnerAdminV1']),cases=task5cCasesV1(8);
  await cases.wait('resolved identity query',async()=>{const f=task5cAdminFixtureV1();
    assert.deepEqual(task5cPlainV1(await f.query()),f.expected.pair);assert.equal(f.calls.queries.length,1);
    await f.admin.close();assert.equal(f.admin.current().closed,true);f.check();});
  await cases.wait('pending blocks second',async()=>{const f=task5cAdminFixtureV1(),d=task5bDeferredV1();f.next=d.promise;
    const first=f.query(),settled=first.catch(error=>error);await task5bPumpV1();await task5cRejectedV1(f.query());
    assert.equal(f.calls.queries.length,1);assert.equal(f.admin.current().unknown,true);d.resolve(task5cDataV1(f.vm,[]));await settled;f.check();});
  await cases.wait('rejection sticky',async()=>{const f=task5cAdminFixtureV1();f.queryReject=true;
    await task5cRejectedV1(f.query());f.queryReject=false;await task5cRejectedV1(f.query());assert.equal(f.calls.queries.length,1);f.check();});
  await cases.wait('pair drift',async()=>{const f=task5cAdminFixtureV1();f.row=[{...f.identity,pid:701}];
    await task5cRejectedV1(f.query());assert.equal(f.admin.current().unknown,true);f.check();});
  await cases.wait('timeout keeps pending original',async()=>{const f=task5cAdminFixtureV1(),d=task5bDeferredV1();f.next=d.promise;
    const query=trackProbePromiseV1(f.query());await task5bPumpV1();f.check();task5bDeadlineV1(f.vm);await task5bPumpV1();
    assert.equal(query.outcome,null,'deadline cannot settle a query while its original is pending');
    assert.equal(f.admin.current().pending,true);assert.equal(f.admin.current().unknown,true);assert.equal(f.admin.current().closed,false);
    const close=trackProbePromiseV1(f.admin.close());await task5bPumpV1();
    assert.equal(close.outcome,null,'close must join the pending query before release/end');assert.equal(query.outcome,null);
    assert.equal(f.calls.releases,0);assert.equal(f.calls.ends,0);f.check();
    d.resolve(task5cDataV1(f.vm,[f.identity]));await Promise.all([query.done,close.done]);
    await assertProbeRejectedV1(query,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');await assertProbeRejectedV1(close,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.deepEqual(f.calls.order,['query','release','end']);assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);
    assert.equal(f.admin.current().pending,false);assert.equal(f.admin.current().closed,false);assert.equal(f.admin.current().unknown,true);f.check();});
  await cases.wait('premature onclose',async()=>{const f=task5cAdminFixtureV1();f.admin.onclose();await task5cRejectedV1(f.query());
    assert.equal(f.calls.queries.length,0);assert.equal(f.admin.current().unknown,true);f.check();});
  await cases.wait('re-reserve forbidden',async()=>{const f=task5cAdminFixtureV1();await f.query();await f.query();
    assert.equal(f.calls.queries.length,2);assert.equal(f.calls.reserve,0);await f.admin.close();await task5cRejectedV1(f.query());f.check();});
  await cases.wait('late fulfillment never restores',async()=>{const f=task5cAdminFixtureV1(),d=task5bDeferredV1();f.next=d.promise;
    const pending=f.query();await task5bPumpV1();f.admin.onclose();const refused=task5cRejectedV1(pending);
    d.resolve(task5cDataV1(f.vm,[f.identity]));await refused;await task5bPumpV1();assert.equal(f.admin.current().unknown,true);
    await task5cRejectedV1(f.query());assert.equal(f.calls.queries.length,1);f.check();});cases.done();gate.check();
});
// 16 / 6. Fulfilled promises, not signal requests or timeout, prove closure.
test('Task5C admin release and end are terminal and ordered',async()=>{
  const gate=task5cVmV1(['retainManualOrphanRunnerAdminV1']),cases=task5cCasesV1(6);
  await cases.wait('release once immediate end once',async()=>{const f=task5cAdminFixtureV1();await f.query();
    await f.admin.close();assert.deepEqual(f.calls.order,['query','release','end']);assert.equal(f.admin.current().closed,true);
    assert.equal(f.admin.current().unknown,false);f.admin.onclose();assert.equal(f.admin.current().unknown,false);f.check();});
  await cases.wait('release failure retained',async()=>{const f=task5cAdminFixtureV1();f.releaseThrows=true;
    await task5cRejectedV1(f.admin.close());assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);assert.equal(f.admin.current().closed,false);f.check();});
  await cases.wait('end rejection retained',async()=>{const f=task5cAdminFixtureV1();f.endReject=true;
    await task5cRejectedV1(f.admin.close());assert.equal(f.calls.ends,1);assert.equal(f.admin.current().closed,false);f.check();});
  await cases.wait('end pending timeout',async()=>{const f=task5cAdminFixtureV1(),d=task5bDeferredV1();f.endValue=d.promise;
    const close=trackProbePromiseV1(f.admin.close());await task5bPumpV1();f.check();task5bDeadlineV1(f.vm);await task5bPumpV1();
    assert.equal(close.outcome,null,'deadline cannot settle close while actual end is pending');
    assert.equal(f.admin.current().closed,false);assert.equal(f.admin.current().pending,true);assert.equal(f.admin.current().unknown,true);
    assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);f.check();
    d.resolve();await assertProbeRejectedV1(close,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.deepEqual(f.calls.order,['release','end']);assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);
    assert.equal(f.admin.current().pending,false);assert.equal(f.admin.current().unknown,true);assert.equal(f.admin.current().closed,false);f.check();});
  await cases.wait('query after stop',async()=>{const f=task5cAdminFixtureV1();f.admin.stop();await task5cRejectedV1(f.query());
    assert.equal(f.calls.queries.length,0);assert.equal(f.admin.current().stopped,true);f.check();});
  await cases.wait('repeat close joins same outcome',async()=>{const f=task5cAdminFixtureV1();await f.admin.close();await f.admin.close();
    assert.equal(f.calls.releases,1);assert.equal(f.calls.ends,1);assert.equal(f.admin.current().closed,true);f.check();});cases.done();gate.check();
});
function task5cPartialV1(){return [{name:OWN_ID,kind:'directory',entries:[
  {name:'planned.json',kind:'file',bytes:1},{name:'runtime',kind:'directory',files:2048,bytes:8388608,
    artifactSubtree:{path:'product-compiler/artifacts/sha256',files:3,bytes:128}},
]}];}
// 17 / 6. Names/types/counts only; no contents or ownership inference.
test('Task5C partial installation diagnostics never grant cleanup',()=>{
  const vm=task5cVmV1(['inspectManualOrphanPartialInstallationV1']),cases=task5cCasesV1(6);
  const call=entries=>vm.api.inspectManualOrphanPartialInstallationV1(task5cDataV1(vm,entries),'provision');
  cases.run('zero entries',()=>assert.deepEqual(task5cPlainV1(call([])),{installationId:null,partial:false,cleanupEligible:false}));
  cases.run('canonical unrecorded UUID',()=>assert.deepEqual(task5cPlainV1(call([{name:OWN_ID,kind:'directory',entries:[]}])),
    {installationId:OWN_ID,partial:true,cleanupEligible:false}));
  cases.run('two UUIDs',()=>task5cRefusedV1(()=>call([{name:OWN_ID,kind:'directory',entries:[]},{name:OWN_OP,kind:'directory',entries:[]}])));
  cases.run('unknown symlink',()=>task5cRefusedV1(()=>call([{name:'unknown',kind:'symlink',entries:[]}])));
  cases.run('ninth failure file',()=>{const entries=task5cPartialV1();entries[0].entries=Array.from({length:9},(_,index)=>({
    name:'failure-12345678-1234-4234-8234-123456789ab'+index+'.json',kind:'file',bytes:1}));task5cRefusedV1(()=>call(entries));});
  cases.run('stock runtime allowed',()=>{const result=call(task5cPartialV1());assert.equal(result.installationId,OWN_ID);
    assert.equal(result.partial,true);assert.equal(result.cleanupEligible,false);task5cFrozenV1(result);});cases.done();vm.check();
});
function task5cFinalFactsV1(kind){return {result:kind==='runner'?ownedRunnerData():ownedIntegrationData(),
  closures:task5cClosureFactsV1(),currentSource:ownedSourceData(),unknown:false};}
// 18 / 6. Closure observations precede codec construction and are not receipts.
test('Task5C final results require all owned closures',()=>{
  const vm=task5cVmV1(['finalizeManualOrphanFixtureResultV1']),cases=task5cCasesV1(6);
  const call=(kind,facts)=>vm.api.finalizeManualOrphanFixtureResultV1(kind,task5cDataV1(vm,facts));
  cases.run('exact integration DATA',()=>{const result=call('integration',task5cFinalFactsV1('integration'));
    assert.deepEqual(task5cPlainV1(result),ownedIntegrationData());task5cFrozenV1(result);});
  cases.run('exact runner bytes',()=>assert.deepEqual(call('runner',task5cFinalFactsV1('runner')),Buffer.from(OWN_RUNNER_WIRE)));
  for(const [name,mutate] of [
    ['missing Source close',facts=>{facts.closures.source='pending';}],['pending admin close',facts=>{facts.closures.admin='pending';}],
    ['incomplete cleanup',facts=>{facts.result.cleanup.baselineRestored=false;}],['late fault after valid DATA',facts=>{facts.closures.fault='late-stream';}],
  ])cases.run(name,()=>{const facts=task5cFinalFactsV1('runner');mutate(facts);task5cRefusedV1(()=>call('runner',facts),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');});cases.done();vm.check();
});
function task5cChildPathsV1(){return {node:TASK3_NODE_V1,maintenanceRoot:SOURCE_M_V1,targetRoot:SOURCE_T_V1,
  helper:SOURCE_M_V1+SOURCE_SUFFIX_V1,integration:SOURCE_M_V1+'/'+FILE,
  env:{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C'}};}
// 19 / 6. Launch DATA is secret free; actual spawn remains in private C.
test('Task5C child plans use exact fixed vectors',()=>{
  const vm=task5cVmV1(['planManualOrphanFixtureChildV1']),cases=task5cCasesV1(6);
  for(const purpose of ['provision','activate','integration','old_entry_positive','new_entry_refusal'])cases.run(purpose,()=>{
    const plan=vm.api.planManualOrphanFixtureChildV1(purpose,task5cDataV1(vm,task5cChildPathsV1()));
    assert.deepEqual(task5cPlainV1(plan),{executable:TASK3_NODE_V1,args:purpose==='integration'?
      ['--import','tsx','--test','--test-isolation=none',FILE]:[SOURCE_M_V1+SOURCE_SUFFIX_V1],options:{
      cwd:SOURCE_M_V1,argv0:TASK3_NODE_V1,shell:false,detached:false,env:purpose==='integration'?
        {PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C',TSX_DISABLE_CACHE:'1'}:{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C'},
      stdio:['ignore','pipe','pipe','ignore','pipe']}});task5cFrozenV1(plan);
    assert.equal(JSON.stringify(plan).includes(OWN_H),false);assert.equal(JSON.stringify(plan).includes('NODE_TEST_CONTEXT'),false);
  });cases.run('unsupported purpose',()=>task5cRefusedV1(()=>vm.api.planManualOrphanFixtureChildV1('initdb',task5cDataV1(vm,task5cChildPathsV1()))));
  cases.done();assert.equal(vm.timers.length,0);vm.check();
});
// 20 / 4. Actual 5A collector and original events, never a copied grammar.
test('Task5C correlation consumes actual collector current faults',async()=>{
  const vm=task5cVmV1(['correlateManualOrphanIntegrationResultV1'],{observers:true}),cases=task5cCasesV1(4);
  const call=f=>vm.api.correlateManualOrphanIntegrationResultV1(f.issued,f.witness.snapshot(),f.witness.output());
  await cases.wait('actual calibrated transcript',async()=>{const f=await task5cObservedV1(vm);task5aAcceptedV1(f.witness);
    assert.deepEqual(task5cPlainV1(call(f)),ownedIntegrationData());f.check();});
  await cases.wait('marker after 64KiB ordinary lines',async()=>{const prefix=Buffer.from(('ordinary diagnostic\n').repeat(4000)),wire=Buffer.concat([prefix,task5aWireV1()]);
    assert.ok(prefix.length>65536);const f=await task5cObservedV1(vm,'integration',wire);assert.equal(f.witness.output().stdout.length,65536);
    assert.equal(f.witness.output().stdout.includes(Buffer.from(TASK5A_MARKER_PREFIX_V1)),false);
    assert.deepEqual(task5cPlainV1(call(f)),ownedIntegrationData());f.check();});
  await cases.wait('valid then late stream fault',async()=>{const f=await task5cObservedV1(vm);call(f);
    f.f.channels.stdout.emit('error',Error('late original stream error'));assert.equal(f.witness.snapshot().state,'unknown');
    task5cRefusedV1(()=>call(f));f.check();});
  await cases.wait('semantic refusal observed transport',async()=>{const wire=Buffer.from(task5aWireV1().toString('utf8').replace('ℹ pass 1','ℹ pass 2'));
    const f=await task5cObservedV1(vm,'integration',wire);assert.equal(f.witness.snapshot().state,'observed');assert.equal(f.witness.output().integration.state,'refused');
    task5cRefusedV1(()=>call(f));f.check();});cases.done();vm.check();
});


// Task5C fix round1: narrow original-lifetime/completion consumers only.
// Complete modules remain in the same realm. C/E, Source/factory/SQL success
// are never supplied. Corrected recipient DATA above needs its own causal RED.
function task5cFix1VmV1(mode){
  assert.ok(['lifetime','runner','integration'].includes(mode));
  const reads=[],faults=[],writes=[],monotonic=task3ClockV1();let importing=true,callback=null;
  const guard=fn=>task5bGuardV1(faults,fn),binding={};
  for(const key of ['env','argv','execArgv','pid','ppid','cwd'])Object.defineProperty(binding,key,{get(){
    reads.push(key);throw Error('TASK5C_FIX1_PROCESS_READ');}});
  const outputs={};
  if(mode!=='lifetime')for(const name of ['stdout','stderr']){
    const channel=new EventEmitter(),on=channel.on;
    channel.on=guard((event,listener)=>{assert.equal(event,'error');assert.equal(typeof listener,'function');
      return Reflect.apply(on,channel,[event,listener]);});
    channel.write=guard((bytes,done)=>{
      assert.equal(name,'stdout','no diagnostic output inside the completion consumer');
      assert.equal(mode,'runner');assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>=1&&bytes.length<=16384);
      assert.equal(bytes.at(-1),10);assert.equal(typeof done,'function');assert.equal(writes.length,0,'one original write');
      writes.push(Buffer.from(bytes));callback=done;return true;
    });
    outputs[name]=channel;Object.defineProperty(binding,name,{get(){
      if(importing){reads.push(name);throw Error('TASK5C_FIX1_IMPORT_OUTPUT');}return channel;}});
  }
  const vm=task3VmV1({task5cFixture:true,task5cFiniteObservers:mode==='lifetime',process:binding,monotonic});importing=false;
  const fix1=vm.fixtureFix1Lexical;assert.ok(fix1,'Task5C fix1 separate lexical wrapper');
  assert.deepEqual(Object.keys(fix1).sort(),['retainManualOrphanFixtureCompletionV1','retainManualOrphanOriginalChildLifetimeV1']);
  const required=mode==='lifetime'?'retainManualOrphanOriginalChildLifetimeV1':'retainManualOrphanFixtureCompletionV1';
  assert.equal(typeof fix1[required],'function','missing Task5C fix1 private consumer '+required+' (scaffolding RED)');
  assert.equal(fix1[required].length,mode==='lifetime'?2:1);
  const check=()=>{assert.deepEqual(reads,[],'no swallowed process/import observation');
    assert.deepEqual(faults,[],'no swallowed completion boundary assertion');vm.assertContained();};
  check();return {...vm,api:vm.fixtureLexical,fix1,outputs,writes,check,
    callback(error=null){assert.equal(typeof callback,'function','original callback was retained');const original=callback;callback=null;original(error);check();}};
}
function task5cFix1LifetimeFactsV1(lifetime){
  assert.deepEqual(Object.keys(lifetime).sort(),['current','settled']);assert.equal(typeof lifetime.current,'function');assert.equal(lifetime.current.length,0);
  const facts=lifetime.current();assert.deepEqual(Object.keys(facts).sort(),['childClosed','closed','fd4','pending','stderr','stdout','unknown']);
  task5cFrozenV1(facts);for(const key of ['closed','pending','unknown','childClosed'])assert.equal(typeof facts[key],'boolean');
  for(const key of ['stdout','stderr','fd4'])assert.ok(['unacquired','open','closed','unobserved'].includes(facts[key]));
  assert.equal(facts.pending,!facts.closed);return facts;
}
function task5cFix1LifetimeV1(missing=false){
  const vm=task5cFix1VmV1('lifetime'),f=task3EventFixtureV1('provision'),intentional=[];
  if(missing){
    f.bindings.stdout=null;f.bindings.stderr=null;f.bindings.stdio[1]=null;f.bindings.stdio[2]=null;f.bindings.stdio[4]=null;f.child.pid=undefined;
    const on=f.child.on;
    // Real observer receives a one-time binding exception after the actual
    // listener is attached; the fixture's independent inspection guards stay on.
    f.child.on=function(event,listener){const result=Reflect.apply(on,this,[event,listener]);
      if(event==='spawn'&&intentional.length===0){intentional.push('observer-bind');throw Error('EXPECTED_FIX1_BIND_REFUSAL');}return result;};
  }
  const witness=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');
  const lifetime=vm.fix1.retainManualOrphanOriginalChildLifetimeV1(f.child,witness),tracked=trackProbePromiseV1(lifetime.settled);
  const admin=task5cAdminFixtureV1();let laterPhases=0;
  // Narrow actual Q→L composition on retained emitter/client originals only.
  // This is NOT C, a fake Source/FD owner, or proof of C's actual finally.
  const unwound=tracked.done.then(async outcome=>{
    if(!Object.hasOwn(outcome,'error')){laterPhases++;assert.fail('failure cannot authorize the next phase or DROP');}
    assert.equal(outcome.error.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    admin.admin.stop();await admin.admin.close();return outcome.error;
  });
  const check=()=>{vm.check();f.assertGuarded();admin.check();assert.equal(laterPhases,0);
    assert.deepEqual(admin.calls.queries,[],'no later SQL or DROP');assert.deepEqual(intentional,missing?['observer-bind']:[]);};
  const pending=async()=>{await task5bPumpV1();check();assert.equal(tracked.outcome,null,'physical original is still owed');
    const facts=task5cFix1LifetimeFactsV1(lifetime);assert.equal(facts.closed,false);assert.equal(facts.pending,true);
    assert.equal(admin.calls.releases,0);assert.equal(admin.calls.ends,0);return facts;};
  const done=async()=>{const error=await assertProbeRejectedV1(tracked,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');await unwound;check();
    const facts=task5cFix1LifetimeFactsV1(lifetime);assert.equal(facts.closed,true);assert.equal(facts.pending,false);assert.equal(facts.unknown,true);assert.equal(facts.childClosed,true);
    assert.equal(witness.snapshot().state,'unknown');await witness.settled;
    assert.equal(admin.calls.releases,1);assert.equal(admin.calls.ends,1);assert.deepEqual(admin.calls.order,['release','end']);
    assert.equal(admin.admin.current().closed,true);check();return {facts,error};};
  return {vm,f,witness,lifetime,tracked,admin,pending,done,check};
}
// 21 / 4. Failed success transport can still have actual physical closure.
test('Task5C failure lifetime joins acquired originals',async()=>{
  const gate=task5cFix1VmV1('lifetime'),cases=task5cCasesV1(4);
  await cases.wait('FD4 error close without finish or end',async()=>{
    const x=task5cFix1LifetimeV1();x.f.channels.fd4.emit('error',Error('FD4_ABORTED'));
    for(const name of ['stdout','stderr']){x.f.channels[name].emit('end');x.f.channels[name].emit('close');}
    x.f.child.emit('exit',1,null);x.f.child.emit('close',1,null);await x.pending();
    x.f.channels.fd4.emit('close');const {facts}=await x.done();assert.equal(facts.fd4,'closed');
    assert.equal(x.witness.snapshot().fd4.finish,false);assert.equal(x.witness.snapshot().fd4.end,false);x.check();
  });
  await cases.wait('readable close without end',async()=>{
    const x=task5cFix1LifetimeV1();x.f.channels.stdout.emit('close');
    x.f.channels.stderr.emit('end');x.f.channels.stderr.emit('close');
    x.f.channels.fd4.emit('finish');x.f.channels.fd4.emit('end');x.f.channels.fd4.emit('close');
    x.f.child.emit('exit',1,null);await x.pending();x.f.child.emit('close',1,null);const {facts}=await x.done();
    assert.equal(facts.stdout,'closed');assert.equal(x.witness.snapshot().stdout.end,false);x.check();
  });
  await cases.wait('failed spawn missing channels and observer binding refusal',async()=>{
    const x=task5cFix1LifetimeV1(true);x.f.child.emit('error',Error('SPAWN_FAILED'));const before=await x.pending();
    for(const key of ['stdout','stderr','fd4'])assert.equal(before[key],'unacquired');
    x.f.child.emit('close',-2,null);const {facts}=await x.done();
    for(const key of ['stdout','stderr','fd4'])assert.equal(facts[key],'unacquired','absence is never a fictitious acquired close');x.check();
  });
  await cases.wait('still open original survives observer cutoff',async()=>{
    const x=task5cFix1LifetimeV1();
    for(const name of ['stdout','stderr']){x.f.channels[name].emit('end');x.f.channels[name].emit('close');}
    x.f.child.emit('exit',1,null);x.f.child.emit('close',1,null);
    x.vm.monotonic.state.ms=300000;assert.equal(x.vm.timers.length,1);x.vm.timers[0].callback();
    const before=await x.pending();assert.equal(before.unknown,true);assert.equal(before.fd4,'open');
    x.f.channels.fd4.emit('close');await x.done();x.check();
  });cases.done();gate.check();
});
function task5cFix1CompletionFactsV1(completion){
  assert.deepEqual(Object.keys(completion).sort(),['check','current','fail','finish','write']);
  for(const [name,arity] of [['check',0],['current',0],['fail',0],['finish',1],['write',1]]){
    assert.equal(typeof completion[name],'function');assert.equal(completion[name].length,arity);}
  const facts=completion.current();assert.deepEqual(Object.keys(facts).sort(),[
    'finished','kind','lastAtNs','limitNs','startedAtNs','unknown','writePending','writeSettled','writeStarted']);
  task5cFrozenV1(facts);for(const key of ['finished','unknown','writePending','writeSettled','writeStarted'])assert.equal(typeof facts[key],'boolean');
  for(const key of ['startedAtNs','lastAtNs','limitNs'])assert.match(facts[key],/^(0|[1-9][0-9]*)$/);
  assert.equal(facts.startedAtNs,'0','one original origin');assert.equal(facts.limitNs,facts.kind==='runner'?'840000000000':'300000000000');return facts;
}
function task5cFix1CompletionV1(kind='runner'){
  const vm=task5cFix1VmV1(kind),completion=vm.fix1.retainManualOrphanFixtureCompletionV1(kind);
  assert.equal(vm.timers.length,1);const timer=vm.timers[0];assert.equal(timer.delay,kind==='runner'?840000:300000);
  assert.ok(vm.outputs.stdout.listenerCount('error')>0);assert.ok(vm.outputs.stderr.listenerCount('error')>0);
  completion.check();const result=vm.api.finalizeManualOrphanFixtureResultV1(kind,task5cDataV1(vm,task5cFinalFactsV1(kind)));
  if(kind==='runner')assert.deepEqual(result,Buffer.from(OWN_RUNNER_WIRE));else task5cFrozenV1(result);
  const check=()=>{vm.check();assert.equal(vm.timers.length,1);task5cFix1CompletionFactsV1(completion);};
  const closed=()=>{check();assert.deepEqual(vm.cleared,[timer.handle]);assert.equal(completion.current().finished,true);};
  check();return {vm,completion,result,timer,check,closed};
}
// 22 / 5. Actual R output callback/clock; no public owner or injected finalizer.
test('Task5C completion deadline covers final output',async()=>{
  const gate=task5cFix1VmV1('runner'),cases=task5cCasesV1(5);
  await cases.wait('write pending at cutoff retains original',async()=>{
    const x=task5cFix1CompletionV1(),t=trackProbePromiseV1(x.completion.write(x.result));
    await task5bPumpV1();x.check();assert.equal(t.outcome,null);assert.equal(x.vm.writes.length,1);
    x.vm.monotonic.state.ms=840000;x.timer.callback();await task5bPumpV1();x.check();
    let facts=x.completion.current();assert.equal(facts.unknown,true);assert.equal(facts.writePending,true);assert.equal(facts.finished,false);
    assert.equal(t.outcome,null,'timeout does not settle the actual pending callback');assert.deepEqual(x.vm.cleared,[]);
    task5cRefusedV1(()=>x.completion.finish(true),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.deepEqual(x.vm.cleared,[]);
    assert.equal(t.outcome,null);x.vm.callback();await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    facts=x.completion.current();assert.equal(facts.writePending,false);assert.equal(facts.writeSettled,true);assert.equal(facts.unknown,true);
    task5cRefusedV1(()=>x.completion.finish(false),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');x.closed();assert.equal(x.vm.writes.length,1);
  });
  await cases.wait('success callback after cutoff rejects',async()=>{
    const x=task5cFix1CompletionV1(),t=trackProbePromiseV1(x.completion.write(x.result));await task5bPumpV1();x.check();
    assert.equal(t.outcome,null);x.vm.monotonic.state.ms=840001;x.vm.callback();
    await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.equal(x.completion.current().unknown,true);
    task5cRefusedV1(()=>x.completion.finish(false),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');x.closed();assert.equal(x.vm.writes.length,1);
  });
  await cases.wait('timely callback completes inside same owner deadline',async()=>{
    const x=task5cFix1CompletionV1(),t=trackProbePromiseV1(x.completion.write(x.result));await task5bPumpV1();x.check();
    assert.equal(t.outcome,null);x.vm.monotonic.state.ms=839999;x.vm.callback();await t.done;
    assert.deepEqual(t.outcome,{value:undefined});assert.deepEqual(x.vm.writes,[Buffer.from(OWN_RUNNER_WIRE)]);
    const before=x.completion.current();assert.equal(before.unknown,false);assert.equal(before.finished,false);assert.equal(before.writePending,false);assert.equal(before.writeSettled,true);
    assert.deepEqual(x.vm.cleared,[],'resource/write closure alone does not end the owner interval');
    x.vm.monotonic.state.ms=839999.5;assert.equal(x.completion.finish(true),undefined);x.closed();assert.equal(x.completion.current().unknown,false);
  });
  await cases.wait('callback error stays fixed and never retries',async()=>{
    const x=task5cFix1CompletionV1(),t=trackProbePromiseV1(x.completion.write(x.result));await task5bPumpV1();x.check();
    assert.equal(t.outcome,null);x.vm.callback(Error('PRIVATE_OUTPUT_CALLBACK_ERROR'));
    const first=await assertProbeRejectedV1(t,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    const second=task5cRefusedV1(()=>x.completion.check(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');assert.notEqual(first,second);
    assert.equal(x.completion.current().writePending,false);assert.equal(x.completion.current().unknown,true);
    task5cRefusedV1(()=>x.completion.finish(false),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');x.closed();assert.equal(x.vm.writes.length,1);
  });
  await cases.wait('integration finalization overrun includes timer release',async()=>{
    const x=task5cFix1CompletionV1('integration'),faults=[],push=x.vm.cleared.push;
    assert.deepEqual(task5cPlainV1(x.result),ownedIntegrationData());assert.equal(x.vm.writes.length,0);
    x.vm.monotonic.state.ms=299999;
    // This is the existing finite clearTimeout trace, not an injected Source
    // callback. Its fallible release crosses the same finalization deadline.
    Object.defineProperty(x.vm.cleared,'push',{value:task5bGuardV1(faults,function(...args){
      assert.deepEqual(args,[x.timer.handle]);const result=Reflect.apply(push,x.vm.cleared,args);x.vm.monotonic.state.ms=300000;return result;
    }),configurable:true});
    task5cRefusedV1(()=>x.completion.finish(true),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.deepEqual(faults,[],'no swallowed timer-release assertion');assert.equal(x.completion.current().unknown,true);
    x.closed();assert.equal(x.vm.writes.length,0);assert.equal(x.completion.current().writeStarted,false);assert.deepEqual(faults,[]);
  });cases.done();gate.check();
});
// 23 / 7. Recipient-only Node26 DATA; no worker key may enter base/child env.
test('Task5C integration recipient requires Node26 worker metadata',()=>{
  const vm=task5cVmV1(['qualifyManualOrphanFixtureLaunchV1','planManualOrphanFixtureChildV1']),cases=task5cCasesV1(7);
  const launch=f=>vm.api.qualifyManualOrphanFixtureLaunchV1(f.kind,task5cDataV1(vm,f.actual),task5cDataV1(vm,f.frame));
  for(const [name,kind,change] of [
    ['missing worker ID','integration',f=>{f.actual.worker={};}],
    ['wrong worker ID','integration',f=>{f.actual.worker.NODE_TEST_WORKER_ID='2';}],
    ['recipient child-v8 context is absent','integration',f=>{f.actual.env.NODE_TEST_CONTEXT='child-v8';}],
    ['worker ID leaked into runner base','runner',f=>{f.actual.env.NODE_TEST_WORKER_ID='1';}],
    ['context leaked into runner base','runner',f=>{f.actual.env.NODE_TEST_CONTEXT='child-v8';}],
  ])cases.run(name,()=>{const f=task5cLaunchV1(kind);change(f);task5cRefusedV1(()=>launch(f));vm.check();});
  for(const [key,value] of [['NODE_TEST_WORKER_ID','1'],['NODE_TEST_CONTEXT','child-v8']])cases.run(key+' forwarded into child plan',()=>{
    const paths=task5cChildPathsV1();paths.env[key]=value;
    task5cRefusedV1(()=>vm.api.planManualOrphanFixtureChildV1('old_entry_positive',task5cDataV1(vm,paths)));vm.check();
  });cases.done();assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
});


// Task4C: complete actual caller main/catch in the existing helper/fixture realm.
// Closed Task4/provider bindings are containment only, not execution evidence for
// external packages. Earlier exposed-main/admin/projection tests are simulations.
const TASK4C_FIXTURE_SPECIFIER_V1='../tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.js';
function task4cEvaluateIsolatedEntryV1(context,bindings,c,faults){
  const control=bindings.task4cControl;
  assert.ok(control,'fixed Task4C entry control');
  const actual=context.exports,fixture=context.__task5cFixtureExportsV1;
  assert.equal(typeof actual.classifyManualOrphanVectorV1,'function');
  const guard=fn=>task5bGuardV1(faults,fn);
  const modules=new Map([
    ['node:path',path],['node:url',url],
    ['node:fs',closedModule(c,'Task4C fs',{constants,...bindings.fs})],
    ['node:os',closedModule(c,'Task4C os')],
    ['node:crypto',closedModule(c,'Task4C crypto')],
    ['node:child_process',closedModule(c,'Task4C child_process')],
    ['postgres',forbidden(c,'Task4C postgres')],
    [TASK4_SPECIFIER,closedModule(c,'Task4C Task4')],
  ]);
  context.__task4cCallerRequireV1=guard(specifier=>{
    if(specifier===HELPER_SPECIFIER)return actual;
    if(specifier===TASK4C_FIXTURE_SPECIFIER_V1){control.fixtureImports.push(fixture);return fixture;}
    assert.ok(modules.has(specifier),'Task4C unlisted caller import '+specifier);
    return modules.get(specifier);
  });
  let source=readFileSync(ISOLATED,'utf8');
  const cliHeader='#!/usr/bin/env node\n';
  assert.equal(source.startsWith(cliHeader),true,'Task4C exact first CLI header');
  assert.equal(source.split(cliHeader).length-1,1,'Task4C exactly one CLI header');
  source=source.slice(cliHeader.length);
  source=replaceOnce(source,'new URL("../", import.meta.url)',
    'new URL("../", '+JSON.stringify(ISOLATED.href)+')','Task4C fixed caller metadata URL');
  const preload='const SETFARM_P3_TEST_CAPABILITY_PRELOAD_V1 = `\n'
    +'process.env.NODE_OPTIONS = "--test-isolation=none";\n'
    +'await import("tsx");\nconst helper = await import(\n'
    +'  new URL("./tests/execution-attempts/test-database.ts", import.meta.url).href\n);\n'
    +'helper.authenticateP3ProjectedReadinessTestCapabilityV1();\n`;';
  source=replaceOnce(source,preload,'const SETFARM_P3_TEST_CAPABILITY_PRELOAD_V1 = "";',
    'Task4C dormant preload text only');
  source=replaceOnce(source,'main().catch((error) => {',
    'globalThis.__task4cEntryDoneV1 = main().catch((error) => {','Task4C capture original entry and entire catch');
  source+='\n;globalThis.__task4cPrivateMapperV1 = typeof manualOrphanFailureCodeV1 === "function" ? manualOrphanFailureCodeV1 : null;\n';
  const compiled=ts.transpileModule(source,{fileName:url.fileURLToPath(ISOLATED),
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'Task4C lowering diagnostics are scaffolding, not behavioral RED');
  control.beginCaller();
  runInNewContext('(function(exports,require){\n'+compiled.outputText+'\n})(globalThis.__task4cCallerExportsV1={},globalThis.__task4cCallerRequireV1);',
    context,{filename:url.fileURLToPath(ISOLATED),timeout:5000});
  assert.equal(typeof context.__task4cEntryDoneV1?.then,'function','actual full entry promise retained');
  return {done:context.__task4cEntryDoneV1,mapper:context.__task4cPrivateMapperV1,
    actualFixture:fixture,fixtureImports:control.fixtureImports};
}
function task4cEntryFixtureV1(options={}){
  const reader=probeReaderFixtureV1(options.reader??{}),faults=[],importReads=[],identityReads=[],envReads=[],rootReads=[];
  const writes=[],stdout=[],fixtureImports=[],events=[],monotonic=task3ClockV1();let importing=true,exitCode;
  const guard=fn=>task5bGuardV1(faults,fn),binding={};
  const importRefusal=key=>{importReads.push(key);throw Error('TASK4C_IMPORT_FIELD_READ');};
  for(const key of ['execArgv','execPath','argv0','pid','ppid','cwd','chdir','kill','getuid','geteuid','getgid','getegid','platform','arch','version'])
    Object.defineProperty(binding,key,{get(){if(importing)return importRefusal(key);
      identityReads.push(key);throw Error('PRIVATE_TASK4C_IDENTITY');}});
  Object.defineProperty(binding,'argv',{get(){if(importing)return importRefusal('argv');
    events.push('routing argv');return ['/inert/node',url.fileURLToPath(ISOLATED),'--',...(options.vector??VECTOR)];}});
  Object.defineProperty(binding,'env',{get(){if(importing)return importRefusal('env');envReads.push('env');
    if(options.environment==='ambient')return {SETFARM_PG_URL:'ambient-sentinel'};
    if(options.environment==='ordinary')return {};
    throw Error('PRIVATE_TASK4C_ENVIRONMENT');}});
  const outputs={};
  for(const name of ['stdout','stderr']){
    const channel=new EventEmitter(),on=channel.on;
    channel.on=guard((event,listener)=>{
      assert.equal(event,'error');assert.equal(typeof listener,'function');
      assert.equal(channel.listenerCount('error'),0,'one actual completion output listener');
      assert.deepEqual(reader.ledger.fstats,[4],'actual receiver initiation precedes R output acquisition');
      events.push('R '+name);return Reflect.apply(on,channel,[event,listener]);
    });
    channel.write=guard((bytes,...rest)=>{
      if(name==='stdout')stdout.push(bytes);
      assert.equal(name,'stderr','negative entry never publishes an owner result');
      assert.equal(rest.length,0,'normal CLI terminal write, no invented callback contract');
      assert.equal(typeof bytes,'string');assert.equal(writes.length,0,'one terminal diagnostic write');
      events.push('terminal stderr');writes.push(bytes);return true;
    });
    outputs[name]=channel;Object.defineProperty(binding,name,{get(){if(importing)return importRefusal(name);return channel;}});
  }
  Object.defineProperty(binding,'exitCode',{get(){if(importing)return importRefusal('exitCode');return exitCode;},
    set:guard(value=>{assert.equal(importing,false);assert.equal(value,1);assert.equal(writes.length,1);
      events.push('terminal exitCode');exitCode=value;})});
  const root=url.fileURLToPath(new URL('../',ISOLATED));
  const fs={...reader.fs,realpathSync:guard(value=>{
    assert.equal(value,root,'only legacy fixed Source realpath boundary is admitted');rootReads.push(value);return value;
  })};
  const control={fixtureImports,beginCaller(){
    assert.equal(importing,true);assert.deepEqual(importReads,[],'complete helper/fixture imports are inert');importing=false;
  }};
  const vm=task3VmV1({task5cFixture:true,task4cIsolatedEntry:true,task4cActualFd4Negative:true,
    task4cControl:control,process:binding,monotonic,fs,net:reader.net,assertClean:reader.assertClean});
  const entry=vm.task4cEntry,tracked=trackProbePromiseV1(entry.done);
  const check=()=>{assert.deepEqual(importReads,[]);assert.deepEqual(identityReads,[]);
    assert.deepEqual(faults,[],'no swallowed Task4C adapter/guard assertions');reader.assertClean();vm.assertContained();};
  check();return {vm,entry,tracked,reader,outputs,writes,stdout,events,envReads,rootReads,fixtureImports,check,
    get exitCode(){return exitCode;}};
}
async function task4cPumpV1(f){f.check();await task5bPumpV1();f.check();}
function task4cNoOwnerV1(f){
  f.check();assert.deepEqual(f.rootReads,[]);assert.deepEqual(f.envReads,[]);
  assert.deepEqual(f.stdout,[]);assert.equal(f.outputs.stdout.listenerCount('error'),f.reader.ledger.fstats.length?1:0);
}
async function task4cSettledV1(f,code){
  f.check();const result=await f.tracked.done;f.check();
  assert.equal(Object.hasOwn(result,'error'),false,'the actual catch must settle normally');
  assert.deepEqual(f.writes,[code+'\n']);assert.equal(f.exitCode,1);assert.deepEqual(f.stdout,[]);
  assert.deepEqual(f.events.slice(-2),['terminal stderr','terminal exitCode']);
  f.check();
}
function task4cGuardedV1(f){
  task4cNoOwnerV1(f);assert.deepEqual(f.reader.ledger.fstats,[]);assert.deepEqual(f.reader.ledger.rawCloses,[]);
  assert.deepEqual(f.reader.ledger.constructs,[]);assert.equal(f.reader.ledger.destroys,0);
  assert.equal(f.vm.timers.length,0);assert.equal(f.vm.monotonic.state.calls,0);
}
function task4cRawRefusalV1(f){
  task4cNoOwnerV1(f);assert.deepEqual(f.reader.ledger.fstats,[4]);assert.deepEqual(f.reader.ledger.rawCloses,[4]);
  assert.deepEqual(f.reader.ledger.constructs,[]);assert.equal(f.reader.ledger.destroys,0);
  assert.deepEqual(f.vm.timers.map(timer=>timer.delay),[840000]);
  assert.deepEqual(f.vm.cleared,[f.vm.timers[0].handle]);
}
function task4cPendingReaderV1(f){
  task4cNoOwnerV1(f);assert.deepEqual(f.reader.ledger.fstats,[4]);assert.deepEqual(f.reader.ledger.rawCloses,[]);
  assert.equal(f.reader.ledger.constructs.length,1);assert.equal(f.reader.ledger.closed,false);
  assert.deepEqual(f.vm.timers.map(timer=>timer.delay),[5000,840000]);
  assert.equal(f.tracked.outcome,null);assert.deepEqual(f.writes,[]);assert.equal(f.exitCode,undefined);
}
function task4cKnownCloseV1(f){
  f.check();assert.equal(f.reader.ledger.closed,false);f.reader.ledger.closed=true;
  f.reader.ledger.socket.emit('close',false);f.check();
}
async function task4cMalformedReaderV1(){
  const f=task4cEntryFixtureV1({});
  task4cPendingReaderV1(f);
  f.reader.ledger.socket.emit('data',Buffer.from('{invalid JSON}\n'));f.reader.ledger.socket.emit('end');
  await task4cPumpV1(f);task4cPendingReaderV1(f);assert.equal(f.reader.ledger.destroys,1);
  task4cKnownCloseV1(f);await task4cSettledV1(f,'MANUAL_ORPHAN_FRAME_REFUSED');task4cNoOwnerV1(f);
  assert.equal(f.vm.cleared.length,2);assert.ok(f.vm.timers.every(timer=>f.vm.cleared.includes(timer.handle)));
  return f;
}
function task4cMapperV1(f){
  assert.equal(typeof f.entry.mapper,'function','missing actual private manualOrphanFailureCodeV1 (API scaffolding RED)');
  assert.equal(f.entry.mapper.length,1);return f.entry.mapper;
}

// Break: a missing private manual bit/terminal branch can expose raw diagnostics.
test('Task4C 01 complete isolated entry reaches actual receiver refusal',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('exact actual catch',async()=>{
    const f=task4cEntryFixtureV1({environment:'ordinary',reader:{kind:'file'}});await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: ambient observation before route classification can leak/override the fixed refusal.
test('Task4C 02 exact enabled entry never reads ambient environment',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('throwing ambient getter',async()=>{
    const f=task4cEntryFixtureV1({reader:{kind:'file'}});await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: any reserved near vector falling through grammar changes its public refusal.
test('Task4C 03 complete entry refuses all ten reserved near vectors',async()=>{
  const cases=task5bCasesV1(10);for(const [label,vector] of NEAR)await cases.wait(label,async()=>{
    const f=task4cEntryFixtureV1({vector});await task4cSettledV1(f,'MANUAL_ORPHAN_ROUTE_REFUSED');task4cGuardedV1(f);
  });cases.done();
});
// Break: moving the legacy root observation ahead of the ordinary ambient guard.
test('Task4C 04 unrelated ambient refusal preserves ordinary diagnostic',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('ordinary ambient refusal',async()=>{
    const f=task4cEntryFixtureV1({vector:['node'],environment:'ambient'});
    await task4cSettledV1(f,'ISOLATED_TEST_AMBIENT_PG_URL_FORBIDDEN');
    assert.deepEqual(f.envReads,['env']);assert.deepEqual(f.rootReads,[]);
    assert.deepEqual(f.reader.ledger.fstats,[]);assert.equal(f.vm.timers.length,0);
  });cases.done();
});
// Break: reserved routing must preserve the four preexisting malformed ordinary vectors.
test('Task4C 05 four unrelated malformed vectors retain grammar refusal',async()=>{
  const cases=task5bCasesV1(4);for(const vector of [[],['node'],
    ['node','--import','tsx','--test','--test-concurrency=2','unrelated.test.ts'],
    ['node','--import','tsx','--test','--test-concurrency=1','/absolute/unrelated.test.ts']])
    await cases.wait(JSON.stringify(vector),async()=>{
      const f=task4cEntryFixtureV1({vector,environment:'ordinary'});
      await task4cSettledV1(f,'ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE');
      assert.deepEqual(f.envReads,['env']);assert.equal(f.rootReads.length,1);
      assert.deepEqual(f.reader.ledger.fstats,[]);assert.equal(f.vm.timers.length,0);
    });cases.done();
});
// Break: a missing/aliased static fixture import would leave the real exact route unwired.
test('Task4C 06 actual fixture import is inert and exact',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('actual complete fixture namespace import',async()=>{
    const f=task4cEntryFixtureV1({environment:'ordinary',reader:{kind:'file'}});
    assert.equal(f.fixtureImports.length,1,'caller resolves the exact actual fixture import once (import scaffolding RED if absent)');
    assert.equal(f.fixtureImports[0],f.vm.fixtureExports);assert.equal(f.entry.actualFixture,f.vm.fixtureExports);
    assert.equal(typeof f.vm.fixtureExports.runManualOrphanBootstrapRouteV1,'function');
    assert.equal(typeof f.vm.fixtureExports.runManualOrphanBootstrapIntegrationV1,'function');
    assert.equal(f.vm.fixtureExports.runManualOrphanBootstrapRouteV1.length,0);
    assert.equal(f.vm.fixtureExports.runManualOrphanBootstrapIntegrationV1.length,0);
    await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: calling legacy grammar or an owner before the actual negative FD4 receiver.
test('Task4C 07 enabled exact route reaches actual receiver before owner work',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('nonpipe known raw close',async()=>{
    const f=task4cEntryFixtureV1({reader:{kind:'file'}});
    await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: uncertain raw close must dominate the receiver's ordinary owner refusal.
test('Task4C 08 uncertain raw FD4 close reaches sole cleanup diagnostic',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('one uncertain raw close',async()=>{
    const f=task4cEntryFixtureV1({reader:{kind:'file',rawCloseError:true}});
    await task4cSettledV1(f,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: EOF/requested destroy cannot replace the original reader's known close.
test('Task4C 09 malformed receiver frame waits for actual known close',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('literal malformed JSON then retained close',task4cMalformedReaderV1);cases.done();
});
// Break: a 5000ms reader cutoff must burn uncertainty without settling pending input.
test('Task4C 10 receiver deadline stays pending until retained close',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('reader deadline before retained close',async()=>{
    const f=task4cEntryFixtureV1({});task4cPendingReaderV1(f);
    const timer=f.vm.timers.find(item=>item.delay===5000);assert.ok(timer);f.check();
    f.vm.monotonic.state.ms=5000;timer.callback();f.check();await task4cPumpV1(f);
    task4cPendingReaderV1(f);assert.equal(f.reader.ledger.destroys,1);
    task4cKnownCloseV1(f);await task4cSettledV1(f,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');task4cNoOwnerV1(f);
    assert.equal(f.vm.cleared.length,2);assert.ok(f.vm.timers.every(item=>f.vm.cleared.includes(item.handle)));
  });cases.done();
});
// Break: narrowing the finite code set must not discard the existing SETUP diagnostic.
test('Task4C 11 actual private diagnostic mapper preserves seven fixed codes',async()=>{
  const cases=task5bCasesV1(7);for(const code of ['MANUAL_ORPHAN_FRAME_REFUSED','MANUAL_ORPHAN_SETUP_REFUSED',
    'MANUAL_ORPHAN_CASE_REFUSED','MANUAL_ORPHAN_OWNER_REFUSED','MANUAL_ORPHAN_CLEANUP_UNKNOWN',
    'MANUAL_ORPHAN_ROUTE_REFUSED','MANUAL_ORPHAN_SLICE2_UNAVAILABLE'])await cases.wait(code,async()=>{
      const f=task4cEntryFixtureV1({environment:'ordinary',reader:{kind:'file'}});await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');
      const mapper=task4cMapperV1(f);assert.equal(mapper(new Error(code)),code);task4cRawRefusalV1(f);
    });cases.done();
});
// Break: raw text, broad-prefix matching, object duck typing, or hostile access can leak detail.
test('Task4C 12 actual diagnostic mapper rejects eight untrusted error forms',async()=>{
  const cases=task5bCasesV1(8);for(const [name,make] of [
    ['child code',()=>new Error('MANUAL_ORPHAN_CHILD_UNKNOWN')],
    ['fake success code',()=>new Error('MANUAL_ORPHAN_FAKE_SUCCESS')],
    ['secret Error',()=>new Error('PRIVATE_TASK4C_SECRET')],
    ['secret string',()=> 'PRIVATE_TASK4C_SECRET'],['null',()=>null],
    ['throwing Error message',()=>Object.defineProperty(new Error('unused'),'message',{get(){throw Error('PRIVATE_TASK4C_GETTER');}})],
    ['throwing Error Proxy',()=>new Proxy(new Error('unused'),{get(){throw Error('PRIVATE_TASK4C_PROXY');},getPrototypeOf(){throw Error('PRIVATE_TASK4C_PROXY');}})],
    ['plain message object',()=>({message:'MANUAL_ORPHAN_OWNER_REFUSED'})],
  ])await cases.wait(name,async()=>{
    const f=task4cEntryFixtureV1({environment:'ordinary',reader:{kind:'file'}});await task4cSettledV1(f,'MANUAL_ORPHAN_OWNER_REFUSED');
    const mapper=task4cMapperV1(f);assert.equal(mapper(make()),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');task4cRawRefusalV1(f);
  });cases.done();
});
// Break: retained late reader faults must not reopen catch/output after case09 settles.
test('Task4C 13 repeated late reader faults never duplicate terminal output',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('case09 plus one retained late error',async()=>{
    const f=await task4cMalformedReaderV1(),socket=f.reader.ledger.socket;
    assert.ok(socket.listenerCount('error')>=1,'actual retained reader error listener');f.check();
    assert.equal(socket.emit('error',new Error('PRIVATE_TASK4C_LATE_READER')),true);f.check();
    await task4cPumpV1(f);await task4cSettledV1(f,'MANUAL_ORPHAN_FRAME_REFUSED');task4cNoOwnerV1(f);
    assert.equal(f.reader.ledger.destroys,1);assert.deepEqual(f.reader.ledger.rawCloses,[]);
  });cases.done();
});

// Task6 late-original-fault appendix: twelve literal finite component cases.
// Retained emitters simulate events only. Actual same-realm Q/R/observers/O
// execute; no C/E, owner, Source holder, SQL, provider or native success claim.
function task6LateVmV1(kind='runner'){
  assert.ok(kind===null||kind==='runner'||kind==='integration');
  const reads=[],faults=[],writes=[],outputs={},binding={},monotonic=task3ClockV1();
  let importing=true,callback=null;
  const guard=fn=>task5bGuardV1(faults,fn);
  for(const key of ['env','argv','execArgv','pid','ppid','cwd'])Object.defineProperty(binding,key,{get(){
    reads.push(key);throw Error('TASK6_LATE_PROCESS_READ');}});
  for(const name of ['stdout','stderr']){
    const stream=new EventEmitter(),on=stream.on;
    stream.on=guard((event,listener)=>{assert.equal(event,'error');assert.equal(typeof listener,'function');
      return Reflect.apply(on,stream,[event,listener]);});
    stream.write=guard((bytes,done)=>{
      assert.equal(kind,'runner');assert.equal(name,'stdout');assert.equal(writes.length,0,'one original output');
      assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>=1&&bytes.length<=16384);assert.equal(bytes.at(-1),10);
      assert.equal(typeof done,'function');writes.push(Buffer.from(bytes));callback=done;return true;
    });
    outputs[name]=stream;Object.defineProperty(binding,name,{get(){
      if(importing){reads.push(name);throw Error('TASK6_LATE_IMPORT_OUTPUT');}return stream;}});
  }
  const vm=task3VmV1({task5cFixture:true,task5cFiniteObservers:true,task6CompletionLifetime:true,
    process:binding,monotonic});importing=false;
  const api=vm.fixtureLexical,fix1=vm.fixtureFix1Lexical,register=vm.task6CompletionChild;
  assert.deepEqual(Object.keys(vm.fixtureExports).sort(),[
    'runManualOrphanBootstrapIntegrationV1','runManualOrphanBootstrapRouteV1','runManualOrphanCompiledCliNegativeV1','runManualOrphanSourceContextNegativeV1']);
  assert.equal(vm.fixtureExports.runManualOrphanBootstrapRouteV1.length,0);
  assert.equal(vm.fixtureExports.runManualOrphanBootstrapIntegrationV1.length,0);
  assert.deepEqual(Object.keys(fix1).sort(),['retainManualOrphanFixtureCompletionV1','retainManualOrphanOriginalChildLifetimeV1']);
  assert.equal(fix1.retainManualOrphanOriginalChildLifetimeV1.length,2);
  assert.equal(fix1.retainManualOrphanFixtureCompletionV1.length,1);
  assert.equal(typeof register,'function','missing Task6 private registrar (scaffolding only; not causal RED)');
  assert.equal(register.length,2);assert.equal(api.finalizeManualOrphanFixtureResultV1.length,2);
  assert.equal(vm.timers.length,0);assert.equal(monotonic.state.calls,0);assert.equal(monotonic.state.accesses,0);
  const originals=[];
  // Containment checks deliberately do not sample R, Q or witnesses. In the
  // lazy cases only the specified witness observation may advance its clock.
  const check=()=>{assert.deepEqual(reads,[]);assert.deepEqual(faults,[],'no swallowed Task6 boundary assertion');
    vm.assertContained();for(const original of originals)original.f.assertGuarded();};
  const completion=kind===null?null:fix1.retainManualOrphanFixtureCompletionV1(kind);
  const timer=kind===null?null:vm.timers[0];
  if(completion!==null){assert.equal(Object.isFrozen(completion),true);task5cFix1CompletionFactsV1(completion);
    assert.equal(vm.timers.length,1);assert.equal(timer.delay,kind==='runner'?840000:300000);}
  const x={...vm,api,fix1,register,kind,completion,timer,originals,writes,outputs,check,
    callback(){assert.equal(typeof callback,'function','retain the one original callback');
      const original=callback;callback=null;original(null);check();},
    releaseTrace(body){const push=vm.cleared.push;Object.defineProperty(vm.cleared,'push',{
      value:guard((...args)=>{assert.deepEqual(args,[timer.handle]);const value=Reflect.apply(push,vm.cleared,args);body();return value;}),configurable:true});},
    closed(expectedWrites){check();assert.equal(callback,null);assert.equal(writes.length,expectedWrites);
      assert.equal(originals.length<= (kind==='integration'?2:3),true);
      assert.equal(vm.timers.length,originals.length+(completion===null?0:1),'one timer per real observer and one R timer');
      assert.equal(vm.cleared.length,vm.timers.length);assert.equal(new Set(vm.cleared).size,vm.timers.length);
      for(const scheduled of vm.timers)assert.ok(vm.cleared.includes(scheduled.handle));
      for(const original of originals){assert.equal(original.lifetime.settled,original.settled);
        assert.equal(original.witness.settled,original.witnessSettled);assert.notEqual(original.tracked.outcome,null);}
      if(completion!==null){const facts=task5cFix1CompletionFactsV1(completion);
        assert.equal(facts.finished,true);assert.equal(facts.writePending,false);}
    },
  };check();return x;
}
function task6OriginalV1(x,purpose='provision',register=true){
  const f=task3EventFixtureV1(purpose),data=purpose==='integration'?ownedIntegrationData():ownedPhaseResultData(purpose);
  f.child.pid=data.pid;
  const witness=purpose==='integration'?x.actual.observeManualOrphanOwnedIntegrationChildV1(f.child):x.actual.observeManualOrphanOwnedChildV1(f.child,purpose);
  const lifetime=x.fix1.retainManualOrphanOriginalChildLifetimeV1(f.child,witness);
  const settled=lifetime.settled,witnessSettled=witness.settled,tracked=trackProbePromiseV1(settled);
  const original={f,purpose,witness,lifetime,settled,witnessSettled,tracked};x.originals.push(original);
  assert.equal(Object.isFrozen(lifetime),true);assert.deepEqual(Object.keys(lifetime).sort(),['current','settled']);
  assert.equal(lifetime.current.length,0);
  if(register)x.register(x.completion,lifetime); // exact original Q and exact returned R, no copied surrogate
  // Valid transport DATA is not owner/Source evidence. The integration observer
  // consumes the real bounded transcript scanner, not a supplied witness.
  f.channels.stdout.emit('data',purpose==='integration'?task5aWireV1():helper.encodeManualOrphanOwnedPhaseResultV1(data));
  x.check();return original;
}
async function task6ClosedOriginalV1(x,purpose='provision'){
  const original=task6OriginalV1(x,purpose);task3CompleteV1(original.f,purpose);
  const history=await original.witnessSettled;await original.tracked.done;x.check();
  assert.equal(history.state,'observed');assert.deepEqual(original.tracked.outcome,{value:undefined});
  const facts=task5cFix1LifetimeFactsV1(original.lifetime);assert.equal(facts.closed,true);assert.equal(facts.unknown,false);
  return original;
}
function task6ResultDataV1(x){
  // Explicit valid DATA input to actual O/codec; never a public success path.
  return x.api.finalizeManualOrphanFixtureResultV1(x.kind,task5cDataV1(x,task5cFinalFactsV1(x.kind)));
}
function task6CaptureV1(body){
  try{return {value:body()};}catch(error){
    if(!(error instanceof Error)||error.message!=='MANUAL_ORPHAN_CLEANUP_UNKNOWN')throw error;
    return {error};
  }
}
function task6RefusalV1(outcome,message){
  assert.ok(outcome.error instanceof Error,message);assert.equal(outcome.error.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  assert.equal(Object.hasOwn(outcome,'value'),false);
}
async function task6PendingOutputV1(x){
  const bytes=task6ResultDataV1(x);x.monotonic.state.ms=100;
  const tracked=trackProbePromiseV1(x.completion.write(bytes));await task5bPumpV1();x.check();
  assert.equal(tracked.outcome,null);assert.equal(x.writes.length,1);
  assert.deepEqual(x.writes,[Buffer.from(OWN_RUNNER_WIRE)]);return tracked;
}
async function task6LateOutputErrorV1(target,three=false){
  const x=task6LateVmV1(),earliest=await task6ClosedOriginalV1(x,'provision');
  if(three){await task6ClosedOriginalV1(x,'activate');await task6ClosedOriginalV1(x,'integration');}
  const tracked=await task6PendingOutputV1(x);
  const original=target==='child'?earliest.f.child:earliest.f.channels[target];
  original.emit('error',Error('TASK6_SIMULATED_LATE_ORIGINAL'));await task5bPumpV1();
  const stillPending=tracked.outcome===null;x.callback();const outcome=await tracked.done;
  // R outcome is captured BEFORE fresh Q/witness diagnostic reads, including RED.
  const finish=task6CaptureV1(()=>x.completion.finish(false));
  const facts=earliest.lifetime.current(),witness=earliest.witness.snapshot();
  await Promise.all(x.originals.map(item=>item.tracked.done));x.closed(1);
  assert.equal(stillPending,true,'a child fault never supplies the original output callback');
  assert.equal(facts.unknown,true);assert.equal(witness.state,'unknown');
  for(const item of x.originals)assert.equal((await item.witnessSettled).state,'observed','historical original witness remains joined');
  task6RefusalV1(outcome,'current original fault must reject the actual pending output');
  task6RefusalV1(finish,'late uncertainty remains sticky through release');
}

// Break: a valid registry/actual finalizer must not itself refuse healthy originals.
test('Task6 late original fault runner control retains three closed originals',async()=>{
  const x=task6LateVmV1();await task6ClosedOriginalV1(x,'provision');await task6ClosedOriginalV1(x,'activate');await task6ClosedOriginalV1(x,'integration');
  const tracked=await task6PendingOutputV1(x);x.monotonic.state.ms=150;x.callback();const outcome=await tracked.done;
  const finish=task6CaptureV1(()=>x.completion.finish(true));x.closed(1);
  assert.deepEqual(outcome,{value:undefined});assert.deepEqual(finish,{value:undefined});assert.equal(x.completion.current().unknown,false);
});
test('Task6 late original fault integration control retains two closed originals',async()=>{
  const x=task6LateVmV1('integration');await task6ClosedOriginalV1(x,'old_entry_positive');await task6ClosedOriginalV1(x,'new_entry_refusal');
  const result=task6ResultDataV1(x);x.monotonic.state.ms=100;const finish=task6CaptureV1(()=>x.completion.finish(true));x.closed(0);
  assert.deepEqual(task5cPlainV1(result),ownedIntegrationData());task5cFrozenV1(result);
  assert.deepEqual(finish,{value:undefined});assert.equal(x.completion.current().unknown,false);
});
// Break: omitting fresh Q polling loses each original's late retained error.
test('Task6 late original child error rejects pending runner output',async()=>{
  await task6LateOutputErrorV1('child');
});
test('Task6 late original stdout error rejects pending runner output',async()=>{
  await task6LateOutputErrorV1('stdout');
});
test('Task6 late original stderr error rejects pending runner output',async()=>{
  await task6LateOutputErrorV1('stderr');
});
test('Task6 late original fd4 error rejects pending runner output',async()=>{
  await task6LateOutputErrorV1('fd4');
});
// Break: event/global-output-only sampling misses a settled witness's fresh clock fault.
test('Task6 late witness clock regression rejects otherwise timely runner output',async()=>{
  const control=task6LateVmV1(),controlWrite=await task6PendingOutputV1(control);
  control.monotonic.state.ms=200;control.monotonic.state.ms=150;control.callback();
  const controlOutcome=await controlWrite.done,controlFinish=task6CaptureV1(()=>control.completion.finish(true));control.closed(1);
  assert.deepEqual(controlOutcome,{value:undefined});assert.deepEqual(controlFinish,{value:undefined});
  const x=task6LateVmV1(),original=await task6ClosedOriginalV1(x),tracked=await task6PendingOutputV1(x);
  x.monotonic.state.ms=200;const prior=original.witness.snapshot(); // ONLY witness advances to 200
  x.monotonic.state.ms=150;x.callback();const outcome=await tracked.done;
  const finish=task6CaptureV1(()=>x.completion.finish(false));
  const witness=original.witness.snapshot(),facts=original.lifetime.current();x.closed(1);
  assert.equal(prior.state,'observed');assert.equal(witness.state,'unknown');assert.equal(facts.unknown,true);
  assert.equal((await original.witnessSettled).state,'observed');assert.deepEqual(original.tracked.outcome,{value:undefined});
  task6RefusalV1(outcome,'R 100→150 is timely; only current Q sees witness 200→150');task6RefusalV1(finish,'lazy fault stays sticky');
});
// Break: skipping the post-clear Q observation permits a fault during final release.
test('Task6 late original child error during runner timer release rejects finish',async()=>{
  const x=task6LateVmV1(),original=await task6ClosedOriginalV1(x),tracked=await task6PendingOutputV1(x);
  x.callback();const outcome=await tracked.done;
  x.releaseTrace(()=>original.f.child.emit('error',Error('TASK6_SIMULATED_RELEASE_ERROR')));
  const finish=task6CaptureV1(()=>x.completion.finish(true));const facts=original.lifetime.current();x.closed(1);
  assert.deepEqual(outcome,{value:undefined});assert.equal(facts.unknown,true);assert.equal(original.witness.snapshot().state,'unknown');
  task6RefusalV1(finish,'post-release current original fault must reject finish');
});
test('Task6 late witness clock regression during integration timer release rejects finish',async()=>{
  const x=task6LateVmV1('integration'),original=await task6ClosedOriginalV1(x,'old_entry_positive');
  task6ResultDataV1(x);x.monotonic.state.ms=100;x.completion.check();let during=null;
  x.releaseTrace(()=>{x.monotonic.state.ms=200;during=original.witness.snapshot();x.monotonic.state.ms=150;});
  const finish=task6CaptureV1(()=>x.completion.finish(true));
  const witness=original.witness.snapshot(),facts=original.lifetime.current();x.closed(0);
  assert.equal(during.state,'observed');assert.equal(witness.state,'unknown');assert.equal(facts.unknown,true);
  assert.equal((await original.witnessSettled).state,'observed');
  task6RefusalV1(finish,'R 100→150 is valid; its post-clear Q poll must detect witness 200→150');
});
// Break: missing polling refuses neither uncertainty nor the still-owed FD4;
// observer settlement/R refusal cannot manufacture that original's close.
test('Task6 late fault refusal preserves pending original fd4 custody',async()=>{
  const x=task6LateVmV1(),original=task6OriginalV1(x);
  original.f.channels.fd4.emit('error',Error('TASK6_SIMULATED_OPEN_FD4_ERROR'));
  for(const name of ['stdout','stderr']){original.f.channels[name].emit('end');original.f.channels[name].emit('close');}
  original.f.child.emit('exit',1,null);original.f.child.emit('close',1,null);await task5bPumpV1();
  const pendingBefore=original.tracked.outcome===null;
  const refusal=task6CaptureV1(()=>x.completion.check()); // capture R while FD4 is physically open
  const open=original.lifetime.current();await task5bPumpV1();const pendingAfter=original.tracked.outcome===null;
  original.f.channels.fd4.emit('close');const history=await original.witnessSettled;const joined=await original.tracked.done;
  const finish=task6CaptureV1(()=>x.completion.finish(false));x.closed(0);
  assert.equal(pendingBefore,true);assert.equal(pendingAfter,true);assert.equal(open.fd4,'open');assert.equal(open.closed,false);
  assert.equal(open.pending,true);assert.equal(open.unknown,true);assert.equal(history.state,'unknown');
  assert.equal(original.lifetime.current().fd4,'closed');task6RefusalV1(joined,'Q still joins the actual FD4 close');
  task6RefusalV1(refusal,'R must refuse original uncertainty before FD4 closure');task6RefusalV1(finish,'original uncertainty stays sticky');
});
// Break: retaining only the most recent Q loses the earliest original's late fault.
test('Task6 late fault on earliest retained child rejects runner output',async()=>{
  await task6LateOutputErrorV1('child',true);
});
// Break: a structural/fabricated completion key must not acquire private association.
test('Task6 late fault private registrar refuses an unregistered completion',async()=>{
  const x=task6LateVmV1(null),original=task6OriginalV1(x,'provision',false);
  const refusal=task6CaptureV1(()=>x.register(Object.freeze({}),original.lifetime));
  await task5bPumpV1();const pending=original.tracked.outcome===null;
  task3CompleteV1(original.f,'provision');const history=await original.witnessSettled;const joined=await original.tracked.done;x.closed(0);
  assert.equal(pending,true);assert.equal(history.state,'observed');assert.deepEqual(joined,{value:undefined});
  assert.equal(x.outputs.stdout.listenerCount('error'),0);assert.equal(x.outputs.stderr.listenerCount('error'),0);
  task6RefusalV1(refusal,'private registrar requires the exact R registered by its factory');
});

// Task6 genuine-integration appendix: 18 literal SCRIPT callbacks / 19 finite
// scenarios. Missing genuine Source is lazy scaffold evidence only. The actual
// body has two negative FD4 cases; producer DATA cases exercise the private
// actual writer/codec/collector and never claim public fixture/C/owner success.
const TASK6_INTEGRATION_MODULE_V1=new URL('../../tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts',import.meta.url);
const TASK6_INTEGRATION_FIXTURE_SPECIFIER_V1='./helpers/manual-control-orphan-bootstrap-fixture-v1.js';
// Independent complete expected membership: no expected string is read from
// OWNER_BACKED_TESTS. The old top-level 43 assertion stays frozen for tests-first.
const TASK6_EXPECTED_OWNER_FILES_V1=Object.freeze([
  'attempt-reconciler.test.ts',
  'claim-authority.test.ts',
  'claim-attempt-transition.test.ts',
  'claim-runtime-publication.test.ts',
  'claim-step-v3-recovery.integration.test.ts',
  'compiler-claim-fence.test.ts',
  'concurrency.test.ts',
  'control-evidence-admission-reader-v1.isolated-pg.test.ts',
  'manual-test-admission-v1.isolated-pg.test.ts',
  'migration-runtime-preservation.test.ts',
  'migration33-current-entry-observers.test.ts',
  'operational-event-delivery.test.ts',
  'operational-outbox-publisher.test.ts',
  'operational-outbox-repository.test.ts',
  'post-claim-ownership-finalizer.integration.test.ts',
  'repository.test.ts',
  'run-operational-action.test.ts',
  'run-protocol.test.ts',
  'run-terminal-transition.test.ts',
  'run-termination.test.ts',
  'runtime-completion.test.ts',
  'runtime-hooks.test.ts',
  'runtime-session-repository.test.ts',
  'story-publication.integration.test.ts',
  'terminal-claim-runtime-reconciler.test.ts',
  'v3-deploy-receipt-repository.test.ts',
  'v3-deploy-refusal.integration.test.ts',
  'v3-downstream-evidence-publication.test.ts',
  'v3-downstream-recovery-transition.test.ts',
  'v3-implementation-refusal.integration.test.ts',
  'v3-operational-retry-lifecycle.integration.test.ts',
  'v3-plan-invalid-proposal-retry.integration.test.ts',
  'v3-plan-product-build-authority.integration.test.ts',
  'v3-plan-refusal.integration.test.ts',
  'v3-platform-preclaim-claim.integration.test.ts',
  'v3-platform-preclaim-terminal.integration.test.ts',
  'v3-platform-preclaim-termination-race.integration.test.ts',
  'v3-pre-dispatch-failure.integration.test.ts',
  'v3-predecessor-completion-claim.integration.test.ts',
  'v3-preparation-claim-authority.test.ts',
  'v3-setup-build-failure-cause.integration.test.ts',
  'v3-setup-build-untyped-build-failure.integration.test.ts',
  'v3-stage-input-unresolved.integration.test.ts',
  'manual-control-orphan-bootstrap-v1.integration.test.ts',
]);
function task6IntegrationSourceV1(){
  assert.equal(existsSync(TASK6_INTEGRATION_MODULE_V1),true,
    'missing genuine integration module (scaffold only; not behavioral RED)');
  return readFileSync(TASK6_INTEGRATION_MODULE_V1,'utf8');
}
function task6EvaluateIntegrationV1(context,bindings,c,faults){
  const control=bindings.task6IntegrationControl;
  assert.ok(control,'literal Task6 opt-in requires its finite control');
  const source=task6IntegrationSourceV1(),fixture=context.__task5cFixtureExportsV1;
  const guard=fn=>task5bGuardV1(control.assertions,fn);
  const reject=label=>{control.forbidden.push(label);throw Error('TASK6_INTEGRATION_CONTAINMENT');};
  const admitted=['node:test','node:buffer','node:process',TASK6_INTEGRATION_FIXTURE_SPECIFIER_V1];
  // Static imports and runtime require attempts have separate ledgers. Even an
  // unused forbidden import cannot disappear harmlessly during TS lowering.
  const parsed=ts.createSourceFile(url.fileURLToPath(TASK6_INTEGRATION_MODULE_V1),source,ts.ScriptTarget.ES2022,true);
  for(const statement of parsed.statements){
    if(ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement)){
      assert.equal(ts.isImportDeclaration(statement),true,'genuine module has no reexports');
      assert.equal(ts.isStringLiteral(statement.moduleSpecifier),true);
      const specifier=statement.moduleSpecifier.text;control.staticImports.push(specifier);
      assert.ok(admitted.includes(specifier),'only exact genuine integration imports');
    }
  }
  assert.equal(control.staticImports.filter(value=>value==='node:test').length,1);
  assert.equal(control.staticImports.filter(value=>value===TASK6_INTEGRATION_FIXTURE_SPECIFIER_V1).length,1);
  assert.equal(new Set(control.staticImports).size,control.staticImports.length);
  const originalProcess=context.process;
  const processBinding=new Proxy(originalProcess,{
    get(target,key){if(key==='__esModule')return false;
      if(control.importing){control.moduleReads.push(String(key));return reject('module-time process read');}
      return Reflect.get(target,key);},
    set(target,key,value){if(control.importing){control.moduleReads.push(String(key));return reject('module-time process write');}
      return Reflect.set(target,key,value);},
  });
  const register=guard((...args)=>{
    assert.equal(control.importing,true);assert.equal(args.length,3);
    const [title,options,body]=args;
    assert.equal(title,'manual orphan bootstrap v1 preserves old entry and refuses maintenance source');
    assert.deepEqual(task5cPlainV1(options),{concurrency:false});
    assert.equal(typeof body,'function');assert.equal(body.constructor.name,'AsyncFunction');
    control.registrations.push({title,options,body});assert.equal(control.registrations.length,1);
  });
  const testBinding=new Proxy(register,{get(target,key){
    if(key==='__esModule')return false;if(key==='test')return register;
    return reject('node:test.'+String(key));
  }});
  const modules=new Map([
    ['node:test',testBinding],['node:buffer',closedModule(c,'Task6 integration buffer',{Buffer})],['node:process',processBinding],
    [TASK6_INTEGRATION_FIXTURE_SPECIFIER_V1,fixture],
  ]);
  context.__task6IntegrationRequireV1=guard(specifier=>{
    control.imports.push(specifier);if(!modules.has(specifier))return reject('import '+String(specifier));
    if(specifier===TASK6_INTEGRATION_FIXTURE_SPECIFIER_V1)control.fixtureImports.push(fixture);
    return modules.get(specifier);
  });
  const compiled=ts.transpileModule(source,{fileName:url.fileURLToPath(TASK6_INTEGRATION_MODULE_V1),
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[],
    'complete genuine module must lower before behavioral evidence');
  context.process=processBinding;
  // No body/catch/mapper replacement: only expose the fixed actual lexical
  // factory after evaluating the entire original module in the existing realm.
  runInNewContext('(function(exports,require){\n'+compiled.outputText+`\n;
    globalThis.__task6IntegrationFactoryV1=typeof retainManualOrphanIntegrationMarkerWriterV1==='function'?retainManualOrphanIntegrationMarkerWriterV1:null;
  })(globalThis.__task6IntegrationExportsV1={},globalThis.__task6IntegrationRequireV1);`,context,
    {filename:url.fileURLToPath(TASK6_INTEGRATION_MODULE_V1),timeout:5000});
  assert.deepEqual(Object.keys(context.__task6IntegrationExportsV1),[],'no new public integration API');
  assert.equal(control.registrations.length,1);assert.deepEqual(control.moduleReads,[]);
  assert.deepEqual(control.forbidden,[]);assert.deepEqual(control.assertions,[]);
  assert.equal(c.calls.forbidden,0);assert.deepEqual(faults,[]);
  const factory=context.__task6IntegrationFactoryV1;
  assert.equal(typeof factory,'function','missing genuine private writer (scaffold only)');assert.equal(factory.length,0);
  return {factory,registration:control.registrations[0],actualFixture:fixture};
}
function task6IntegrationVmV1(options={}){
  task6IntegrationSourceV1(); // lazy, before any VM setup in these NEW cases only
  const control={importing:true,registrations:[],staticImports:[],imports:[],fixtureImports:[],moduleReads:[],forbidden:[],assertions:[]};
  const reader=probeReaderFixtureV1({kind:'file'}),binding={},outputs={},writes=[],events=[],reads=[];
  const guard=fn=>function(...args){try{return Reflect.apply(fn,this,args);}catch(error){
    if(error?.code==='ERR_ASSERTION')control.assertions.push(error.message);throw error;
  }};let callback=null,exitCode,writeGetterReads=0;
  const refuse=key=>{reads.push(key);throw Error('TASK6_FORBIDDEN_PROCESS_FIELD');};
  for(const key of ['env','argv','execArgv','execPath','argv0','pid','ppid','cwd','chdir','kill','getuid','geteuid','getgid','getegid','platform','arch','version','on','once','exit'])
    Object.defineProperty(binding,key,{get(){return refuse(key);}});
  for(const name of ['stdout','stderr']){
    const stream=new EventEmitter(),on=stream.on;
    stream.on=guard(function(event,listener){
      assert.equal(this,stream);assert.equal(control.importing,false);assert.equal(event,'error');assert.equal(typeof listener,'function');
      const count=stream.listenerCount('error');assert.ok(count<(options.body===true?2:1));
      assert.deepEqual(reader.ledger.fstats,count===0?[]:[4]);
      events.push((count===0?'writer ':'fixture ')+name);return Reflect.apply(on,stream,[event,listener]);
    });
    const method=guard(function(...args){
      assert.equal(control.importing,false);assert.equal(this,stream);assert.equal(name,'stdout');
      assert.equal(args.length,2);const [bytes,done]=args;
      assert.ok(Buffer.isBuffer(bytes));assert.ok(bytes.length>0&&bytes.length<=16384);assert.equal(bytes.at(-1),10);
      assert.equal(typeof done,'function');assert.equal(writes.length,0,'one retained original marker operation');
      writes.push(Buffer.from(bytes));callback=done;events.push('write');
      if(options.writeThrow===true)throw Error('PRIVATE_TASK6_WRITE_SENTINEL');return true;
    });
    Object.defineProperty(stream,'write',{get:guard(()=>{
      assert.equal(control.importing,false);assert.equal(name,'stdout');writeGetterReads++;
      if(options.getterThrow===true)throw Error('PRIVATE_TASK6_GETTER_SENTINEL');return method;
    })});
    outputs[name]=stream;Object.defineProperty(binding,name,{get(){
      if(control.importing)return refuse(name);return stream;
    }});
  }
  Object.defineProperty(binding,'exitCode',{get(){if(control.importing)return refuse('exitCode');return exitCode;},
    set:guard(value=>{assert.equal(control.importing,false);assert.equal(value,1);exitCode=value;events.push('exitCode');})});
  const fs={...reader.fs,fstatSync:guard(fd=>{
    assert.equal(options.body,true);assert.equal(outputs.stdout.listenerCount('error'),1);
    assert.equal(outputs.stderr.listenerCount('error'),1);events.push('receiver fstat');
    const result=reader.fs.fstatSync(fd);
    if(options.duringFstatError===true){events.push('stdout error during fstat');
      outputs.stdout.emit('error',Error('PRIVATE_TASK6_AWAIT_SENTINEL'));}
    return result;
  })};
  const vm=task3VmV1({task5cFixture:true,task6IntegrationModule:true,task6IntegrationControl:control,
    task4cActualFd4Negative:options.body===true,process:binding,fs,net:reader.net,assertClean:reader.assertClean});
  const entry=vm.task6Integration;
  assert.deepEqual(Object.keys(vm.fixtureExports).sort(),[
    'runManualOrphanBootstrapIntegrationV1','runManualOrphanBootstrapRouteV1','runManualOrphanCompiledCliNegativeV1','runManualOrphanSourceContextNegativeV1']);
  assert.equal(vm.fixtureExports.runManualOrphanBootstrapIntegrationV1.length,0);
  assert.equal(entry.actualFixture,vm.fixtureExports);assert.deepEqual(control.fixtureImports,[vm.fixtureExports]);
  assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);assert.deepEqual(events,[]);
  control.importing=false;
  const check=()=>{assert.deepEqual(reads,[]);assert.deepEqual(control.moduleReads,[]);assert.deepEqual(control.forbidden,[]);
    assert.deepEqual(control.assertions,[],'no swallowed integration boundary assertions');
    assert.ok(control.imports.every(specifier=>control.staticImports.includes(specifier)));
    assert.equal(control.registrations.length,1);reader.assertClean();vm.assertContained();
    if(options.body!==true){assert.deepEqual(reader.ledger.fstats,[]);assert.deepEqual(reader.ledger.rawCloses,[]);}
    assert.deepEqual(reader.ledger.constructs,[]);assert.equal(reader.ledger.destroys,0);
  };
  const x={vm,entry,control,reader,outputs,writes,events,check,
    get exitCode(){return exitCode;},get callback(){return callback;},get writeGetterReads(){return writeGetterReads;},
    writer(){const writer=entry.factory();assert.equal(typeof writer,'function');assert.equal(writer.length,1);
      assert.deepEqual(events,['writer stdout','writer stderr']);check();return writer;},
  };check();return x;
}
function task6MarkerDataV1(x){
  // Explicit component DATA, normalized by the real same-realm codec. This is
  // deliberately not obtained by replacing a successful public fixture call.
  const input=x.vm.fixtureLexical.dataFromJson(JSON.stringify(ownedIntegrationData()));
  const encoded=x.vm.actual.encodeManualOrphanIntegrationResultV1(input);
  assert.deepEqual(encoded,Buffer.from(OWN_INTEGRATION_WIRE));
  const data=x.vm.actual.decodeManualOrphanIntegrationResultV1(encoded);task5cFrozenV1(data);
  return {data,encoded};
}
async function task6MarkerPendingV1(x){
  const {data,encoded}=task6MarkerDataV1(x),writer=x.writer(),tracked=trackProbePromiseV1(writer(data));
  await task5bPumpV1();x.check();assert.equal(tracked.outcome,null);assert.equal(x.writes.length,1);
  assert.deepEqual(x.writes[0],Buffer.concat([Buffer.from('MANUAL_ORPHAN_INTEGRATION_RESULT '),encoded]));
  assert.equal(typeof x.callback,'function');return tracked;
}
function task6MarkerRejectedV1(x,outcome){
  x.check();assert.ok(outcome.error instanceof Error);assert.equal(outcome.error.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  assert.equal(Object.hasOwn(outcome,'value'),false);assert.equal(x.exitCode,1);
  assert.ok(x.writes.every(bytes=>!bytes.includes(Buffer.from('PRIVATE_TASK6_'))));
}
async function task6MarkerSuccessfulV1(x){
  const tracked=await task6MarkerPendingV1(x);x.callback();const outcome=await tracked.done;
  x.check();assert.deepEqual(outcome,{value:undefined});assert.equal(x.exitCode,undefined);
  assert.equal(x.vm.timers.length,0,'private marker writer creates no timer');return x.writes[0];
}
async function task6MarkerCaseV1(label,body,options={}){
  const cases=task5bCasesV1(1);await cases.wait(label,async()=>{
    const x=task6IntegrationVmV1(options);try{await body(x);}finally{x.check();}
  });cases.done();
}
async function task6ActualBodyRefusalV1(duringFstatError){
  const x=task6IntegrationVmV1({body:true,duringFstatError});
  try{
    const tracked=trackProbePromiseV1(x.entry.registration.body());const outcome=await tracked.done;x.check();
    assert.ok(outcome.error instanceof Error);
    assert.equal(outcome.error.message,duringFstatError?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED');
    assert.deepEqual(x.reader.ledger.fstats,[4]);assert.deepEqual(x.reader.ledger.rawCloses,[4]);
    assert.deepEqual(x.writes,[]);assert.equal(x.callback,null);assert.equal(x.writeGetterReads,0);
    const expected=['writer stdout','writer stderr','receiver fstat'];
    if(duringFstatError)expected.push('stdout error during fstat','exitCode');
    expected.push('fixture stdout','fixture stderr');assert.deepEqual(x.events,expected);
    assert.equal(x.exitCode,duringFstatError?1:undefined);
    assert.equal(x.vm.timers.length,1);assert.equal(x.vm.timers[0].delay,300000);
    assert.deepEqual(x.vm.cleared,[x.vm.timers[0].handle]);
    for(const name of ['stdout','stderr'])assert.equal(x.outputs[name].listenerCount('error'),2);
  }finally{x.check();}
}

// Break: eager IO, extra registrations/imports or a parallel/skipped body.
test('Task6 integration module registers one inert sequential test',async()=>{
  await task6MarkerCaseV1('actual full module registration only',async x=>{
    assert.equal(x.entry.registration.title,'manual orphan bootstrap v1 preserves old entry and refuses maintenance source');
    assert.deepEqual(task5cPlainV1(x.entry.registration.options),{concurrency:false});
    assert.deepEqual(x.events,[]);assert.deepEqual(x.writes,[]);assert.equal(x.callback,null);
    assert.deepEqual(x.reader.ledger.fstats,[]);assert.equal(x.vm.timers.length,0);
    for(const name of ['stdout','stderr'])assert.equal(x.outputs[name].listenerCount('error'),0);
  });
});
// Break: losing actual FD4 refusal or output uncertainty while real fixture awaits.
test('Task6 integration body preserves actual raw FD4 refusal',async()=>{
  const cases=task5bCasesV1(2);
  await cases.wait('actual nonpipe FD4 yields OWNER',()=>task6ActualBodyRefusalV1(false));
  await cases.wait('original stdout error during actual fstat dominates OWNER',()=>task6ActualBodyRefusalV1(true));
  cases.done();
});
// Break: registry omission/additional owner, or reserved raw dispatch admission.
test('Task6 owner registry adds the reserved integration without raw admission',()=>{
  const cases=task5bCasesV1(1);cases.run('complete literal 44 membership and actual explicit refusal',()=>{
    assert.equal(TASK6_EXPECTED_OWNER_FILES_V1.length,44);assert.equal(new Set(TASK6_EXPECTED_OWNER_FILES_V1).size,44);
    assert.equal(OWNER_FILES.length,44,'new owner registration contract (not an existing production bug)');
    assert.equal(new Set(OWNER_FILES).size,44);
    assert.deepEqual([...OWNER_FILES].sort(),[...TASK6_EXPECTED_OWNER_FILES_V1].sort());
    const c=runWrapperSourceV1([FILE],[...TASK6_EXPECTED_OWNER_FILES_V1]);
    assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);assert.equal(c.stdout,'');assert.equal(c.stderr,'');
  });cases.done();
});
// Break: default selection must retain every ordinary owner without dispatching the constructor-only integration.
test('Task6 owner discovery defaults to all ordinary owners without the reserved integration',()=>{
  const cases=task5bCasesV1(1);cases.run('actual no-args complete ordinary owner dispatch',()=>{
    const c=runWrapperSourceV1([],[...TASK6_EXPECTED_OWNER_FILES_V1]);
    pr305AssertDispatchV1(c,pr305OrdinaryOwnerSpawnsV1());
  });cases.done();
});

// Break: producer bytes diverge from codec, or collector credits missing closes.
test('Task6 marker DATA matches the actual codec and integration collector',async()=>{
  await task6MarkerCaseV1('producer and observer DATA simulation with actual original joins',async x=>{
    const marker=await task6MarkerSuccessfulV1(x),f=task3EventFixtureV1('integration');
    const w=x.vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
    try{
      f.child.emit('spawn');f.channels.stdout.emit('data',Buffer.concat([marker,Buffer.from(task5aReportV1())]));
      task5aIntegrationV1(w,'pending');
      for(const name of ['stdout','stderr']){f.channels[name].emit('end');f.channels[name].emit('close');}
      f.channels.fd4.emit('finish');f.channels.fd4.emit('end');f.child.emit('exit',0,null);f.child.emit('close',0,null);
      const before=w.snapshot().state;f.channels.fd4.emit('close');await w.settled;
      assert.equal(before,'pending');task5aAcceptedV1(w);
      assert.equal(x.vm.timers.length,1);assert.deepEqual(x.vm.cleared,[x.vm.timers[0].handle]);
    }finally{f.assertGuarded();x.check();}
  });
});
// Break: limiting JSON payload instead of the entire prefixed UTF-8 marker line.
test('Task6 marker whole line cap rejects oversized DATA before write',async()=>{
  await task6MarkerCaseV1('nonprotocol DATA exceeds whole-line cap only',async x=>{
    const data={padding:'x'.repeat(16360)},payload=Buffer.from(JSON.stringify(data)+'\n');
    assert.ok(payload.length<=16384);assert.ok(payload.length+Buffer.byteLength('MANUAL_ORPHAN_INTEGRATION_RESULT ')>16384);
    const writer=x.writer(),outcome=await trackProbePromiseV1(writer(data)).done;
    task6MarkerRejectedV1(x,outcome);assert.deepEqual(x.writes,[]);assert.equal(x.callback,null);
  });
});
// Break: completion/retry before the one original write callback.
test('Task6 marker retains the original pending write callback',async()=>{
  await task6MarkerCaseV1('withheld original callback remains pending',async x=>{
    const tracked=await task6MarkerPendingV1(x),original=x.callback;await task5bPumpV1();
    const pending=tracked.outcome===null;original();const outcome=await tracked.done;
    assert.equal(pending,true);assert.deepEqual(outcome,{value:undefined});assert.equal(x.callback,original);
    assert.equal(x.writes.length,1);assert.equal(x.vm.timers.length,0);assert.equal(x.exitCode,undefined);
  });
});
// Break: raw callback error leakage or retry after uncertain original output.
test('Task6 marker callback error is fixed and never retried',async()=>{
  await task6MarkerCaseV1('original callback error',async x=>{
    const tracked=await task6MarkerPendingV1(x);x.callback(Error('PRIVATE_TASK6_CALLBACK_SENTINEL'));
    task6MarkerRejectedV1(x,await tracked.done);assert.equal(x.writes.length,1);
  });
});
// Break: an invocation throw fabricates callback settlement or retries output.
test('Task6 marker invocation throw retains its original callback',async()=>{
  await task6MarkerCaseV1('throw after acquiring original callback obligation',async x=>{
    const tracked=await task6MarkerPendingV1(x);await task5bPumpV1();const pending=tracked.outcome===null;
    x.callback();const outcome=await tracked.done;assert.equal(pending,true);
    task6MarkerRejectedV1(x,outcome);assert.equal(x.writes.length,1);
  },{writeThrow:true});
});
// Break: stdout error settles pending output without its original callback.
test('Task6 marker original stdout error rejects pending output',async()=>{
  await task6MarkerCaseV1('original stdout error while original callback pending',async x=>{
    const tracked=await task6MarkerPendingV1(x);x.outputs.stdout.emit('error',Error('PRIVATE_TASK6_STDOUT_SENTINEL'));
    await task5bPumpV1();const pending=tracked.outcome===null;x.callback();const outcome=await tracked.done;
    assert.equal(pending,true);task6MarkerRejectedV1(x,outcome);assert.equal(x.writes.length,1);
  });
});
// Break: callback success masks a synchronous fault before async continuation.
test('Task6 marker original stderr error wins before continuation',async()=>{
  await task6MarkerCaseV1('stderr error after callback before continuation',async x=>{
    const tracked=await task6MarkerPendingV1(x);x.callback();x.outputs.stderr.emit('error',Error('PRIVATE_TASK6_STDERR_SENTINEL'));
    task6MarkerRejectedV1(x,await tracked.done);assert.equal(x.writes.length,1);
  });
});
// Break: listener removal loses post-fulfillment local failure signaling. This
// exitCode assertion is not evidence of actual native reporter/process exit.
test('Task6 marker late output error prevents clean process outcome',async()=>{
  await task6MarkerCaseV1('retained stdout listener after writer fulfillment',async x=>{
    await task6MarkerSuccessfulV1(x);x.outputs.stdout.emit('error',Error('PRIVATE_TASK6_LATE_SENTINEL'));
    assert.equal(x.exitCode,1);assert.equal(x.writes.length,1);assert.equal(x.outputs.stdout.listenerCount('error'),1);
    assert.equal(x.outputs.stderr.listenerCount('error'),1);assert.equal(x.vm.timers.length,0);
  });
});
// Break: a duplicate of the SAME original callback is silently accepted late.
test('Task6 marker duplicate original callback remains a late fault',async()=>{
  await task6MarkerCaseV1('same original callback duplicated after fulfillment',async x=>{
    await task6MarkerSuccessfulV1(x);const original=x.callback;original();
    assert.equal(x.exitCode,1);assert.equal(x.callback,original);assert.equal(x.writes.length,1);assert.equal(x.vm.timers.length,0);
  });
});
// Break: actual collector credits any passing title rather than the named test.
test('Task6 marker actual collector rejects the wrong test title',async()=>{
  await task6MarkerCaseV1('actual producer marker plus wrong-title transcript DATA',async x=>{
    const marker=await task6MarkerSuccessfulV1(x),report=task5aReportV1().replace(TASK5A_PASS_NAME_V1,'wrong test title');
    await task5aRefusedTranscriptV1(x.vm,Buffer.concat([marker,Buffer.from(report)]));
  });
});
// Break: actual collector accepts a marker emitted after the named pass line.
test('Task6 marker actual collector rejects reporter before marker',async()=>{
  await task6MarkerCaseV1('named pass line precedes actual producer marker DATA',async x=>{
    const marker=await task6MarkerSuccessfulV1(x),report=task5aReportV1(),split=report.indexOf('\n')+1;
    await task5aRefusedTranscriptV1(x.vm,Buffer.concat([Buffer.from(report.slice(0,split)),marker,Buffer.from(report.slice(split))]));
  });
});
// Break: observer deadline invents writer callback/physical closure. The
// observer and writer have distinct obligations; neither simulates native C.
test('Task6 marker parent observer deadline does not manufacture closure',async()=>{
  await task6MarkerCaseV1('actual observer deadline while original output and channels remain owed',async x=>{
    const tracked=await task6MarkerPendingV1(x),f=task3EventFixtureV1('integration'),closed=[];
    for(const name of ['stdout','stderr','fd4'])f.channels[name].on('close',()=>closed.push(name));
    f.child.on('close',()=>closed.push('child'));
    const w=x.vm.actual.observeManualOrphanOwnedIntegrationChildV1(f.child);
    try{
      f.channels.stdout.emit('data',Buffer.concat([x.writes[0],Buffer.from(task5aReportV1())]));
      assert.equal(x.vm.timers.length,1);assert.equal(x.vm.timers[0].delay,300000);
      x.vm.monotonic.state.ms=300000;x.vm.timers[0].callback();await task5bPumpV1();
      const pending=tracked.outcome===null,physicalBefore=[...closed],deadline=w.snapshot();
      x.callback();const output=await tracked.done;task3CompleteV1(f,'integration');const history=await w.settled;
      // Decisive assertions follow the retained original callback and all four
      // physical close emissions; a timeout was never used as a close surrogate.
      assert.equal(pending,true);assert.deepEqual(physicalBefore,[]);assert.deepEqual(output,{value:undefined});
      assert.deepEqual(closed,['stdout','stderr','fd4','child']);assert.equal(deadline.state,'unknown');
      assert.equal(deadline.reason,'deadline');assert.equal(history.state,'unknown');task5aIntegrationV1(w,'refused');
      assert.equal(w.snapshot().state,'unknown');assert.deepEqual(x.vm.cleared,[x.vm.timers[0].handle]);
    }finally{f.assertGuarded();x.check();}
  });
});
// Break: builtin serialization failure leaks raw DATA or attempts output.
test('Task6 marker serialization failure is sanitized before write',async()=>{
  await task6MarkerCaseV1('explicit nonprotocol BigInt DATA',async x=>{
    const writer=x.writer(),outcome=await trackProbePromiseV1(writer({PRIVATE_TASK6_BIGINT_SENTINEL:1n})).done;
    task6MarkerRejectedV1(x,outcome);assert.deepEqual(x.writes,[]);assert.equal(x.callback,null);
  });
});
// Break: write getter failure acquires a fictitious callback obligation.
test('Task6 marker write getter failure acquires no callback',async()=>{
  await task6MarkerCaseV1('actual stdout write getter fails before invocation',async x=>{
    const {data}=task6MarkerDataV1(x),outcome=await trackProbePromiseV1((async()=>{
      const writer=x.writer();await writer(data);
    })()).done;
    task6MarkerRejectedV1(x,outcome);assert.equal(x.writeGetterReads,1);assert.deepEqual(x.writes,[]);assert.equal(x.callback,null);
    assert.equal(x.vm.timers.length,0);
  },{getterThrow:true});
});

// Task6 complete-path fix1:17 literal registrations/67 finite component cases.
// Missing new private/API surfaces are scaffolding, never native-path RED.
// Actual existing C-negative/R/launch consumers remain separately exercisable.
const TASK6_FIX1_ROOT_V1='/private/tmp/setfarm-task6a-pg.';
function task6Fix1VmV1({fs={},observers=false}={}){
  const reads=[],processBinding={},monotonic=task3ClockV1();
  for(const key of ['env','argv','execArgv','pid','ppid','cwd','stdout','stderr'])
    Object.defineProperty(processBinding,key,{get(){reads.push(key);throw Error('TASK6_FIX1_PROCESS_READ');}});
  const vm=task3VmV1({task5cFixture:true,task6Fix1:true,task5cFiniteObservers:observers,
    fs,process:processBinding,monotonic});
  assert.ok(vm.task6Fix1,'separate fixed Task6 fix1 private exposure');
  assert.deepEqual(Object.keys(vm.task6Fix1),['holdManualOrphanRunnerInstallationsV1','projectManualOrphanInstallationsPinV1']);
  const check=()=>{assert.deepEqual(reads,[]);vm.assertContained();};check();
  return {...vm,api:vm.fixtureLexical,check};
}
function task6Fix1HoldV1(vm){
  const hold=vm.task6Fix1.holdManualOrphanRunnerInstallationsV1;
  assert.equal(typeof hold,'function','missing actual holdManualOrphanRunnerInstallationsV1 (scaffolding only)');
  assert.equal(hold.length,2);return hold;
}
function task6Fix1ProjectV1(vm){
  const project=vm.task6Fix1.projectManualOrphanInstallationsPinV1;
  assert.equal(typeof project,'function','missing actual projectManualOrphanInstallationsPinV1 (scaffolding only)');
  assert.equal(project.length,2);return project;
}
function task6Fix1DirectoryV1({root=TASK6_FIX1_ROOT_V1+'F1',existing=null,createError=null,fault=null}={}){
  const retained=[],calls=[],faults=[],fd=73,pathname=root+'/installations';
  let exists=existing!==null,created=false;
  const error=Object.assign(Error('PRIVATE_TASK6_DIRECTORY_SYSCALL'),{code:createError??'EACCES'});
  const guard=fn=>task5bGuardV1(faults,fn);
  const stat=()=>({dev:3n,ino:73n,uid:fault==='uid'?502n:501n,gid:fault==='gid'?21n:20n,
    mode:fault==='mode'?0o40755n:0o40700n,nlink:2n,size:64n,birthtimeNs:1n,mtimeNs:2n,ctimeNs:3n,
    isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>fault==='symlink'});
  const fs={
    mkdirSync:guard((name,options)=>{
      calls.push(['mkdir',name,task5cPlainV1(options)]);assert.equal(name,pathname);
      assert.deepEqual(task5cPlainV1(options),{mode:0o700,recursive:false});
      if(exists)throw Object.assign(Error('PRIVATE_TASK6_EXISTS'),{code:'EEXIST'});
      if(createError!==null)throw error;exists=true;created=true;
    }),
    realpathSync:guard(name=>{calls.push(['realpath',name]);assert.equal(name,pathname);assert.equal(created,true);
      return fault==='realpath'?pathname+'.changed':pathname;}),
    lstatSync:guard((name,options)=>{calls.push(['lstat',name]);assert.equal(name,pathname);
      assert.deepEqual(task5cPlainV1(options),{bigint:true});assert.equal(created,true);return stat();}),
    openSync:guard((name,flags)=>{calls.push(['open',name,flags]);assert.equal(name,pathname);assert.equal(created,true);
      assert.equal(flags,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
      if(fault==='open')throw error;return fd;}),
    fstatSync:guard((actualFd,options)=>{calls.push(['fstat',actualFd]);assert.equal(actualFd,fd);
      assert.deepEqual(task5cPlainV1(options),{bigint:true});assert.equal(retained.length,1,'retain original FD before held validation');
      assert.equal(retained[0].fd,fd);assert.equal(retained[0].path,pathname);
      assert.equal(retained[0].mutable,true);assert.equal(retained[0].attempted,false);
      const value=stat();if(fault==='held inode')value.ino++;return value;}),
    readdirSync:guard((name,options)=>{calls.push(['readdir',name]);assert.equal(name,pathname);
      assert.deepEqual(task5cPlainV1(options),{withFileTypes:true});assert.equal(retained.length,1);
      assert.ok(calls.some(([op])=>op==='fstat'),'empty check follows actual held validation');
      return fault==='nonempty'?[{name:'unexpected',isDirectory:()=>true,isSymbolicLink:()=>false}]:[];}),
  };
  const vm=task6Fix1VmV1({fs}),hold=task6Fix1HoldV1(vm);
  const check=()=>{assert.deepEqual(faults,[],'no swallowed acquisition seam assertion');vm.check();
    assert.ok(retained.every(row=>row.attempted===false),'component acquisition does not pretend to run C finally');};
  const call=(value=root)=>{try{return hold(value,retained);}finally{check();}};
  return {vm,root,pathname,fd,retained,calls,error,call,check,get created(){return created;},get exists(){return exists;}};
}
// Break: missing creation/pin/empty check cannot reach fresh provision.
test('Task6 fix1 fresh runner creates pins and checks an empty installations parent',()=>{
  const cases=task5bCasesV1(1);cases.run('canonical136-byte physical root',()=>{
    const root=TASK6_FIX1_ROOT_V1+'A'.repeat(136-Buffer.byteLength(TASK6_FIX1_ROOT_V1)),f=task6Fix1DirectoryV1({root});
    assert.equal(Buffer.byteLength(root),136);f.call();assert.equal(f.created,true);assert.equal(f.retained.length,1);
    assert.equal(f.retained[0].fd,73);assert.equal(f.retained[0].path,root+'/installations');
    assert.equal(f.retained[0].initial.dev,3n);assert.equal(f.retained[0].initial.ino,73n);
    assert.equal(f.retained[0].initial.uid,501n);assert.equal(f.retained[0].initial.gid,20n);
    assert.equal(f.retained[0].initial.mode,0o40700n);
    assert.deepEqual(f.calls.filter(([op])=>op==='mkdir'),[['mkdir',f.pathname,{mode:0o700,recursive:false}]]);
    assert.equal(f.calls.filter(([op])=>op==='open').length,1);assert.equal(f.calls.filter(([op])=>op==='readdir').length,1);
    assert.equal(f.calls[0][0],'mkdir');assert.equal(f.calls.at(-1)[0],'readdir');f.check();
  });cases.done();
});
// Break: EEXIST cannot become authority by adoption or permission repair.
test('Task6 fix1 installations preexistence is never adopted',()=>{
  const cases=task5bCasesV1(3);for(const existing of ['directory','file','symlink'])cases.run(existing,()=>{
    const f=task6Fix1DirectoryV1({existing});assert.throws(f.call,error=>error?.code==='EEXIST');
    assert.equal(f.created,false);assert.equal(f.exists,true);assert.deepEqual(f.retained,[]);
    assert.deepEqual(f.calls,[['mkdir',f.pathname,{mode:0o700,recursive:false}]]);f.check();
  });cases.done();
});
// Break: a failed mkdir cannot authorize a subsequent open/read/phase.
test('Task6 fix1 installations creation failure stops acquisition',()=>{
  const cases=task5bCasesV1(3);for(const createError of ['ENOENT','EACCES','EIO'])cases.run(createError,()=>{
    const f=task6Fix1DirectoryV1({createError});assert.throws(f.call,error=>error===f.error);
    assert.equal(f.created,false);assert.deepEqual(f.retained,[]);
    assert.deepEqual(f.calls,[['mkdir',f.pathname,{mode:0o700,recursive:false}]]);f.check();
  });cases.done();
});
// Break: post-open validation must not lose the acquired original FD.
test('Task6 fix1 installations pin failures retain only acquired originals',()=>{
  const cases=task5bCasesV1(8);
  for(const [fault,held] of [['realpath',false],['symlink',false],['uid',true],['gid',true],['mode',true],
    ['open',false],['held inode',true],['nonempty',true]])cases.run(fault,()=>{
    const f=task6Fix1DirectoryV1({fault});assert.throws(f.call);assert.equal(f.created,true);assert.equal(f.exists,true);
    assert.equal(f.retained.length,held?1:0);if(held){assert.equal(f.retained[0].fd,f.fd);assert.equal(f.retained[0].attempted,false);}
    assert.equal(f.calls.filter(([op])=>op==='mkdir').length,1);
    assert.equal(f.calls.filter(([op])=>op==='readdir').length,fault==='nonempty'?1:0);f.check();
  });cases.done();
});
// Break: repeated acquisition must not create a second original or retry mkdir.
test('Task6 fix1 installations repeat cannot acquire twice',()=>{
  const cases=task5bCasesV1(1);cases.run('same actual retained path',()=>{
    const f=task6Fix1DirectoryV1();f.call();const before=JSON.stringify(f.calls),original=f.retained[0];
    assert.throws(f.call);assert.equal(JSON.stringify(f.calls),before,'duplicate retained path refuses before mkdir');
    assert.equal(f.retained.length,1);assert.equal(f.retained[0],original);assert.equal(f.created,true);f.check();
  });cases.done();
});
// Break: scalar path data cannot select an alias, traversal or over-cap parent.
test('Task6 fix1 installations rejects noncanonical derived roots',()=>{
  const cases=task5bCasesV1(3);for(const [name,root] of [['alias','/tmp/setfarm-task6a-pg.F1'],
    ['traversal',TASK6_FIX1_ROOT_V1+'F1/../other'],['overcap',TASK6_FIX1_ROOT_V1+'A'.repeat(137-Buffer.byteLength(TASK6_FIX1_ROOT_V1))]])
    cases.run(name,()=>{const f=task6Fix1DirectoryV1();task5cRefusedV1(()=>f.call(root));assert.deepEqual(f.calls,[]);assert.deepEqual(f.retained,[]);f.check();});
  cases.done();
});

function task6Fix1InputV1(kind='runner',{negative=false}={}){
  const reader=probeReaderFixtureV1(),faults=[],reads=[],envReads=[],accountCalls=[],inputFaults=[],writes=[],outputs={},originals=[];
  const monotonic=task3ClockV1(),binding={};let importing=true,callback=null;
  const guard=fn=>task5bGuardV1(faults,fn);
  for(const key of ['argv','execArgv','pid','ppid','cwd','getuid','geteuid','getgid','getegid','platform','arch','version'])
    Object.defineProperty(binding,key,{get(){reads.push(key);throw Error('TASK6_FIX1_INPUT_PROCESS_READ');}});
  Object.defineProperty(binding,'env',{get(){
    if(importing||!negative){reads.push('env');throw Error('TASK6_FIX1_INPUT_ENV_READ');}
    envReads.push('negative context snapshot');return {};
  }});
  for(const name of ['stdout','stderr']){
    const stream=new EventEmitter(),on=stream.on;
    stream.on=guard((event,listener)=>{assert.equal(event,'error');assert.equal(typeof listener,'function');
      assert.deepEqual(reader.ledger.fstats,[4],'actual inherited read precedes R output listeners');
      return Reflect.apply(on,stream,[event,listener]);});
    stream.write=guard((bytes,done)=>{
      assert.equal(name,'stdout');assert.equal(kind,'runner');assert.equal(negative,false);
      assert.ok(Buffer.isBuffer(bytes));assert.equal(bytes.at(-1),10);assert.equal(typeof done,'function');
      assert.equal(writes.length,0,'one original R write');writes.push(Buffer.from(bytes));callback=done;return true;
    });
    outputs[name]=stream;Object.defineProperty(binding,name,{get(){
      if(importing){reads.push(name);throw Error('TASK6_FIX1_INPUT_IMPORT_OUTPUT');}return stream;}});
  }
  const fault=event=>{
    assert.equal(reader.ledger.closed,true,'late fault follows original physical close');inputFaults.push(event);
    if(event==='error')reader.ledger.socket.emit('error',Error('PRIVATE_TASK6_INPUT_LATE'));
    else if(event==='close')reader.ledger.socket.emit('close',false);
    else {assert.equal(event,'data');reader.ledger.socket.emit('data',Buffer.from('late'));}
  };
  const account=guard((...args)=>{
    assert.equal(negative,true);assert.equal(args.length,0);accountCalls.push('userInfo');assert.equal(accountCalls.length,1);
    assert.deepEqual(reader.ledger.fstats,[4]);assert.equal(reader.ledger.closed,true);
    fault('error');return {homedir:'/component/nonrelease',uid:502,gid:20};
  });
  const vm=task3VmV1({task5cFixture:true,task5cFiniteObservers:true,task6CompletionLifetime:true,
    task4cActualFd4Negative:true,task6InputNegativeV1:negative,task6InputNegativeAccountV1:account,
    fs:reader.fs,net:reader.net,assertClean:reader.assertClean,process:binding,monotonic});importing=false;reader.task3Vm=vm;
  const fix1=vm.fixtureFix1Lexical;
  assert.equal(typeof fix1.retainManualOrphanFixtureCompletionV1,'function');
  assert.equal(typeof fix1.retainManualOrphanOriginalChildLifetimeV1,'function');
  assert.equal(typeof vm.task6CompletionChild,'function');
  const check=()=>{assert.deepEqual(reads,[]);assert.deepEqual(faults,[],'no swallowed current-input adapter assertion');
    if(!negative){assert.deepEqual(envReads,[]);assert.deepEqual(accountCalls,[]);}
    reader.assertClean();vm.assertContained();for(const original of originals)original.f.assertGuarded();};
  const x={...vm,vm,reader,kind,fix1,api:vm.fixtureLexical,register:vm.task6CompletionChild,originals,
    writes,outputs,accountCalls,envReads,inputFaults,fault,check,completion:null,
    start(){assert.equal(x.input,undefined);x.input=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1(kind));return x.input;},
    retain(){assert.equal(x.completion,null);x.completion=fix1.retainManualOrphanFixtureCompletionV1(kind);return x.completion;},
    finishInput(){task3FinishReadV1(reader,kind==='runner'?Buffer.from(OWN_SETUP_WIRE):task3WireV1('integration'));},
    callback(){assert.equal(typeof callback,'function','one actual pending output callback');const original=callback;callback=null;original(null);check();},
    get callbackPending(){return callback!==null;},
  };check();return x;
}
async function task6Fix1ReadyInputV1(kind='runner'){
  const x=task6Fix1InputV1(kind);x.start();x.retain();x.finishInput();
  const result=await x.input.done;assert.equal(Object.hasOwn(result,'error'),false);x.check();return x;
}
function task6Fix1ObservationV1(vm){
  const observe=vm.actual.observeManualOrphanOwnedFd4V1;
  assert.equal(typeof observe,'function','missing observeManualOrphanOwnedFd4V1 (scaffolding only)');
  assert.equal(observe.length,0);return observe;
}
function task6Fix1InputFactsV1(value,expected){
  assert.deepEqual(Object.keys(value),['claimed','adopted','closed','unknown']);assert.equal(Object.isFrozen(value),true);
  for(const field of Object.keys(value))assert.equal(typeof value[field],'boolean');
  assert.deepEqual(task5cPlainV1(value),expected);
}
// Break: observation must not reserve/mutate a claim or add any IO/clock read.
test('Task6 fix1 inherited input observation is fixed read only boolean DATA',async()=>{
  const cases=task5bCasesV1(5);
  cases.run('unclaimed snapshot',()=>{
    const {f,vm}=task3ReaderV1(),observe=task6Fix1ObservationV1(vm),before=task3IoV1(f);
    task6Fix1InputFactsV1(observe(),{claimed:false,adopted:false,closed:false,unknown:false});
    assert.deepEqual(task3IoV1(f),before);vm.assertContained();
  });
  await cases.wait('argument refusal does not reserve',async()=>{
    const {f,vm}=task3ReaderV1(),observe=task6Fix1ObservationV1(vm),before=task3IoV1(f);let traps=0;
    const argument=new Proxy({},{get(){traps++;throw Error('PRIVATE_TASK6_OBSERVE_ARGUMENT');}});
    task5cRefusedV1(()=>observe(argument));assert.equal(traps,0);assert.deepEqual(task3IoV1(f),before);
    const input=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));
    assert.equal((await input.done).error,undefined);assert.deepEqual(f.ledger.fstats,[4]);vm.assertContained();
  });
  await cases.wait('pending actual reader',async()=>{
    const {f,vm}=task3ReaderV1(),observe=task6Fix1ObservationV1(vm),input=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    const before=task3IoV1(f),facts=observe(),after=task3IoV1(f);task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));await input.done;
    task6Fix1InputFactsV1(facts,{claimed:true,adopted:true,closed:false,unknown:false});assert.deepEqual(after,before);vm.assertContained();
  });
  await cases.wait('settled actual reader',async()=>{
    const {f,vm}=task3ReaderV1(),observe=task6Fix1ObservationV1(vm),input=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));assert.equal((await input.done).error,undefined);
    const before=task3IoV1(f);task6Fix1InputFactsV1(observe(),{claimed:true,adopted:true,closed:true,unknown:false});
    assert.deepEqual(task3IoV1(f),before);vm.assertContained();
  });
  await cases.wait('detached frozen snapshots',async()=>{
    const {f,vm}=task3ReaderV1(),observe=task6Fix1ObservationV1(vm),input=trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner'));
    task3FinishReadV1(f,Buffer.from(OWN_SETUP_WIRE));await input.done;const first=observe(),second=observe();assert.notEqual(first,second);
    assert.equal(Reflect.set(first,'unknown',true),false);f.ledger.socket.emit('error',Error('PRIVATE_TASK6_LATE_OBSERVATION'));
    task6Fix1InputFactsV1(first,{claimed:true,adopted:true,closed:true,unknown:false});
    task6Fix1InputFactsV1(observe(),{claimed:true,adopted:true,closed:true,unknown:true});
    assert.equal(await input.done,input.outcome,'historical promise outcome remains the same object');vm.assertContained();
  });cases.done();
});
// Break: read-only current facts must preserve known raw close versus uncertainty.
test('Task6 fix1 inherited input observation preserves raw close certainty',async()=>{
  const cases=task5bCasesV1(2);for(const rawCloseError of [false,true])await cases.wait(String(rawCloseError),async()=>{
    const {f,vm}=task3ReaderV1({kind:'file',rawCloseError}),observe=task6Fix1ObservationV1(vm);
    await assertProbeRejectedV1(trackProbePromiseV1(vm.actual.readManualOrphanOwnedFd4V1('runner')),
      rawCloseError?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED');
    const before=task3IoV1(f);task6Fix1InputFactsV1(observe(),{claimed:true,adopted:false,closed:!rawCloseError,unknown:rawCloseError});
    assert.deepEqual(task3IoV1(f),before);assert.deepEqual(f.ledger.rawCloses,[4]);assert.deepEqual(f.ledger.constructs,[]);vm.assertContained();
  });cases.done();
});
// Break: a current observation cannot reexpire a timely completed five-second read.
test('Task6 fix1 timely inherited input does not reexpire during owner work',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('timely read then6000ms owner work',async()=>{
    const x=task6Fix1InputV1(),observe=task6Fix1ObservationV1(x);x.start();x.retain();x.finishInput();await x.input.done;
    x.monotonic.state.ms=6000;const before=task3IoV1(x.reader);
    task6Fix1InputFactsV1(observe(),{claimed:true,adopted:true,closed:true,unknown:false});assert.deepEqual(task3IoV1(x.reader),before);
    x.completion.check();assert.equal(x.completion.current().unknown,false);x.completion.finish(false);
    assert.equal(x.completion.current().finished,true);assert.equal(x.writes.length,0);x.check();
  });cases.done();
});
// Break: fulfilled input promise cannot hide a retained error during real C refusal.
test('Task6 fix1 retained input fault dominates actual TS context refusal',async()=>{
  const cases=task5bCasesV1(2);for(const kind of ['runner','integration'])await cases.wait(kind,async()=>{
    const x=task6Fix1InputV1(kind,{negative:true});
    const run=kind==='runner'?x.fixtureExports.runManualOrphanBootstrapRouteV1:x.fixtureExports.runManualOrphanBootstrapIntegrationV1;
    assert.equal(typeof run,'function');assert.equal(run.length,0);
    const tracked=trackProbePromiseV1(run());x.finishInput();const result=await tracked.done;x.check();
    assert.deepEqual(x.accountCalls,['userInfo']);assert.deepEqual(x.envReads,['negative context snapshot']);
    assert.deepEqual(x.inputFaults,['error']);assert.deepEqual(x.writes,[]);assert.equal(x.callbackPending,false);
    assert.deepEqual(x.reader.ledger.fstats,[4]);assert.deepEqual(x.reader.ledger.rawCloses,[]);
    assert.equal(x.reader.ledger.constructs.length,1);assert.equal(x.reader.ledger.destroys,1);
    assert.deepEqual(x.timers.map(timer=>timer.delay),[5000,kind==='runner'?840000:300000]);
    assert.equal(x.cleared.length,2);assert.ok(x.timers.every(timer=>x.cleared.includes(timer.handle)));
    task6RefusalV1(result,'late inherited uncertainty dominates actual conservative context refusal');
  });cases.done();
});
// Break: input uncertainty burns R but must still sample every retained actual Q.
test('Task6 fix1 current input faults stop actual completion work',async()=>{
  const cases=task5bCasesV1(3);for(const event of ['error','close','data'])await cases.wait(event,async()=>{
    const x=await task6Fix1ReadyInputV1();await task6ClosedOriginalV1(x);await task6ClosedOriginalV1(x,'activate');
    x.fault(event);const before=x.monotonic.state.calls,facts=x.completion.current(),sampleCalls=x.monotonic.state.calls-before;
    assert.ok(sampleCalls>=3,'both actual Q witnesses and R clock are sampled despite input uncertainty');
    assert.equal(facts.unknown,true);task5cRefusedV1(()=>x.completion.check(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    await assertProbeRejectedV1(trackProbePromiseV1(x.completion.write(Buffer.from(OWN_RUNNER_WIRE))),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.deepEqual(x.writes,[]);task5cRefusedV1(()=>x.completion.finish(false),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');x.check();
  });cases.done();
});
// Break: unknown input cannot settle an already-invoked original write callback.
test('Task6 fix1 late input fault joins pending original output callback',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('late error while original callback pending',async()=>{
    const x=await task6Fix1ReadyInputV1(),tracked=trackProbePromiseV1(x.completion.write(Buffer.from(OWN_RUNNER_WIRE)));
    await task5bPumpV1();assert.equal(x.callbackPending,true);x.fault('error');await task5bPumpV1();
    const before=x.completion.current(),pending=tracked.outcome===null;
    x.callback();const outcome=await tracked.done;const finish=task6CaptureV1(()=>x.completion.finish(false));x.check();
    assert.equal(pending,true);assert.equal(before.writePending,true);assert.equal(before.unknown,true);
    task6RefusalV1(outcome,'actual original callback settles UNKNOWN');task6RefusalV1(finish);
    assert.equal(x.writes.length,1);assert.equal(x.callbackPending,false);assert.equal(x.completion.current().writeSettled,true);
  });cases.done();
});
// Break: the final pre/post-release sample must include the actual inherited claim.
test('Task6 fix1 inherited input remains current through final finish sample',async()=>{
  const cases=task5bCasesV1(2);
  await cases.wait('integration before finish',async()=>{
    const x=await task6Fix1ReadyInputV1('integration');x.fault('error');
    const outcome=task6CaptureV1(()=>x.completion.finish(true));x.check();task6RefusalV1(outcome);
    assert.equal(x.completion.current().finished,true);assert.deepEqual(x.writes,[]);
  });
  await cases.wait('runner fault during final timer release',async()=>{
    const x=await task6Fix1ReadyInputV1(),tracked=trackProbePromiseV1(x.completion.write(Buffer.from(OWN_RUNNER_WIRE)));
    x.callback();assert.deepEqual(await tracked.done,{value:undefined});
    const timer=x.timers.find(item=>item.delay===840000),push=x.cleared.push,faults=[];assert.ok(timer);
    Object.defineProperty(x.cleared,'push',{value:task5bGuardV1(faults,(...args)=>{
      assert.deepEqual(args,[timer.handle]);const result=Reflect.apply(push,x.cleared,args);x.fault('error');return result;
    }),configurable:true});
    const outcome=task6CaptureV1(()=>x.completion.finish(true));assert.deepEqual(faults,[]);x.check();task6RefusalV1(outcome);
    assert.equal(x.completion.current().finished,true);assert.equal(x.writes.length,1);assert.equal(x.callbackPending,false);
  });cases.done();
});

// Break: phase identity must come from the actual held pre-spawn mutable row.
test('Task6 fix1 phase installations identity comes from the retained mutable pin',()=>{
  const cases=task5bCasesV1(5);for(const stage of ['provision','activate','integration','old_entry_positive','new_entry_refusal'])
    cases.run(stage,()=>{
      const f=task5cPinFixtureV1(stage),vm=task6Fix1VmV1(),project=task6Fix1ProjectV1(vm);
      const directory=task5bDerivedV1().installationsDirectory,row=f.pins.mutable.find(item=>item.path===directory);
      assert.ok(row);const before=JSON.stringify(f.pins),clock=vm.monotonic.state.calls;
      const value=project(f.pins,directory);assert.equal(Object.isFrozen(value),true);
      assert.deepEqual(Object.keys(value),['dev','ino','uid','gid','mode']);
      assert.deepEqual(task5cPlainV1(value),{dev:'1',ino:row.identity.ino,uid:501,gid:20,mode:0o700});
      assert.equal(JSON.stringify(f.pins),before);assert.equal(vm.monotonic.state.calls,clock);
      assert.deepEqual(f.calls,[]);f.check();vm.check();
    });cases.done();
});
// Break: held projection cannot add a post-ps filesystem read or third G pass.
test('Task6 fix1 held installations projection preserves exact delivery passes',async()=>{
  const cases=task5bCasesV1(5);
  await cases.wait('projection then actual two-pass G',async()=>{
    const vm=task6Fix1VmV1(),project=task6Fix1ProjectV1(vm),f=task5cWriterV1();
    try{
      const directory=task5bDerivedV1().installationsDirectory;
      f.frame.installations=project(f.pins.pins,directory);assert.deepEqual(f.pins.calls,[]);
      f.call();assert.equal(f.calls.length,1);assert.equal(f.pins.calls.length,4*(25+3));
      for(const row of [...f.pins.pins.source,...f.pins.pins.mutable]){
        assert.equal(f.pins.calls.filter(([op,value])=>op==='lstat'&&value===row.path).length,2);
        assert.equal(f.pins.calls.filter(([op,value])=>op==='fstat'&&value===row.fd).length,2);
      }
      assert.deepEqual(task5cPlainV1(vm.actual.decodeManualOrphanOwnedPhaseFrameV1(f.calls[0])).installations,
        task5cPlainV1(f.frame.installations));f.check();vm.check();
    }finally{await f.finish();}
  });
  for(const [name,mutate] of [
    ['missing row',(pins,row)=>{pins.mutable.splice(pins.mutable.indexOf(row),1);}],
    ['duplicate row',(pins,row)=>{pins.mutable.push({...row});}],
    ['wrong policy/kind',(_pins,row)=>{row.kind='file';row.policy='immutable-file';}],
    ['malformed identity',(_pins,row)=>{row.identity.dev='not-decimal';}],
  ])cases.run(name,()=>{
    const f=task5cPinFixtureV1('provision'),vm=task6Fix1VmV1(),project=task6Fix1ProjectV1(vm);
    const directory=task5bDerivedV1().installationsDirectory,row=f.pins.mutable.find(item=>item.path===directory);
    assert.ok(row);mutate(f.pins,row);task5cRefusedV1(()=>project(f.pins,directory));
    assert.deepEqual(f.calls,[]);f.check();vm.check();
  });cases.done();
});

function task6Fix1DarwinV1(kind){
  const vm=task5cVmV1(['qualifyManualOrphanFixtureLaunchV1']),cases=task5bCasesV1(11);
  const call=value=>{
    const f=task5cLaunchV1(kind);f.actual.env.__CF_USER_TEXT_ENCODING=value;
    return vm.api.qualifyManualOrphanFixtureLaunchV1(kind,task5cDataV1(vm,f.actual),task5cDataV1(vm,f.frame));
  };
  for(const value of ['0x1F5:0x0:0x0','0x1F5:0xFFFFFFFF:0xFFFFFFFF','0x1F5:0x23:0x18'])
    cases.run('accept '+value,()=>{const result=call(value);task5cFrozenV1(result);assert.equal(result.maintenanceRoot,SOURCE_M_V1);vm.check();});
  for(const [name,value] of [['padding','0x1F5:0x00:0x0'],['lowercase suffix','0x1F5:0x0:0xabc'],
    ['middle overflow','0x1F5:0x100000000:0x0'],['last overflow','0x1F5:0x0:0x100000000'],
    ['lowercase uid','0x1f5:0x0:0x0'],['wrong uid','0x1F4:0x0:0x0'],
    ['terminal LF','0x1F5:0x0:0x0\n'],['nonstring',123]])
    cases.run(name,()=>{task5cRefusedV1(()=>call(value));vm.check();});
  cases.done();vm.check();
}
// Break: runner launch accepts padded/lowercase/overflow Darwin fields.
test('Task6 fix1 runner launch requires canonical Darwin metadata',()=>{
  task6Fix1DarwinV1('runner');
});
// Break: integration launch must enforce the same exact metadata predicate.
test('Task6 fix1 integration launch requires canonical Darwin metadata',()=>{
  task6Fix1DarwinV1('integration');
});

// Final consolidated I1 fix: 16 literal tests / 28 finite cases. Actual L only;
// the C wiring check is explicitly structural. No successful Source/C emulator.
function finalFixAdminV1(){
  const vm=task5cVmV1(['retainManualOrphanRunnerAdminV1','advanceManualOrphanCleanupLedgerV1']);
  const faults=[],trace=[],lookups=[],starts=[],outcomes=[],deferred=[];
  const pair={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:5,usesysid:1};
  const expected={pair,cluster:ownedClusterData(),database:'postgres',databaseOid:5,user:'root',userOid:1};
  const identity={...pair,datid:'5',usesysid:'1',database:'postgres',databaseOid:'5',currentUser:'root',sessionUser:'root',userOid:'1',
    serverAddress:'127.0.0.1',serverPort:55439,systemIdentifier:'123',postmasterStartedAtUTC:'2026-10-21T00:00:00.123456Z',serverVersionNum:'170001'};
  const installation=task5cDataV1(vm,ownedInstallationData(true));
  const commands=['DROP DATABASE "'+installation.databaseName+'"','DROP ROLE "'+installation.runtimeRole+'"','DROP ROLE "'+installation.ownerRole+'"'];
  const f={vm,faults,trace,lookups,starts,outcomes,installation,commands,next:null,endValue:null,lookup:null,releases:0,ends:0,releaseMicrotask:false};
  const guard=body=>task5bGuardV1(faults,body);
  const reserved=guard(()=>assert.fail('no callable reservation query'));
  const unsafe=function(command,...rest){
    try{
    assert.equal(this,reserved,'invoke captured original method with original receiver');assert.deepEqual(rest,[]);
    assert.equal(f.releases,0);assert.equal(f.ends,0);assert.equal(typeof command,'string');
    const mutation=command.startsWith('DROP ');
    if(mutation){assert.equal(command,commands[starts.filter(item=>item.mutation).length],'only next exact generated DROP');}
    else {assert.match(command,/^SELECT\b/);assert.match(command,/pg_backend_pid\s*\(/);assert.match(command,/pg_stat_activity/);
      assert.match(command,/backend_start/);assert.match(command,/datid/);assert.match(command,/usesysid/);
      assert.doesNotMatch(command,/pg_authid|\b(?:DROP|CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE)\b/i);}
    starts.push({command,mutation,ms:vm.monotonic.state.ms});trace.push(mutation?'drop':'select');
    const original=f.next??Promise.resolve(task5cDataV1(vm,mutation?[]:[identity]));f.next=null;
    void original.then(()=>outcomes.push({command,state:'fulfilled'}),()=>outcomes.push({command,state:'rejected'}));return original;
    }catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}
  };
  Object.defineProperty(reserved,'unsafe',{get:guard(()=>{lookups.push(vm.monotonic.state.ms);if(f.lookup)f.lookup();return unsafe;})});
  reserved.release=guard(()=>{assert.equal(++f.releases,1);trace.push('release');queueMicrotask(()=>{f.releaseMicrotask=true;});});
  const pool=guard(()=>assert.fail('no unreserved pool query'));
  Object.defineProperty(pool,'reserve',{get:guard(()=>assert.fail('no reservation reacquisition'))});
  pool.end=guard(options=>{assert.equal(++f.ends,1);assert.equal(f.releases,1);assert.equal(f.releaseMicrotask,false);
    assert.equal(trace.at(-1),'release');trace.push('end');assert.deepEqual(task5cPlainV1(options),{timeout:5});
    return f.endValue??Promise.resolve();});
  const clocks=vm.monotonic.state.calls,timers=vm.timers.length;
  f.admin=vm.api.retainManualOrphanRunnerAdminV1(pool,reserved,task5cDataV1(vm,expected));
  assert.equal(vm.monotonic.state.calls,clocks,'retaining L does not begin cleanup');assert.equal(vm.timers.length,timers);
  assert.deepEqual(Object.keys(f.admin).sort(),['beginCleanup','close','current','endCleanup','onclose','query','stop'],
    'new private cleanup methods: scaffolding RED, not old C semantic execution');
  for(const method of ['beginCleanup','endCleanup']){assert.equal(typeof f.admin[method],'function','missing private cleanup API (scaffolding RED)');assert.equal(f.admin[method].length,0);}
  assert.equal(Object.isFrozen(f.admin),true);
  f.at=ms=>{vm.monotonic.state.ms=ms;};
  f.drops=()=>starts.filter(item=>item.mutation);
  f.timer=()=>{const rows=vm.timers.filter(row=>row.delay===30000);assert.equal(rows.length,1,'one original cleanup timer');return rows[0];};
  f.operation=object=>task5cDataV1(vm,{installation:task5cPlainV1(installation),
    object:{kind:object,name:installation[object==='database'?'databaseName':object==='runtime'?'runtimeRole':'ownerRole'],
      oid:installation[object==='database'?'databaseOid':object==='runtime'?'runtimeOid':'ownerOid']},
    stage:object==='database'?'activated':object==='runtime'?'database-dropped':'runtime-dropped'});
  f.drop=(object='database',operation=f.operation(object))=>f.admin.query('drop-'+object,operation);
  f.read=()=>f.admin.query('identity');
  f.defer=()=>{const d=task5bDeferredV1(),item={settled:false,promise:d.promise,
    resolve(value){assert.equal(item.settled,false);item.settled=true;d.resolve(value);},
    reject(error){assert.equal(item.settled,false);item.settled=true;d.reject(error);}};deferred.push(item);return item;};
  f.check=()=>{assert.deepEqual(faults,[],'no caught finite client assertion');vm.check();
    const current=f.admin.current();assert.deepEqual(Object.keys(current).sort(),['closed','endAttempted','pair','pending','releaseAttempted','stopped','unknown']);
    assert.deepEqual(task5cPlainV1(current.pair),pair);assert.equal(current.releaseAttempted,f.releases===1);assert.equal(current.endAttempted,f.ends===1);
    assert.equal(Object.isFrozen(current),true);assert.ok(f.releases<=1&&f.ends<=1);};
  f.finish=async()=>{
    // Only finite simulated originals; ensure failed assertions cannot leave the
    // harness's deferred promises unjoined. This is not an acceptance outcome.
    vm.monotonic.state.mode=null;
    for(const d of deferred)if(!d.settled)d.resolve(task5cDataV1(vm,[identity]));
    try{await f.admin.close();}catch(error){assert.equal(error?.message,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');}
    await task5bPumpV1();assert.equal(f.admin.current().pending,false);assert.equal(f.releases,1);assert.equal(f.ends,1);f.check();
  };
  return f;
}
async function finalFixAckAbsenceV1(f,ledger,object){
  await f.drop(object);assert.equal(f.outcomes.at(-1).state,'fulfilled','only original fulfillment supplies ACK');
  const ack=task5cCleanupAdvanceV1(f.vm,ledger,object+'-ack');assert.equal(ack.state,ledger.state);
  await f.read(); // Finite SELECT boundary, not successful catalog qualification.
  const absent=task5cCleanupAdvanceV1(f.vm,ack,object+'-absent');assert.equal(absent.state,object+'-dropped');
  return absent;
}
function finalFixTimerPushV1(f,collection,body){
  const own=Object.getOwnPropertyDescriptor(collection,'push'),push=collection.push;
  Object.defineProperty(collection,'push',{configurable:true,value:task5bGuardV1(f.faults,(...args)=>body(push,args))});
  return ()=>{if(own)Object.defineProperty(collection,'push',own);else delete collection.push;};
}
// Break: merely retaining L must not create a cleanup lifetime or public API.
test('Final fix I1 cleanup interval is private and inert',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('unarmed readonly client',async()=>{const f=finalFixAdminV1();try{
    assert.equal(f.vm.monotonic.state.calls,0);assert.equal(f.vm.timers.length,0);await f.read();await f.admin.close();
    assert.equal(f.admin.current().closed,true);assert.equal(f.admin.current().unknown,false);
    assert.equal(f.vm.timers.filter(row=>row.delay===30000).length,0);assert.equal(f.drops().length,0);
    assert.deepEqual(Object.keys(f.vm.fixtureExports).sort(),['runManualOrphanBootstrapIntegrationV1','runManualOrphanBootstrapRouteV1',
      'runManualOrphanCompiledCliNegativeV1','runManualOrphanSourceContextNegativeV1']);
  }finally{await f.finish();}});cases.done();
});
// Break: resetting origin per DROP or reordering ACK/absence would evade 30s.
test('Final fix I1 healthy cleanup keeps one origin and ordered ACKs',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('one origin through all stages',async()=>{const f=finalFixAdminV1();try{
    f.at(10);f.admin.beginCleanup();const timer=f.timer();let ledger=task5cDataV1(f.vm,task5cCleanupLedgerV1());
    for(const [object,ms] of [['database',20],['runtime',10000],['owner',30009]]){
      f.at(ms);ledger=await finalFixAckAbsenceV1(f,ledger,object);assert.equal(ledger.unknown,false);
    }
    assert.equal(ledger.state,'owner-dropped');assert.deepEqual(f.drops().map(row=>row.command),f.commands);
    assert.deepEqual(f.drops().map(row=>row.ms),[20,10000,30009]);assert.equal(f.timer(),timer);
    f.admin.endCleanup();assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);
    await f.admin.close();assert.equal(f.admin.current().closed,true);assert.equal(f.admin.current().unknown,false);
  }finally{await f.finish();}});cases.done();
});
// Break: >= cutoff must fail even when the timer task has never run.
test('Final fix I1 exact cleanup cutoff refuses mutation',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('strict elapsed equality',async()=>{const f=finalFixAdminV1();try{
    f.at(10);f.admin.beginCleanup();f.at(30009.999);assert.equal(f.admin.current().unknown,false);
    f.at(30010);await task5cRejectedV1(f.drop());assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);
    f.at(30011);await task5cRejectedV1(f.drop());assert.equal(f.drops().length,0);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: C's current observation must see time spent after an awaited SELECT.
test('Final fix I1 postcatalog current check catches synchronous crossing',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('actual current after finite SELECT',async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();f.at(29999);await f.read();assert.equal(f.admin.current().unknown,false);
    f.at(30000);assert.equal(f.admin.current().unknown,true,'actual current used by C sees synchronous elapsed time');
    await task5cRejectedV1(f.drop());assert.equal(f.drops().length,0);assert.equal(f.starts.length,1);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: a check before query cannot cover its deferred validation work.
test('Final fix I1 deferred DROP validation rechecks cleanup time',async()=>{
  const cases=task5bCasesV1(2);
  for(const mode of ['deferred continuation','record getter'])await cases.wait(mode,async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();f.at(29999);assert.equal(f.admin.current().unknown,false);const operation=f.operation('database');let reads=0;
    if(mode==='record getter'){
      const value=operation.installation.records['activated.json'];
      Object.defineProperty(operation.installation.records,'activated.json',{enumerable:true,get(){reads++;f.at(30000);return value;}});
    }
    const pending=f.drop('database',operation);if(mode==='deferred continuation')f.at(30000);
    await task5cRejectedV1(pending);if(mode==='record getter')assert.ok(reads>0,'actual validation must reach the getter');
    assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: method acquisition after the last sample leaves another effect gap.
test('Final fix I1 unsafe method lookup cannot cross cleanup cutoff',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('capture then sample then invoke',async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();f.at(29999);assert.equal(f.admin.current().unknown,false);
    f.lookup=()=>{f.at(30000);};await task5cRejectedV1(f.drop());
    assert.deepEqual(f.lookups,[29999]);assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: earlier acknowledged progress must not reset or overrule expiry.
test('Final fix I1 prior ACK never permits a later expired DROP',async()=>{
  const cases=task5bCasesV1(2);
  for(const count of [1,2])await cases.wait('after '+count+' acknowledged stages',async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();let ledger=task5cDataV1(f.vm,task5cCleanupLedgerV1());
    for(const object of ['database','runtime'].slice(0,count)){f.at(100);ledger=await finalFixAckAbsenceV1(f,ledger,object);}
    assert.equal(ledger.state,count===1?'database-dropped':'runtime-dropped');f.at(30000);
    await task5cRejectedV1(f.drop(count===1?'runtime':'owner'));assert.equal(f.drops().length,count);
    assert.deepEqual(f.drops().map(row=>row.command),f.commands.slice(0,count));assert.equal(f.admin.current().unknown,true);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: uncertainty must not manufacture settlement or race original close.
test('Final fix I1 expired cleanup retains pending original outcomes',async()=>{
  const cases=task5bCasesV1(2);
  for(const outcome of ['fulfill after elapsed sample','reject after timer'])await cases.wait(outcome,async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();f.at(29999);const d=f.defer();f.next=d.promise;
    const query=trackProbePromiseV1(f.drop());await task5bPumpV1();assert.equal(f.drops().length,1);assert.equal(f.outcomes.length,0);
    f.at(30000);if(outcome==='reject after timer')f.timer().callback();
    assert.equal(f.admin.current().unknown,true);assert.equal(f.admin.current().pending,true);assert.equal(query.outcome,null);
    const close=trackProbePromiseV1(f.admin.close());await task5bPumpV1();
    assert.equal(close.outcome,null);assert.equal(query.outcome,null);assert.equal(f.releases,0);assert.equal(f.ends,0);assert.equal(f.outcomes.length,0);
    await task5cRejectedV1(f.drop('runtime'));assert.equal(f.drops().length,1);
    if(outcome==='reject after timer')d.reject(Error('FINITE_ORIGINAL_DROP_REJECTION'));else d.resolve(task5cDataV1(f.vm,[]));
    await assertProbeRejectedV1(query,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');await assertProbeRejectedV1(close,'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.outcomes.length,1);assert.equal(f.outcomes[0].state,outcome==='reject after timer'?'rejected':'fulfilled');
    assert.deepEqual(f.trace,['drop','release','end']);assert.equal(f.admin.current().pending,false);
    assert.equal(f.admin.current().closed,false);assert.equal(f.admin.current().unknown,true);
    assert.equal(f.vm.cleared.filter(handle=>handle===f.timer().handle).length,1);
  }finally{await f.finish();}});cases.done();
});
// Break: valid later readings must not revive a faulted monotonic interval.
test('Final fix I1 cleanup clock faults remain sticky',async()=>{
  const cases=task5bCasesV1(4);
  for(const mode of ['positive backward','negative','invalid','throw'])await cases.wait(mode,async()=>{const f=finalFixAdminV1();try{
    f.at(10);f.admin.beginCleanup();f.at(20);assert.equal(f.admin.current().unknown,false);
    if(mode==='positive backward')f.at(19);else if(mode==='negative')f.at(-1);else f.vm.monotonic.state.mode=mode;
    assert.equal(f.admin.current().unknown,true);f.vm.monotonic.state.mode=null;f.at(21);
    task5cRefusedV1(()=>f.admin.beginCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');await task5cRejectedV1(f.drop());
    assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);f.timer();
  }finally{await f.finish();}});cases.done();
});
// Break: a partial origin/timer acquisition must not become cleanup permission.
test('Final fix I1 partial cleanup acquisition fails closed',async()=>{
  const cases=task5bCasesV1(4);
  for(const mode of ['negative origin','invalid origin','throwing origin','registration throw'])await cases.wait(mode,async()=>{
    const f=finalFixAdminV1();let restore=()=>{};try{
      if(mode==='negative origin')f.at(-1);else if(mode==='invalid origin')f.vm.monotonic.state.mode='invalid';
      else if(mode==='throwing origin')f.vm.monotonic.state.mode='throw';
      else restore=finalFixTimerPushV1(f,f.vm.timers,(push,args)=>{assert.equal(args.length,1);assert.equal(args[0].delay,30000);
        Reflect.apply(push,f.vm.timers,args);throw Error('FINITE_TIMER_REGISTER');});
      task5cRefusedV1(()=>f.admin.beginCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');restore();restore=()=>{};
      f.vm.monotonic.state.mode=null;f.at(1);assert.equal(f.admin.current().unknown,true);
      task5cRefusedV1(()=>f.admin.endCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
      assert.equal(f.vm.cleared.length,0,'no handle returned by failed registration/origin');
      if(mode==='registration throw'){f.timer().callback();assert.equal(f.admin.current().unknown,true);}
      else assert.equal(f.vm.timers.length,0,'origin refusal cannot acquire timer');
      task5cRefusedV1(()=>f.admin.beginCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');await task5cRejectedV1(f.drop());
      assert.equal(f.drops().length,0);assert.equal(f.starts.length,0);
    }finally{restore();await f.finish();}
  });cases.done();
});
// Break: clear failure and time consumed by clear must remain visible.
test('Final fix I1 cleanup discharge faults remain unknown',async()=>{
  const cases=task5bCasesV1(2);
  for(const mode of ['clear throws','clear crosses cutoff'])await cases.wait(mode,async()=>{const f=finalFixAdminV1();let restore=()=>{};try{
    f.admin.beginCleanup();f.at(29999);const timer=f.timer();
    restore=finalFixTimerPushV1(f,f.vm.cleared,(push,args)=>{assert.deepEqual(args,[timer.handle]);
      const value=Reflect.apply(push,f.vm.cleared,args);if(mode==='clear throws')throw Error('FINITE_TIMER_CLEAR');f.at(30000);return value;});
    task5cRefusedV1(()=>f.admin.endCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');restore();restore=()=>{};
    assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);assert.equal(f.admin.current().unknown,true);
    await task5cRejectedV1(f.drop());await task5cRejectedV1(f.admin.close());
    assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);assert.equal(f.drops().length,0);
    assert.equal(f.releases,1);assert.equal(f.ends,1);
  }finally{restore();await f.finish();}});cases.done();
});
// Break: neither an active nor completed attempt may reset the single origin.
test('Final fix I1 cleanup interval cannot be restarted',async()=>{
  const cases=task5bCasesV1(2);
  for(const mode of ['active','ended'])await cases.wait(mode,async()=>{const f=finalFixAdminV1();try{
    f.at(10);f.admin.beginCleanup();const timer=f.timer();f.at(20);if(mode==='ended')f.admin.endCleanup();
    f.at(21);task5cRefusedV1(()=>f.admin.beginCleanup(),'MANUAL_ORPHAN_CLEANUP_UNKNOWN');
    assert.equal(f.timer(),timer);await task5cRejectedV1(f.drop());assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);
  }finally{await f.finish();}});cases.done();
});
// Break: a completed cleanup interval must not re-expire readonly or end work.
test('Final fix I1 ended cleanup does not expire unrelated reads or close',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('distinct later five second operations',async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();const timer=f.timer();f.at(29999);f.admin.endCleanup();f.at(30001);timer.callback();
    assert.equal(f.admin.current().unknown,false);await f.read();const d=f.defer();f.endValue=d.promise;
    const close=trackProbePromiseV1(f.admin.close());await task5bPumpV1();assert.equal(close.outcome,null);f.at(30002);d.resolve();
    assert.deepEqual(await close.done,{value:undefined});assert.equal(f.admin.current().closed,true);assert.equal(f.admin.current().unknown,false);
    assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);assert.equal(f.drops().length,0);
  }finally{await f.finish();}});cases.done();
});
// Break: merely possessing L, or ending cleanup, cannot authorize a new DROP.
test('Final fix I1 DROP requires an active cleanup interval',async()=>{
  const cases=task5bCasesV1(2);
  for(const mode of ['unarmed','ended'])await cases.wait(mode,async()=>{const f=finalFixAdminV1();try{
    if(mode==='ended'){f.admin.beginCleanup();f.admin.endCleanup();}
    await task5cRejectedV1(f.drop());assert.equal(f.drops().length,0);assert.equal(f.admin.current().unknown,true);
    assert.equal(f.vm.timers.filter(row=>row.delay===30000).length,mode==='ended'?1:0);
  }finally{await f.finish();}});cases.done();
});
// Source-only contract evidence: no C/Source owner is invoked or emulated here.
// Break: C omits the shared lifecycle, its final current sample, or finally.
test('Final fix I1 C uses the retained cleanup interval',()=>{
  const cases=task5bCasesV1(1);cases.run('actual C lexical wiring only',()=>{
    const source=readFileSync(TASK5C_FIXTURE_V1,'utf8');
    const ast=ts.createSourceFile('manual-control-orphan-bootstrap-fixture-v1.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
    assert.deepEqual(ast.parseDiagnostics,[]);const owners=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='openManualOrphanFixtureContextV1');
    assert.equal(owners.length,1);const owner=owners[0],text=node=>node.getText(ast),nodes=[];
    const visit=node=>{nodes.push(node);ts.forEachChild(node,visit);};visit(owner.body);
    const calls=name=>nodes.filter(node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text===name);
    const begins=calls('beginCleanup'),ends=calls('endCleanup');assert.equal(begins.length,1,'missing actual C cleanup lifecycle (Source wiring RED)');assert.equal(ends.length,1);
    assert.equal(begins[0].arguments.length,0);assert.equal(ends[0].arguments.length,0);
    assert.equal(text(begins[0].expression.expression),'admin!');assert.equal(text(ends[0].expression.expression),'admin!');
    const tries=nodes.filter(node=>ts.isTryStatement(node)&&node.tryBlock.pos<begins[0].pos&&node.tryBlock.end>begins[0].end);
    tries.sort((a,b)=>(a.end-a.pos)-(b.end-b.pos));assert.ok(tries.length);const cleanup=tries[0];assert.ok(cleanup.finallyBlock);
    assert.ok(ends[0].pos>cleanup.finallyBlock.pos&&ends[0].end<cleanup.finallyBlock.end);
    const loop=cleanup.tryBlock.statements.find(node=>ts.isForOfStatement(node));assert.ok(loop);assert.ok(begins[0].end<loop.pos);
    assert.match(text(loop),/await readRunnerCatalogFactsLocal\(before\);\s*check\(\);/);
    assert.match(text(loop),/await admin!\.query\("drop-"\+object,[\s\S]*?\);\s*localCheck\(\);/);
    assert.match(text(loop),/await readRunnerCatalogFactsLocal\(after\);\s*check\(\);[\s\S]*advanceManualOrphanCleanupLedgerV1/);
    const declaration=name=>{const rows=nodes.filter(node=>ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name);assert.equal(rows.length,1);return rows[0];};
    const sample=declaration('sample'),check=declaration('check'),localCheck=declaration('localCheck');
    assert.match(text(sample),/admin\?\.current\(\)\.unknown/);
    assert.match(text(localCheck),/prepared\?\.assertUnchanged\(\);activation\?\.assertUnchanged\(\);sample\(\);\s*}/);
    assert.match(text(check),/localCheck\(\);\s*holder\?\.check\(\);\s*localCheck\(\);/);
    assert.doesNotMatch(text(owner),/\bcleanupStart\b|\bcleanupTimer\b/);
    assert.doesNotMatch(text(cleanup),/process\.hrtime|setTimeout\(burn,30000\)/);
    const closing=nodes.filter(node=>ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='closeSql'
      &&node.pos>cleanup.end);assert.ok(closing.length);assert.ok(closing[0].pos>cleanup.finallyBlock.end);
    assert.match(text(cleanup.tryBlock),/readRunnerCatalogFactsLocal\("owner-dropped"\)[\s\S]*setTimeout\(yes,100\)[\s\S]*readRunnerCatalogFactsLocal\("owner-dropped"\)/);
  });cases.done();
});
// Break: close must discharge an unended interval before its separate end wait.
test('Final fix I1 close discharges an unfinished cleanup interval once',async()=>{
  const cases=task5bCasesV1(1);await cases.wait('fallback discharge precedes end',async()=>{const f=finalFixAdminV1();try{
    f.admin.beginCleanup();const timer=f.timer();f.at(29999);const d=f.defer();f.endValue=d.promise;
    const close=trackProbePromiseV1(f.admin.close());await task5bPumpV1();assert.equal(close.outcome,null);
    assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);assert.deepEqual(f.trace,['release','end']);
    f.at(30001);d.resolve();assert.deepEqual(await close.done,{value:undefined});await f.admin.close();
    assert.equal(f.admin.current().closed,true);assert.equal(f.admin.current().unknown,false);
    assert.equal(f.releases,1);assert.equal(f.ends,1);assert.equal(f.vm.cleared.filter(handle=>handle===timer.handle).length,1);
  }finally{await f.finish();}});cases.done();
});

// PR305 default-discovery compatibility
function pr305OrdinaryOwnerSpawnsV1(){
  const files=TASK6_EXPECTED_OWNER_FILES_V1.filter(file=>file!=='manual-control-orphan-bootstrap-v1.integration.test.ts');
  assert.equal(files.length,43);assert.equal(new Set(files).size,43);
  return [...files].sort().map(file=>({
    args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',
      'node','--import','tsx','--test','--test-concurrency=1','tests/execution-attempts/'+file],
    env:{...ENV},
  }));
}
function pr305AssertDispatchV1(c,expected){
  assert.equal(c.thrown,null);assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));
  assert.equal(c.calls.preconditions,0);assert.equal(c.calls.admin,0);
  assert.equal(c.calls.task4,0);assert.equal(c.calls.projection,0);
  assert.equal(c.exitCode,undefined);assert.equal(c.stdout,'');assert.equal(c.stderr,'');
  assert.deepEqual(c.calls.spawn,expected);
  assert.deepEqual(c.environment,{...ENV,SETFARM_PG_URL:'must-be-removed'});
}

test('PR305 default discovery preserves sorted raw batch and all ordinary owners excluding only the genuine basename',()=>{
  const c=runWrapperSourceV1([],[...TASK6_EXPECTED_OWNER_FILES_V1].reverse().concat([
    'zzz-ordinary.test.ts','aaa-ordinary.test.ts',
    'manual-control-orphan-bootstrap-v1.integration.test.ts.bak.test.ts','discovery-notes.txt',
  ]));
  pr305AssertDispatchV1(c,[
    {args:['--import','tsx','--test','tests/execution-attempts/aaa-ordinary.test.ts',
      'tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts.bak.test.ts',
      'tests/execution-attempts/zzz-ordinary.test.ts'],env:{...ENV}},
    ...pr305OrdinaryOwnerSpawnsV1(),
  ]);
});
test('PR305 default discovery refuses a missing ordinary required owner before any dispatch',()=>{
  const files=TASK6_EXPECTED_OWNER_FILES_V1.filter(file=>file!=='attempt-reconciler.test.ts');
  const c=runWrapperSourceV1([],files.concat('aaa-unrelated.test.ts'));
  assert.equal(c.thrown,'EXECUTION_ATTEMPT_OWNER_TEST_MISSING:attempt-reconciler.test.ts');
  noEffects(c);assert.equal(c.stdout,'');assert.equal(c.stderr,'');
});
test('PR305 default discovery refuses a missing genuine required owner before any dispatch',()=>{
  const files=TASK6_EXPECTED_OWNER_FILES_V1.filter(file=>file!=='manual-control-orphan-bootstrap-v1.integration.test.ts');
  const c=runWrapperSourceV1([],files.concat('aaa-unrelated.test.ts'));
  assert.equal(c.thrown,'EXECUTION_ATTEMPT_OWNER_TEST_MISSING:manual-control-orphan-bootstrap-v1.integration.test.ts');
  noEffects(c);assert.equal(c.stdout,'');assert.equal(c.stderr,'');
});
test('PR305 explicit raw selection remains sorted and deduplicated with the genuine file discovered',()=>{
  const c=runWrapperSourceV1(['tests/execution-attempts/zzz-ordinary.test.ts','aaa-ordinary.test.ts','zzz-ordinary.test.ts'],
    [...TASK6_EXPECTED_OWNER_FILES_V1,'zzz-ordinary.test.ts','aaa-ordinary.test.ts']);
  pr305AssertDispatchV1(c,[
    {args:['--import','tsx','--test','tests/execution-attempts/aaa-ordinary.test.ts',
      'tests/execution-attempts/zzz-ordinary.test.ts'],env:{...ENV}},
  ]);
});
test('PR305 explicit owner selection remains sorted and deduplicated with the genuine file discovered',()=>{
  const c=runWrapperSourceV1(['tests/execution-attempts/v3-stage-input-unresolved.integration.test.ts',
    'attempt-reconciler.test.ts','tests/execution-attempts/attempt-reconciler.test.ts'],[...TASK6_EXPECTED_OWNER_FILES_V1]);
  pr305AssertDispatchV1(c,[
    {args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node','--import','tsx','--test',
      '--test-concurrency=1','tests/execution-attempts/attempt-reconciler.test.ts'],env:{...ENV}},
    {args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node','--import','tsx','--test',
      '--test-concurrency=1','tests/execution-attempts/v3-stage-input-unresolved.integration.test.ts'],env:{...ENV}},
  ]);
});
test('PR305 explicit mixed selection preserves raw-first ordering and owner vectors with the genuine file discovered',()=>{
  const c=runWrapperSourceV1(['v3-stage-input-unresolved.integration.test.ts','zzz-ordinary.test.ts',
    'attempt-reconciler.test.ts','tests/execution-attempts/aaa-ordinary.test.ts','aaa-ordinary.test.ts',
    'tests/execution-attempts/attempt-reconciler.test.ts'],
    [...TASK6_EXPECTED_OWNER_FILES_V1,'zzz-ordinary.test.ts','aaa-ordinary.test.ts']);
  pr305AssertDispatchV1(c,[
    {args:['--import','tsx','--test','tests/execution-attempts/aaa-ordinary.test.ts',
      'tests/execution-attempts/zzz-ordinary.test.ts'],env:{...ENV}},
    {args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node','--import','tsx','--test',
      '--test-concurrency=1','tests/execution-attempts/attempt-reconciler.test.ts'],env:{...ENV}},
    {args:['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node','--import','tsx','--test',
      '--test-concurrency=1','tests/execution-attempts/v3-stage-input-unresolved.integration.test.ts'],env:{...ENV}},
  ]);
});

// Task7D: actual private pins/resources, with a closed finite filesystem seam.
// This is NOT a successful Source/stock-owner emulator. Raw stock recheck is a
// dependency boundary; only the separate actual call-site slice binds its
// retained identity. Missing handoffTargetOutput is scaffolding RED, not proof
// that the later semantic assertions ran. No production export/test hook added.
function task7dSourceV1(){
  const text=readFileSync(HELPER,'utf8');
  const ast=ts.createSourceFile('actual-H.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.deepEqual(ast.parseDiagnostics,[],'actual helper parses before private extraction');
  const declaration=name=>{
    const matches=ast.statements.filter(node=>ts.isFunctionDeclaration(node)?node.name?.text===name:
      ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(ast)===name));
    assert.equal(matches.length,1,'one actual private declaration: '+name);
    return matches[0].getText(ast);
  };
  return {text,ast,declaration};
}
function task7dPrivateVmV1(fs,scope={}){
  const source=task7dSourceV1(),c=capture();
  const names=['ownedTargetShaV1','ownedMetadataV1','ownedSourceCleanupUncertainV1',
    'ownedSourceRefusalV1','ownedSourceRequireV1','ownedSourceHashV1','ownedSourceLocatorV1',
    'ownedSourceSameV1','ownedSourceKeysV1','ownedGitShaV1','probeHexV1',
    'ownedSourceBuildDataV1','ownedSourceEqualBuildV1','ownedSourceResourcesV1','ownedSourcePinsV1',
    'ownedObserverV1','ownedOrdinaryRootsV1','ownedSetupRootsV1','ownedGraphBuiltinsV1',
    'ownedSourceImportsV1','ownedSourceSetEqualV1','ownedSourceGraphV1'];
  const context={Buffer,TextDecoder,path,createHash,fs:closedModule(c,'Task7D finite fs',fs),...scope};
  runInNewContext(names.map(source.declaration).join('\n')+
    '\n;globalThis.unit={resources:ownedSourceResourcesV1,pins:ownedSourcePinsV1};',context,
    {filename:'actual-H-private-pins-resources',timeout:5000});
  return {...context.unit,contained(){assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));}};
}
const TASK7D_METADATA_V1=Object.freeze(['BUILD_INFO.json','PLATFORM_BUILD_OUTPUT_TREE.json','PLATFORM_RELEASE_MANIFEST.json']);
function task7dPinsV1({fixedGraph=false,scope={},extraFiles=[],sourceContext}={}){
  const root=SOURCE_T_V1,files=new Map(),dirs=new Map(),handles=new Map(),opened=[],events=[],faults=[];
  let inode=100,next=1000,temporary=false,live=true,ownerFault=false,checks=0,activeTemporary=0,maxTemporary=0;
  const controls={read:null,close:null,held:null,named:null,afterRead:null,afterCheck:null,recycle:false};
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){
    if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;
  }};
  const add=(locator,text)=>{
    const bytes=Buffer.from(text),stat={...observationStatV1('file',inode++,bytes.length),birthtimeNs:1n};
    files.set(locator,{bytes,stat});
    for(let at=path.dirname(locator);;at=path.dirname(at)){
      if(!dirs.has(at))dirs.set(at,{...observationStatV1('directory',inode++),birthtimeNs:1n});
      if(at==='/')break;
    }
  };
  const output=new Map(),sha='9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee8f0';
  // Independent literal SHA256("aaa"); 911 ordinary + 3 metadata, exact scope.
  const graphData=fixedGraph?task7eGraphDataV1():null;
  for(let i=0;i<911;i++){
    const locator=graphData?.names[i]??'dist/unit-'+String(i).padStart(4,'0')+'.js';
    const text=graphData?.text.get(locator)??'aaa';add(root+'/'+locator,text);
    output.set(locator,{locator,mode:0o644,byteLength:Buffer.byteLength(text),
      sha256:graphData?createHash('sha256').update(text).digest('hex'):sha});
  }
  for(const name of TASK7D_METADATA_V1){const locator=root+'/dist/'+name;add(locator,'aaa');files.get(locator).stat.mode=0o100444n;}
  const keep=root+'/scripts/build-generation-retention.mjs';add(keep,'keep');
  for(const [locator,text] of extraFiles)add(locator,text);
  const paths=[...output.keys()].map(locator=>root+'/'+locator).concat(TASK7D_METADATA_V1.map(name=>root+'/dist/'+name));
  const entry=locator=>{
    assert.equal(typeof locator,'string');const item=files.get(locator)??dirs.get(locator);
    if(!item){const error=Error('finite absent');error.code='ENOENT';throw error;}return item;
  };
  const stat=value=>({...value,isFile:()=>value.kind==='file',isDirectory:()=>value.kind==='directory',isSymbolicLink:()=>false});
  const descriptor=fd=>{
    const h=handles.get(fd);assert.ok(h,'only owned fixture descriptors');
    assert.equal(h.closed,false,'no read/stat of burned descriptor');assert.equal(h.foreign,false,'never touch recycled foreign descriptor');return h;
  };
  const fs={constants,
    realpathSync:guard(locator=>{entry(locator);return locator;}),
    lstatSync:guard((locator,options)=>{
      assert.equal(options?.bigint,true);events.push(['named',locator]);const item=entry(locator);
      const value=files.has(locator)?item.stat:item;
      return stat(controls.named===locator?{...value,ino:value.ino+1n}:value);
    }),
    readdirSync:guard(locator=>{
      assert.ok(dirs.has(locator));events.push(['members',locator]);
      return [...new Set([...files.keys(),...dirs.keys()].filter(p=>p!==locator&&path.dirname(p)===locator).map(p=>path.basename(p)))];
    }),
    openSync:guard((locator,flags)=>{
      const item=entry(locator),isFile=files.has(locator);
      assert.equal(flags,isFile?constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK:
        constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW,'exact readonly nofollow/nonblock file flags');
      const h={fd:next++,path:locator,item,closed:false,foreign:false,temporary:temporary&&isFile};
      handles.set(h.fd,h);opened.push(h);events.push(['open',h.fd,locator]);
      if(h.temporary){activeTemporary++;maxTemporary=Math.max(maxTemporary,activeTemporary);assert.equal(activeTemporary,1,'one bounded temporary at a time');}
      return h.fd;
    }),
    fstatSync:guard((fd,options)=>{
      assert.equal(options?.bigint,true);const h=descriptor(fd);events.push(['held',fd]);
      const value=files.has(h.path)?h.item.stat:h.item;
      return stat(controls.held===h.path?{...value,ino:value.ino+1n}:value);
    }),
    readSync:guard((fd,buffer,offset,length,position)=>{
      const h=descriptor(fd);assert.ok(files.has(h.path));assert.ok(Buffer.isBuffer(buffer));
      for(const value of [offset,length,position])assert.ok(Number.isSafeInteger(value)&&value>=0);
      assert.equal(offset,buffer.length===1?0:position,'exact explicit data/EOF offset');assert.ok(length<=65536);assert.ok(offset+length<=buffer.length);
      events.push(['read',fd,position,length]);
      if(h.temporary&&controls.read==='short'&&position===0)return 0;
      if(h.temporary&&controls.read==='overlong'&&position===0)return length+1;
      if(h.temporary&&controls.read==='extra-eof'&&position===h.item.bytes.length)return 1;
      const data=h.temporary&&controls.read==='hash'?Buffer.from('bbb'):h.item.bytes;
      const n=Math.max(0,Math.min(length,data.length-position));data.copy(buffer,offset,position,position+n);
      if(h.temporary&&controls.afterRead)controls.afterRead(h,position);
      return n;
    }),
    closeSync:guard(fd=>{
      const h=descriptor(fd);events.push(['close',fd,h.path]);h.closed=true;
      if(h.temporary)activeTemporary--;
      const fail=controls.close==='temporary'?h.temporary:controls.close===h.path;
      if(fail){
        if(controls.recycle)handles.set(fd,{fd,path:'FOREIGN_REUSED_FD',closed:false,foreign:true});
        throw Error('FINITE_CLOSE_AFTER_RELEASE');
      }
    }),
  };
  const vm=task7dPrivateVmV1(fs,scope),resources=vm.resources();
  const pins=sourceContext===undefined?vm.pins(resources,SOURCE_HOME_V1):vm.pins(resources,SOURCE_HOME_V1,sourceContext);
  // The seam creates no stock descriptors. The recheck boundary intentionally
  // represents the retained full check, not a fabricated passing Source owner.
  const owner={expected:ownedReleaseData(OWN_T),check:guard(()=>{
    checks++;events.push(['stock-check']);if(!live||ownerFault)throw Error('FINITE_STOCK_UNAVAILABLE');
    if(controls.afterCheck)controls.afterCheck(checks);
  })};
  for(const locator of paths)pins.file(locator);
  pins.file(keep);for(const [locator] of extraFiles)pins.file(locator);pins.directory(root+'/dist',true);pins.absent(root+'/dist/absent.js');
  const original=opened.filter(h=>files.has(h.path)),originalTargets=original.filter(h=>paths.includes(h.path));
  assert.equal(originalTargets.length,914);assert.equal(original.length,915+extraFiles.length);
  const originalCount=opened.length;
  const contained=()=>{assert.deepEqual(faults,[],'no swallowed finite FS/assertion fault');vm.contained();};
  const api=()=>assert.equal(typeof pins.handoffTargetOutput,'function',
    'Task7D scaffolding RED: missing private pins.handoffTargetOutput; semantic assertions not yet reached');
  const handoff=(candidate=owner,inventory=output,location=root)=>{api();return pins.handoffTargetOutput(location,inventory,candidate);};
  const finish=(unknown=false)=>{
    if(unknown)assert.throws(()=>resources.close(),/MANUAL_ORPHAN_CLEANUP_UNKNOWN/);else resources.close();
    const before=events.length;
    if(unknown)assert.throws(()=>resources.close(),/MANUAL_ORPHAN_CLEANUP_UNKNOWN/);else resources.close();
    assert.equal(events.length,before,'second cleanup never retries a numeric descriptor');
    for(const h of opened){assert.equal(h.closed,true,'all known H acquisitions attempted');
      assert.equal(events.filter(e=>e[0]==='close'&&e[1]===h.fd).length,1,'one attempt per acquired fd');}
    assert.equal(activeTemporary,0);contained();
  };
  return {root,output,paths,keep,files,dirs,handles,opened,events,controls,pins,resources,owner,originalTargets,originalCount,graphData,
    api,handoff,finish,contained,checks:()=>checks,maxTemporary:()=>maxTemporary,
    delegate(){handoff();temporary=true;},startTemporary(){temporary=true;},stockClosed(){live=false;},stockFault(){ownerFault=true;},
    reads(){return events.filter(e=>e[0]==='read');},closes(){return events.filter(e=>e[0]==='close');}};
}
function task7dRefusedV1(fn,unknown=false){
  assert.throws(fn,error=>error?.message===(unknown?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED'));
}

test('Task7D private custody validates every original member before closing exactly914 duplicate pins',()=>{
  // Catches close-as-you-validate and retirement of non-output/directory pins.
  const f=task7dPinsV1();f.api();f.events.length=0;f.handoff();
  const first=f.events.findIndex(e=>e[0]==='close');assert.ok(first>0);
  for(const h of f.originalTargets){
    assert.ok(f.events.slice(0,first).some(e=>e[0]==='held'&&e[1]===h.fd));
    assert.ok(f.events.slice(0,first).some(e=>e[0]==='named'&&e[1]===h.path));
    assert.ok(f.events.slice(0,first).some(e=>e[0]==='read'&&e[1]===h.fd&&e[2]===3),'exact EOF checked before any retirement');
  }
  assert.equal(f.closes().length,914);assert.ok(f.closes().every(e=>f.paths.includes(e[2])));
  assert.equal(f.opened.slice(0,f.originalCount).filter(h=>!h.closed).length,f.originalCount-914);
  assert.equal(f.checks(),2,'one same-stock check before and one after batch retirement');f.finish();
});
for(const kind of ['absent','null','malformed','wrong-sha','wrong-root','missing-member','extra-member','closed']){
  test('Task7D private custody refuses '+kind+' before retiring an H descriptor',()=>{
    // Catches handoff without a usable fixed-T owner or exact admitted members.
    const f=task7dPinsV1();f.api();let owner=f.owner,output=f.output,root=f.root;
    if(kind==='absent')owner=undefined;if(kind==='null')owner=null;if(kind==='malformed')owner={expected:f.owner.expected};
    if(kind==='wrong-sha')owner={...f.owner,expected:ownedReleaseData(SOURCE_M_SHA_V1)};
    if(kind==='wrong-root')root=SOURCE_M_V1;
    if(kind==='missing-member'){output=new Map(output);output.delete('dist/unit-0910.js');}
    if(kind==='extra-member'){output=new Map(output);output.set('scripts/build-generation-retention.mjs',{locator:'scripts/build-generation-retention.mjs'});}
    if(kind==='closed')f.stockClosed();
    task7dRefusedV1(()=>kind==='absent'?f.pins.handoffTargetOutput(root,output):f.handoff(owner,output,root),kind==='closed');assert.equal(f.closes().length,0);f.finish(kind==='closed');
  });
}
for(const drift of ['named-inode','held-inode','metadata','content','membership']){
  test('Task7D private custody original '+drift+' drift refuses the whole batch before first close',()=>{
    // Catches replacing original expectations or checking only named metadata.
    const f=task7dPinsV1();f.api();const last=f.paths.at(-1);
    if(drift==='named-inode')f.controls.named=last;if(drift==='held-inode')f.controls.held=last;
    if(drift==='metadata')f.files.get(last).stat={...f.files.get(last).stat,mtimeNs:1000000001n};
    if(drift==='content')f.files.get(last).bytes=Buffer.from('bbb');
    if(drift==='membership')f.files.set(f.root+'/dist/intruder.js',f.files.get(last));
    task7dRefusedV1(()=>f.handoff());assert.equal(f.closes().length,0);f.finish();
  });
}
test('Task7D private custody partial handoff burns a close before throw and never closes its recycled fd',()=>{
  // Catches a distinct cleanup callback that retries an attempted duplicate.
  const f=task7dPinsV1();f.api();f.controls.close=f.paths[1];f.controls.recycle=true;
  task7dRefusedV1(()=>f.handoff(),true);
  assert.equal(f.closes().length,2,'first duplicate released, second attempted, remaining batch still owned');
  const recycled=f.originalTargets[1].fd;assert.equal(f.handles.get(recycled).foreign,true);
  const before=f.reads().length;task7dRefusedV1(()=>f.pins.file(f.paths[0]),true);assert.equal(f.reads().length,before);
  f.finish(true);assert.equal(f.handles.get(recycled).foreign,true);
});
test('Task7D private custody failed post-handoff stock check stays UNKNOWN and unwinds every other resource',()=>{
  // Catches permitting delegated use after the overlap owner loses its proof.
  const f=task7dPinsV1();f.api();f.controls.afterCheck=n=>{if(n===2)throw Error('FINITE_POST_HANDOFF');};
  task7dRefusedV1(()=>f.handoff(),true);assert.equal(f.closes().length,914);
  const before=f.opened.length;task7dRefusedV1(()=>f.pins.file(f.paths[0]),true);assert.equal(f.opened.length,before);f.finish(true);
});
test('Task7D private custody delegated file uses one fresh descriptor and closes it before returning original bytes',()=>{
  // Catches silent permanent re-pinning, borrowed reads, or returning before close.
  const f=task7dPinsV1();f.delegate();const before=f.opened.length;
  const got=f.pins.file(f.paths[0]);assert.equal(got.bytes.toString(),'aaa');
  assert.equal(got.sha256,'9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee8f0');
  assert.equal(f.opened.length,before+1);assert.equal(f.opened.at(-1).closed,true);assert.equal(f.maxTemporary(),1);
  const again=f.pins.file(f.paths[0]);assert.equal(again.bytes.toString(),'aaa');assert.equal(f.opened.length,before+2);
  f.finish();
});
test('Task7D private custody check joins the same stock owner once and all914 original file proofs',()=>{
  // Catches cached owner observations, per-file full stock checks, or lstat-only proof.
  const f=task7dPinsV1();f.delegate();const checks=f.checks(),before=f.opened.length;f.pins.check();
  assert.equal(f.checks()-checks,1);assert.equal(f.opened.length-before,914);assert.equal(f.maxTemporary(),1);
  for(const locator of f.paths){const h=f.opened.slice(before).find(item=>item.path===locator);assert.ok(h);assert.equal(h.closed,true);
    assert.ok(f.events.some(e=>e[0]==='held'&&e[1]===h.fd));assert.ok(f.events.some(e=>e[0]==='read'&&e[1]===h.fd&&e[2]===3));}
  f.finish();
});
for(const fault of ['short','overlong','extra-eof','hash','named-inode','held-inode','after-read-metadata','after-read-named','after-read-held','temporary-close']){
  test('Task7D private custody delegated '+fault+' refuses and closes its temporary exactly once',()=>{
    // Catches incomplete reads, refreshed digest/stat expectations, or lost temp cleanup.
    const f=task7dPinsV1();f.delegate();const locator=f.paths[0],before=f.opened.length;
    if(['short','overlong','extra-eof','hash'].includes(fault))f.controls.read=fault;
    if(fault==='named-inode')f.controls.named=locator;if(fault==='held-inode')f.controls.held=locator;
    if(fault==='after-read-metadata')f.controls.afterRead=()=>{f.files.get(locator).stat={...f.files.get(locator).stat,ctimeNs:1000000001n};};
    if(fault==='after-read-named')f.controls.afterRead=(_h,position)=>{if(position===3)f.controls.named=locator;};
    if(fault==='after-read-held')f.controls.afterRead=(_h,position)=>{if(position===3)f.controls.held=locator;};
    if(fault==='temporary-close'){f.controls.close='temporary';f.controls.recycle=true;}
    task7dRefusedV1(()=>f.pins.file(locator),fault==='temporary-close');
    // Named pre-open refusal may avoid acquisition; every actually returned FD is closed.
    assert.ok(f.opened.length-before<=1);for(const h of f.opened.slice(before))assert.equal(h.closed,true);
    if(fault!=='named-inode')assert.equal(f.opened.length,before+1);
    f.finish(fault==='temporary-close');
  });
}
test('Task7D private custody temporary close UNKNOWN dominates a simultaneous short read refusal',()=>{
  // Catches a finally-close error being discarded behind the content refusal.
  const f=task7dPinsV1();f.delegate();f.controls.read='short';f.controls.close='temporary';f.controls.recycle=true;
  task7dRefusedV1(()=>f.pins.file(f.paths[0]),true);
  const before=f.opened.length;task7dRefusedV1(()=>f.pins.check(),true);assert.equal(f.opened.length,before);f.finish(true);
});
for(const state of ['closed-stock','failed-stock','cleanup-started']){
  test('Task7D private custody '+state+' cannot start a delegated read or reopen a pin',()=>{
    // Catches using a dead/unknown owner or reading after reverse cleanup starts.
    const f=task7dPinsV1();f.delegate();
    if(state==='closed-stock')f.stockClosed();if(state==='failed-stock')f.stockFault();
    if(state==='cleanup-started')f.resources.close();const before=f.opened.length;
    task7dRefusedV1(()=>f.pins.file(f.paths[0]),state!=='cleanup-started');assert.equal(f.opened.length,before);
    f.finish(state!=='cleanup-started');
  });
}
test('Task7D private custody check after known close performs no descriptor IO',()=>{
  // Catches the closed owner attempting stats/reads on numeric FDs now reusable.
  const f=task7dPinsV1();f.delegate();f.resources.close();const before=f.events.length;
  task7dRefusedV1(()=>f.pins.check());assert.equal(f.events.length,before);f.finish();
});
test('Task7D private custody failed remaining resource close does not stop reverse unwind',()=>{
  // Catches UNKNOWN resetting or an unrelated closer aborting the resource stack.
  const f=task7dPinsV1();f.delegate();f.controls.close=f.keep;f.controls.recycle=true;
  f.finish(true);assert.ok(f.events.findIndex(e=>e[0]==='close'&&e[2]===f.keep)<f.events.length-1);
});

// Actual acquisition ORDER slice only. All selected statements/function bodies
// are copied verbatim from H. The dependency boundaries below cannot authorize
// an actual release, complete Source holder, compiled import or stock proof.
// The slice stops BEFORE the inventory loop and always exits by refusal. Its
// assertions prove ordering/identity/cleanup, independently of pins semantics.
function task7dOrderV1(mode='boundary'){
  const source=task7dSourceV1(),holder=source.ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='holdManualOrphanOwnedSourcesV1');
  assert.ok(holder?.body);const top=[...holder.body.statements];
  const outer=top.find(ts.isTryStatement);assert.ok(outer?.catchClause);
  const inner=[...outer.tryBlock.statements],decl=(node,name)=>ts.isVariableStatement(node)
    &&node.declarationList.declarations.some(item=>item.name.getText(source.ast)===name);
  const acquisition=inner.find(node=>decl(node,'acquireBuild'));assert.ok(acquisition);
  const start=inner.findIndex(node=>decl(node,'targetOutput'));
  const stop=inner.findIndex(node=>ts.isForOfStatement(node)&&node.initializer.getText(source.ast).includes('root,output,groups,roots,count,sites'));
  assert.ok(start>=0&&stop>start,'bounded actual early-T through pre-inventory interval');
  const prefix=top.slice(0,top.indexOf(outer)).map(node=>node.getText(source.ast)).join('\n');
  const slice=inner.slice(start,stop).map(node=>node.getText(source.ast)).join('\n');
  const events=[],faults=[],c=capture();let currentRaw,handed,lateTarget;
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const expected=ownedReleaseData(OWN_T),output=new Map(),lock=Buffer.from('lock'),pkg=Buffer.from('package');
  const profile={target:{sourceTreeHash:expected.treeHash,lockSha256:'f'.repeat(64)},
    targetResolution:Array.from({length:11},()=>({row:['x','dist/x.js','x'],members:[]}))};
  const pins={
    check:guard(()=>{events.push('pins-check');if(handed!==undefined)handed.check();}),
    directory:guard(()=>{events.push('early-directory');return {dev:1n};}),
    file:guard((locator)=>{
      events.push('file:'+path.basename(locator));
      if(mode==='early-output-actual')return {stat:{mode:0o100644n},bytes:Buffer.from('{}'),sha256:'f'.repeat(64)};
      assert.ok([SOURCE_T_V1+'/package.json',SOURCE_T_V1+'/package-lock.json'].includes(locator));
      const isLock=locator.endsWith('package-lock.json');
      return {bytes:isLock?lock:pkg,sha256:mode==='lock-hash'&&isLock?'0'.repeat(64):'f'.repeat(64)};
    }),
    handoffTargetOutput:guard((root,actualOutput,retained)=>{
      events.push('handoff');assert.equal(root,SOURCE_T_V1);assert.equal(actualOutput,output);
      assert.ok(retained&&retained!==currentRaw,'same private retained wrapper, not raw replacement/caller data');
      handed=retained;
    }),
  };
  const raw=()=>{
    events.push('acquire-raw');if(mode==='unreturned')throw Error('FINITE_UNRETURNED');
    if(mode==='null-raw')return null;
    const build={...expected};if(mode==='wrong-sha')build.sha=SOURCE_M_SHA_V1;
    if(mode==='wrong-tree')build.treeHash='0'.repeat(40);
    let alive=true;
    const value={observation:{buildSource:build,checkoutSource:{branch:'main',clean:true,
      sha:build.sha,treeHash:build.treeHash,originMainSha:build.sha}},
      recheck(){assert.equal(this,value);events.push('raw-recheck');
        if(!alive||mode==='closed-raw'||mode==='stock-check')throw Error('FINITE_STOCK_RECHECK');},
      close(){assert.equal(this,value);events.push('raw-close');assert.equal(alive,true);alive=false;}};
    if(mode==='shape-getter')Object.defineProperty(value,'recheck',{get(){events.push('shape-getter');throw Error('FINITE_SHAPE_GETTER');}});
    if(mode==='wrong-observation')value.observation.checkoutSource.clean=false;
    currentRaw=Object.freeze(value);return currentRaw;
  };
  const context={Buffer,path,createHash,Error,finitePins:pins,profile,targetRoot:SOURCE_T_V1,
    maintenanceRoot:SOURCE_M_V1,maintenanceCommon:'/finite/M.git',targetCommon:'/finite/T.git',device:1n,
    setupFiles:['dist/order-only.js'],output,
    importBoundary:guard(specifier=>{
      events.push('import-retention');assert.equal(specifier,url.pathToFileURL(SOURCE_T_V1+'/'+SOURCE_SCRIPT_V1).href);
      if(mode==='import-refusal')throw Error('FINITE_IMPORT');return {holdCurrentFinalizedSetfarmSourceBuildV1:raw};
    }),
    pathToFileURL:url.pathToFileURL,
    ownedSourceOutputV1:guard((actualPins,root,_expected,full,actualProfile)=>{
      events.push('early-output');assert.equal(actualPins,pins);assert.equal(root,SOURCE_T_V1);assert.equal(full,true);assert.equal(actualProfile,profile);return output;
    }),
    git:guard(args=>{
      const cells=Array.from(args);assert.equal(cells[0],'-C');assert.equal(cells[1],SOURCE_T_V1);assert.equal(cells[2],'show');
      const locator=cells[3].split(':')[1];events.push('git:'+locator);
      if(mode==='package-equality'&&locator==='package.json')return Buffer.from('changed');return locator==='package.json'?pkg:lock;
    }),
    authenticateRetention:guard((root,sha)=>{
      events.push('authenticate-retention');assert.equal(root,SOURCE_T_V1);assert.equal(sha,OWN_T);
      if(mode==='retention-auth')throw Error('FINITE_AUTH');
    }),
    compiled:guard((root,actualOutput,locator)=>{
      events.push('compiled-read');assert.equal(root,SOURCE_T_V1);assert.equal(actualOutput,output);assert.equal(locator,'dist/order-only.js');return Buffer.from('audit-only');
    }),
    ownedSourceAuditedCompiledV1:guard((manifest,kind)=>{
      events.push('compiled-audit');assert.equal(kind,'target');assert.equal(manifest.length,1);
      if(mode==='compiled-audit')throw Error('FINITE_COMPILED_AUDIT');
    }),
    identityCommon:guard(root=>{
      assert.ok([SOURCE_M_V1,SOURCE_T_V1].includes(root),'only original M/T identity roots');events.push('identity-common:'+root);
      return root===SOURCE_M_V1?'/finite/M.git':'/finite/T.git';
    }),
    captureTarget:guard(target=>{lateTarget=target;events.push('pre-inventory-stop');}),
    exerciseClose:mode==='normal-close',
  };
  const privateNames=['ownedTargetShaV1','ownedRetentionV1','ownedMetadataV1','ownedSourceCleanupUncertainV1',
    'ownedSourceRefusalV1','ownedSourceRequireV1','ownedSourceHashV1','ownedSourceSameV1','ownedSourceKeysV1',
    'ownedGitShaV1','probeHexV1','ownedSourceBuildDataV1','ownedSourceEqualBuildV1','ownedSourceResourcesV1'];
  // The early-output case additionally executes the real full-output function;
  // wrong metadata mode terminates it before any profile/hash/inventory seam.
  const early=mode==='early-output-actual'?source.declaration('ownedSourceOutputV1')+'\n':'';
  const program=privateNames.map(source.declaration).join('\n')+'\n'+early+
    '\nglobalThis.run=async function(){\n'+prefix+'\npins=finitePins;\n'+acquisition.getText(source.ast)+
    '\ntry{\n'+slice+'\ncaptureTarget(target);if(exerciseClose)close();throw Error("FINITE_PRE_INVENTORY_STOP");\n}'+
    outer.catchClause.getText(source.ast)+'\n};';
  const transpiled=ts.transpileModule(program,{fileName:'actual-H-order-slice.ts',
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.deepEqual((transpiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  context.require=guard(specifier=>context.importBoundary(specifier));context.exports={};
  context.process=closedModule(c,'Task7D order process');context.fs=closedModule(c,'Task7D order filesystem');
  runInNewContext(transpiled.outputText,context,{filename:'actual-H-order-slice',timeout:5000});
  return {events,run:context.run,handed:()=>handed,target:()=>lateTarget,contained(){
    assert.deepEqual(faults,[],'no swallowed ordering boundary assertions');assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));}};
}
test('Task7D acquisition ORDER only binds handoff to the actual retained T after early audits and before inventories',async()=>{
  // Catches an absent/early handoff, wrong retained wrapper or advanced import.
  const f=task7dOrderV1();await assert.rejects(()=>f.run(),/MANUAL_ORPHAN_OWNER_REFUSED/);f.contained();
  assert.ok(f.events.includes('handoff'),'Task7D structural RED: actual H acquisition has no handoff call; no custody claim');
  assert.equal(f.handed(),f.target(),'handoff receives the SAME acquireBuild retained return');
  const at=name=>{const index=f.events.indexOf(name);assert.ok(index>=0,'reached '+name);return index;};
  assert.ok(at('early-output')<at('file:package-lock.json'));
  assert.ok(at('git:package-lock.json')<at('authenticate-retention'));
  assert.ok(at('authenticate-retention')<at('import-retention'));assert.ok(at('import-retention')<at('acquire-raw'));
  assert.ok(at('acquire-raw')<at('raw-recheck'));assert.ok(at('raw-recheck')<at('compiled-audit'));
  assert.ok(at('compiled-audit')<at('handoff'));assert.ok(at('handoff')<at('pre-inventory-stop'));
  assert.equal(f.events.filter(e=>e==='import-retention').length,1);assert.equal(f.events.filter(e=>e==='raw-close').length,1);
});
for(const mode of ['early-output-actual','lock-hash','package-equality','retention-auth','import-refusal',
  'unreturned','null-raw','shape-getter','wrong-sha','wrong-tree','wrong-observation','closed-raw','stock-check','compiled-audit']){
  test('Task7D acquisition ORDER only '+mode+' cannot advance to custody handoff',async()=>{
    // Catches moving retirement before the original independent gate; this is
    // NOT semantic proof of a passing compiled audit or stock Source owner.
    const f=task7dOrderV1(mode),unknown=['unreturned','null-raw','closed-raw','stock-check'].includes(mode);
    await assert.rejects(()=>f.run(),error=>error?.message===(unknown?'MANUAL_ORPHAN_CLEANUP_UNKNOWN':'MANUAL_ORPHAN_OWNER_REFUSED'));
    assert.equal(f.events.includes('handoff'),false);assert.equal(f.events.includes('pre-inventory-stop'),false);
    if(['shape-getter','wrong-sha','wrong-tree','wrong-observation','closed-raw','stock-check','compiled-audit'].includes(mode))
      assert.equal(f.events.filter(e=>e==='raw-close').length,1,'returned raw retained before any failing property or observation access');
    if(mode==='shape-getter')assert.ok(f.events.indexOf('shape-getter')<f.events.indexOf('raw-close'));
    if(mode==='early-output-actual'){
      assert.ok(f.events.includes('file:BUILD_INFO.json'),'actual output metadata predicate reached');
      assert.equal(f.events.includes('file:package-lock.json'),false);
    }
    f.contained();
  });
}
test('Task7D acquisition ORDER only normal close checks the retained stock while live before reverse cleanup',async()=>{
  // Catches closing the stock owner before the original H final check.
  const f=task7dOrderV1('normal-close');await assert.rejects(()=>f.run(),/MANUAL_ORPHAN_OWNER_REFUSED/);
  const stop=f.events.indexOf('pre-inventory-stop'),close=f.events.indexOf('raw-close');
  assert.ok(stop>=0&&close>stop);assert.ok(f.events.slice(stop+1,close).includes('raw-recheck'));
  assert.equal(f.events.filter(e=>e==='raw-close').length,1);f.contained();
});
test('Task7D acquisition ORDER only caller arguments refuse before acquisition IO',async()=>{
  // Catches moving the actual zero-argument refusal below resource acquisition.
  const f=task7dOrderV1();assert.equal(f.run.length,0);
  await assert.rejects(()=>f.run(undefined),/MANUAL_ORPHAN_OWNER_REFUSED/);assert.deepEqual(f.events,[]);f.contained();
});
for(const replacement of [false,true]){
  test('Task7D private custody refuses a second handoff with '+(replacement?'a replacement':'the same')+' retained owner',()=>{
    // Catches replacing the established stock proof or retiring a numeric FD twice.
    const f=task7dPinsV1();f.delegate();let replacementChecks=0;
    const candidate=replacement?{expected:{...f.owner.expected},check(){replacementChecks++;}}:f.owner;
    const before=f.closes().length;task7dRefusedV1(()=>f.handoff(candidate));
    assert.equal(f.closes().length,before);assert.equal(replacementChecks,0);f.finish();
  });
}
test('Task7D private custody retains full directory membership checks after successful delegation',()=>{
  // Catches discarding H directory membership proof alongside duplicate file FDs.
  const f=task7dPinsV1();f.delegate();f.files.set(f.root+'/dist/late-intruder.js',f.files.get(f.paths[0]));
  task7dRefusedV1(()=>f.pins.check());f.finish();
});
test('Task7D private custody failed stock batch recheck precedes every temporary file acquisition',()=>{
  // Catches doing delegated reads before the complete same-owner stock proof.
  const f=task7dPinsV1();f.delegate();f.stockFault();const before=f.opened.length;
  task7dRefusedV1(()=>f.pins.check(),true);assert.equal(f.opened.length,before);f.finish(true);
});

// Task7E: actual fixed lexical bodies only. Extraction gates precede fixtures.
// A missing declaration is scaffolding RED; it is never reported as a reached
// retained-owner/SQL/filesystem predicate. No successful whole Source emulator.
function task7eLexicalV1(file,ownerName,names){
  const source=readFileSync(file,'utf8'),ast=ts.createSourceFile('actual-private-unit.ts',source,ts.ScriptTarget.Latest,true,
    String(file).endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
  assert.deepEqual(ast.parseDiagnostics,[]);const owner=ownerName===null?ast:ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===ownerName);
  assert.ok(owner,'actual containing function '+ownerName);const nodes=[];
  const visit=n=>{nodes.push(n);ts.forEachChild(n,visit);};visit(ownerName===null?owner:owner.body);
  return names.map(name=>{const found=nodes.filter(n=>(ts.isFunctionDeclaration(n)&&n.name?.text===name)
    ||(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name));
    assert.equal(found.length,1,'Task7E scaffolding RED: missing unique '+name+'; semantic controls NOT reached');
    return ts.isFunctionDeclaration(found[0])?found[0].getText(ast):'const '+found[0].getText(ast)+';';}).join('\n');
}
function task7eVmV1(code,names,bindings={}){
  const faults=[],c=capture();const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const context={Buffer,Error,TextDecoder,path,createHash,pathToFileURL:url.pathToFileURL,...bindings};
  for(const name of ['process','fs','orphanFs','console','performance'])context[name]=new Proxy(context[name]??{},{get(target,key){
    if(Object.hasOwn(target,key))return target[key];c.calls.forbidden++;c.forbiddenSites.push(name+'.'+String(key));throw Error('TASK7E_UNLISTED_PROPERTY');}});
  context.Date=new Proxy(function(){c.calls.forbidden++;throw Error('TASK7E_DATE');},{get(){c.calls.forbidden++;throw Error('TASK7E_DATE');}});
  if(!Object.hasOwn(context,'require'))context.require=guard(specifier=>{c.forbiddenSites.push('require '+specifier);c.calls.forbidden++;throw Error('TASK7E_FORBIDDEN');});
  const compiled=ts.transpileModule(code+'\nglobalThis.unit={'+names.join(',')+'};',{fileName:'actual-task7e-unit.ts',reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.deepEqual((compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  runInNewContext(compiled.outputText,context,{filename:'actual-fixed-private-unit',timeout:5000});
  return {context,api:context.unit,guard,faults,contained(){assert.deepEqual(faults,[]);assert.equal(c.calls.forbidden,0,JSON.stringify(c.forbiddenSites));}};
}
function task7eGraphDataV1(){
  // Independent finite import DATA, not copies of traversal or proof logic.
  const roots=['dist/installation/fresh-installation-entry-v1.js','dist/db-pg.js','dist/db/contract-spine-migrations.js',
    'dist/internal-production/baseline-post-handoff-receipt-v1.js','dist/cli/runtime-guard.js','dist/installation/fresh-installation-v1.js',
    'dist/installation/fresh-installation-activation-verifier-v1.js','dist/installation/fresh-installation-activation-v1.js',
    'dist/installation/fresh-installation-provenance-v1.js','dist/installation/fresh-installation-mission-control-schema-v1.js',
    'dist/installation/fresh-installation-runtime-grants-v1.js','dist/installation/fresh-installation-artifact-bootstrap-v1.js'];
  const observer=roots[3],common=Array.from({length:120},(_,i)=>'dist/graph-'+String(i).padStart(3,'0')+'.js'),
    extra=Array.from({length:21},(_,i)=>'dist/extra-'+String(i).padStart(3,'0')+'.js');
  const text=new Map();for(const name of roots)text.set(name,'export const finite=1;');
  text.set(observer,common.map(x=>"import '../"+path.posix.basename(x)+"';").join('\n'));
  text.set(roots[0],extra.map(x=>"import '../"+path.posix.basename(x)+"';").join('\n'));
  for(const [i,name] of common.entries())text.set(name,i<79?"import 'pkg';":'export const finite=1;');
  for(const [i,name] of extra.entries())text.set(name,i<6?"import 'pkg';":'export const finite=1;');
  const member=(members)=>[{row:['esm',members[0],'pkg','node_modules/pkg/index.js'],members}];
  return {names:[...roots,...common,...extra],text,groups:member([...common.slice(0,79),...extra.slice(0,6)]),observerGroups:member(common.slice(0,79))};
}
function task7ePinsV1(){
  // The exact method gates run before constructing the 914-file finite seam.
  task7eLexicalV1(HELPER,'ownedSourcePinsV1',['targetSetupGraph','targetObserverGraph','targetMembership']);
  const f=task7dPinsV1({fixedGraph:true});f.delegate();return f;
}
function task7ePinCallV1(f,kind){
  if(kind==='setup')return f.pins.targetSetupGraph(f.output,f.graphData.groups);
  if(kind==='observer')return f.pins.targetObserverGraph(f.output,f.graphData.observerGroups);
  return f.pins.targetMembership(f.graphData.groups);
}
for(const [kind,count] of [['setup',153],['observer',121],['membership',85]])test('Task7E H fixed '+kind+' retains same T around every original file proof',()=>{
  // Break: per-file recursive stock check, skipped content/EOF/close, early result.
  const f=task7ePinsV1(),before=f.opened.length,checks=f.checks();const result=task7ePinCallV1(f,kind);
  assert.equal(f.checks()-checks,2);assert.equal(f.opened.length-before,count);assert.equal(f.maxTemporary(),1);
  for(const h of f.opened.slice(before)){assert.equal(h.closed,true);assert.ok(f.events.some(x=>x[0]==='read'&&x[1]===h.fd&&x[2]===h.item.bytes.length));}
  if(kind!=='membership')assert.equal(result.files.size,count);
  const outside=f.checks();f.pins.file(f.paths[0]);assert.equal(f.checks()-outside,1,'ordinary file call retains its own full stock boundary');f.finish();
});
for(const position of ['first','middle','last'])test('Task7E H setup '+position+' original digest drift refuses before graph acceptance',()=>{
  const f=task7ePinsV1(),locator=f.root+'/'+(position==='first'?f.graphData.names[11]:position==='middle'?'dist/graph-052.js':'dist/extra-000.js');
  const item=f.files.get(locator);item.bytes=Buffer.alloc(item.bytes.length,120);
  task7dRefusedV1(()=>task7ePinCallV1(f,'setup'));assert.ok(f.opened.filter(x=>x.temporary).every(x=>x.closed));f.finish();
});
for(const [kind,point] of [['setup','start'],['observer','body'],['membership','end']])test('Task7E H '+kind+' '+point+' Source drift burns the fixed unit',()=>{
  const f=task7ePinsV1(),before=f.checks();
  if(point==='start')f.stockFault();else if(point==='body')f.controls.afterRead=()=>f.stockFault();
  else f.controls.afterCheck=n=>{if(n===before+2)throw Error('FINITE_TERMINAL_STOCK_DRIFT');};
  task7dRefusedV1(()=>task7ePinCallV1(f,kind),true);const opened=f.opened.length;
  task7dRefusedV1(()=>f.pins.file(f.paths[0]),true);assert.equal(f.opened.length,opened);f.finish(true);
});
for(const drift of ['named','held','directory','absence','short','eof','close-recycled','reentrant'])test('Task7E H fixed setup '+drift+' cannot escape complete custody',()=>{
  const f=task7ePinsV1();let nested=false;
  if(drift==='named')f.controls.named=f.root+'/'+f.graphData.names[0];if(drift==='held')f.controls.held=f.root+'/'+f.graphData.names[0];
  if(drift==='directory')f.dirs.get(f.root+'/dist').ino+=1n;
  if(drift==='absence')f.files.set(f.root+'/dist/absent.js',f.files.get(f.paths[0]));
  if(drift==='short')f.controls.read='short';if(drift==='eof')f.controls.read='extra-eof';
  if(drift==='close-recycled'){f.controls.close='temporary';f.controls.recycle=true;}
  if(drift==='reentrant')f.controls.afterRead=()=>{if(!nested){nested=true;f.pins.targetMembership(f.graphData.groups);}};
  task7dRefusedV1(()=>task7ePinCallV1(f,'setup'),drift==='close-recycled');if(drift==='reentrant')assert.equal(nested,true);
  f.finish(drift==='close-recycled');
});
for(const invalid of ['wrong-output','wrong-groups','async-output'])test('Task7E H fixed setup refuses '+invalid+' without surviving authorization',()=>{
  const f=task7ePinsV1();const output=invalid==='wrong-output'?new Map():invalid==='async-output'?Promise.resolve(f.output):f.output;
  const groups=invalid==='wrong-groups'?[]:f.graphData.groups;
  task7dRefusedV1(()=>f.pins.targetSetupGraph(output,groups));f.finish();
});

function task7eCleanupV1(options={}){
  const names=['localCheck','check','readFixtureCatalogRowsLocal','readRunnerCatalogFactsLocal','readRuntimeCatalogFactsLocal','runnerCatalog','runtimeCatalog','readClosureFactsLocal','cleanupClosures','cleanupRunnerObjects'];
  const code=task7eLexicalV1(TASK5C_FIXTURE_V1,'openManualOrphanFixtureContextV1',names);
  const validators=task5cVmV1(['qualifyManualOrphanRunnerCatalogV1','advanceManualOrphanCleanupLedgerV1','advanceManualOrphanRouteLedgerV1']);
  const events=[],faults=[],controls={proofFault:0,proofCost:0,drift:false,afterAwait:0,pendingAt:0,pending:null,localFault:null,...options};
  let proof=0,awaits=0,now=0,origin=null,ended=false,pending=false,dropIndex=0;
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const need=guard(value=>{if(!value)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');});
  const unknown=()=>Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');
  const original=task4aCatalogV1();for(const role of original.roles)if(role.name==='root')Object.assign(role,{name:'postgres',inherit:true,createDb:true,replication:true});
  const canonical=helper.canonicalizeManualOrphanClusterBaselineV1(original),installation=ownedInstallationData(true);
  const rows=JSON.parse(JSON.stringify(original));rows.databases.push({name:installation.databaseName,oid:7,ownerOid:7,allowConnections:true,connectionLimit:-1});
  rows.roles.push({name:installation.ownerRole,oid:7,superuser:false,inherit:false,createRole:false,createDb:false,login:false,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null},
    {name:installation.runtimeRole,oid:8,superuser:false,inherit:false,createRole:false,createDb:false,login:true,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null});
  const pair={pid:700,backendStartedAtUTC:'2026-10-21T00:00:01.234567Z',datid:5,usesysid:1},constructor={pid:701,backendStartedAtUTC:'2026-10-21T00:00:01.345678Z'};
  const sessions=[{...pair,database:'postgres',user:'postgres',backendType:'client backend',clientAddress:'127.0.0.1'},
    {...constructor,datid:5,usesysid:1,database:'postgres',user:'postgres',backendType:'client backend',clientAddress:'127.0.0.1'}];
  const clockCode=task7eLexicalV1(TASK5C_FIXTURE_V1,'retainManualOrphanRunnerAdminV1',['mark','failure','sample','beginCleanup','endCleanup']);
  const clock=task7eVmV1(clockCode,['sample','beginCleanup','endCleanup'],{unknown:false,closed:false,stopped:false,pending:null,clocks:[],
    cleanupAttempted:false,cleanupEnded:false,cleanupClock:null,cleanupTimer:null,manualOrphanFixtureOutputFaultV1:false,
    process:{hrtime:{bigint:()=>BigInt(now)*1000000n}},setTimeout:guard((fn,ms)=>{assert.equal(ms,30000);return 1;}),clearTimeout:guard(id=>assert.equal(id,1))});
  const sample=guard(()=>{events.push('local:sample');clock.api.sample();if(controls.localFault==='sample'||clock.context.unknown)throw unknown();});
  const admin={beginCleanup:guard(()=>{assert.equal(origin,null);origin=now;events.push('clock:start');clock.api.beginCleanup();}),
    endCleanup:guard(()=>{events.push('clock:end');ended=true;clock.api.endCleanup();sample();}),
    current:()=>({pair,pending,unknown:false,closed:false}),query:guard(async(kind,operation)=>{
      sample();assert.equal(pending,false);pending=true;const index=++awaits;events.push('await:'+index+':'+kind);
      try{if(controls.pendingAt===index){assert.ok(controls.pending);await controls.pending;}
        if(kind.startsWith('drop-')){const object=kind.slice(5);assert.equal(object,['database','runtime','owner'][dropIndex++]);
          assert.equal(operation.object.kind,object);assert.equal(operation.object.oid,object==='runtime'?8:7);assert.deepEqual(task5cPlainV1(operation.installation),installation);
          assert.equal(operation.stage,{database:'activated',runtime:'database-dropped',owner:'runtime-dropped'}[object]);events.push('drop:'+object);
          if(object==='database')rows.databases=rows.databases.filter(r=>r.oid!==7);else rows.roles=rows.roles.filter(r=>r.oid!==(object==='runtime'?8:7));
        }
        if(index===controls.afterAwait)controls.drift=true;events.push('settled:'+index+':'+kind);
        if(kind==='identity'||kind.startsWith('drop-'))return [];
        assert.ok(['databases','roles','memberships','sessions'].includes(kind));return kind==='sessions'?sessions:rows[kind];
      }finally{pending=false;}
    })};
  const localRecord=label=>guard(()=>{events.push('local:'+label);if(controls.localFault===label)throw unknown();});
  const context={kind:'runner',frame:{source:ownedSourceData(),constructorAdminBackend:constructor,cluster:canonical},installation,baseline:canonical,
    ledger:task5cRouteLedgerV1('cases-settled'),cleanup:task5cCleanupLedgerV1(),admin,sqlClosed:false,initialPending:null,children:[],sourceClosed:false,
    sample,need,initialEnvironment:{},longPins:[],aliases:[],socketPin:null,originalGraph:{},prepared:{assertUnchanged:localRecord('prepared')},activation:{assertUnchanged:localRecord('activation')},
    process:{env:{},getuid:()=>501,geteuid:()=>501,getgid:()=>20,getegid:()=>20,platform:'darwin',arch:'arm64',version:'v26.4.0'},
    holder:{check:guard(()=>{events.push('source:'+ ++proof);now+=controls.proofCost;if(controls.drift||proof===controls.proofFault)throw unknown();})},
    observeManualOrphanOwnedFd4V1:()=>({claimed:true,adopted:true,closed:true,unknown:false}),
    setTimeout:guard((yes,ms)=>{assert.equal(ms,100);events.push('delay:100');now+=ms;yes();return 1;}),
    canonicalizeManualOrphanClusterBaselineV1:guard(value=>helper.canonicalizeManualOrphanClusterBaselineV1(task5cPlainV1(value))),
    qualifyManualOrphanRunnerCatalogV1:guard((...args)=>{events.push('census:'+args[0]);return task5cPlainV1(validators.api.qualifyManualOrphanRunnerCatalogV1(...args.map(x=>task5cDataV1(validators,x))));}),
    advanceManualOrphanCleanupLedgerV1:guard((ledger,event)=>{assert.equal(controls.drift,false,'no acknowledgement/absence before terminal Source proof');events.push('ledger:'+event.type);
      return task5cPlainV1(validators.api.advanceManualOrphanCleanupLedgerV1(task5cDataV1(validators,ledger),task5cDataV1(validators,event)));}),
    advanceManualOrphanRouteLedgerV1:guard((ledger,event)=>{assert.equal(controls.drift,false,'no route result before terminal Source proof');events.push('route:'+event.type);
      return task5cPlainV1(validators.api.advanceManualOrphanRouteLedgerV1(task5cDataV1(validators,ledger),task5cDataV1(validators,event)));}),
    closures:guard(()=>{faults.push('general closures reintroduced');throw Error('TASK7E_GENERAL_CLOSURES');}),
    phaseEvent:guard(()=>{faults.push('general phaseEvent reintroduced');throw Error('TASK7E_GENERAL_PHASE_EVENT');}),
  };
  const vm=task7eVmV1(code,names,context);
  return {events,controls,rows,sessions,context:vm.context,api:vm.api,run:vm.api.cleanupRunnerObjects,proofs:()=>proof,awaits:()=>awaits,pending:()=>pending,ended:()=>ended,at:ms=>{now=ms;},
    clean(){assert.deepEqual(faults,[],'no swallowed finite SQL/ledger assertion');vm.contained();clock.contained();validators.check();}};
}
function task7eBeforeV1(events,a,b){assert.ok(events.indexOf(a)>=0&&events.indexOf(b)>events.indexOf(a),a+' precedes '+b);}
function task7eProofRefusalV1(error){return ['MANUAL_ORPHAN_OWNER_REFUSED','MANUAL_ORPHAN_CLEANUP_UNKNOWN'].includes(error?.message);}
test('Task7E F cleanup has eight complete proofs and admits each exact DROP only after its own census',async()=>{
  // Break: borrowing an outside proof, acknowledging before post-census proof,
  // recursive general closures, reordered DROP, or replacing full validators.
  const f=task7eCleanupV1();await f.run();assert.equal(f.proofs(),8);assert.equal(f.ended(),true);assert.equal(f.awaits(),43);
  assert.deepEqual(f.events.filter(x=>x.startsWith('drop:')),['drop:database','drop:runtime','drop:owner']);
  task7eBeforeV1(f.events,'clock:start','source:1');task7eBeforeV1(f.events,'source:1','census:activated');
  for(const [object,before,after,pre,post] of [['database','activated','database-dropped',2,3],['runtime','database-dropped','runtime-dropped',4,5],['owner','runtime-dropped','owner-dropped',6,7]]){
    task7eBeforeV1(f.events,'source:'+pre,'drop:'+object);task7eBeforeV1(f.events,'drop:'+object,'census:'+after);
    task7eBeforeV1(f.events,'source:'+post,'ledger:'+object+'-ack');task7eBeforeV1(f.events,'ledger:'+object+'-ack','ledger:'+object+'-absent');
    task7eBeforeV1(f.events,'ledger:'+object+'-absent','route:'+after);
  }
  task7eBeforeV1(f.events,'delay:100','source:8');task7eBeforeV1(f.events,'source:8','clock:end');f.clean();
});
for(const at of [1,2,3,4,5,6,7,8])test('Task7E F cleanup complete proof '+at+' failure forbids next effect and authority',async()=>{
  const f=task7eCleanupV1({proofFault:at});await assert.rejects(f.run(),task7eProofRefusalV1);
  const drops=f.events.filter(x=>x.startsWith('drop:'));assert.equal(drops.length,Math.min(3,Math.floor((at-1)/2)));
  const accepted=f.events.filter(x=>/^ledger:.*-absent$/.test(x));assert.equal(accepted.length,Math.min(3,Math.max(0,Math.floor((at-2)/2))));
  assert.equal(f.ended(),true);assert.equal(f.pending(),false);f.clean();
});
// All 43 actual awaited query boundaries: eight five-query censuses + three
// DROP promises. One finite registration per await, no Cartesian fault matrix.
for(let at=1;at<=43;at++)test('Task7E F cleanup Source drift after awaited operation '+at+' prevents later DROP or accepted fact',async()=>{
  const f=task7eCleanupV1({afterAwait:at});await assert.rejects(f.run(),task7eProofRefusalV1);
  assert.ok(f.events.some(x=>x.startsWith('settled:'+at+':')),'injected await was reached');const index=f.events.findIndex(x=>x.startsWith('settled:'+at+':'));
  assert.equal(f.events.slice(index+1).some(x=>/^(drop:|ledger:|route:)/.test(x)),false);assert.equal(f.ended(),true);assert.equal(f.pending(),false);f.clean();
});
for(const at of [1,6,11,12,17,22,23,28,33,34,39,43])test('Task7E F cleanup pending operation '+at+' retains its actual promise through clock expiry',async()=>{
  const d=task5bDeferredV1(),f=task7eCleanupV1({pendingAt:at,pending:d.promise});let settled=false;
  const result=f.run().then(()=>{settled=true;return null;},error=>{settled=true;return error;});
  for(let i=0;i<300;i++)await Promise.resolve();assert.equal(f.awaits(),at);assert.equal(f.pending(),true);assert.equal(settled,false);
  f.at(30000);d.resolve();assert.ok(task7eProofRefusalV1(await result));assert.equal(f.pending(),false);assert.equal(f.ended(),true);f.clean();
});
for(const fault of ['prepared','activation','sample'])test('Task7E F cleanup preserves local '+fault+' refusal before first DROP',async()=>{
  const f=task7eCleanupV1({localFault:fault});await assert.rejects(f.run(),task7eProofRefusalV1);assert.equal(f.events.some(x=>x.startsWith('drop:')),false);f.clean();
});
test('Task7E F cleanup expensive proof cannot move outside the same thirty-second window',async()=>{
  const f=task7eCleanupV1({proofCost:15000});await assert.rejects(f.run(),task7eProofRefusalV1);
  assert.equal(f.events.some(x=>x.startsWith('drop:')),false);assert.equal(f.ended(),true);f.clean();
});
for(const fault of ['backend-pair','duplicate-session','database-owner','role-flags'])test('Task7E F cleanup local census retains '+fault+' predicate',async()=>{
  const f=task7eCleanupV1();if(fault==='backend-pair')f.sessions[0].backendStartedAtUTC='2026-10-21T00:00:01.234568Z';
  if(fault==='duplicate-session')f.sessions.push({...f.sessions[0]});if(fault==='database-owner')f.rows.databases.at(-1).ownerOid=99;
  if(fault==='role-flags')f.rows.roles.at(-1).superuser=true;
  await assert.rejects(f.run(),task7eProofRefusalV1);assert.equal(f.events.some(x=>x.startsWith('drop:')),false);f.clean();
});

function task7eResolverV1(options={}){
  const code=task7eLexicalV1(HELPER,null,['ownedSourceResolversV1','ownedResolutionProgramV1','ownedNodeV1','ownedSourceCleanupUncertainV1','ownedSourceRefusalV1','ownedSourceRequireV1']);
  const events=[],faults=[],controls={sourceFault:0,pinFault:0,childFault:null,absenceFault:false,...options};let proofs=0,pins=0,runs=0;
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const groups=[{row:['esm','dist/example.js','pkg','node_modules/pkg/index.js'],members:['dist/example.js']}];
  const recheck=guard(()=>{events.push('source:'+ ++proofs);if(proofs===controls.sourceFault)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');});
  const finitePins={check:guard(()=>{events.push('pins:'+ ++pins);if(pins===controls.pinFault)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');}),
    absent:guard(locator=>{events.push('absence:'+locator);assert.ok(locator.startsWith('/finite/search/pkg'));if(controls.absenceFault)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');})};
  const spawnSync=guard((node,args,options)=>{
    const index=runs++;events.push('spawn:'+index);assert.equal(node,TASK3_NODE_V1);
    assert.deepEqual(Array.from(args.slice(0,3)),['--experimental-import-meta-resolve','--input-type=module','-e']);assert.equal(args.length,4);
    assert.equal(args[3],"import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';\nconst input=JSON.parse(fs.readFileSync(0,'utf8'));\nprocess.stdout.write(JSON.stringify(input.edges.map(([mode,parent,specifier])=>{\nconst url=pathToFileURL(parent),require=createRequire(url);\nreturn input.phase==='paths'?require.resolve.paths(specifier):fileURLToPath(import.meta.resolve(specifier,url.href));\n})));",'exact builtin-only resolution program, no package body import');
    assert.deepEqual(Object.keys(options).sort(),['cwd','encoding','env','input','maxBuffer','shell','timeout']);
    assert.equal(options.cwd,controls.root??SOURCE_T_V1);assert.equal(options.encoding,'utf8');assert.equal(options.shell,false);assert.equal(options.timeout,5000);assert.equal(options.maxBuffer,1048576);
    assert.deepEqual(task5cPlainV1(options.env),{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',...(index>=2?{HOME:SOURCE_HOME_V1}:{})});
    const input=JSON.parse(options.input);assert.deepEqual(input,{phase:index%2===0?'paths':'resolve',edges:[['esm',(controls.root??SOURCE_T_V1)+'/dist/example.js','pkg']]});
    const response={status:0,signal:null,stderr:'',stdout:JSON.stringify(index%2===0?[['/finite/search',(controls.root??SOURCE_T_V1)+'/node_modules']]:[(controls.root??SOURCE_T_V1)+'/node_modules/pkg/index.js'])};
    if(index===(controls.childAt??0)){
      if(controls.childFault==='error')response.error=Error('finite error');if(controls.childFault==='timeout')response.error=Object.assign(Error('finite timeout'),{code:'ETIMEDOUT'});
      if(controls.childFault==='signal')response.signal='SIGTERM';if(controls.childFault==='status')response.status=1;if(controls.childFault==='stderr')response.stderr='unexpected';
      if(controls.childFault==='malformed')response.stdout='{';if(controls.childFault==='oversize')response.stdout=' '.repeat(1048577);
      if(controls.childFault==='resolve')response.stdout=JSON.stringify(['/wrong/result']);if(controls.childFault==='async')return Promise.resolve(response);
      if(controls.childFault==='no-node-modules')response.stdout=JSON.stringify([['/finite/search']]);
    }
    return response;
  });
  const vm=task7eVmV1(code,['ownedSourceResolversV1'],{spawnSync});
  return {events,controls,run:()=>vm.api.ownedSourceResolversV1(finitePins,controls.root??SOURCE_T_V1,groups,SOURCE_HOME_V1,recheck),
    proofs:()=>proofs,pins:()=>pins,runs:()=>runs,clean(){assert.deepEqual(faults,[],'no swallowed subprocess fixture assertion');vm.contained();}};
}
for(const root of [SOURCE_M_V1,SOURCE_T_V1])test('Task7E H exact fixed resolver unit for '+(root===SOURCE_M_V1?'M':'T')+' preserves all four programs and nine local proofs',()=>{
  const f=task7eResolverV1({root});f.run();assert.equal(f.runs(),4);assert.equal(f.proofs(),2);assert.equal(f.pins(),9);
  task7eBeforeV1(f.events,'source:1','spawn:0');task7eBeforeV1(f.events,'spawn:3','source:2');
  for(let i=0;i<4;i++){task7eBeforeV1(f.events,'pins:'+(i*2+1),'spawn:'+i);task7eBeforeV1(f.events,'spawn:'+i,'pins:'+(i*2+2));}
  assert.equal(f.events.filter(x=>x.startsWith('absence:')).length,8);f.clean();
});
for(const point of [1,2])test('Task7E H resolver Source bookend '+point+' refuses before any result authorization',()=>{
  const f=task7eResolverV1({sourceFault:point});assert.throws(f.run,task7eProofRefusalV1);assert.equal(f.runs(),point===1?0:4);f.clean();
});
for(const point of [1,2,3,4,5,6,7,8,9])test('Task7E H resolver local full-pin pass '+point+' drift forbids the next child',()=>{
  const f=task7eResolverV1({pinFault:point});assert.throws(f.run,task7eProofRefusalV1);assert.equal(f.runs(),Math.min(4,Math.floor(point/2)));f.clean();
});
for(const fault of ['error','timeout','signal','status','stderr','malformed','oversize','async','no-node-modules','resolve'])test('Task7E H resolver '+fault+' never permits a later resolver',()=>{
  const f=task7eResolverV1({childFault:fault,childAt:fault==='resolve'?1:0});assert.throws(f.run);assert.equal(f.runs(),fault==='resolve'?2:1);f.clean();
});
test('Task7E H resolver newly present search candidate refuses before resolving a package',()=>{
  const f=task7eResolverV1({absenceFault:true});assert.throws(f.run,task7eProofRefusalV1);assert.equal(f.runs(),1);f.clean();
});

function task7eHolderCheckV1(options={}){
  // No acquire body is evaluated. Real pins/resources prove retained contents;
  // exact owner/observer/Git boundaries are finite dependencies of actual check.
  const code=task7eLexicalV1(HELPER,null,['ownedSourceCleanupUncertainV1','ownedSourceRefusalV1','ownedSourceRequireV1','ownedGitShaV1','probeHexV1','ownedSourceBuildDataV1','ownedSourceEqualBuildV1'])+'\n'
    +task7eLexicalV1(HELPER,'holdManualOrphanOwnedSourcesV1',['check','close']);
  task7eLexicalV1(HELPER,'holdManualOrphanOwnedSourcesV1',['retainedTarget']);
  const f=task7dPinsV1();f.delegate();const events=[],controls={fault:null,...options};
  const guard=fn=>task5bGuardV1(events,fn),target=f.owner;
  const maintenance={check:()=>{events.push('maintenance');if(controls.fault==='maintenance')throw Error('MANUAL_ORPHAN_OWNER_REFUSED');}},
    anchor={check:()=>{events.push('anchor');if(controls.fault==='anchor')throw Error('MANUAL_ORPHAN_OWNER_REFUSED');}};
  const context={invalid:false,closed:false,ready:true,resources:f.resources,pins:f.pins,retainedTarget:target,owners:[maintenance,anchor,target],
    contextCheck:()=>{events.push('context');if(controls.fault==='context')throw Error('MANUAL_ORPHAN_OWNER_REFUSED');},
    identityCheck:()=>{events.push('identity');if(controls.fault==='identity')f.stockFault();},
    observers:['M','T'].map(name=>({expected:ownedReleaseData(name==='M'?OWN_M:OWN_T),read:()=>{events.push('observer:'+name);
      if(controls.fault==='observer:'+name)f.stockFault();return ownedReleaseData(name==='M'?OWN_M:OWN_T);}})),
    cleanup:()=>{events.push('cleanup');context.closed=true;f.resources.close();},
    ownedSourceRequireV1:value=>{if(!value)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');},
    ownedSourceRefusalV1:()=>Error('MANUAL_ORPHAN_OWNER_REFUSED')};
  const vm=task7eVmV1(code,['check','close'],context);return {f,events,controls,api:vm.api,clean(){f.contained();vm.contained();}};
}
test('Task7E H complete check has two same-T full pin proofs and retains M anchor both observers',()=>{
  const h=task7eHolderCheckV1(),before=h.f.checks(),opened=h.f.opened.length;h.api.check();
  assert.equal(h.f.checks()-before,2);assert.equal(h.f.opened.length-opened,1828);
  assert.deepEqual(h.events,['context','maintenance','anchor','identity','observer:M','observer:T','context']);h.f.finish();h.clean();
});
for(const fault of ['context','maintenance','anchor','identity','observer:M','observer:T'])test('Task7E H complete check '+fault+' refusal prevents accepted current Source',()=>{
  const h=task7eHolderCheckV1({fault});assert.throws(h.api.check,task7eProofRefusalV1);const before=h.f.opened.length;
  assert.throws(h.api.check,task7eProofRefusalV1);assert.equal(h.f.opened.length,before,'invalid owner cannot restart proof');
  h.f.finish(['identity','observer:M','observer:T'].includes(fault));h.clean();
});
test('Task7E H close runs complete proof while both stock owners remain retained then unwinds once',()=>{
  const h=task7eHolderCheckV1(),before=h.f.checks();h.api.close();assert.equal(h.f.checks()-before,2);
  assert.equal(h.events.at(-1),'cleanup');h.f.finish();h.clean();
});

for(const fault of ['escaped-facade','nested','async-result','wrong-root','wrong-home'])test('Task7E H resolver private scope rejects '+fault+' without a reusable local proof',()=>{
  task7eLexicalV1(HELPER,'ownedSourcePinsV1',['resolvePackages']);let facade=null,f,entered=0;
  const scope={ownedSourceResolversV1:(pins,root,groups,home,recheck)=>{
    facade=pins;entered++;if(fault==='nested')return f.pins.resolvePackages(root,groups,home,recheck);
    if(fault==='async-result')return Promise.resolve();pins.check();
  }};
  f=task7dPinsV1({scope});f.delegate();const recheck=()=>f.pins.check();
  const call=()=>f.pins.resolvePackages(fault==='wrong-root'?'/unadmitted':SOURCE_T_V1,[],fault==='wrong-home'?'/elsewhere':SOURCE_HOME_V1,recheck);
  if(fault==='escaped-facade'){call();assert.ok(facade);assert.throws(()=>facade.check(),task7eProofRefusalV1);}
  else assert.throws(call,task7eProofRefusalV1);
  assert.ok(entered<=1,'nested resolver never acquires another authorization');assert.equal(Object.hasOwn(f.pins,'checkLocal'),false);
  assert.equal(Object.hasOwn(f.pins,'skip'),false);f.finish();
});

function task7ePhaseV1(options={}){
  const names=['localPhaseCheck','check','queryLocal','readPhaseCatalogFactsLocal','catalog','qualify','loadNamespaceLocal','load',
    'loadRecordsAndMigrations','recordPins','readPreparedLocal','readActivationLocal','readPrepared','readActivation','readPreparedAndActivationForMechanical','select'];
  const code=task7eLexicalV1(HELPER,'runManualOrphanOwnedPhaseV1',names);
  const vm=task5bGateV1(),events=[],faults=[],controls={proofFault:0,drift:false,importFault:null,recordDrift:false,...options};
  const guard=fn=>task5bGuardV1(faults,fn),frame=ownedPhaseData('old_entry_positive');
  const base=task4aCatalogV1();for(const role of base.roles)if(role.name==='root')Object.assign(role,{name:'postgres',inherit:true,createDb:true,replication:true});
  const canonical=helper.canonicalizeManualOrphanClusterBaselineV1(base);Object.assign(frame.cluster,canonical);
  const rows=JSON.parse(JSON.stringify(base)),installation=ownedInstallationData(true);
  rows.databases.push({name:installation.databaseName,oid:7,ownerOid:7,allowConnections:true,connectionLimit:-1});
  rows.roles.push({name:installation.ownerRole,oid:7,superuser:false,inherit:false,createRole:false,createDb:false,login:false,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null},
    {name:installation.runtimeRole,oid:8,superuser:false,inherit:false,createRole:false,createDb:false,login:true,replication:false,bypassRls:false,connectionLimit:-1,validUntilUTC:null});
  const sql=task5bSqlFixtureV1(vm,{catalogRows:rows}),d=task5bDerivedV1();let proof=0,unknown=false,captured=false;
  const record=task5bProjectionV1(true),prepared=record.recordView.prepared,activation=record.recordView.activation;
  prepared.assertUnchanged=guard(()=>{events.push('prepared-current');if(controls.recordDrift)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');});
  activation.assertUnchanged=guard(()=>{events.push('activation-current');if(controls.recordDrift)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');});
  const recordApi={readFreshInstallationPreparedStateV1:guard(()=>{events.push('read-prepared');return prepared;}),
    readFreshInstallationActivationStateV1:guard(()=>{events.push('read-activation');if(controls.recordAfterRead)controls.recordDrift=true;return activation;})};
  const migrations=Array.from({length:33},(_,i)=>({version:i+1,name:'finite-'+i,checksum:OWN_H,migrationClass:'automatic'}));
  const namespaces={postgres:{default:guard((_endpoint,config)=>{assert.equal(config.max,1);assert.equal(config.connection.statement_timeout,5000);events.push('pool-return');return sql.pool;})},
    records:recordApi,migrations:{getContractSpineCurrentHeadJournalIdentitiesV1:()=>migrations},
    targetDatabase:{},maintenanceDatabase:{},targetSelection:{freshInstallationSelectionV1:{directory:d.installationsDirectory+'/'+OWN_ID},assertFreshInstallationSelectionUnchangedV1:guard(()=>events.push('selection-current'))},
    maintenanceSelection:{freshInstallationSelectionV1:{directory:d.installationsDirectory+'/'+OWN_ID},assertFreshInstallationSelectionUnchangedV1:guard(()=>events.push('selection-current'))},targetEntry:{},maintenanceEntry:{}};
  for(const key of ['targetDatabase','maintenanceDatabase'])Object.defineProperty(namespaces[key],'getSql',{get:guard(()=>{assert.equal(captured,true,'database retained before fallible property');events.push('database-property');return ()=>{};})});
  const paths={postgres:d.targetRoot+'/node_modules/postgres/src/index.js',records:d.targetRoot+'/dist/installation/fresh-installation-records-v1.js',
    migrations:d.targetRoot+'/dist/db/contract-spine-migrations.js',targetDatabase:d.targetRoot+'/dist/db-pg.js',maintenanceDatabase:d.maintenanceRoot+'/dist/db-pg.js',
    targetSelection:d.targetRoot+'/dist/installation/fresh-installation-selection-v1.js',maintenanceSelection:d.maintenanceRoot+'/dist/installation/fresh-installation-selection-v1.js',
    targetEntry:d.targetRoot+'/dist/installation/fresh-installation-entry-v1.js',maintenanceEntry:d.maintenanceRoot+'/dist/installation/fresh-installation-entry-v1.js'};
  const context={frame,admitted:d,derived:d,unknown:false,finished:false,qualified:false,expectedIdentity:null,sql:null,databaseClose:null,
    prepared:null,activationState:null,directory:null,records:recordApi,migrations:null,moduleCache:new Map(),selectionMade:false,selectedDirectory:null,
    holder:{source:{target:ownedReleaseData(OWN_T)},check:guard(()=>{events.push('source:'+ ++proof);if(controls.drift||proof===controls.proofFault)throw Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');})},
    pins:{check:guard(()=>events.push('phase-pins')),file:guard((locator,cap)=>{
      const name=path.basename(locator);assert.equal(path.dirname(locator),d.installationsDirectory+'/'+OWN_ID);
      const expected=name==='activation-prepared.json'?activation.preparedPin:name==='activated.json'?activation.activatedPin:prepared.baseRecordPins[name];
      assert.ok(expected,'only actual fixed record pins');assert.equal(cap,name==='runtime-credentials.json'?4096:32768);events.push('record-pin:'+name);
      return {stat:{uid:501n,gid:20n,mode:0o100600n},bytes:Buffer.alloc(expected.bytes+(controls.pinFault==='bytes'?1:0)),sha256:controls.pinFault==='hash'?OWN_C:expected.sha256};
    })},aliases:[],observations:null,
    sample:guard(()=>{if(unknown)throw Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN');events.push('sample');}),contextCurrent:guard(()=>events.push('context')),
    burn:()=>{unknown=true;},ownedTransportUnknownV1:()=>Error('MANUAL_ORPHAN_CLEANUP_UNKNOWN'),
    require:guard(value=>{if(!value)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');}),process:{env:{}},detach:value=>JSON.parse(JSON.stringify(value)),
    privateDirectory:guard(()=>({dev:'1',ino:'2',uid:501,gid:20,mode:448})),capacity:guard(()=>events.push('capacity')),
    ownedUuidV1:value=>value===OWN_ID,ownedCreatedRecordKeysV1:Object.keys(ownedInstallationData().records),
    recordPins:guard((names,expected)=>{events.push('record-pins');assert.ok(names.every(name=>expected[name]));if(controls.recordDrift)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');}),
    createManualOrphanPhaseSqlLedgerV1:guard(()=>{events.push('sql-ledger');return {...sql.ledger,query:(kind,expected)=>sql.ledger.query(kind,expected===undefined?undefined:task5bDataV1(vm,expected))};}),
    captureManualOrphanPhaseDatabaseV1:guard(namespace=>{events.push('capture-database');captured=true;return vm.api.captureManualOrphanPhaseDatabaseV1(namespace);}),
    validateManualOrphanPhaseBaselineV1:guard((rows,cluster,i)=>task5bPlainV1(vm.api.validateManualOrphanPhaseBaselineV1(task5bDataV1(vm,rows),task5bDataV1(vm,cluster),task5bDataV1(vm,i)))),
  };
  // The source uses require as a lexical assertion. Only transpiled import's
  // module dispatch is renamed, leaving every actual predicate untouched.
  const compiled=ts.transpileModule(code+'\nglobalThis.unit={'+names.join(',')+'};',{fileName:'actual-H-phase-units.ts',reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.deepEqual((compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  const ast=ts.createSourceFile('actual-phase-lowered.js',compiled.outputText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const edits=[];const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='require'
    &&node.arguments.length===1&&ts.isIdentifier(node.arguments[0])&&node.parent&&ts.isArrowFunction(node.parent)
    &&node.parent.parameters.length===1&&node.parent.parameters[0].name.getText(ast)===node.arguments[0].text
    &&ts.isCallExpression(node.parent.parent)&&ts.isPropertyAccessExpression(node.parent.parent.expression)
    &&node.parent.parent.expression.name.text==='then')edits.push([node.expression.getStart(ast),node.expression.end]);ts.forEachChild(node,visit);};visit(ast);
  assert.equal(edits.length,1,'only actual loadNamespaceLocal dynamic import is redirected');
  // TS lowers import() to Promise.resolve(...).then(s => require(s)); the exact
  // generated node alone is redirected. Plain Source require(predicates) stays.
  let lowered=compiled.outputText;for(const [start,end] of edits.reverse())lowered=lowered.slice(0,start)+'importBoundary'+lowered.slice(end);
  context.importBoundary=guard(specifier=>{const key=Object.keys(paths).find(key=>url.pathToFileURL(paths[key]).href===specifier);assert.ok(key,'closed exact import URL');events.push('import:'+key);
    if(controls.importFault===key)throw Error('MANUAL_ORPHAN_OWNER_REFUSED');if(controls.importDrift===key)controls.drift=true;return namespaces[key];});
  Object.assign(context,{Buffer,Error,path,pathToFileURL:url.pathToFileURL});
  runInNewContext(lowered,context,{filename:'actual-H-phase-units',timeout:5000});
  return {events,controls,context,api:context.unit,sql,rows,installation,prepared,activation,recordApi,namespaces,proofs:()=>proof,
    async finish(){try{await sql.ledger.close();}catch(error){assert.ok(task7eProofRefusalV1(error));}assert.deepEqual(faults,[]);sql.check();vm.assertContained();},
    selectReady(purpose='old_entry_positive'){context.qualified=true;context.sql={current:()=>({closed:true})};context.prepared=prepared;context.directory=d.installationsDirectory+'/'+OWN_ID;context.frame.purpose=purpose;},
    qualify:()=>context.unit.qualify('postgresql://finite',installation,prepared)};
}

test('Task7E H qualifier keeps four full proofs and actual reservation identity catalog joins',async()=>{
  const f=task7ePhaseV1();await f.qualify();assert.equal(f.proofs(),4);assert.equal(f.context.qualified,true);
  assert.deepEqual(f.sql.calls.queries,['identity','databases','roles','memberships','identity']);assert.equal(f.sql.calls.reserves,1);
  task7eBeforeV1(f.events,'source:1','import:postgres');task7eBeforeV1(f.events,'import:postgres','source:2');task7eBeforeV1(f.events,'pool-return','source:3');
  const before=f.proofs();await f.api.catalog(f.installation);assert.equal(f.proofs()-before,2);await f.finish();
});
for(const proof of [1,2,3,4])test('Task7E H qualifier failed proof '+proof+' never grants qualification',async()=>{
  const f=task7ePhaseV1({proofFault:proof});await assert.rejects(f.qualify(),task7eProofRefusalV1);assert.equal(f.context.qualified,false);
  if(proof<=2)assert.equal(f.sql.ledger.current().poolCaptured,false);if(proof>=3)assert.equal(f.sql.ledger.current().poolCaptured,true);
  if(proof===4){assert.equal(f.sql.ledger.current().reservationCaptured,true);assert.equal(f.sql.calls.queries.length,5);}await f.finish();
});
test('Task7E H qualifier retains a late actual reservation and joins close after terminal drift',async()=>{
  const f=task7ePhaseV1(),d=task5bDeferredV1();f.sql.reserveValue=d.promise;
  const out=trackProbePromiseV1(f.qualify());await task5bPumpV1();assert.equal(f.sql.calls.reserves,1);assert.equal(out.outcome,null);
  f.controls.drift=true;d.resolve(f.sql.reservation);await out.done;assert.ok(task7eProofRefusalV1(out.outcome.error));
  assert.equal(f.sql.ledger.current().reservationCaptured,true);assert.equal(f.context.qualified,false);await f.finish();assert.equal(f.sql.calls.releases,1);assert.equal(f.sql.calls.ends,1);
});
for(const fault of ['owner-oid','postgres-flags','backend-pair'])test('Task7E H qualifier retains actual '+fault+' rejection',async()=>{
  const f=task7ePhaseV1();if(fault==='owner-oid')f.rows.databases.find(x=>x.name==='postgres').ownerOid=99;
  if(fault==='postgres-flags')f.rows.roles.find(x=>x.name==='postgres').superuser=false;
  if(fault==='backend-pair')f.sql.nextRows=[{...task5bIdentityV1().rows[0],pid:701}];
  await assert.rejects(f.qualify(),task7eProofRefusalV1);assert.equal(f.context.qualified,false);await f.finish();
});
for(const [purpose,count] of [['old_entry_positive',5],['new_entry_refusal',5],['activate',4]])test('Task7E H select '+purpose+' fully brackets each actual import and retains database first',async()=>{
  const f=task7ePhaseV1();f.selectReady(purpose);await f.api.select(false);assert.equal(f.proofs(),count);
  const imports=f.events.filter(x=>x.startsWith('import:'));assert.deepEqual(imports,purpose==='activate'?['import:targetDatabase','import:targetSelection']:['import:targetDatabase','import:targetSelection','import:targetEntry']);
  task7eBeforeV1(f.events,'import:targetDatabase','capture-database');task7eBeforeV1(f.events,'capture-database','source:3');
  task7eBeforeV1(f.events,'source:3','import:targetSelection');if(purpose!=='activate')task7eBeforeV1(f.events,'source:4','import:targetEntry');assert.ok(f.context.databaseClose);await f.finish();
});
for(const [key,after] of [['targetDatabase','targetSelection'],['targetSelection','targetEntry']])test('Task7E H drift after '+key+' retains namespace and prevents '+after,async()=>{
  const f=task7ePhaseV1({importDrift:key});f.selectReady();await assert.rejects(f.api.select(false),task7eProofRefusalV1);
  assert.equal(f.events.includes('import:'+after),false);assert.ok(f.context.databaseClose,'namespace close obligation retained before failed post-import proof');await f.finish();
});
test('Task7E H fixed records migrations startup shares only adjacent complete import boundaries',async()=>{
  const f=task7ePhaseV1();await f.api.loadRecordsAndMigrations();assert.equal(f.proofs(),3);
  task7eBeforeV1(f.events,'source:1','import:records');task7eBeforeV1(f.events,'import:records','source:2');task7eBeforeV1(f.events,'source:2','import:migrations');task7eBeforeV1(f.events,'import:migrations','source:3');
  assert.equal(f.context.migrations.length,33);await f.finish();
});
for(const at of [1,2,3])test('Task7E H startup Source proof '+at+' failure prevents accepted modules',async()=>{
  const f=task7ePhaseV1({proofFault:at});await assert.rejects(f.api.loadRecordsAndMigrations(),task7eProofRefusalV1);
  if(at<3)assert.equal(f.events.includes('import:migrations'),false);await f.finish();
});
for(const key of ['records','unknown-key'])test('Task7E H standalone load '+key+' cannot bypass full guard on cache or unrecognized key',async()=>{
  const f=task7ePhaseV1({proofFault:1});f.context.moduleCache.set('records',f.recordApi);await assert.rejects(f.api.load(key),task7eProofRefusalV1);
  assert.equal(f.events.some(x=>x.startsWith('import:')),false);await f.finish();
});
test('Task7E H mechanical record pair keeps two full proofs with both actual retained record readers',async()=>{
  const f=task7ePhaseV1();f.context.frame.input.installation=f.installation;
  const got=f.api.readPreparedAndActivationForMechanical();assert.equal(f.proofs(),2);assert.ok(got);assert.equal(f.context.prepared,f.prepared);assert.equal(f.context.activationState,f.activation);
  task7eBeforeV1(f.events,'source:1','read-prepared');task7eBeforeV1(f.events,'read-prepared','read-activation');task7eBeforeV1(f.events,'read-activation','source:2');await f.finish();
});
for(const fault of ['record-after-read','terminal-source'])test('Task7E H mechanical pair '+fault+' refuses provisional records',async()=>{
  const f=task7ePhaseV1(fault==='record-after-read'?{recordAfterRead:true}:{proofFault:2});f.context.frame.input.installation=f.installation;
  assert.throws(()=>f.api.readPreparedAndActivationForMechanical(),task7eProofRefusalV1);assert.equal(f.context.activationState,f.activation,'returned record retained before validation');await f.finish();
});

function task7eFirstObserverV1(failRoot=null){
  task7eLexicalV1(HELPER,null,['ownedSourceResolversV1']);
  const source=task7dSourceV1(),owner=source.ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='holdManualOrphanOwnedSourcesV1');
  const outer=owner.body.statements.find(ts.isTryStatement),statements=[...outer.tryBlock.statements];
  const start=statements.findIndex(n=>ts.isForOfStatement(n)&&n.getText(source.ast).includes('ownedSourcePackagesV1'));
  assert.ok(start>=0,'actual two-root audit loop');const end=statements.findIndex((n,i)=>i>start&&ts.isForOfStatement(n)&&n.getText(source.ast).includes('await import'));
  assert.ok(end>start,'actual first full observer import loop');const code=statements.slice(start,end+1).map(n=>n.getText(source.ast)).join('\n');
  const events=[],faults=[],sets={maintenance:new Set(Array.from({length:143},(_,i)=>'dist/m'+i+'.js')),
    target:new Set(Array.from({length:153},(_,i)=>'dist/t'+i+'.js')),observer:new Set(Array.from({length:121},(_,i)=>'dist/o'+i+'.js'))};
  const guard=fn=>task5bGuardV1(faults,fn),resolvers=new Map();
  const roots=['dist/setup'],observer='dist/observer',profile={maintenanceObserver:{resolution:[]},targetAbsences:[]};
  const context={path,pathToFileURL:url.pathToFileURL,maintenanceRoot:SOURCE_M_V1,targetRoot:SOURCE_T_V1,maintenanceOutput:new Map(),targetOutput:new Map(),
    maintenanceGroups:[],targetGroups:[],ownedOrdinaryRootsV1:roots,ownedSetupRootsV1:roots,ownedObserverV1:observer,profile,
    ordinaryFiles:sets.maintenance,setupFiles:sets.target,observerFiles:sets.observer,pins:{},home:SOURCE_HOME_V1,
    maintenance:{expected:ownedReleaseData(OWN_M)},target:{expected:ownedReleaseData(OWN_T)},observers:[],
    check:guard(()=>events.push('holder-check')),ownedSourceRequireV1:guard(value=>assert.ok(value,'actual audit guard')),
    ownedSourceSetEqualV1:(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort()),
    compiled:guard(()=>{faults.push('unexpected slice compiled read');throw Error('TASK7E_UNLISTED');}),
    ownedSourceGraphV1:guard((root,_output,starts)=>({files:starts[0]===observer?sets.observer:root===SOURCE_M_V1?sets.maintenance:sets.target,
      members:new Set(Array.from({length:starts[0]===observer?79:root===SOURCE_M_V1?82:85},(_,i)=>i))})),
    ownedSourcePackagesV1:guard((_pins,root)=>{events.push('package:'+root);const f=task7eResolverV1({root,sourceFault:failRoot===root?2:0});resolvers.set(root,f);return f.run();}),
    require:guard(specifier=>{events.push('first-observer-import');assert.equal(specifier,url.pathToFileURL(SOURCE_M_V1+'/'+observer).href);throw Error('TASK7E_FIRST_OBSERVER_STOP');}),
  };
  context.pins.targetSetupGraph=()=>({files:sets.target,members:new Set(Array.from({length:85},(_,i)=>i))});
  context.pins.targetObserverGraph=()=>({files:sets.observer,members:new Set(Array.from({length:79},(_,i)=>i))});
  const lowered=ts.transpileModule('globalThis.run=async()=>{'+code+'};',{fileName:'actual-H-first-observer.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  runInNewContext(lowered.outputText,context,{filename:'actual-H-post-audit-import-order',timeout:5000});
  return {events,resolvers,run:context.run,clean(){assert.deepEqual(faults,[]);for(const f of resolvers.values())f.clean();}};
}
test('Task7E H first full observer import follows both actual four-resolver terminal proofs',async()=>{
  const f=task7eFirstObserverV1();await assert.rejects(f.run(),/TASK7E_FIRST_OBSERVER_STOP/);
  assert.equal(f.resolvers.size,2);assert.equal([...f.resolvers.values()].reduce((n,x)=>n+x.runs(),0),8);
  task7eBeforeV1(f.events,'package:'+SOURCE_T_V1,'first-observer-import');f.clean();
});
for(const root of [SOURCE_M_V1,SOURCE_T_V1])test('Task7E H '+(root===SOURCE_M_V1?'M':'T')+' resolver terminal drift prevents first compiled observer import',async()=>{
  const f=task7eFirstObserverV1(root);await assert.rejects(f.run(),task7eProofRefusalV1);assert.equal(f.events.includes('first-observer-import'),false);
  assert.equal(f.resolvers.get(root).runs(),4);if(root===SOURCE_M_V1)assert.equal(f.resolvers.has(SOURCE_T_V1),false);f.clean();
});

function task7eIdentityGitV1(options={}){
  const code=task7eLexicalV1(HELPER,'holdManualOrphanOwnedSourcesV1',['identityGit']);
  const events=[],faults=[],controls={fault:null,...options};
  const guard=fn=>task5bGuardV1(faults,fn),refuse=()=>Error('MANUAL_ORPHAN_OWNER_REFUSED');
  const context={maintenanceRoot:SOURCE_M_V1,targetRoot:SOURCE_T_V1,maintenanceCommon:'/finite/M.git',targetCommon:'/finite/T.git',
    ownedSourceRequireV1:guard(value=>{if(!value)throw refuse();}),ownedSourceRefusalV1:refuse,
    pins:{file:guard((locator)=>{assert.equal(locator,'/usr/bin/git');events.push('executable-proof');if(controls.fault==='executable')throw refuse();return {bytes:Buffer.from('finite-git'),sha256:OWN_H};}),
      directory:guard(locator=>{assert.ok(['/finite/M.git','/finite/T.git'].includes(locator));events.push('directory-proof');if(controls.fault==='common-directory')throw refuse();return {dev:1n,ino:2n};}),
      check:guard(()=>{faults.push('recursive whole-Source pins check');throw Error('TASK7E_RECURSIVE');})},
    spawnSync:guard((executable,args,options)=>{assert.equal(executable,'/usr/bin/git');events.push('git');
      assert.deepEqual(Array.from(args),['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','rev-parse','--git-common-dir']);
      assert.equal(options.cwd,SOURCE_M_V1);assert.equal(options.shell,false);assert.equal(options.timeout,10000);assert.equal(options.maxBuffer,16777216);
      assert.deepEqual(task5bPlainV1(options.env),{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'});
      const result={status:0,signal:null,stderr:Buffer.alloc(0),stdout:Buffer.from('/finite/M.git\n')};
      if(controls.fault==='signal')result.signal='SIGTERM';if(controls.fault==='status')result.status=1;if(controls.fault==='stderr')result.stderr=Buffer.from('unexpected');
      if(controls.fault==='stdout-type')result.stdout='/finite/M.git\n';if(controls.fault==='timeout')result.error=Object.assign(Error('timeout'),{code:'ETIMEDOUT'});
      if(controls.fault==='executable-after')controls.fault='executable';if(controls.fault==='directory-after')controls.fault='common-directory';return result;
    })};
  const vm=task7eVmV1(code,['identityGit'],context);return {events,run:()=>vm.api.identityGit(['rev-parse','--git-common-dir']),clean(){assert.deepEqual(faults,[]);vm.contained();}};
}
test('Task7E H internal identity Git authenticates executable and common directory at the actual fixed command',()=>{
  const f=task7eIdentityGitV1();assert.equal(f.run().toString(),'/finite/M.git\n');task7eBeforeV1(f.events,'executable-proof','git');task7eBeforeV1(f.events,'directory-proof','git');f.clean();
});
for(const fault of ['executable','common-directory','executable-after','directory-after','signal','status','stderr','stdout-type','timeout'])test('Task7E H identity Git '+fault+' refuses actual fixed identity',()=>{
  const f=task7eIdentityGitV1({fault});assert.throws(f.run,task7eProofRefusalV1);if(['executable','common-directory'].includes(fault))assert.equal(f.events.includes('git'),false);f.clean();
});

for(const kind of ['runner','runtime'])test('Task7E F standalone '+kind+' catalog has complete boundaries around original local row predicates',async()=>{
  const f=task7eCleanupV1();if(kind==='runner')await f.api.runnerCatalog('activated');else await f.api.runtimeCatalog();
  assert.equal(f.proofs(),2);assert.equal(f.awaits(),5);assert.equal(f.events.some(x=>x.startsWith('drop:')),false);f.clean();
});
for(const kind of ['runner','runtime'])test('Task7E F standalone '+kind+' catalog terminal drift cannot return accepted facts',async()=>{
  const f=task7eCleanupV1({afterAwait:5});await assert.rejects(kind==='runner'?f.api.runnerCatalog('activated'):f.api.runtimeCatalog(),task7eProofRefusalV1);
  assert.equal(f.events.some(x=>x.startsWith('ledger:')||x.startsWith('route:')),false);f.clean();
});
for(const fault of ['runtime-login','generated-membership','residual-baseline'])test('Task7E F runtime local facts preserve '+fault+' refusal',async()=>{
  const f=task7eCleanupV1();if(fault==='runtime-login')f.rows.roles.at(-1).login=false;
  if(fault==='generated-membership')f.rows.memberships.push({roleOid:7,memberOid:8,grantorOid:1,adminOption:false,inheritOption:true,setOption:true});
  if(fault==='residual-baseline')f.rows.databases.find(x=>x.name==='template0').connectionLimit=1;
  await assert.rejects(f.api.runtimeCatalog(),task7eProofRefusalV1);f.clean();
});
test('Task7E F general closure projection still requires its own complete Source check',()=>{
  const f=task7eCleanupV1(),code=task7eLexicalV1(TASK5C_FIXTURE_V1,'openManualOrphanFixtureContextV1',['readClosureFactsLocal','closures']);
  const vm=task7eVmV1(code,['closures'],{...f.context,check:f.api.check});const result=vm.api.closures();assert.equal(result.source,'retained');assert.equal(f.proofs(),1);vm.contained();f.clean();
});

// Wiring assertions supplement the behavioral fault controls above; they never
// substitute for a retained-stock, content, operation or deadline predicate.
test('Task7E fixed private methods remain connected only to the adopted Source lexical callsites',()=>{
  const text=readFileSync(HELPER,'utf8'),ast=ts.createSourceFile('actual-H.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),nodes=[];
  const visit=n=>{nodes.push(n);ts.forEachChild(n,visit);};visit(ast);
  for(const name of ['targetSetupGraph','targetObserverGraph','targetMembership','resolvePackages']){
    const calls=nodes.filter(n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text===name);
    assert.equal(calls.length,1,'one fixed lexical use of '+name);assert.equal(calls[0].expression.expression.getText(ast),'pins');
  }
  const holder=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='holdManualOrphanOwnedSourcesV1');
  const frozen=nodes.filter(n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='Object.freeze'&&n.arguments.length===1
    &&ts.isObjectLiteralExpression(n.arguments[0])&&n.pos>holder.pos&&n.end<holder.end
    &&JSON.stringify(n.arguments[0].properties.map(p=>p.name?.getText(ast)).sort())===JSON.stringify(['check','close','source']));
  assert.equal(frozen.length,1,'frozen public owner remains exact');
  for(const name of ['targetSetupGraph','targetObserverGraph','targetMembership','resolvePackages','ownedSourceResolversV1'])
    assert.equal(ast.statements.some(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&n.name?.text===name),false,'no new public proof interface');
});
test('Task7E constructor fixed observation units remain single lexical calls with local admin ownership',()=>{
  const text=readFileSync(CONSTRUCTOR,'utf8'),ast=ts.createSourceFile('actual-K.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),nodes=[];
  const owner=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='runManualOrphanConstructorV1');assert.ok(owner);
  const visit=n=>{nodes.push(n);ts.forEachChild(n,visit);};visit(owner);
  for(const name of ['waitForConstructorReadinessAndOpenAdmin','readConstructorInitialIdentity','readConstructorInitialBaseline',
    'readConstructorPreSpawnFacts','readConstructorQuiescenceSamples','closeConstructorAdmin','settleConstructorServer']){
    const calls=nodes.filter(n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text===name);assert.equal(calls.length,1,'one fixed call '+name);assert.equal(calls[0].arguments.length,0);
  }
  const opens=nodes.filter(n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='openManualOrphanConstructorAdminV1');
  assert.equal(opens.length,1);assert.equal(opens[0].arguments[1].getText(ast),'localCheck');
});

test('Task7E H resolver local full-pin predicate detects changed original Node bytes before another subprocess',()=>{
  task7eLexicalV1(HELPER,'ownedSourcePinsV1',['resolvePackages']);let f,passes=0;
  const scope={ownedSourceResolversV1:pins=>{pins.check();passes++;f.files.get(TASK3_NODE_V1).bytes=Buffer.from('changedNode');pins.check();passes++;}};
  f=task7dPinsV1({scope,extraFiles:[[TASK3_NODE_V1,'originalNod']]});f.delegate();
  assert.throws(()=>f.pins.resolvePackages(SOURCE_T_V1,[],SOURCE_HOME_V1,()=>f.pins.check()),task7eProofRefusalV1);
  assert.equal(passes,1,'actual original pin digest predicate rejects the next local complete pass');f.finish();
});
for(const fault of ['bytes','hash'])test('Task7E H mechanical pair actual record-pin '+fault+' predicate refuses provisional state',async()=>{
  const f=task7ePhaseV1({pinFault:fault});f.context.frame.input.installation=f.installation;
  assert.throws(()=>f.api.readPreparedAndActivationForMechanical(),task7eProofRefusalV1);assert.ok(f.events.some(x=>x.startsWith('record-pin:')));await f.finish();
});


// The resolver subprocess body is separately exercised above. These six rows
// isolate its actual private pins facade and injected fixed context predicate;
// every local pin read below still executes the original Source implementation.
function task7eResolverContextV1(mode){
  task7eLexicalV1(HELPER,'ownedSourcePinsV1',['resolvePackages']);
  const faults=[],guard=fn=>task5bGuardV1(faults,fn);let f,calls=0,entered=0,accepted=0,nested=0;
  const recheck=()=>f.pins.check(),groups=[];
  const scope={ownedSourceResolversV1:guard((facade,root,actualGroups,home,actualRecheck)=>{
    entered++;assert.equal(root,SOURCE_T_V1);assert.equal(actualGroups,groups);assert.equal(home,SOURCE_HOME_V1);assert.equal(actualRecheck,recheck);
    facade.check();accepted++;
  })};
  const sourceContext=mode==='nonfunction'?null:guard(()=>{
    calls++;f.events.push(['resolver-context',calls]);
    if(mode==='before-throw'||mode==='terminal-throw'&&calls===2)throw Error('FINITE_CONTEXT_DRIFT');
    if(mode==='async-return')return Promise.resolve();
    if(mode==='caught-reentrant'&&calls===1){
      assert.throws(()=>f.pins.resolvePackages(SOURCE_T_V1,groups,SOURCE_HOME_V1,recheck),task7eProofRefusalV1);nested++;
    }
  });
  f=task7dPinsV1({scope,sourceContext});f.delegate();
  return {f,run:()=>f.pins.resolvePackages(SOURCE_T_V1,groups,SOURCE_HOME_V1,recheck),calls:()=>calls,entered:()=>entered,
    accepted:()=>accepted,nested:()=>nested,clean(){f.finish();assert.deepEqual(faults,[],'no swallowed context/facade assertion');}};
}
test('Task7E H resolver context synchronous undefined guard brackets actual complete local pins',()=>{
  const h=task7eResolverContextV1('positive'),f=h.f,start=f.events.length,opened=f.opened.length;h.run();
  assert.equal(h.calls(),2);assert.equal(h.entered(),1);assert.equal(h.accepted(),1);
  const events=f.events.slice(start),first=events.findIndex(e=>e[0]==='resolver-context'&&e[1]===1),last=events.findIndex(e=>e[0]==='resolver-context'&&e[1]===2);
  assert.ok(first>=0&&last>first);const body=events.slice(first+1,last);
  assert.equal(f.opened.length-opened,914,'actual local pass opens all original delegated files');
  for(const item of f.opened.slice(opened)){
    assert.ok(body.some(e=>e[0]==='held'&&e[1]===item.fd));assert.ok(body.some(e=>e[0]==='named'&&e[1]===item.path));
    assert.ok(body.some(e=>e[0]==='read'&&e[1]===item.fd&&e[2]===item.item.bytes.length),'actual EOF before terminal context');
    assert.ok(body.some(e=>e[0]==='close'&&e[1]===item.fd));assert.equal(item.closed,true);
  }
  const retained=f.opened.find(item=>item.path===f.keep);assert.ok(retained);
  assert.ok(body.some(e=>e[0]==='read'&&e[1]===retained.fd&&e[2]===retained.item.bytes.length),'retained H file EOF also checked');
  assert.ok(body.some(e=>e[0]==='members'),'actual topology accompanies local content');h.clean();
});
test('Task7E H resolver context before throw prevents local read and accepted return',()=>{
  const h=task7eResolverContextV1('before-throw'),opened=h.f.opened.length;assert.throws(h.run,task7eProofRefusalV1);
  assert.equal(h.calls(),1);assert.equal(h.entered(),1);assert.equal(h.accepted(),0);assert.equal(h.f.opened.length,opened);h.clean();
});
test('Task7E H resolver context terminal throw rejects completed provisional local pins',()=>{
  const h=task7eResolverContextV1('terminal-throw'),opened=h.f.opened.length;assert.throws(h.run,task7eProofRefusalV1);
  assert.equal(h.calls(),2);assert.equal(h.accepted(),0);assert.equal(h.f.opened.length-opened,914);
  assert.ok(h.f.opened.slice(opened).every(item=>item.closed),'actual reads closed before terminal refusal');h.clean();
});
test('Task7E H resolver context async thenable return cannot grant a local scope',()=>{
  const h=task7eResolverContextV1('async-return'),opened=h.f.opened.length;assert.throws(h.run,task7eProofRefusalV1);
  assert.equal(h.calls(),1);assert.equal(h.accepted(),0);assert.equal(h.f.opened.length,opened);h.clean();
});
test('Task7E H resolver context caught reentrant attempt leaves sticky refusal',()=>{
  const h=task7eResolverContextV1('caught-reentrant'),opened=h.f.opened.length;assert.throws(h.run,task7eProofRefusalV1);
  assert.equal(h.nested(),1);assert.equal(h.calls(),1);assert.equal(h.entered(),1);assert.equal(h.accepted(),0);
  assert.equal(h.f.opened.length,opened);assert.throws(()=>h.f.pins.file(h.f.paths[0]),task7eProofRefusalV1);
  assert.equal(h.f.opened.length,opened,'caught nested refusal cannot restart ordinary reads');h.clean();
});
test('Task7E H resolver context nonfunction shape refuses before fixed resolver entry',()=>{
  const h=task7eResolverContextV1('nonfunction'),opened=h.f.opened.length;assert.throws(h.run,task7eProofRefusalV1);
  assert.equal(h.calls(),0);assert.equal(h.entered(),0);assert.equal(h.accepted(),0);assert.equal(h.f.opened.length,opened);h.clean();
});

// Task2 cache boundary. Complete actual F functions in the existing inert
// realm; no Source holder, successful constructor, native child or TSX import.
// Break: integration lacks fixed1, builtin leaves inherit it, or metadata/input
// are changed while the plan builds its fresh output.
test('Task2 F adds cache suppression only to integration output with Darwin metadata',()=>{
  const vm=task5cVmV1(['planManualOrphanFixtureChildV1']),cases=task5cCasesV1(5);
  for(const purpose of ['integration','provision','activate','old_entry_positive','new_entry_refusal'])cases.run(purpose,()=>{
    const paths=task5cChildPathsV1();paths.env.__CF_USER_TEXT_ENCODING='0x1F5:0x23:0x18';
    const input=task5cDataV1(vm,paths),before=JSON.stringify(input);
    const plan=vm.api.planManualOrphanFixtureChildV1(purpose,input),env=plan.options.env;
    assert.notEqual(env,input.env);assert.equal(JSON.stringify(input),before);
    assert.equal(Object.hasOwn(input.env,'TSX_DISABLE_CACHE'),false);
    assert.equal(env.__CF_USER_TEXT_ENCODING,'0x1F5:0x23:0x18');
    if(purpose==='integration'){
      assert.equal(env.TSX_DISABLE_CACHE,'1');
      assert.deepEqual(task5cPlainV1(plan.args),['--import','tsx','--test','--test-isolation=none',FILE]);
      assert.deepEqual(task5cPlainV1(env),{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C',
        __CF_USER_TEXT_ENCODING:'0x1F5:0x23:0x18',TSX_DISABLE_CACHE:'1'});
    }else{
      assert.equal(Object.hasOwn(env,'TSX_DISABLE_CACHE'),false);
      assert.deepEqual(task5cPlainV1(plan.args),[SOURCE_M_V1+SOURCE_SUFFIX_V1]);
      assert.deepEqual(task5cPlainV1(env),{PATH:TASK3_PATH_V1,LANG:'C',LC_ALL:'C',__CF_USER_TEXT_ENCODING:'0x1F5:0x23:0x18'});
    }
    assert.equal(plan.executable,TASK3_NODE_V1);assert.equal(plan.options.cwd,SOURCE_M_V1);
    assert.equal(plan.options.argv0,TASK3_NODE_V1);assert.equal(plan.options.shell,false);assert.equal(plan.options.detached,false);
    assert.deepEqual(task5cPlainV1(plan.options.stdio),['ignore','pipe','pipe','ignore','pipe']);
    task5cFrozenV1(plan);vm.check();
  });
  cases.done();assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
});

// Break: the generated OUTPUT flag is admitted as ambient plan INPUT.
test('Task2 F refuses ambient cache flag in unchanged plan input',()=>{
  const vm=task5cVmV1(['planManualOrphanFixtureChildV1']),cases=task5cCasesV1(2);
  for(const purpose of ['integration','old_entry_positive'])cases.run(purpose,()=>{
    const paths=task5cChildPathsV1();paths.env.TSX_DISABLE_CACHE='1';
    const input=task5cDataV1(vm,paths),before=JSON.stringify(input);
    task5cRefusedV1(()=>vm.api.planManualOrphanFixtureChildV1(purpose,input));
    assert.equal(JSON.stringify(input),before);vm.check();
  });
  cases.done();assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
});

function task2CacheLaunchV1(kind){
  const vm=task5cVmV1(['qualifyManualOrphanFixtureLaunchV1']),cases=task5cCasesV1(8);
  const call=f=>vm.api.qualifyManualOrphanFixtureLaunchV1(kind,task5cDataV1(vm,f.actual),task5cDataV1(vm,f.frame));
  for(const [name,change] of [
    ['missing flag',f=>{delete f.actual.env.TSX_DISABLE_CACHE;}],
    ['empty flag',f=>{f.actual.env.TSX_DISABLE_CACHE='';}],
    ['zero flag',f=>{f.actual.env.TSX_DISABLE_CACHE='0';}],
    ['two flag',f=>{f.actual.env.TSX_DISABLE_CACHE='2';}],
    ['text true flag',f=>{f.actual.env.TSX_DISABLE_CACHE='true';}],
    ['boolean true flag',f=>{f.actual.env.TSX_DISABLE_CACHE=true;}],
    ['extra environment key',f=>{f.actual.env.NODE_OPTIONS='';}],
  ])cases.run(name,()=>{
    const f=task5cLaunchV1(kind);change(f);const before=JSON.stringify(f);
    task5cRefusedV1(()=>call(f));assert.equal(JSON.stringify(f),before);vm.check();
  });
  cases.run('exact literal1',()=>{
    const f=task5cLaunchV1(kind),before=JSON.stringify(f);
    const result=call(f);task5cFrozenV1(result);assert.equal(result.maintenanceRoot,SOURCE_M_V1);
    assert.equal(JSON.stringify(f),before);vm.check();
  });
  cases.done();assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
}
// Break: genuine runner accepts env3 or a truthy/extra-key cache environment.
test('Task2 F runner qualifier requires exact literal1 and exact environment keys',()=>{
  task2CacheLaunchV1('runner');
});
// Break: genuine integration diverges from the same mandatory cache contract.
test('Task2 F integration qualifier requires exact literal1 and exact environment keys',()=>{
  task2CacheLaunchV1('integration');
});
// Break: adding the one cache key weakens recipient-only worker metadata.
test('Task2 F integration cache environment retains exact worker1 policy',()=>{
  const vm=task5cVmV1(['qualifyManualOrphanFixtureLaunchV1']),cases=task5cCasesV1(2);
  for(const [name,worker] of [['worker zero',{NODE_TEST_WORKER_ID:'0'}],
    ['extra worker context',{NODE_TEST_WORKER_ID:'1',NODE_TEST_CONTEXT:'child-v8'}]])cases.run(name,()=>{
    const f=task5cLaunchV1('integration');f.actual.worker=worker;
    task5cRefusedV1(()=>vm.api.qualifyManualOrphanFixtureLaunchV1('integration',
      task5cDataV1(vm,f.actual),task5cDataV1(vm,f.frame)));vm.check();
  });
  cases.done();assert.equal(vm.timers.length,0);assert.equal(vm.monotonic.state.calls,0);vm.check();
});
