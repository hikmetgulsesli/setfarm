import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import test from 'node:test';

const enabled=process.env.SETFARM_DASHBOARD_MACH_PEER_TEST==='1';
const opts={skip:!enabled,concurrency:false};
const source=new URL('../dashboard-cutover-mach-peer-v2.c',import.meta.url);
const node='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const clang='/Library/Developer/CommandLineTools/usr/bin/clang';
const sdk='/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const headers='/opt/homebrew/Cellar/node/26.4.0/include/node';
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const napi=['create_buffer_copy','define_properties','create_object','create_uint32',
  'get_cb_info','get_typedarray_info','is_typedarray','is_arraybuffer','is_detached_arraybuffer',
  'object_freeze','throw_error','is_exception_pending','get_and_clear_last_exception'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const pendingChildren=new Set(),completedCommands=[],ownedJobs=[];
let currentDirectory,commandOrdinal=0,campaignBurned=false;

async function qualification(body){
  assert.equal(campaignBurned,false,'prior setup/campaign failure is unqualified; no later attempt');
  try{return await body()}catch(error){campaignBurned=true;throw error}
}

async function run(command,args) {
  assert.ok(commandOrdinal<40,'closed command budget');
  const ordinal=++commandOrdinal,locator=currentDirectory+'/command-'+ordinal;
  fs.writeFileSync(locator+'-intent.json',JSON.stringify({command,args,ordinal}),{flag:'wx',mode:0o600});
  const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});
  const row={child,out:[],err:[],bytes:0,overflow:false,unknown:false,timeout:false,
    outEnd:false,errEnd:false,outClose:false,errClose:false,status:null,signal:null};
  pendingChildren.add(row);
  const timer=setTimeout(()=>{row.timeout=true},20000); // Mark only; no signals/retry.
  for(const [stream,key] of [[child.stdout,'out'],[child.stderr,'err']]) {
    stream.once('error',()=>{row.unknown=true});
    stream.once('end',()=>{row[key+'End']=true});stream.once('close',()=>{row[key+'Close']=true});
    stream.on('data',b=>{row.bytes+=b.length;if(row.bytes<=2*1024*1024)row[key].push(b);else row.overflow=true});
  }
  child.once('error',()=>{row.unknown=true});
  await new Promise(resolve=>child.once('close',(status,signal)=>{
    row.status=status;row.signal=signal;clearTimeout(timer);resolve();
  }));
  completedCommands.push(row); // Retain original result BEFORE any assertion.
  pendingChildren.delete(row); // Actual close only; not native/job settlement.
  const stdout=Buffer.concat(row.out).toString(),stderr=Buffer.concat(row.err).toString();
  fs.writeFileSync(locator+'-result.json',JSON.stringify({command,args,ordinal,stdout,stderr,
    status:row.status,signal:row.signal,timeout:row.timeout,overflow:row.overflow,unknown:row.unknown,
    outEnd:row.outEnd,errEnd:row.errEnd,outClose:row.outClose,errClose:row.errClose}),{flag:'wx',mode:0o600});
  assert.equal(row.timeout||row.overflow||row.unknown,false,'unqualified setup/capture');
  assert.equal(row.outEnd&&row.errEnd&&row.outClose&&row.errClose,true);
  assert.equal(row.signal,null);assert.equal(row.status,0,stderr+'\n'+stdout);
  return {stdout,stderr,status:row.status,signal:row.signal};
}

