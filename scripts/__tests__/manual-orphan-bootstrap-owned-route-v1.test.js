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
assert.equal(OWNER_FILES.length,43,'preserve the current complete owner discovery inventory');
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
async function runConstructorSourceV1(args,removeUnavailable=false){
  const c=capture(),fake=environment(c,CONSTRUCTOR,args);
  let source=readFileSync(CONSTRUCTOR,'utf8');
  if(removeUnavailable){
    const unavailable="  if(args[0]==='manual-orphan-bootstrap'){\n"
      +"    mirrors.stderr.write(Buffer.from('MANUAL_ORPHAN_SLICE2_UNAVAILABLE\\n'));\n"
      +'    process.exitCode=1;return;\n  }';
    source=replaceOnce(source,unavailable,'','constructor unavailable guard-removal');
  }
  source=replaceOnce(source,
    "if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();",
    'globalThis.__main=main;','constructor direct entry');
  source=replaceOnce(source,"new URL('../',import.meta.url)",
    "new URL('../',"+JSON.stringify(CONSTRUCTOR.href)+')','constructor module URL');
  // Apart from optional unavailable-guard removal, only the downstream binding changes.
  assert.equal(source.split('function preconditions(){').length-1,1,'one preconditions binding');
  source+='\npreconditions=()=>globalThis.__boundary("preconditions");\n';
  const context=evaluate(source,CONSTRUCTOR,c,fake);
  try{await context.__main();}catch(error){c.thrown=error.message;}
  return c;
}
async function runIsolatedSourceV1(vector,{ambient=false,removeUnavailable=false}={}){
  const c=capture(),fake=environment(c,ISOLATED,['--',...vector],ambient?{SETFARM_PG_URL:'ambient-sentinel'}:{});
  let source=readFileSync(ISOLATED,'utf8');
  if(removeUnavailable){
    source=replaceOnce(source,
      'if (manualOrphanRoute === "exact") throw new Error("MANUAL_ORPHAN_SLICE2_UNAVAILABLE");',
      '','isolated unavailable guard-removal');
  }
  const entry='main().catch((error) => {\n'
    +'  const message = error instanceof Error ? error.message : String(error);\n'
    +'  process.stderr.write(`${task4InvocationV1 ? (/^TASK4_[A-Z_]+$/.test(message) ? message : "TASK4_CLEANUP_UNKNOWN") : message}\\n`);\n'
    +'  process.exitCode = 1;\n});';
  source=replaceOnce(source,entry,'globalThis.__main=main;','isolated direct entry');
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

test('source-contained constructor refuses the genuine mode before preconditions',async()=>{
  const c=await runConstructorSourceV1(['manual-orphan-bootstrap']);
  assert.equal(c.thrown,null);
  assert.equal(c.stderr,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE\n');
  assert.equal(c.stdout,'');assert.equal(c.exitCode,1);noEffects(c);
});
test('source-contained isolated runner refuses the genuine vector before Task4/admin/P3',async()=>{
  const c=await runIsolatedSourceV1([...VECTOR]);
  assert.equal(c.thrown,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE');noEffects(c);
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
test('source-contained wrapper refuses no-args reserved discovery before unrelated raw dispatch',()=>{
  const c=runWrapperSourceV1([],discovery('aaa-unrelated.test.ts',BASENAME));
  assert.equal(c.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');noEffects(c);
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
test('source-contained isolated ambient URL guard precedes even genuine reserved route',async()=>{
  const c=await runIsolatedSourceV1([...VECTOR],{ambient:true});
  assert.equal(c.thrown,'ISOLATED_TEST_AMBIENT_PG_URL_FORBIDDEN');noEffects(c);
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


// These mutations exist only in VM Source copies; no original child/PG/FD claim.
test('source-contained guard-removal exposes constructor preconditions after exact refusal',async()=>{
  const normal=await runConstructorSourceV1(['manual-orphan-bootstrap']);
  assert.equal(normal.thrown,null);assert.equal(normal.stderr,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE\n');
  assert.equal(normal.stdout,'');assert.equal(normal.exitCode,1);noEffects(normal);

  const mutant=await runConstructorSourceV1(['manual-orphan-bootstrap'],true);
  assert.equal(mutant.thrown,null);assert.equal(mutant.exitCode,1);assert.equal(mutant.stderr,'');
  assert.equal(mutant.calls.preconditions,1);
  assert.equal(mutant.calls.task4,0);assert.equal(mutant.calls.admin,0);
  assert.equal(mutant.calls.projection,0);assert.equal(mutant.calls.forbidden,0);
  assert.deepEqual(mutant.calls.spawn,[]);assert.deepEqual(mutant.forbiddenSites,[]);
  assert.match(mutant.stdout,/"operation":"preconditions","reason":"PRIVATE_TEST_CLUSTER_REFUSED"/);
});
test('source-contained guard-removal exposes ordinary grammar after exact isolated refusal',async()=>{
  const normal=await runIsolatedSourceV1([...VECTOR]);
  assert.equal(normal.thrown,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE');noEffects(normal);

  const mutant=await runIsolatedSourceV1([...VECTOR],{removeUnavailable:true});
  assert.equal(mutant.thrown,'ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE');noEffects(mutant);
  assert.deepEqual(mutant.forbiddenSites,[]);
  assert.equal(mutant.stdout,'');assert.equal(mutant.stderr,'');assert.equal(mutant.exitCode,undefined);
  assert.deepEqual(mutant.environment,ENV);
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
  const c=capture(),pureUtil=createRequire(import.meta.url)('node:util'),timers=[],cleared=[],faults=[];
  const guard=fn=>(...args)=>{try{return fn(...args);}catch(error){if(error?.code==='ERR_ASSERTION')faults.push(error.message);throw error;}};
  const clock={setTimeout:guard((callback,delay)=>{
    assert.ok([5000,10000,60000,960000,840000,300000,180000,120000].includes(delay));const handle={unref(){return this;},ref(){return this;}};
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
    require(specifier){assert.ok(modules.has(specifier),'unlisted fixed probe import '+specifier);return modules.get(specifier);}};
  runInNewContext(compiled.outputText,context,{filename:OBS_HELPER_PATH_V1,timeout:5000});
  assert.equal(timers.length,0,'import creates no timer');assert.equal(c.calls.forbidden,0,'import performs no IO');
  return {actual:context.exports,childMain:context.__fixedProbeChildMain,timers,cleared,assertContained(){
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
const SOURCE_HOME_V1='/Users/setrox';
const SOURCE_WORKSPACE_V1='/Users/setrox/ai/setrox';
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
    const vm=task3VmV1({monotonic});let w;
    assert.doesNotThrow(()=>{w=vm.actual.observeManualOrphanOwnedChildV1(f.child,'provision');});
    if(mode==='later throw')monotonic.state.mode='throw';if(mode==='backwards')monotonic.state.ms=-1;
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
const TASK3_PATH_V1='/opt/homebrew/Cellar/node/26.4.0/bin:/Users/setrox/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
function task3EntryV1(bytes,{profile='new',auto=true,readerOptions={},configure}={}){
  task3ContractsV1();const f=probeCompositionFixtureV1('child'),effects=[],calls=[],faults=[];
  const reader=probeReaderFixtureV1({...readerOptions,...(auto?{autoBytes:Buffer.from(bytes)}:{})});
  f.control.reader=reader;f.net=reader.net;
  const fs0=f.state.fs;f.fs={...fs0,fstatSync:(...args)=>reader.fs.fstatSync(...args),closeSync:(...args)=>reader.fs.closeSync(...args)};
  const noEffect=label=>(..._args)=>{effects.push(label);throw Error('FORBIDDEN_TASK3_EFFECT');};
  f.fs.openSync=noEffect('source/open');f.childProcess={spawn:noEffect('spawn'),spawnSync:noEffect('process observation')};
  const account={username:'setrox',uid:501,gid:20,shell:'/bin/zsh',homedir:'/Users/setrox'};
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
  ['new extra HOME','new',({f})=>{f.process.env.HOME='/Users/setrox';},false],
  ['new wrong locale','new',({f})=>{f.process.env.LANG='en_US';},false],
  ['new wrong physical Node','new',({f})=>{f.process.execPath=OBS_EXE_V1;f.process.argv0=OBS_EXE_V1;f.process.argv[0]=OBS_EXE_V1;},false],
  ['new wrong account home','new',({account})=>{account.homedir='/other/home';},false],
];
for(const [label,profile,configure,admitted] of TASK3_ENV_V1){
  test('Task3 H exact launch admission '+label,async()=>{task3ContractsV1();
    const entry=task3EntryV1(task3WireV1('provision'),{profile,configure});await entry.vm.childMain();
    task3EntryRefusedV1(entry,admitted?'MANUAL_ORPHAN_SETUP_REFUSED':'MANUAL_ORPHAN_OWNER_REFUSED');
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
    const entry=task3EntryV1(task3WireV1(purpose));await entry.vm.childMain();task3EntryRefusedV1(entry,'MANUAL_ORPHAN_SETUP_REFUSED');
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
      task3FinishReadV1(entry.reader,task3WireV1('provision'));await first.done;task3EntryRefusedV1(entry,'MANUAL_ORPHAN_SETUP_REFUSED');
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
  task3FinishReadV1(entry.reader,task3WireV1('provision'));await main.done;task3EntryRefusedV1(entry,'MANUAL_ORPHAN_SETUP_REFUSED');
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
  ['canonical provision',()=>task3WireV1('provision'),'MANUAL_ORPHAN_SETUP_REFUSED'],
  ['canonical mechanical refusal',()=>task3WireV1('new_entry_refusal'),'MANUAL_ORPHAN_SETUP_REFUSED'],
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
