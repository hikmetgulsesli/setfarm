import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import test from 'node:test';

const enabled=process.env.SETFARM_DASHBOARD_MACH_JOB_PORT_TEST==='1';
const baseline=process.env.SETFARM_DASHBOARD_MACH_JOB_RED_BASELINE==='1';
assert.ok(!baseline||enabled,'baseline requires explicit campaign admission');
const source=new URL(baseline?'../dashboard-cutover-mach-peer-v2.c':'../dashboard-cutover-mach-job-peer-v4.c',import.meta.url);
const clang='/Library/Developer/CommandLineTools/usr/bin/clang';
const sdk='/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const headers='/opt/homebrew/Cellar/node/26.4.0/include/node';
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let ordinal=0,directory;

async function run(command,args){
  assert.ok(++ordinal<=32,'closed command budget');
  const stem=directory+'/command-'+ordinal;
  fs.writeFileSync(stem+'-intent.json',JSON.stringify({command,args}),{flag:'wx',mode:0o600});
  const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});
  const row={out:[],err:[],bytes:0,unknown:false,timeout:false,overflow:false,
    outEnd:false,errEnd:false,outClose:false,errClose:false,status:null,signal:null};
  const timer=setTimeout(()=>{row.timeout=true},20000); // Mark only; no kill/retry.
  for(const [stream,key] of [[child.stdout,'out'],[child.stderr,'err']]){
    stream.once('error',()=>{row.unknown=true});
    stream.once('end',()=>{row[key+'End']=true});
    stream.once('close',()=>{row[key+'Close']=true});
    stream.on('data',b=>{row.bytes+=b.length;if(row.bytes<=1024*1024)row[key].push(b);else row.overflow=true});
  }
  child.once('error',()=>{row.unknown=true});
  await new Promise(resolve=>child.once('close',(status,signal)=>{
    row.status=status;row.signal=signal;clearTimeout(timer);resolve();
  }));
  const result={...row,out:undefined,err:undefined,stdout:Buffer.concat(row.out).toString(),stderr:Buffer.concat(row.err).toString()};
  fs.writeFileSync(stem+'-result.json',JSON.stringify(result),{flag:'wx',mode:0o600});
  assert.equal(row.unknown||row.timeout||row.overflow,false,'unqualified capture');
  assert.equal(row.outEnd&&row.errEnd&&row.outClose&&row.errClose,true);
  assert.equal(row.signal,null);assert.equal(row.status,0,result.stderr+'\n'+result.stdout);
  return result;
}