function prefix(fault) {return String.raw`
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <stdio.h>
static kern_return_t trace_check(mach_port_t b,const name_t s,mach_port_t *p){
  fprintf(stderr,"check-in\n");return bootstrap_check_in(b,s,p);
}
static kern_return_t trace_lookup(mach_port_t b,const name_t s,mach_port_t *p){
  fprintf(stderr,"lookup\n");return bootstrap_look_up(b,s,p);
}
static kern_return_t trace_allocate(ipc_space_t t,mach_port_right_t r,mach_port_name_t *p){
  fprintf(stderr,"allocate\n");return mach_port_allocate(t,r,p);
}
static mach_msg_return_t trace_msg(mach_msg_header_t *m,mach_msg_option_t o,mach_msg_size_t s,
  mach_msg_size_t z,mach_port_name_t n,mach_msg_timeout_t t,mach_port_name_t v){
  fprintf(stderr,(o&MACH_RCV_MSG)?"receive\n":"send\n");
  mach_msg_return_t k=mach_msg(m,o,s,z,n,t,v);
  if(${fault==='bad-header'?1:0} && (o&MACH_RCV_MSG) && k==MACH_MSG_SUCCESS){
    m->msgh_id=0;fprintf(stderr,"injected-successful-receive-header\n");
  }
  return k;
}
static kern_return_t trace_close(ipc_space_t t,mach_port_name_t n){
  fprintf(stderr,"close-send\n");return mach_port_deallocate(t,n);
}
static kern_return_t trace_refs(ipc_space_t t,mach_port_name_t n,mach_port_right_t r,mach_port_delta_t d){
  fprintf(stderr,"close-receive\n");return mach_port_mod_refs(t,n,r,d);
}
#define bootstrap_check_in trace_check
#define bootstrap_look_up trace_lookup
#define mach_port_allocate trace_allocate
#define mach_msg trace_msg
#define mach_port_deallocate trace_close
#define mach_port_mod_refs trace_refs
`;}

async function compile(directory,label,fault,pristine=false) {
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  assert.ok(fs.existsSync(source),'missing nominated remote Mach source');
  const original=fs.readFileSync(source),literal='com.setrox.setfarm.dashboard-cutover.peer.v2';
  let input=original.toString();
  if(!pristine){assert.equal(input.split(literal).length,2);input=prefix(fault)+input.replace(literal,label);}
  const stem=pristine?'pristine':fault,fixture=directory+'/'+stem+'.c',output=directory+'/'+stem+'.node';
  fs.writeFileSync(fixture,input,{flag:'wx',mode:0o600});
  const argv=['-std=c11','-Wall','-Wextra','-Werror','-O2','-DNAPI_VERSION=8','-arch','arm64',
    '-mmacosx-version-min=14.0','-isysroot',sdk,'-I',headers,'-bundle',
    ...napi.map(s=>'-Wl,-U,_napi_'+s),'-MD','-MF',directory+'/'+stem+'.d',fixture,'-lbsm','-o',output];
  const built=await run(clang,argv),imports=(await run('/usr/bin/nm',['-u',output])).stdout;
  const symbols=imports.trim().split('\n').map(l=>l.trim().split(/\s+/).at(-1));
  const system=['_audit_token_to_euid','_audit_token_to_pid','_audit_token_to_pidversion',
    '_bootstrap_check_in','_bootstrap_look_up','_bootstrap_port','_mach_port_allocate','_mach_port_deallocate',
    '_mach_port_mod_refs','_mach_msg','_mach_task_self_','_getpid','_geteuid','_memcpy','_memcmp','_memset',
    '_bzero','___memcpy_chk','___stack_chk_fail','___stack_chk_guard','dyld_stub_binder',
    '_fprintf','_fputs','_fwrite','___stderrp'];
  assert.deepEqual(symbols.filter(s=>!system.includes(s)&&!napi.some(n=>s==='_napi_'+n)),[]);
  const exports=(await run('/usr/bin/nm',['-gU',output])).stdout.trim().split('\n')
    .map(l=>l.trim().split(/\s+/).at(-1)).sort();
  assert.deepEqual(exports,['_napi_register_module_v1','_node_api_module_get_api_version_v1']);
  const deps=(await run('/usr/bin/otool',['-L',output])).stdout.trim().split('\n').slice(1)
    .map(l=>l.trim().split(/\s+/)[0]).sort();
  assert.deepEqual(deps,['/usr/lib/libSystem.B.dylib','/usr/lib/libbsm.0.dylib']);
  fs.writeFileSync(directory+'/'+stem+'-build.json',JSON.stringify({sourceSha:sha(original),
    fixtureSha:sha(Buffer.from(input)),addonSha:sha(fs.readFileSync(output)),compilerSha:sha(fs.readFileSync(clang)),
    argv,imports,exports,deps,built}),{flag:'wx',mode:0o600});
  return output;
}

