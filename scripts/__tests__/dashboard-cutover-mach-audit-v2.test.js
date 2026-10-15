import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Separate diagnostic only; ordinary portable tests never require native tools.
const enabled = process.env.SETFARM_DASHBOARD_MACH_AUDIT_TEST === '1';
const source = new URL('../dashboard-cutover-mach-audit-v2.c', import.meta.url);
const clang = '/Library/Developer/CommandLineTools/usr/bin/clang';
const sdk = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const headers = '/opt/homebrew/Cellar/node/26.4.0/include/node';
const node = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const env = {PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const napi = ['create_buffer_copy','define_properties','create_object','create_uint32',
  'get_cb_info','get_typedarray_info','is_typedarray','is_arraybuffer',
  'is_detached_arraybuffer',
  'object_freeze','throw_error','is_exception_pending',
  'get_and_clear_last_exception'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifacts = new Map();
const opts = {skip: !enabled};
const prefix = fault => String.raw`
#include <node_api.h>
#include <mach/mach.h>
#include <stdio.h>
#include <stdatomic.h>
#include <string.h>
static void probe_burn(void);
static void probe_frame(void *);
static void *probe_copy(void *p,const void *q,size_t n) {
  void *r=memcpy(p,q,n);
  if (${fault === 'frame-burn' ? 1 : 0}) probe_frame(p);
  return r;
}
static kern_return_t probe_allocate(ipc_space_t t,mach_port_right_t r,mach_port_name_t *n) {
  fprintf(stderr,"allocate\n"); kern_return_t k=mach_port_allocate(t,r,n);
  if (${fault === 'acquire-burn' ? 1 : 0} && k==KERN_SUCCESS) probe_burn();
  return k;
}
static kern_return_t probe_insert(ipc_space_t t,mach_port_name_t n,mach_port_t p,mach_msg_type_name_t d) {
  fprintf(stderr,"insert\n"); return mach_port_insert_right(t,n,p,d);
}
static mach_msg_return_t probe_msg(mach_msg_header_t *m,mach_msg_option_t o,mach_msg_size_t s,
    mach_msg_size_t z,mach_port_name_t n,mach_msg_timeout_t t,mach_port_name_t v) {
  int receiving=(o&MACH_RCV_MSG)!=0; fprintf(stderr,receiving?"receive\n":"send\n");
  mach_msg_return_t k=mach_msg(m,o,s,z,n,t,v);
  if (receiving && k==MACH_MSG_SUCCESS) {
    if (${fault === 'receive-loss' ? 1 : 0}) return MACH_RCV_BODY_ERROR;
    if (${fault === 'bad-header' ? 1 : 0}) m->msgh_id=0;
    if (${fault === 'bad-trailer' ? 1 : 0}) {
      mach_msg_trailer_t *a=(mach_msg_trailer_t *)((unsigned char *)m+round_msg(m->msgh_size));
      a->msgh_trailer_size=sizeof(mach_msg_trailer_t);
    }
  }
  return k;
}
static kern_return_t probe_deallocate(ipc_space_t t,mach_port_name_t n) {
  fprintf(stderr,"close-send\n"); kern_return_t k=mach_port_deallocate(t,n);
  return ${fault === 'send-close-loss' ? 1 : 0} && k==KERN_SUCCESS?KERN_FAILURE:k;
}
static kern_return_t probe_mod_refs(ipc_space_t t,mach_port_name_t n,mach_port_right_t r,mach_port_delta_t d) {
  fprintf(stderr,"close-receive\n"); kern_return_t k=mach_port_mod_refs(t,n,r,d);
  return ${fault === 'receive-close-loss' ? 1 : 0} && k==KERN_SUCCESS?KERN_FAILURE:k;
}
#define mach_port_allocate probe_allocate
#define mach_port_insert_right probe_insert
#define mach_msg probe_msg
#define mach_port_deallocate probe_deallocate
#define mach_port_mod_refs probe_mod_refs
#undef memcpy /* Test wrapper above already invokes the genuine fortified copy. */
#define memcpy probe_copy
`;

const children=new Set(); // Retain original child/stream custody until actual close.
async function run(command, args) {
  const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});
  const row={child,stdout:'',stderr:'',error:undefined,signal:null,status:null,timedOut:false,
    overflow:false,captureUnknown:false,stdoutEOF:false,stderrEOF:false,stdoutClosed:false,stderrClosed:false};
  children.add(row);
  // Mark-only watchdog. Never kill, retry, destroy streams or invent close/reap.
  const timer=setTimeout(()=>{row.timedOut=true;},20000);
  for(const key of ['stdout','stderr']) {
    child[key].once('error',()=>{row.captureUnknown=true;});
    child[key].once('end',()=>{row[key+'EOF']=true;});
    child[key].once('close',()=>{row[key+'Closed']=true;});
    child[key].on('data',chunk=>{
      if(Buffer.byteLength(row[key])+chunk.length<=2*1024*1024) row[key]+=chunk.toString();
      else row.overflow=true; // Continue draining without growing captured memory.
    });
  }
  child.once('error',error=>{row.error=error;});
  await new Promise(resolve=>child.once('close',(status,signal)=>{
    row.status=status;row.signal=signal;clearTimeout(timer);resolve();
  }));
  const {child:ignored,...r}=row;
  children.delete(row); // Only original close retires encapsulated pipe custody.
  assert.equal(r.timedOut,false,'watchdog is unqualified; natural close is not Mach settlement');
  assert.equal(r.overflow,false,'capture overflow is unqualified');
  assert.equal(r.captureUnknown,false,'stream error is unqualified');
  assert.equal(r.stdoutEOF&&r.stderrEOF&&r.stdoutClosed&&r.stderrClosed,true,'original pipe EOF/close required');
  assert.equal(r.error,undefined,'native setup/runner error is not transport RED');
  assert.equal(r.signal,null);
  assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
  return r;
}

