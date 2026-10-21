import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {constants,existsSync,readFileSync} from 'node:fs';
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
    assert.ok(delay===5000||delay===10000);const handle={unref(){return this;},ref(){return this;}};
    timers.push({callback,delay,handle});return handle;
  }),clearTimeout:guard(handle=>{assert.ok(timers.some(timer=>timer.handle===handle));cleared.push(handle);})};
  const crypto={createHash,randomBytes:guard(size=>{assert.equal(size,32);return Buffer.alloc(32,0xcc);}),...bindings.crypto};
  const modules=new Map([
    ['node:fs',closedModule(c,'fixed probe fs',{constants,...bindings.fs})],
    ['node:net',closedModule(c,'fixed probe net',bindings.net??{})],
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
  source:ownedSourceData(),cluster:ownedClusterData(),adminPassword:OWN_H};}
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
const OWN_SETUP_WIRE='{"schema":"setfarm.manual-orphan-runner-setup.v1","run":"'+OWN_C+'","constructor":'+OWN_CON_WIRE
  +',"runner":'+OWN_RUN_WIRE+',"server":'+OWN_SERVER_WIRE+',"source":'+OWN_SOURCE_WIRE+',"cluster":'+OWN_CLUSTER_WIRE+',"adminPassword":"'+OWN_H+'"}\n';
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