function directory() {
  // Assertion before filesystem/compiler/job effects is the missing-source RED.
  assert.ok(fs.existsSync(source),'missing nominated remote Mach source');
  const d=fs.mkdtempSync('/private/tmp/setfarm-dashboard-mach-peer-v2.');fs.chmodSync(d,0o700);
  currentDirectory=d;
  console.log(JSON.stringify({kind:'owned-remote-mach-fixture',directory:d}));return d;
}

const program=(addon,controller)=>`
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const a=createRequire(import.meta.url)(${JSON.stringify(addon)});
assert.deepEqual(Object.keys(a).sort(),['observeClientMachPeerV2','observeControllerMachPeerV2']);
assert.ok(Object.isFrozen(a));const f=a.${controller?'observeControllerMachPeerV2':'observeClientMachPeerV2'};
const refused=g=>assert.throws(g,e=>e.message==='DASHBOARD_CUTOVER_MACH_PEER_REFUSED');
for(const b of [undefined,null,{},new Uint8Array(0),new Uint8Array(1025),new Int16Array(1),
  new Uint8Array(new SharedArrayBuffer(1))])refused(()=>f(b));
refused(()=>f());refused(()=>f(Buffer.from([1]),7));
const b=Buffer.alloc(1024,0xa7);let record;
try{const v=f(b);assert.ok(Object.isFrozen(v));assert.deepEqual(Object.keys(v).sort(),['bytes','euid','pid','pidversion']);
  b.fill(0);assert.deepEqual(v.bytes,Buffer.alloc(1024,0xa7));
  record={ok:true,originalPid:process.pid,peerPid:v.pid,euid:v.euid,pidversion:v.pidversion,bytes:v.bytes.toString('hex')};
}catch(e){assert.equal(e.message,'DASHBOARD_CUTOVER_MACH_PEER_REFUSED');record={ok:false,originalPid:process.pid,error:e.message};}
refused(()=>f(Buffer.from([1])));fs.writeSync(1,JSON.stringify(record)+'\\n');
`;
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

