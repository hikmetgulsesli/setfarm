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
const VECTOR=Object.freeze(['node','--import','tsx','--test','--test-concurrency=1',FILE]);
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
  const c=await runIsolatedSourceV1([...VECTOR.slice(0,5),'tests/execution-attempts/unrelated.test.ts']);
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
test('source-contained guard-removal exposes Task4 then admin after exact isolated refusal',async()=>{
  const normal=await runIsolatedSourceV1([...VECTOR]);
  assert.equal(normal.thrown,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE');noEffects(normal);

  const mutant=await runIsolatedSourceV1([...VECTOR],{removeUnavailable:true});
  assert.equal(mutant.thrown,'OBSERVED_ADMIN');
  assert.equal(mutant.calls.task4,1);assert.equal(mutant.calls.admin,1);
  assert.equal(mutant.calls.preconditions,0);assert.equal(mutant.calls.projection,0);
  assert.equal(mutant.calls.forbidden,0);assert.deepEqual(mutant.forbiddenSites,[]);
  assert.deepEqual(mutant.calls.spawn,[]);
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