// Compile the actual C unit. Only external Mach/BSM ports are doubled. The
// static Node-API layer is dead-stripped: no publication/authentication credit.
const prefix=String.raw`
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <bsm/libbsm.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#undef NAPI_MODULE_INIT
#define NAPI_MODULE_INIT() static napi_value fixture_module(napi_env env,napi_value exports)
static int role,received,sent;static const char *fault;
static struct {const void *pointer;size_t length;unsigned char bytes[1200];} originals[4];
static int intact(void){
  for(int i=0;i<4;i++)if(originals[i].pointer && memcmp(originals[i].pointer,originals[i].bytes,originals[i].length))return 0;
  return 1;
}
static int outcome(const char *label){fprintf(stderr,"%s\n",label);return intact() && strcmp(fault,label);}
static kern_return_t fixture_check(mach_port_t b,const name_t s,mach_port_t *p){
  if(b!=bootstrap_port || !intact())return KERN_INVALID_ARGUMENT;
  int controller=!strcmp(s,"com.setrox.setfarm.dashboard-cutover.control.v4") ||
    !strcmp(s,"com.setrox.setfarm.dashboard-cutover.control.v3");
  if(!controller && strcmp(s,"com.setrox.setfarm.dashboard-cutover.job.v4"))return KERN_INVALID_ARGUMENT;
  *p=controller?1001:1002;return outcome(controller?"check-controller":"check-job")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_lookup(mach_port_t b,const name_t s,mach_port_t *p){
  if(b!=bootstrap_port || !intact())return KERN_INVALID_ARGUMENT;
  int controller=!strcmp(s,"com.setrox.setfarm.dashboard-cutover.control.v4") ||
    !strcmp(s,"com.setrox.setfarm.dashboard-cutover.control.v3");
  if(!controller && strcmp(s,"com.setrox.setfarm.dashboard-cutover.job.v4"))return KERN_INVALID_ARGUMENT;
  *p=controller?2001:2002;return outcome(controller?"lookup-controller":"lookup-job")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_allocate(ipc_space_t t,mach_port_right_t r,mach_port_name_t *p){
  (void)t;(void)r;*p=1002;return outcome("anonymous-allocate")?KERN_SUCCESS:KERN_FAILURE;
}
static mach_msg_return_t fixture_msg(mach_msg_header_t *m,mach_msg_option_t o,mach_msg_size_t s,
  mach_msg_size_t z,mach_port_name_t n,mach_msg_timeout_t t,mach_port_name_t v){
  int recv=(o&MACH_RCV_MSG)!=0,count=recv?++received:++sent;
  int index=role?(recv?(count==1?0:2):(count==1?1:3)):(recv?(count==1?1:3):(count==1?0:2));
  const char *payload=index==0?"hello":index==1?"challenge":index==2?"ack":"grant";
  uint32_t length=(uint32_t)strlen(payload);size_t prefix=sizeof(*m)+4,size=prefix+round_msg(length);
  char label[32];snprintf(label,sizeof label,"%s-%d",recv?"receive":"send",index);
  if(!intact()||t!=5000||v!=0||count>2)return MACH_SEND_INVALID_DATA;
  if(recv){
    if(o!=(MACH_RCV_MSG|MACH_RCV_TIMEOUT|MACH_RCV_INTERRUPT|MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)|
      MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT))||s!=0||z!=prefix+1024+sizeof(mach_msg_audit_trailer_t)||n!=(role?1001u:1002u))return MACH_RCV_INVALID_NAME;
    memset(m,0,z);m->msgh_bits=MACH_MSGH_BITS(index==1?MACH_MSG_TYPE_PORT_SEND_ONCE:0,
      index==2?MACH_MSG_TYPE_PORT_SEND_ONCE:MACH_MSG_TYPE_PORT_SEND);
    m->msgh_remote_port=index==1?3001:0;m->msgh_local_port=n;m->msgh_size=(mach_msg_size_t)size;m->msgh_id=0x53463331+index;
    memcpy((unsigned char*)m+sizeof(*m),&length,4);memcpy((unsigned char*)m+prefix,payload,length);
    mach_msg_audit_trailer_t trailer;memset(&trailer,0,sizeof trailer);
    trailer.msgh_trailer_type=MACH_MSG_TRAILER_FORMAT_0;trailer.msgh_trailer_size=sizeof trailer;
    memcpy((unsigned char*)m+round_msg(size),&trailer,sizeof trailer);
    if(!strcmp(fault,"bad-header")&&count==2)m->msgh_id=0;
    if(!strcmp(fault,"bad-reply")&&count==1)m->msgh_remote_port=9001;
    if(!strcmp(fault,"bad-padding")&&count==1)((unsigned char*)m)[prefix+length]=1;
    if(!strcmp(fault,"bad-trailer")&&count==1)((mach_msg_audit_trailer_t*)((unsigned char*)m+size))->msgh_trailer_size=0;
  }else{
    unsigned bits=MACH_MSGH_BITS(index==2?MACH_MSG_TYPE_MOVE_SEND_ONCE:MACH_MSG_TYPE_COPY_SEND,
      index==1?MACH_MSG_TYPE_MAKE_SEND_ONCE:0);
    uint32_t actual=0;memcpy(&actual,(unsigned char*)m+sizeof(*m),4);
    if(o!=(MACH_SEND_MSG|MACH_SEND_TIMEOUT|MACH_SEND_INTERRUPT)||s!=size||z!=0||n!=0||
      m->msgh_bits!=bits||m->msgh_remote_port!=(index==0?2001u:index==2?3001u:2002u)||
      m->msgh_local_port!=(index==1?1001u:0u)||m->msgh_id!=0x53463331+index||m->msgh_voucher_port!=0||
      actual!=length||memcmp((unsigned char*)m+prefix,payload,length))return MACH_SEND_INVALID_DATA;
  }
  originals[index].pointer=m;originals[index].length=recv?z:s;
  if(originals[index].length>sizeof originals[index].bytes)return MACH_SEND_INVALID_DATA;
  memcpy(originals[index].bytes,m,originals[index].length);
  return outcome(label)?MACH_MSG_SUCCESS:(recv?MACH_RCV_TIMED_OUT:MACH_SEND_TIMED_OUT);
}
static kern_return_t fixture_refs(ipc_space_t t,mach_port_name_t n,mach_port_right_t r,mach_port_delta_t d){
  if(!intact()||t!=mach_task_self()||n!=(role?1001u:1002u)||r!=MACH_PORT_RIGHT_RECEIVE||d!=-1)return KERN_INVALID_ARGUMENT;
  return outcome("close-receive")?KERN_SUCCESS:KERN_FAILURE;
}
static kern_return_t fixture_close(ipc_space_t t,mach_port_name_t n){
  if(!intact()||t!=mach_task_self()||n!=(role?2002u:2001u))return KERN_INVALID_ARGUMENT;
  return outcome("close-send")?KERN_SUCCESS:KERN_FAILURE;
}
static uid_t fixture_euid(audit_token_t token){(void)token;return geteuid();}
static pid_t fixture_pid(audit_token_t token){(void)token;return getpid()+1000+(received==2&&!strcmp(fault,"peer-pid"));}
static int fixture_version(audit_token_t token){(void)token;return 42+(received==2&&!strcmp(fault,"peer-version"));}
#define bootstrap_check_in fixture_check
#define bootstrap_look_up fixture_lookup
#define mach_port_allocate fixture_allocate
#define mach_msg fixture_msg
#define mach_port_mod_refs fixture_refs
#define mach_port_deallocate fixture_close
#define audit_token_to_euid fixture_euid
#define audit_token_to_pid fixture_pid
#define audit_token_to_pidversion fixture_version
`;