async function buildArtifact(fault) {
  assert.equal(process.platform,'darwin'); assert.equal(process.arch,'arm64');
  // Genuine consumer read: absent nominated implementation fails before tools.
  const bytes=fs.readFileSync(source);
  const directory=fs.mkdtempSync('/private/tmp/setfarm-dashboard-mach-audit-v2.');
  fs.chmodSync(directory,0o700);
  const input=directory+'/fixture.c', output=directory+'/fixture.node', depfile=directory+'/fixture.d';
  const fixture=fault==='pristine'?bytes:prefix(fault)+bytes+
    '\nstatic void probe_burn(void){atomic_store(&lifecycle,3u);}\n'+
    'static void probe_frame(void *p){if(p==vault.sent.raw+PREFIX)probe_burn();}\n';
  fs.writeFileSync(input,fixture,
    {flag:'wx',mode:0o600});
  const argv=['-std=c11','-Wall','-Wextra','-Werror','-O2','-DNAPI_VERSION=8',
    '-arch','arm64','-mmacosx-version-min=14.0','-isysroot',sdk,'-I',headers,
    '-bundle',...napi.map(s=>'-Wl,-U,_napi_'+s),'-MD','-MF',depfile,input,'-lbsm','-o',output];
  const built=await run(clang,argv);
  const imports=(await run('/usr/bin/nm',['-u',output])).stdout;
  const actualNapi=[...imports.matchAll(/_napi_([a-z0-9_]+)/g)].map(m=>m[1]);
  assert.ok(actualNapi.length>0);
  assert.deepEqual(actualNapi.filter(s=>!napi.includes(s)),[],'unknown NAPI dynamic import');
  assert.doesNotMatch(imports,/_ZN|_uv_|_v8/,'no private C++/V8/libuv API');
  const system=['_audit_token_to_euid','_audit_token_to_pid','_audit_token_to_pidversion',
    '_mach_port_allocate','_mach_port_insert_right','_mach_port_deallocate','_mach_port_mod_refs',
    '_mach_msg','_mach_task_self_','_getpid','_geteuid','_memcpy','_memcmp','_memset','_bzero',
    '_fprintf','_fputs','_fwrite','___stderrp','___memcpy_chk',
    '___stack_chk_fail','___stack_chk_guard','dyld_stub_binder'];
  const imported=imports.trim().split(/\n/).map(line=>line.trim().split(/\s+/).at(-1));
  assert.deepEqual(imported.filter(s=>!system.includes(s)&&!napi.some(n=>s==='_napi_'+n)),[],
    'unknown system/provider import');
  const exported=(await run('/usr/bin/nm',['-gU',output])).stdout.trim().split(/\n/)
    .map(line=>line.trim().split(/\s+/).at(-1)).sort();
  assert.deepEqual(exported,['_napi_register_module_v1','_node_api_module_get_api_version_v1']);
  const dependencies=(await run('/usr/bin/otool',['-L',output])).stdout.trim().split(/\n/).slice(1)
    .map(line=>line.trim().split(/\s+/)[0]).sort();
  assert.deepEqual(dependencies,['/usr/lib/libSystem.B.dylib','/usr/lib/libbsm.0.dylib']);
  const includes=fs.readFileSync(depfile,'utf8').replace(/\\\n/g,' ').split(':').slice(1).join(':')
    .trim().split(/\s+/).filter(Boolean).map(path=>({path,sha:sha(fs.readFileSync(path))}));
  fs.writeFileSync(directory+'/receipt.json',JSON.stringify({source:fileURLToPath(source),
    sourceSha:sha(bytes),fixtureSha:sha(fs.readFileSync(input)),addonSha:sha(fs.readFileSync(output)),
    compilerSha:sha(fs.readFileSync(clang)),argv,includes,imports,exported,dependencies,built},null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({kind:'owned-local-audit-fixture',fault,directory,
    sourceSha:sha(bytes),addonSha:sha(fs.readFileSync(output)),includeCount:includes.length}));
  return output;
}

function artifact(fault='none') {
  if(!artifacts.has(fault)) artifacts.set(fault,buildArtifact(fault)); // No setup retry after unknown/failure.
  return artifacts.get(fault);
}

async function invoke(code,fault='none',before='',permitLoadFailure=false) {
  const path=await artifact(fault);
  return run(node,['--input-type=module','-e',
    "import assert from 'node:assert/strict';import {createRequire} from 'node:module';"+before+
    `let a,loadError;try{a=createRequire(import.meta.url)(${JSON.stringify(path)});}catch(e){loadError=e;}`+
    (permitLoadFailure?'':'assert.equal(loadError,undefined);')+
    "const refused=f=>assert.throws(f,e=>e.message==='DASHBOARD_CUTOVER_LOCAL_MACH_AUDIT_REFUSED');"+code]);
}

for (const size of [1,2,3,4,1024]) test('real local audit preserves '+size+' copied bytes and original PID',opts,async()=>{
  const r=await invoke(`const b=Buffer.alloc(${size},0xa7);const v=a.observeLocalMachAuditV2(b);
    assert.deepEqual(Object.keys(v).sort(),['bytes','euid','pid','pidversion']);
    assert.equal(v.pid,process.pid);assert.equal(v.euid,process.geteuid());assert.ok(v.pidversion>0);
    assert.ok(Object.isFrozen(v));assert.deepEqual(v.bytes,b);b.fill(0);assert.equal(v.bytes[0],0xa7);
    refused(()=>a.observeLocalMachAuditV2(Buffer.from([7])));`);
  assert.equal(r.stderr,'allocate\ninsert\nsend\nreceive\nclose-send\nclose-receive\n');
});

test('uninstrumented actual delivered source loads and returns copied local audit data',opts,async()=>{
  const r=await invoke(`const v=a.observeLocalMachAuditV2(Buffer.from([0x50,0x51]));
    assert.deepEqual(v.bytes,Buffer.from([0x50,0x51]));assert.equal(v.pid,process.pid);
    assert.equal(v.euid,process.geteuid());assert.ok(v.pidversion>0);assert.ok(Object.isFrozen(v));`, 'pristine');
  assert.equal(r.stderr,'');
});

test('intrinsic byte view ignores caller getters and preserves an offset slice only',opts,async()=>{
  const r=await invoke(`let traps=0;const b=new Uint8Array([0xff,0x61,0x62,0xee]).subarray(1,3);
    for(const name of ['length','byteLength','byteOffset','buffer','toJSON'])
      Object.defineProperty(b,name,{get(){traps++;throw Error('caller getter');}});
    const v=a.observeLocalMachAuditV2(b);assert.equal(traps,0);assert.deepEqual(v.bytes,Buffer.from([0x61,0x62]));`);
  assert.equal(r.stderr,'allocate\ninsert\nsend\nreceive\nclose-send\nclose-receive\n');
});

test('output defines own inert fields without invoking inherited setters',opts,async()=>{
  const r=await invoke(`let traps=0;for(const name of ['bytes','euid','pid','pidversion'])
    Object.defineProperty(Object.prototype,name,{configurable:true,set(){traps++;throw Error('caller setter');}});
    let v,error;try{v=a.observeLocalMachAuditV2(Buffer.from([0x41]));}catch(e){error=e;}
    assert.equal(traps,0);assert.equal(error,undefined);
    assert.equal(v.bytes[0],0x41);assert.equal(v.pid,process.pid);`);
  assert.equal(r.stderr,'allocate\ninsert\nsend\nreceive\nclose-send\nclose-receive\n');
});

test('module export definition cannot invoke a caller inherited setter',opts,async()=>{
  const r=await invoke(`assert.equal(traps,0);assert.equal(loadError,undefined);assert.equal(typeof a.observeLocalMachAuditV2,'function');`,
    'none',`let traps=0;Object.defineProperty(Object.prototype,'observeLocalMachAuditV2',
      {configurable:true,set(){traps++;throw Error('caller export setter');}});`,true);
  assert.equal(r.stderr,'');
});

test('invalid intrinsic inputs have zero acquisitions and leave valid idle attempt available',opts,async()=>{
  const r=await invoke(`let traps=0;const p=new Proxy(new Uint8Array([1]),{get(){traps++;throw Error('trap');}});
    const detached=new Uint8Array([1]);structuredClone(detached.buffer,{transfer:[detached.buffer]});
    for(const b of [undefined,null,{},[],new Uint8Array(0),new Uint8Array(1025),new Int16Array(1),
      new Uint8Array(new SharedArrayBuffer(1)),detached,p,Object.create(Uint8Array.prototype)])
      refused(()=>a.observeLocalMachAuditV2(b));
    refused(()=>a.observeLocalMachAuditV2());refused(()=>a.observeLocalMachAuditV2(Buffer.from([1]),7));
    assert.equal(traps,0);assert.deepEqual(a.observeLocalMachAuditV2(new Uint8Array([0x51])).bytes,Buffer.from([0x51]));`);
  assert.equal(r.stderr,'allocate\ninsert\nsend\nreceive\nclose-send\nclose-receive\n');
});

for(const [fault,events] of [
  ['acquire-burn','allocate\n'],
  ['frame-burn','allocate\ninsert\n'],
  ['receive-loss','allocate\ninsert\nsend\nreceive\n'],
  ['bad-header','allocate\ninsert\nsend\nreceive\n'],
  ['bad-trailer','allocate\ninsert\nsend\nreceive\n'],
  ['send-close-loss','allocate\ninsert\nsend\nreceive\nclose-send\n'],
  ['receive-close-loss','allocate\ninsert\nsend\nreceive\nclose-send\nclose-receive\n'],
]) test('actual-call '+fault+' retains uncertainty and prohibits later native attempts',opts,async()=>{
  const r=await invoke(`refused(()=>a.observeLocalMachAuditV2(Buffer.from([0x48,0x49])));
    refused(()=>a.observeLocalMachAuditV2(Buffer.from([0x51])));`,fault);
  assert.equal(r.stderr,events);
});