async function pair(serverFault,clientFault) {
  const d=directory(),label='com.setrox.setfarm.peer-fixture.'+randomUUID();
  assert.ok(label.length<128);assert.ok(process.getuid()>0);assert.ok(ownedJobs.length<3);
  const server=await compile(d,label,serverFault),client=clientFault===serverFault?server:await compile(d,label,clientFault);
  const entry=d+'/controller.mjs',stdout=d+'/controller.stdout',stderr=d+'/controller.stderr';
  fs.writeFileSync(entry,program(server,true),{flag:'wx',mode:0o600});
  for(const p of [stdout,stderr])fs.writeFileSync(p,'',{flag:'wx',mode:0o600});
  const plist=d+'/'+label+'.plist',variables={...env,NODE_OPTIONS:'',NODE_PATH:'',DYLD_INSERT_LIBRARIES:'',
    DYLD_LIBRARY_PATH:'',DYLD_FRAMEWORK_PATH:'',DYLD_FALLBACK_LIBRARY_PATH:''};
  const text='<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>'+
    '<key>Label</key><string>'+label+'</string><key>ProgramArguments</key><array>'+
    ['/usr/bin/env','-i','PATH=/usr/bin:/bin','LANG=C','LC_ALL=C',node,entry].map(a=>'<string>'+xml(a)+'</string>').join('')+
    '</array><key>WorkingDirectory</key><string>'+xml(d)+'</string>'+
    '<key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>LaunchOnlyOnce</key><true/>'+
    '<key>MachServices</key><dict><key>'+label+'</key><dict><key>ResetAtClose</key><true/></dict></dict>'+
    '<key>EnvironmentVariables</key><dict>'+Object.entries(variables).map(([k,v])=>'<key>'+k+'</key><string>'+xml(v)+'</string>').join('')+
    '</dict><key>StandardOutPath</key><string>'+xml(stdout)+'</string><key>StandardErrorPath</key><string>'+xml(stderr)+'</string></dict></plist>';
  fs.writeFileSync(plist,text,{flag:'wx',mode:0o600});
  const job={label,domain:'gui/'+process.getuid(),directory:d,plist,attempted:true};ownedJobs.push(job);
  fs.writeFileSync(d+'/job-intent.json',JSON.stringify(job),{flag:'wx',mode:0o600});
  const boot=await run('/bin/launchctl',['bootstrap',job.domain,plist]);
  fs.writeFileSync(d+'/bootstrap-result.json',JSON.stringify(boot),{flag:'wx',mode:0o600});
  const result=await run(node,['--input-type=module','-e',program(client,false)]);
  const started=Date.now();let response='';
  while(Date.now()-started<15000){
    assert.ok(fs.statSync(stdout).size<=4096);response=fs.readFileSync(stdout,'utf8');
    if(response.endsWith('\n'))break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(response.endsWith('\n'),'unqualified original server receipt, no signal/retry');
  assert.ok(fs.statSync(stderr).size<=4096);
  const evidence={job,boot,server:JSON.parse(response),client:JSON.parse(result.stdout),
    serverTrace:fs.readFileSync(stderr,'utf8'),clientTrace:result.stderr};
  fs.writeFileSync(d+'/pair-receipt.json',JSON.stringify(evidence),{flag:'wx',mode:0o600});
  return evidence; // All job/artifacts retained; no bootout or process-death proof.
}

test('pristine peer source loads and rejects invalid input without any service operation',opts,()=>qualification(async()=>{
  const d=directory(),addon=await compile(d,'unused','none',true);
  const r=await run(node,['--input-type=module','-e',`import assert from 'node:assert/strict';import {createRequire} from 'node:module';
    const a=createRequire(import.meta.url)(${JSON.stringify(addon)});
    assert.deepEqual(Object.keys(a).sort(),['observeClientMachPeerV2','observeControllerMachPeerV2']);
    let traps=0;const p=new Proxy({},{get(){traps++;throw Error('caller trap')}});
    for(const f of Object.values(a))for(const b of [undefined,p,new Uint8Array(0),new Uint8Array(1025)])
      assert.throws(()=>f(b),e=>e.message==='DASHBOARD_CUTOVER_MACH_PEER_REFUSED');assert.equal(traps,0);`]);
  assert.equal(r.stderr,'');
}));

test('real declared service exchanges copied bytes across two original Node PIDs and settles own occurrences',opts,()=>qualification(async()=>{
  const r=await pair('none','none');assert.equal(r.server.ok,true);assert.equal(r.client.ok,true);
  assert.notEqual(r.server.originalPid,r.client.originalPid);
  assert.equal(r.server.peerPid,r.client.originalPid);assert.equal(r.client.peerPid,r.server.originalPid);
  for(const side of [r.server,r.client]){assert.equal(side.euid,process.geteuid());assert.ok(side.pidversion>0);assert.equal(side.bytes,'a7'.repeat(1024));}
  assert.equal(r.serverTrace,'check-in\nreceive\nsend\nclose-receive\n');
  assert.equal(r.clientTrace,'lookup\nallocate\nsend\nreceive\nclose-receive\nclose-send\n');
}));

for(const side of ['server','client'])test('actual remote '+side+' malformed header retains uncertainty and admits no later native call',opts,()=>qualification(async()=>{
  const r=await pair(side==='server'?'bad-header':'none',side==='client'?'bad-header':'none');
  assert.equal(r[side].ok,false);assert.equal(r[side].error,'DASHBOARD_CUTOVER_MACH_PEER_REFUSED');
  assert.equal(r[side+'Trace'],(side==='server'?'check-in\nreceive\n':'lookup\nallocate\nsend\nreceive\n')+
    'injected-successful-receive-header\n');
  if(side==='client'){
    assert.equal(r.server.ok,true);assert.equal(r.server.peerPid,r.client.originalPid);
    assert.equal(r.serverTrace,'check-in\nreceive\nsend\nclose-receive\n');
  }
}));