function suffix(){return `
int main(int argc,char **argv){
  if(argc!=3)return 2;role=!strcmp(argv[1],"controller");fault=argv[2];
  atomic_store(&lifecycle,ACTIVE);
  int ok=acquire(role);
  if(ok && role)ok=receive_frame(HELLO,1);
  ${baseline?'':'if(ok && role)ok=acquire_dashboard_send();'}
  if(ok)ok=send_frame(role?CHALLENGE:HELLO,(const uint8_t*)(role?"challenge":"hello"),role?9:5,role);
  if(ok)ok=receive_frame(role?ACK:CHALLENGE,role);
  if(ok)ok=send_frame(role?GRANT:ACK,(const uint8_t*)(role?"grant":"ack"),role?5:3,role);
  if(ok && !role)ok=receive_frame(GRANT,0);
  if(ok)ok=dispose(role);
  /* Actual private mechanics reject after sticky burn; no public reset. */
  if(!ok)atomic_store(&lifecycle,BURNED);
  if(!ok && (acquire(role)||receive_frame(role?ACK:GRANT,role)||
    send_frame(role?GRANT:ACK,(const uint8_t*)"x",1,role)||dispose(role)))return 3;
  if(!intact())return 4;
  printf("%s\\n",ok?"ok":"refused");return 0;
}
`;}

test('actual C routes challenge and grant through one job lookup and retains uncertain originals',{
  skip:!enabled,concurrency:false,
},async()=>{
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  assert.ok(fs.existsSync(source),'missing nominated C source');
  directory=fs.mkdtempSync('/private/tmp/setfarm-dashboard-mach-job-v4.');fs.chmodSync(directory,0o700);
  console.log(JSON.stringify({directory,baseline}));
  const original=fs.readFileSync(source),input=prefix+original.toString()+suffix();
  const fixture=directory+'/mechanics.c',binary=directory+'/mechanics';
  fs.writeFileSync(fixture,input,{flag:'wx',mode:0o600});
  const args=['-std=c11','-Wall','-Wextra','-Werror','-Wno-unused-function','-O2','-DNAPI_VERSION=8',
    '-arch','arm64','-mmacosx-version-min=14.0','-isysroot',sdk,'-I',headers,
    '-ffunction-sections','-Wl,-dead_strip',fixture,'-lbsm','-o',binary];
  await run(clang,args);
  const imports=(await run('/usr/bin/nm',['-u',binary])).stdout;
  assert.equal(imports.includes('_napi_'),false,'Node-API code must be stripped, not silently qualified');
  fs.writeFileSync(directory+'/build.json',JSON.stringify({sourceSha:sha(original),fixtureSha:sha(Buffer.from(input)),
    binarySha:sha(fs.readFileSync(binary)),args,imports}),{flag:'wx',mode:0o600});
  const controller=['check-controller','receive-0','lookup-job','send-1','receive-2','send-3','close-receive','close-send'];
  const client=['check-job','lookup-controller','send-0','receive-1','send-2','receive-3','close-receive','close-send'];
  const cases=[['controller','',controller],['client','',client]];
  if(!baseline){
    for(const [role,trace] of [['controller',controller],['client',client]])
      for(const [index,fault] of trace.entries())cases.push([role,fault,trace.slice(0,index+1)]);
    for(const fault of ['bad-header','peer-pid','peer-version'])cases.push(['controller',fault,controller.slice(0,5)]);
    for(const fault of ['bad-reply','bad-padding','bad-trailer'])cases.push(['controller',fault,controller.slice(0,2)]);
  }
  const failures=[];
  for(const [role,fault,trace] of cases){
    const result=await run(binary,[role,fault]);
    try{assert.equal(result.stdout,fault?'refused\n':'ok\n');assert.deepEqual(result.stderr.trim().split('\n'),trace);}
    catch(error){failures.push({role,fault,error:error.message});}
  }
  fs.writeFileSync(directory+'/campaign.json',JSON.stringify({baseline,cases:cases.length,commands:ordinal,failures}),{flag:'wx',mode:0o600});
  assert.deepEqual(failures,[],'job-route behavior differs from nominated contract');
  assert.equal(ordinal,baseline?4:26);
});
