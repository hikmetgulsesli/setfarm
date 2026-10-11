import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import test from 'node:test';

const enabled=process.env.SETFARM_DASHBOARD_MACH_PEER_TEST==='1';
const portEnabled=process.env.SETFARM_DASHBOARD_MACH_CONTROL_PORT_TEST==='1';
const realEnabled=process.env.SETFARM_DASHBOARD_MACH_CONTROL_REAL_TEST==='1';
assert.ok([enabled,portEnabled,realEnabled].filter(Boolean).length<=1,'mixed native qualification campaigns');
const opts={skip:!realEnabled,concurrency:false};
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

function prefix(fault) {if(fault==='kernel-double')return kernelPrefix();return String.raw`
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <stdio.h>
static unsigned trace_receives;
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
  if((o&MACH_RCV_MSG))trace_receives++;
  if(${fault==='bad-second-header'?1:0} && (o&MACH_RCV_MSG) && trace_receives==2 && k==MACH_MSG_SUCCESS){
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
  const original=fs.readFileSync(source);
  const literal=original.includes('com.setrox.setfarm.dashboard-cutover.control.v3')?
    'com.setrox.setfarm.dashboard-cutover.control.v3':'com.setrox.setfarm.dashboard-cutover.peer.v2';
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
    '_fprintf','_fputs','_fwrite','___stderrp',...(fault==='kernel-double'?['_getenv','_strcmp','_snprintf','_strlen']:[])];
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
assert.deepEqual(Object.keys(a).sort(),['ackClientAndReceiveGrantV3','challengeControllerAndReceiveAckV3',
  'helloClientAndReceiveChallengeV3','receiveControllerHelloV3','sendControllerGrantV3']);
assert.ok(Object.isFrozen(a));const refused=g=>assert.throws(g,e=>e.message==='DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
refused(()=>a.receiveControllerHelloV3(null));
for(const b of [undefined,null,{},new Uint8Array(0),new Uint8Array(1025),new Int16Array(1),
  new Uint8Array(new SharedArrayBuffer(1))])refused(()=>a.helloClientAndReceiveChallengeV3(b));
refused(()=>a.helloClientAndReceiveChallengeV3());refused(()=>a.helloClientAndReceiveChallengeV3(Buffer.from('hello'),7));
let record;
try{
  const one=${controller?"a.receiveControllerHelloV3()":"a.helloClientAndReceiveChallengeV3(Buffer.from('hello'))"};
  const two=${controller?"a.challengeControllerAndReceiveAckV3(Buffer.from('challenge'))":"a.ackClientAndReceiveGrantV3(Buffer.from('ack'))"};
  for(const v of [one,two]){
    assert.ok(Object.isFrozen(v));assert.deepEqual(Object.keys(v).sort(),['bytes','euid','pid','pidversion']);
    assert.equal(v.euid,process.geteuid());assert.ok(v.pid>0 && v.pid!==process.pid);assert.ok(v.pidversion>0);
  }
  assert.deepEqual([one.euid,one.pid,one.pidversion],[two.euid,two.pid,two.pidversion]);
  assert.equal(one.bytes.toString(),${JSON.stringify(controller?'hello':'challenge')});
  assert.equal(two.bytes.toString(),${JSON.stringify(controller?'ack':'grant')});
  ${controller?"const end=a.sendControllerGrantV3(Buffer.from('grant'));assert.ok(Object.isFrozen(end));assert.deepEqual(Object.keys(end),[]);":""}
  record={ok:true,originalPid:process.pid,peerPid:one.pid,euid:one.euid,pidversion:one.pidversion,
    firstBytes:one.bytes.toString(),secondBytes:two.bytes.toString()};
}catch(e){assert.equal(e.message,'DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');record={ok:false,originalPid:process.pid,error:e.message};}
for(const f of [()=>a.receiveControllerHelloV3(),()=>a.challengeControllerAndReceiveAckV3(Buffer.from('challenge')),
  ()=>a.sendControllerGrantV3(Buffer.from('grant')),()=>a.helloClientAndReceiveChallengeV3(Buffer.from('hello')),
  ()=>a.ackClientAndReceiveGrantV3(Buffer.from('ack'))])refused(f);
fs.writeSync(1,JSON.stringify(record)+'\\n');
`;
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

// Only external kernel/BSM ports are doubled. Actual compiled C and Node-API
// execute; these receipts do not certify kernel identity or loaded-code custody.
function kernelPrefix(){return String.raw`
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <bsm/libbsm.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdatomic.h>
static _Atomic unsigned lifecycle;
static int fixture_controller,fixture_sent,fixture_received;
static napi_env fixture_env;
static void *fixture_input;static size_t fixture_input_length;
static napi_value controller_hello(napi_env,napi_callback_info);
static void reenter(void){
  fprintf(stderr,"active-reentry\n");
  (void)controller_hello(fixture_env,NULL);
  bool pending=false;
  if(napi_is_exception_pending(fixture_env,&pending)==napi_ok && pending){
    napi_value ignored;(void)napi_get_and_clear_last_exception(fixture_env,&ignored);
  }
}
static struct {const uint8_t *pointer;size_t length;uint8_t bytes[1200];} fixture_originals[4];
static int originals_unchanged(void){
  for(int i=0;i<4;i++){
    if(fixture_originals[i].pointer &&
      memcmp(fixture_originals[i].pointer,fixture_originals[i].bytes,fixture_originals[i].length)){
      fprintf(stderr,"original-frame-mutated\n");return 0;
    }
  }
  return 1;
}
static int fault_is(const char *s){const char *f=getenv("SETFARM_MACH_CONTROL_FAULT");return f && !strcmp(f,s);}
static int outcome(const char *s){
  fprintf(stderr,"%s\n",s);
  if(fixture_input && fixture_input_length>=1 && fixture_input_length<=1024)memset(fixture_input,0,fixture_input_length);
  char key[80];snprintf(key,sizeof key,"unknown-%s",s);
  if(fault_is(key))return 0;
  snprintf(key,sizeof key,"burn-%s",s);
  if(fault_is(key))reenter();
  return 1;
}
static kern_return_t fixture_check(mach_port_t b,const name_t s,mach_port_t *p){
  if(!originals_unchanged() || b!=bootstrap_port || strcmp(s,"unused"))return KERN_INVALID_ARGUMENT;
  fixture_controller=1;*p=1001;return outcome("check-in")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_lookup(mach_port_t b,const name_t s,mach_port_t *p){
  if(!originals_unchanged() || b!=bootstrap_port || strcmp(s,"unused"))return KERN_INVALID_ARGUMENT;
  *p=2001;return outcome("lookup")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_allocate(ipc_space_t t,mach_port_right_t r,mach_port_name_t *p){
  if(!originals_unchanged() || t!=mach_task_self() || r!=MACH_PORT_RIGHT_RECEIVE)return KERN_INVALID_ARGUMENT;
  *p=1002;return outcome("allocate")?KERN_SUCCESS:KERN_FAILURE;
}
static mach_msg_return_t fixture_msg(mach_msg_header_t *m,mach_msg_option_t o,mach_msg_size_t s,
  mach_msg_size_t z,mach_port_name_t n,mach_msg_timeout_t t,mach_port_name_t v){
  const int receiving=(o&MACH_RCV_MSG)!=0;const int ordinal=receiving?++fixture_received:++fixture_sent;
  const int index=fixture_controller?(receiving?(ordinal==1?1:3):(ordinal==1?2:4)):
    (receiving?(ordinal==1?2:4):(ordinal==1?1:3));
  const char *payload=index==1?"hello":index==2?"challenge":index==3?"ack":"grant";
  const uint32_t length=(uint32_t)strlen(payload);
  const size_t prefix=sizeof(mach_msg_header_t)+sizeof(uint32_t),size=prefix+round_msg(length);
  if(!originals_unchanged() || t!=5000 || v!=MACH_PORT_NULL || ordinal>2)return MACH_SEND_INVALID_DATA;
  if(receiving){
    const mach_msg_option_t want=MACH_RCV_MSG|MACH_RCV_TIMEOUT|MACH_RCV_INTERRUPT|
      MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)|MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT);
    if(o!=want || s!=0 || z!=prefix+1024+sizeof(mach_msg_audit_trailer_t) ||
      n!=(fixture_controller?1001u:1002u))return MACH_RCV_INVALID_NAME;
    memset(m,0,z);m->msgh_bits=fixture_controller?
      MACH_MSGH_BITS(MACH_MSG_TYPE_PORT_SEND_ONCE,MACH_MSG_TYPE_PORT_SEND):MACH_MSGH_BITS(0,MACH_MSG_TYPE_PORT_SEND_ONCE);
    m->msgh_size=(mach_msg_size_t)size;m->msgh_remote_port=fixture_controller?3001:MACH_PORT_NULL;
    m->msgh_local_port=n;m->msgh_id=0x53463330+index;
    memcpy((uint8_t*)m+sizeof(*m),&length,sizeof length);memcpy((uint8_t*)m+prefix,payload,length);
    mach_msg_audit_trailer_t trailer;memset(&trailer,0,sizeof trailer);
    trailer.msgh_trailer_type=MACH_MSG_TRAILER_FORMAT_0;trailer.msgh_trailer_size=sizeof trailer;
    memcpy((uint8_t*)m+round_msg(m->msgh_size),&trailer,sizeof trailer);
    char malformed[40];snprintf(malformed,sizeof malformed,"bad-frame-%d",index);
    if(fault_is(malformed))m->msgh_id=0;
    if(ordinal==1 && fault_is("bad-length")){uint32_t bad=1025;memcpy((uint8_t*)m+sizeof(*m),&bad,4);}
    if(ordinal==1 && fault_is("bad-size"))m->msgh_size=UINT32_MAX;
    if(ordinal==1 && fault_is("bad-padding"))((uint8_t*)m)[prefix+length]=1;
    if(ordinal==1 && fault_is("bad-trailer"))((mach_msg_audit_trailer_t*)((uint8_t*)m+size))->msgh_trailer_size=0;
  }else{
    const unsigned bits=fixture_controller?MACH_MSGH_BITS(MACH_MSG_TYPE_MOVE_SEND_ONCE,0):
      MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND,MACH_MSG_TYPE_MAKE_SEND_ONCE);
    uint32_t actual=0;memcpy(&actual,(uint8_t*)m+sizeof(*m),4);
    if(o!=(MACH_SEND_MSG|MACH_SEND_TIMEOUT|MACH_SEND_INTERRUPT) || s!=size || z!=0 || n!=MACH_PORT_NULL ||
      m->msgh_bits!=bits || m->msgh_size!=size || m->msgh_id!=0x53463330+index ||
      m->msgh_remote_port!=(fixture_controller?3001u:2001u) || m->msgh_local_port!=(fixture_controller?0u:1002u) ||
      m->msgh_voucher_port!=MACH_PORT_NULL || actual!=length || memcmp((uint8_t*)m+prefix,payload,length))return MACH_SEND_INVALID_DATA;
    for(size_t i=length;i<round_msg(length);i++)if(((uint8_t*)m)[prefix+i])return MACH_SEND_INVALID_DATA;
  }
  fixture_originals[index-1].pointer=(const uint8_t*)m;
  fixture_originals[index-1].length=receiving?z:s;
  if(fixture_originals[index-1].length>sizeof fixture_originals[index-1].bytes)return MACH_SEND_INVALID_DATA;
  memcpy(fixture_originals[index-1].bytes,m,fixture_originals[index-1].length);
  fprintf(stderr,"buffer-%d:%p\n",index,(void*)m);
  char label[24];snprintf(label,sizeof label,"%s-%d",receiving?"receive":"send",ordinal);
  return outcome(label)?MACH_MSG_SUCCESS:(receiving?MACH_RCV_TIMED_OUT:MACH_SEND_TIMED_OUT);
}
static kern_return_t fixture_refs(ipc_space_t t,mach_port_name_t n,mach_port_right_t r,mach_port_delta_t d){
  if(!originals_unchanged() || t!=mach_task_self() || n!=(fixture_controller?1001u:1002u) || r!=MACH_PORT_RIGHT_RECEIVE || d!=-1)return KERN_INVALID_ARGUMENT;
  return outcome("close-receive")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_close(ipc_space_t t,mach_port_name_t n){
  if(!originals_unchanged() || t!=mach_task_self() || n!=2001)return KERN_INVALID_ARGUMENT;
  return outcome("close-send")?KERN_SUCCESS:KERN_FAILURE;
}
static uid_t fixture_euid(audit_token_t token){(void)token;fprintf(stderr,"bsm-euid-%d\n",fixture_received);return geteuid()+(fixture_received==2 && fault_is("peer-euid"));}
static pid_t fixture_pid(audit_token_t token){(void)token;fprintf(stderr,"bsm-pid-%d\n",fixture_received);return getpid()+1000+(fixture_received==2 && fault_is("peer-pid"));}
static int fixture_version(audit_token_t token){(void)token;fprintf(stderr,"bsm-version-%d\n",fixture_received);return 42+(fixture_received==2 && fault_is("peer-version"));}
static napi_status fixture_args(napi_env e,napi_callback_info i,size_t *n,napi_value *a,napi_value *t,void **d){
  static int injected;
  fixture_input=NULL;fixture_input_length=0;napi_status s=napi_get_cb_info(e,i,n,a,t,d);
  if(!injected && s==napi_ok && atomic_load(&lifecycle)==2u && fault_is("napi-args-unknown")){
    injected=1;fprintf(stderr,"intrinsic-unknown\n");return napi_generic_failure;
  }
  return s;
}
static napi_status fixture_typed(napi_env e,napi_value v,napi_typedarray_type *t,size_t *n,void **d,napi_value *b,size_t *o){
  napi_status s=napi_get_typedarray_info(e,v,t,n,d,b,o);
  if(s==napi_ok){fixture_input=*d;fixture_input_length=*n;}return s;
}
static napi_status fixture_freeze(napi_env e,napi_value v){
  fixture_env=e;
  napi_status s=napi_object_freeze(e,v);
  if(s==napi_ok && atomic_load(&lifecycle)==1u && fault_is("burn-freeze")){
    fprintf(stderr,"freeze-burn\n");reenter();
  }
  fixture_input=NULL;fixture_input_length=0;return s;
}
#define bootstrap_check_in fixture_check
#define bootstrap_look_up fixture_lookup
#define mach_port_allocate fixture_allocate
#define mach_msg fixture_msg
#define mach_port_mod_refs fixture_refs
#define mach_port_deallocate fixture_close
#define audit_token_to_euid fixture_euid
#define audit_token_to_pid fixture_pid
#define audit_token_to_pidversion fixture_version
#define napi_get_cb_info fixture_args
#define napi_get_typedarray_info fixture_typed
#define napi_object_freeze fixture_freeze
`;}

const nativeNames=['ackClientAndReceiveGrantV3','challengeControllerAndReceiveAckV3',
  'helloClientAndReceiveChallengeV3','receiveControllerHelloV3','sendControllerGrantV3'];
const controllerTrace=['check-in','receive-1','send-1','receive-2','send-2','close-receive'];
const clientTrace=['lookup','allocate','send-1','receive-1','send-2','receive-2','close-receive','close-send'];
test('compiled four-frame C preserves session originals and burns every nominated uncertain port',{
  skip:!portEnabled,concurrency:false,
},()=>qualification(async()=>{
  const d=directory(),addon=await compile(d,'unused','kernel-double');
  const cases=[
    ['controller success',true,'',controllerTrace,'',6],['client success',false,'',clientTrace,'',6],
    ['intrinsic provider unknown',true,'napi-args-unknown',['check-in','receive-1','intrinsic-unknown'],'intrinsic-unknown',3],
    ['controller wrong role',true,'',controllerTrace.slice(0,2),'wrong-role',3],
    ['client wrong stage',false,'',clientTrace.slice(0,4),'wrong-stage',3],
  ];
  for(const [role,trace] of [[true,controllerTrace],[false,clientTrace]])
    for(const [i,label] of trace.entries())cases.push(['unknown '+label,role,'unknown-'+label,trace.slice(0,i+1),'',
      (role?[0,0,3,3,6,6]:[0,0,0,0,3,3,6,6])[i]]);
  for(const [role,label,bsm] of [[true,'check-in',0],[false,'lookup',0],[false,'allocate',0],[true,'send-1',3],[true,'receive-1',0]]){
    const trace=role?controllerTrace:clientTrace;
    cases.push(['successful-return burn '+label,role,'burn-'+label,trace.slice(0,trace.indexOf(label)+1),'',bsm]);
  }
  cases.push(['post-success freeze burn',true,'burn-freeze',['check-in','receive-1','freeze-burn'],'',3]);
  for(const [index,role,trace] of [[1,true,controllerTrace.slice(0,2)],[2,false,clientTrace.slice(0,4)],
    [3,true,controllerTrace.slice(0,4)],[4,false,clientTrace.slice(0,6)]])
    cases.push(['malformed frame '+index,role,'bad-frame-'+index,trace,'',index>=3?3:0]);
  for(const fault of ['bad-length','bad-size','bad-padding','bad-trailer'])
    cases.push([fault,true,fault,controllerTrace.slice(0,2),'',0]);
  for(const [fault,bsm] of [['peer-euid',4],['peer-pid',5],['peer-version',6]])
    cases.push([fault,true,fault,controllerTrace.slice(0,4),'',bsm]);
  assert.equal(cases.length,36);
  for(const [name,controller,fault,want,mode,bsm] of cases){
    const r=await run(node,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {createRequire} from 'node:module';
      process.env.SETFARM_MACH_CONTROL_FAULT=${JSON.stringify(fault)};
      const a=createRequire(import.meta.url)(${JSON.stringify(addon)});
      assert.deepEqual(Object.keys(a).sort(),${JSON.stringify(nativeNames)});assert.ok(Object.isFrozen(a));
      const refused=f=>assert.throws(f,e=>e.message==='DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
      const controller=${controller},mode=${JSON.stringify(mode??'')};
      if(!${Boolean(fault)} && !mode){
        let traps=0;const p=new Proxy({},{get(){traps++;throw Error('caller trap')}});
        const detached=new Uint8Array(1);structuredClone(detached.buffer,{transfer:[detached.buffer]});
        for(const bad of [undefined,null,{},p,new Uint8Array(0),new Uint8Array(1025),new Int16Array(1),
          new Uint8Array(new SharedArrayBuffer(1)),detached])refused(()=>a.helloClientAndReceiveChallengeV3(bad));
        refused(()=>a.receiveControllerHelloV3(null));refused(()=>a.helloClientAndReceiveChallengeV3(Buffer.from('hello'),1));
        refused(()=>a.challengeControllerAndReceiveAckV3(Buffer.from('challenge')));assert.equal(traps,0);
      }
      const firstInput=Buffer.from('hello'),secondInput=Buffer.from(controller?'challenge':'ack');
      const first=()=>controller?a.receiveControllerHelloV3():a.helloClientAndReceiveChallengeV3(firstInput);
      const second=()=>controller?a.challengeControllerAndReceiveAckV3(secondInput):a.ackClientAndReceiveGrantV3(secondInput);
      const verify=(v,bytes)=>{assert.ok(Object.isFrozen(v));assert.deepEqual(Object.keys(v).sort(),['bytes','euid','pid','pidversion']);
        assert.equal(v.bytes.toString(),bytes);assert.equal(v.euid,process.geteuid());assert.equal(v.pid,process.pid+1000);assert.equal(v.pidversion,42);};
      let failed=false;
      try{
        const one=first();verify(one,controller?'hello':'challenge');
        if(mode==='intrinsic-unknown'){refused(()=>a.challengeControllerAndReceiveAckV3(secondInput));failed=true;}
        else if(mode==='wrong-role'){refused(()=>a.helloClientAndReceiveChallengeV3(Buffer.from('hello')));failed=true;}
        else if(mode==='wrong-stage'){refused(()=>a.sendControllerGrantV3(Buffer.from('grant')));failed=true;}
        else{
          refused(()=>controller?a.challengeControllerAndReceiveAckV3(undefined):a.ackClientAndReceiveGrantV3(undefined));
          const two=second();verify(two,controller?'ack':'grant');verify(one,controller?'hello':'challenge');
          assert.deepEqual(secondInput,Buffer.alloc(controller?9:3));
          if(!controller)assert.deepEqual(firstInput,Buffer.alloc(5));
          if(controller){const input=Buffer.from('grant'),end=a.sendControllerGrantV3(input);
            assert.deepEqual(input,Buffer.alloc(5));assert.ok(Object.isFrozen(end));assert.deepEqual(Object.keys(end),[]);}
        }
      }catch(e){assert.equal(e.message,'DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');failed=true;}
      assert.equal(failed,${Boolean(fault||mode==='wrong-role'||mode==='wrong-stage')});
      if(mode==='intrinsic-unknown')refused(second); // Same valid continuation first: no wrong-stage call may mask revival.
      for(const f of [()=>a.receiveControllerHelloV3(),()=>a.challengeControllerAndReceiveAckV3(Buffer.from('challenge')),
        ()=>a.sendControllerGrantV3(Buffer.from('grant')),()=>a.helloClientAndReceiveChallengeV3(Buffer.from('hello')),
        ()=>a.ackClientAndReceiveGrantV3(Buffer.from('ack'))])refused(f);
      console.log(JSON.stringify({name:${JSON.stringify(name)},failed}));
    `]);
    const lines=r.stderr.trim().split('\n'),buffers=lines.filter(l=>l.startsWith('buffer-'));
    assert.deepEqual(lines.filter(l=>!l.startsWith('buffer-')&&!l.startsWith('bsm-')&&l!=='active-reentry'),want,name);
    assert.deepEqual(lines.filter(l=>l.startsWith('bsm-')),
      ['bsm-euid-1','bsm-pid-1','bsm-version-1','bsm-euid-2','bsm-pid-2','bsm-version-2'].slice(0,bsm),name+' BSM admissions');
    assert.equal(lines.filter(l=>l==='active-reentry').length,fault.startsWith('burn-')?1:0,name+' actual ACTIVE reentry');
    assert.equal(new Set(buffers.map(l=>l.split(':')[1])).size,buffers.length,'original frame buffers must not alias');
    assert.equal(JSON.parse(r.stdout).name,name);
  }
  assert.equal(commandOrdinal,40);assert.equal(ownedJobs.length,0);assert.equal(pendingChildren.size,0);
}));

test('four-frame native consumer rejects invalid V3 inputs before kernel acquisition',{
  skip:!(enabled||realEnabled),concurrency:false,
},()=>qualification(async()=>{
  const d=directory(),addon=await compile(d,'unused','none',true);
  const r=await run(node,['--input-type=module','-e',`
    import assert from 'node:assert/strict';import {createRequire} from 'node:module';
    const addon=createRequire(import.meta.url)(${JSON.stringify(addon)});
    for(const [name,args] of [
      ['receiveControllerHelloV3',[null]],
      ['challengeControllerAndReceiveAckV3',[new Uint8Array(0)]],
      ['sendControllerGrantV3',[]],
      ['helloClientAndReceiveChallengeV3',[new Uint8Array(0)]],
      ['ackClientAndReceiveGrantV3',[new Uint8Array(0)]],
    ]){
      assert.equal(typeof addon[name],'function','missing four-frame native method '+name);
      assert.throws(()=>addon[name](...args),e=>e.message==='DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
    }
    console.log(JSON.stringify({kind:'four-frame-invalid-input-consumer',methods:5}));
  `]);
  assert.equal(r.stderr,'');assert.equal(commandOrdinal,5);assert.equal(ownedJobs.length,0);
}));

async function pair(serverFault,clientFault) {
  const d=directory(),label='com.setrox.setfarm.control-fixture.'+randomUUID();
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

test('real declared service exchanges four distinct frames across two original Node PIDs',opts,()=>qualification(async()=>{
  const r=await pair('none','none');assert.equal(r.server.ok,true);assert.equal(r.client.ok,true);
  assert.notEqual(r.server.originalPid,r.client.originalPid);
  assert.equal(r.server.peerPid,r.client.originalPid);assert.equal(r.client.peerPid,r.server.originalPid);
  for(const side of [r.server,r.client]){assert.equal(side.euid,process.geteuid());assert.ok(side.pidversion>0);}
  assert.deepEqual([r.server.firstBytes,r.client.firstBytes,r.server.secondBytes,r.client.secondBytes],['hello','challenge','ack','grant']);
  assert.equal(r.serverTrace,'check-in\nreceive\nsend\nreceive\nsend\nclose-receive\n');
  assert.equal(r.clientTrace,'lookup\nallocate\nsend\nreceive\nsend\nreceive\nclose-receive\nclose-send\n');
}));

for(const side of ['server','client'])test('actual remote '+side+' second-frame malformed header stops later native calls',opts,()=>qualification(async()=>{
  const r=await pair(side==='server'?'bad-second-header':'none',side==='client'?'bad-second-header':'none');
  assert.equal(r[side].ok,false);assert.equal(r[side].error,'DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
  assert.equal(r[side+'Trace'],(side==='server'?'check-in\nreceive\nsend\nreceive\n':'lookup\nallocate\nsend\nreceive\nsend\nreceive\n')+
    'injected-successful-receive-header\n');
  if(side==='client'){
    assert.equal(r.server.ok,true);assert.equal(r.server.peerPid,r.client.originalPid);
    assert.equal(r.serverTrace,'check-in\nreceive\nsend\nreceive\nsend\nclose-receive\n');
    assert.equal(commandOrdinal,31);assert.equal(ownedJobs.length,3);
  }else{
    assert.equal(r.client.ok,false);assert.equal(r.client.error,'DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
    assert.equal(r.clientTrace,'lookup\nallocate\nsend\nreceive\nsend\nreceive\n');
  }
}));
