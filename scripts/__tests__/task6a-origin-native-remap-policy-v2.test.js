import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import test from 'node:test';

/* Actual C policy; memory-only effects, never physical native ownership. */
const FLAG='SETFARM_ALLOW_NATIVE_REMAP_POLICY_MODEL_V2';
const enabled=process.env[FLAG]==='1';
assert.ok(process.env[FLAG]===undefined || enabled,'closed model-only opt-in');
for(const [name,value] of Object.entries(process.env))
  if(name!==FLAG && (name.startsWith('SETFARM_TASK6A_NATIVE_') ||
     (name.startsWith('SETFARM_ALLOW_') && /NATIVE|COOPERATIVE|TASK6A/.test(name))))
    assert.equal(value,undefined,'no adjacent native effect opt-in: '+name);
const mode=process.env.SETFARM_NATIVE_REMAP_POLICY_MODEL_MODE??'baseline';
assert.ok(['baseline','omit-first-close'].includes(mode),'closed model derivative');
const here=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.dirname(here);
const sourcePath=ROOT+'/task6a-origin-native-remap-policy-v2.c';
const headerPath=ROOT+'/task6a-origin-native-remap-policy-v2.h';
const selfPath=fileURLToPath(import.meta.url);
const CLT='/Library/Developer/CommandLineTools';
const CLANG=CLT+'/usr/bin/clang',LD=CLT+'/usr/bin/ld';
const NM=CLT+'/usr/bin/llvm-nm',OTOOL=CLT+'/usr/bin/llvm-otool';
const SDK=CLT+'/SDKs/MacOSX26.5.sdk',RESOURCE=CLT+'/usr/lib/clang/21';
const NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const hash=b=>createHash('sha256').update(b).digest('hex');
const DRIVER="#include \"task6a-origin-native-remap-policy-v2.h\"\n#ifdef SF_REMAP_POLICY_UNAVAILABLE\nenum sf_remap_result_v2 sf_remap_policy_run_v2(\n    struct sf_remap_policy_v2 *p, const struct sf_remap_ports_v2 *ports) {\n    (void)p; (void)ports; return SF_R_UNAVAILABLE;\n}\n#endif\n/* Synthetic computation ONLY. These numbers never denote acquired OS FDs. */\nstruct model {\n    struct sf_remap_policy_v2 *policy;\n    int ofd[16], calls, binds, error, fault, effect, return_override;\n    int binding_fault, binding_return, reentry_at, reentry_binding, reentries;\n    const struct sf_remap_ports_v2 *ports;\n};\nstatic void active_reentry(struct model *m);\nstatic const int kinds[8] = {0,0,0,0,1,1,0,0};\nstatic const int inputs[8] = {3,4,5,6,7,8,7,8};\nstatic const int outputs[8] = {-1,-1,-1,-1,3,4,-1,-1};\nstatic int prepare(struct model *m, int kind, int input, int output) {\n    int at=m->calls++;\n    if(at<0 || at>=8 || kinds[at]!=kind || inputs[at]!=input ||\n       outputs[at]!=output) { m->error=1; return -1; }\n    struct sf_remap_action_v2 *a=m->policy->action+at;\n    if(a->attempted!=1 || a->returned!=0) m->error=1;\n    if(kind==0) {\n        int source=input-3;\n        if(source<0 || source>=6 ||\n           m->policy->occurrence[source].state!=SF_R_CLOSING ||\n           m->policy->occurrence[source].id!=(unsigned)(source+1))\n            m->error=1;\n    } else {\n        int target=output+3;\n        if(m->policy->occurrence[target].state!=SF_R_PENDING ||\n           m->policy->occurrence[target].id!=(unsigned)(target+1) ||\n           m->policy->occurrence[output-3].state!=SF_R_SETTLED)\n            m->error=1;\n    }\n    return at;\n}\nstatic struct sf_remap_call_v2 model_close(void *context, int fd) {\n    struct model *m=context;\n    int at=prepare(m,0,fd,-1);\n    if(at<0 || m->error || fd<0 || fd>=16 || m->ofd[fd]==0)\n        return (struct sf_remap_call_v2){-1,9};\n    if(at==m->fault) {\n        if(m->effect) m->ofd[fd]=0;\n        return (struct sf_remap_call_v2){m->return_override,5};\n    }\n    if(at==m->reentry_at)active_reentry(m);\n    m->ofd[fd]=0;\n    return (struct sf_remap_call_v2){0,0};\n}\nstatic struct sf_remap_call_v2 model_duplicate(void *context,int from,int to) {\n    struct model *m=context;\n    int at=prepare(m,1,from,to);\n    if(at<0 || m->error || from<0 || from>=16 || to<0 || to>=16 ||\n       m->ofd[from]==0 || m->ofd[to]!=0)\n        return (struct sf_remap_call_v2){-1,9};\n    if(at==m->fault) {\n        if(m->effect) m->ofd[to]=m->ofd[from];\n        return (struct sf_remap_call_v2){m->return_override,5};\n    }\n    if(at==m->reentry_at)active_reentry(m);\n    m->ofd[to]=m->ofd[from];\n    return (struct sf_remap_call_v2){to,0};\n}\nstatic int model_binding(void *context,int fd,unsigned id) {\n    struct model *m=context;int at=m->binds++;\n    if(at<0 || at>=2 || fd!=at+3 || id!=(unsigned)(at+7)) {\n        m->error=1;return 0;\n    }\n    const struct sf_remap_occurrence_v2 *o=m->policy->occurrence+at+6;\n    const struct sf_remap_action_v2 *a=m->policy->action+at+4;\n    if(o->state!=SF_R_HELD || o->id!=id || o->fd!=fd ||\n       a->attempted!=1 || a->returned!=1 || a->rc!=fd ||\n       m->ofd[fd]!=(at==0?11:22)) { m->error=1;return 0; }\n    if(at==m->reentry_binding)active_reentry(m);\n    return at==m->binding_fault?m->binding_return:1;\n}\nstatic void setup(struct sf_remap_policy_v2 *p,struct model *m,\n                  struct sf_remap_ports_v2 *ports) {\n    p->ready=1;p->entered=0;p->burned=0;\n    for(int i=0;i<8;i++) {\n        p->occurrence[i].id=(unsigned)(i+1);\n        p->occurrence[i].fd=i<6?i+3:i-3;\n        p->occurrence[i].state=i<6?SF_R_HELD:SF_R_EMPTY;\n        p->action[i].attempted=0;p->action[i].returned=0;\n        p->action[i].rc=0;p->action[i].error=0;\n    }\n    m->policy=p;m->calls=0;m->binds=0;m->error=0;m->fault=-1;\n    m->effect=0;m->return_override=-1;m->binding_fault=-1;\n    m->binding_return=0;m->reentry_at=-1;m->reentry_binding=-1;m->reentries=0;\n    m->ports=ports;\n    for(int i=0;i<16;i++)m->ofd[i]=0;\n    m->ofd[3]=11;m->ofd[4]=12;m->ofd[5]=21;m->ofd[6]=22;\n    m->ofd[7]=11;m->ofd[8]=22;\n    ports->context=m;ports->close_one=model_close;\n    ports->duplicate=model_duplicate;ports->binding_valid=model_binding;\n}\n/* Fieldwise custody snapshots avoid padding and implicit libc copies. */\nstruct snapshot {\n    struct sf_remap_policy_v2 policy;\n    struct model model;\n};\nstatic void remember(struct snapshot *s,const struct sf_remap_policy_v2 *p,\n                     const struct model *m) {\n    s->policy.ready=p->ready;s->policy.entered=p->entered;s->policy.burned=p->burned;\n    for(int i=0;i<8;i++) {\n        s->policy.occurrence[i].id=p->occurrence[i].id;\n        s->policy.occurrence[i].fd=p->occurrence[i].fd;\n        s->policy.occurrence[i].state=p->occurrence[i].state;\n        s->policy.action[i].attempted=p->action[i].attempted;\n        s->policy.action[i].returned=p->action[i].returned;\n        s->policy.action[i].rc=p->action[i].rc;\n        s->policy.action[i].error=p->action[i].error;\n    }\n    s->model.policy=m->policy;s->model.calls=m->calls;s->model.binds=m->binds;\n    s->model.error=m->error;s->model.fault=m->fault;s->model.effect=m->effect;\n    s->model.return_override=m->return_override;\n    s->model.binding_fault=m->binding_fault;s->model.binding_return=m->binding_return;\n    s->model.reentry_at=m->reentry_at;s->model.reentry_binding=m->reentry_binding;\n    s->model.reentries=m->reentries;s->model.ports=m->ports;\n    for(int i=0;i<16;i++)s->model.ofd[i]=m->ofd[i];\n}\nstatic int preserved(const struct snapshot *s,const struct sf_remap_policy_v2 *p,\n                     const struct model *m) {\n    if(s->policy.ready!=p->ready || s->policy.entered!=p->entered)return 0;\n    for(int i=0;i<8;i++)\n        if(s->policy.occurrence[i].id!=p->occurrence[i].id ||\n           s->policy.occurrence[i].fd!=p->occurrence[i].fd ||\n           s->policy.occurrence[i].state!=p->occurrence[i].state ||\n           s->policy.action[i].attempted!=p->action[i].attempted ||\n           s->policy.action[i].returned!=p->action[i].returned ||\n           s->policy.action[i].rc!=p->action[i].rc ||\n           s->policy.action[i].error!=p->action[i].error)return 0;\n    if(s->model.policy!=m->policy || s->model.calls!=m->calls ||\n       s->model.binds!=m->binds || s->model.error!=m->error ||\n       s->model.fault!=m->fault || s->model.effect!=m->effect ||\n       s->model.return_override!=m->return_override ||\n       s->model.binding_fault!=m->binding_fault ||\n       s->model.binding_return!=m->binding_return || s->model.ports!=m->ports ||\n       s->model.reentry_at!=m->reentry_at ||\n       s->model.reentry_binding!=m->reentry_binding ||\n       s->model.reentries!=m->reentries)return 0;\n    for(int i=0;i<16;i++)if(s->model.ofd[i]!=m->ofd[i])return 0;\n    return 1; /* Only the policy burn latch is deliberately excluded. */\n}\nstatic void active_reentry(struct model *m) {\n    struct snapshot s;remember(&s,m->policy,m);\n    if(sf_remap_policy_run_v2(m->policy,m->ports)!=SF_R_REFUSED ||\n       m->policy->burned!=1 || !preserved(&s,m->policy,m))m->error=1;\n    m->reentries++;\n}\nstatic int reentry_preserved(struct sf_remap_policy_v2 *p,struct model *m,\n                             const struct sf_remap_ports_v2 *ports) {\n    struct snapshot s;remember(&s,p,m);\n    return sf_remap_policy_run_v2(p,ports)==SF_R_REFUSED &&\n           p->burned==1 && preserved(&s,p,m);\n}\nstatic int action_prefix(const struct sf_remap_policy_v2 *p,int end) {\n    for(int i=0;i<8;i++) {\n        unsigned want=(unsigned)(i<=end);\n        if(p->action[i].attempted!=want || p->action[i].returned!=want)return 0;\n    }\n    return 1;\n}\nstatic int success_state(const struct sf_remap_policy_v2 *p,const struct model *m) {\n    if(p->entered!=1 || p->burned!=0 || m->calls!=8 || m->binds!=2 ||\n       m->error || !action_prefix(p,7))return 0;\n    for(int i=0;i<6;i++)\n        if(p->occurrence[i].state!=SF_R_SETTLED ||\n           p->occurrence[i].id!=(unsigned)(i+1) || p->occurrence[i].fd!=i+3)\n            return 0;\n    for(int i=6;i<8;i++)\n        if(p->occurrence[i].state!=SF_R_HELD ||\n           p->occurrence[i].id!=(unsigned)(i+1) || p->occurrence[i].fd!=i-3)\n            return 0;\n    if(m->ofd[3]!=11 || m->ofd[4]!=22)return 0;\n    for(int i=5;i<16;i++)if(m->ofd[i]!=0)return 0;\n    const int rc[8]={0,0,0,0,3,4,0,0};\n    for(int i=0;i<8;i++)\n        if(p->action[i].rc!=rc[i] || p->action[i].error!=0)return 0;\n    return 1;\n}\nstatic int burned_state(const struct sf_remap_policy_v2 *p,const struct model *m,\n                        int end,int failed_dup,int binding_failure) {\n    if(p->entered!=1 || p->burned!=1 || m->error || m->calls!=end+1 ||\n       !action_prefix(p,end))return 0;\n    const int closed_at[6]={0,1,2,3,6,7};\n    for(int i=0;i<6;i++) {\n        enum sf_remap_state_v2 want=closed_at[i]<end?SF_R_SETTLED:SF_R_HELD;\n        if(closed_at[i]==end)want=SF_R_UNKNOWN;\n        if(p->occurrence[i].state!=want ||\n           p->occurrence[i].id!=(unsigned)(i+1) || p->occurrence[i].fd!=i+3)return 0;\n    }\n    for(int i=6;i<8;i++) {\n        int at=i-2;\n        enum sf_remap_state_v2 want=at<=end?SF_R_HELD:SF_R_EMPTY;\n        if(at==end && failed_dup && !binding_failure)want=SF_R_UNKNOWN;\n        if(p->occurrence[i].state!=want ||\n           p->occurrence[i].id!=(unsigned)(i+1) || p->occurrence[i].fd!=i-3)return 0;\n    }\n    const int rc[8]={0,0,0,0,3,4,0,0};\n    for(int i=0;i<8;i++) {\n        int want_rc=i<=end?rc[i]:0, want_error=0;\n        if(i==end && !binding_failure){want_rc=m->return_override;want_error=5;}\n        if(p->action[i].rc!=want_rc || p->action[i].error!=want_error)return 0;\n    }\n    int binds=end<4?0:end==4?0:end==5?1:2;\n    if(binding_failure)binds++;\n    if(m->binds!=binds)return 0;\n    /* Independent literal open-file identities, including ambiguous effects. */\n    int ofd[16];\n    for(int i=0;i<16;i++)ofd[i]=0;\n    ofd[3]=11;ofd[4]=12;ofd[5]=21;ofd[6]=22;ofd[7]=11;ofd[8]=22;\n    for(int i=0;i<6;i++)\n        if(closed_at[i]<end || (closed_at[i]==end && m->effect))ofd[i+3]=0;\n    if(end>4 || (end==4 && (binding_failure || m->effect)))ofd[3]=11;\n    if(end>5 || (end==5 && (binding_failure || m->effect)))ofd[4]=22;\n    for(int i=0;i<16;i++)if(m->ofd[i]!=ofd[i])return 0;\n    return 1;\n}\nstatic int active_state(const struct sf_remap_policy_v2 *p,const struct model *m,\n                        int end,int inside_binding) {\n    if(p->entered!=1 || p->burned!=1 || m->error || m->reentries!=1 ||\n       m->calls!=end+1 || !action_prefix(p,end))return 0;\n    const int closed_at[6]={0,1,2,3,6,7},rc[8]={0,0,0,0,3,4,0,0};\n    for(int i=0;i<8;i++) {\n        enum sf_remap_state_v2 want=i<6?\n            (closed_at[i]<=end?SF_R_SETTLED:SF_R_HELD):\n            (i-2<=end?SF_R_HELD:SF_R_EMPTY);\n        if(p->occurrence[i].id!=(unsigned)(i+1) ||\n           p->occurrence[i].fd!=(i<6?i+3:i-3) || p->occurrence[i].state!=want ||\n           p->action[i].rc!=(i<=end?rc[i]:0) || p->action[i].error!=0)return 0;\n    }\n    int binds=end<5?0:end==5?1:2;\n    if(inside_binding)binds++;\n    if(m->binds!=binds)return 0;\n    int ofd[16];for(int i=0;i<16;i++)ofd[i]=0;\n    ofd[3]=11;ofd[4]=12;ofd[5]=21;ofd[6]=22;ofd[7]=11;ofd[8]=22;\n    for(int i=0;i<6;i++)if(closed_at[i]<=end)ofd[i+3]=0;\n    if(end>=4)ofd[3]=11;\n    if(end>=5)ofd[4]=22;\n    for(int i=0;i<16;i++)if(m->ofd[i]!=ofd[i])return 0;\n    return 1;\n}\nint main(void) {\n    struct sf_remap_policy_v2 p;\n    struct model m;struct sf_remap_ports_v2 ports;\n    struct snapshot before;\n    setup(&p,&m,&ports);remember(&before,&p,&m);\n    enum sf_remap_result_v2 result=sf_remap_policy_run_v2(&p,&ports);\n    if(result==SF_R_UNAVAILABLE) {\n        if(p.burned!=before.policy.burned || !preserved(&before,&p,&m))return 72;\n        return 71; /* Specific unimplemented, definite model NO_EFFECT. */\n    }\n    if(result!=SF_R_COMPLETE || !success_state(&p,&m))return 81;\n    /* Reentry must not erase any of the eight historical action records. */\n    if(!reentry_preserved(&p,&m,&ports))return 82;\n\n    const int close_at[6]={0,1,2,3,6,7};\n    const int close_return[2]={-1,1};\n    for(int i=0;i<6;i++)for(int effect=0;effect<2;effect++)\n      for(int bad_rc=0;bad_rc<2;bad_rc++) {\n        setup(&p,&m,&ports);m.fault=close_at[i];m.effect=effect;\n        m.return_override=close_return[bad_rc];\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !burned_state(&p,&m,close_at[i],0,0) ||\n           p.action[close_at[i]].rc!=close_return[bad_rc])return 90+i;\n        if(!reentry_preserved(&p,&m,&ports))return 96;\n    }\n    for(int at=4;at<=5;at++)for(int effect=0;effect<2;effect++) {\n        setup(&p,&m,&ports);m.fault=at;m.effect=effect;\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !burned_state(&p,&m,at,1,0) || p.action[at].rc!=-1)return 100+at;\n        if(!reentry_preserved(&p,&m,&ports))return 109;\n    }\n    const int bad_return[2]={0,9};\n    for(int at=4;at<=5;at++)for(int i=0;i<2;i++) {\n        setup(&p,&m,&ports);m.fault=at;m.effect=1;\n        m.return_override=bad_return[i];\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !burned_state(&p,&m,at,1,0) ||\n           p.action[at].rc!=bad_return[i])return 110+at;\n        if(!reentry_preserved(&p,&m,&ports))return 119;\n    }\n    const int bad_binding[3]={0,-1,2};\n    for(int at=0;at<2;at++)for(int i=0;i<3;i++) {\n        setup(&p,&m,&ports);m.binding_fault=at;\n        m.binding_return=bad_binding[i];\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !burned_state(&p,&m,at+4,0,1) ||\n           p.occurrence[at+6].state!=SF_R_HELD)return 120+at;\n        if(!reentry_preserved(&p,&m,&ports))return 129;\n    }\n    /* Active same-owner policy reentry must burn without granting later ports. */\n    for(int at=0;at<8;at++) {\n        setup(&p,&m,&ports);m.reentry_at=at;\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !active_state(&p,&m,at,0))return 150+at;\n        if(!reentry_preserved(&p,&m,&ports))return 158;\n    }\n    for(int at=0;at<2;at++) {\n        setup(&p,&m,&ports);m.reentry_binding=at;\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_BURNED ||\n           !active_state(&p,&m,at+4,1))return 160+at;\n        if(!reentry_preserved(&p,&m,&ports))return 162;\n    }\n    for(int bad=0;bad<10;bad++) {\n        setup(&p,&m,&ports);\n        if(bad==0)p.ready=0;\n        if(bad==1)p.ready=2;\n        if(bad==2)p.occurrence[0].fd=4;\n        if(bad==3)p.occurrence[1].id=1;\n        if(bad==4)p.occurrence[3].state=SF_R_UNKNOWN;\n        if(bad==5)p.occurrence[6].state=SF_R_HELD;\n        if(bad==6)p.action[0].attempted=1;\n        if(bad==7)p.action[7].returned=1;\n        if(bad==8)p.entered=1;\n        if(bad==9)p.burned=1;\n        remember(&before,&p,&m);\n        if(sf_remap_policy_run_v2(&p,&ports)!=SF_R_REFUSED ||\n           p.burned!=1 || !preserved(&before,&p,&m))return 130+bad;\n    }\n    for(int bad=0;bad<4;bad++) {\n        setup(&p,&m,&ports);\n        if(bad==0)ports.close_one=0;\n        if(bad==1)ports.duplicate=0;\n        if(bad==2)ports.binding_valid=0;\n        remember(&before,&p,&m);\n        if(sf_remap_policy_run_v2(&p,bad==3?0:&ports)!=SF_R_REFUSED ||\n           p.burned!=1 || !preserved(&before,&p,&m))return 145+bad;\n    }\n    setup(&p,&m,&ports);remember(&before,&p,&m);\n    if(sf_remap_policy_run_v2(0,&ports)!=SF_R_REFUSED ||\n       p.burned!=before.policy.burned || !preserved(&before,&p,&m))return 149;\n    return 0;\n}\n";
const HEADER_SHA='ed8870670992d954b7496e601b1f56339be639afa1743a043b4938b211e8cab7';
const material=['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'];
function same(a,b){return material.every(k=>a[k]===b[k]);}
function hold(filename,{uid,sha,inode,size,limit=1_048_576}={}){
  const fd=fs.openSync(filename,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{
    const stat=fs.fstatSync(fd,{bigint:true});
    assert.ok(stat.isFile());assert.equal(stat.nlink,1n);
    assert.equal(stat.uid,BigInt(uid));assert.equal(stat.mode&0o022n,0n);
    assert.equal(fs.realpathSync(filename),filename);
    assert.ok(stat.size>=0n && stat.size<=BigInt(limit));
    if(inode!==undefined)assert.equal(stat.ino,BigInt(inode));
    if(size!==undefined)assert.equal(stat.size,BigInt(size));
    const digest=()=>{
      const h=createHash('sha256'),chunk=Buffer.alloc(1_048_576);let at=0;
      while(at<Number(stat.size)){
        const count=fs.readSync(fd,chunk,0,Math.min(chunk.length,Number(stat.size)-at),at);
        assert.ok(count>0);h.update(chunk.subarray(0,count));at+=count;
      }return h.digest('hex');
    };
    const initial=digest();if(sha!==undefined)assert.equal(initial,sha,'fixed input '+filename);
    const check=()=>{
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(filename,{bigint:true})));
      assert.equal(digest(),initial);
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
    };
    check();
    return{filename,fd,stat,sha:initial,check,read(){
      check();const bytes=Buffer.alloc(Number(stat.size));let at=0;
      while(at<bytes.length){const n=fs.readSync(fd,bytes,at,bytes.length-at,at);assert.ok(n>0);at+=n;}
      assert.equal(hash(bytes),initial);check();return bytes;
    },close(){fs.closeSync(fd);}};
  }catch(error){
    try{fs.closeSync(fd);}catch(closeError){throw new AggregateError([error,closeError]);}
    throw error;
  }
}
function absent(filename){
  try{fs.lstatSync(filename);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('expected source absence: '+filename);
}
function directory(filename){
  const initial=fs.lstatSync(filename,{bigint:true});assert.ok(initial.isDirectory());
  return()=>{
    const now=fs.lstatSync(filename,{bigint:true});assert.ok(now.isDirectory());
    for(const k of ['dev','ino','uid','gid','mode'])assert.equal(now[k],initial[k]);
  };
}
function settled(command,args,cwd){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,shell:false,stdio:['ignore','pipe','pipe'],
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:cwd}});
    const chunks=[[],[]],eof=[false,false],errors=[];let exit=null,bytes=0,overflow=false;
    child.on('error',e=>errors.push(String(e)));
    child.on('exit',(code,signal)=>{exit={code,signal};});
    for(const [i,stream] of [child.stdout,child.stderr].entries()){
      stream.on('data',b=>{bytes+=b.length;if(bytes<=262144)chunks[i].push(b);else overflow=true;});
      stream.on('end',()=>{eof[i]=true;});
      stream.on('error',e=>errors.push(String(e)));
    }
    child.on('close',(code,signal)=>{
      try{
        assert.deepEqual(exit,{code,signal});assert.equal(signal,null);
        assert.deepEqual(eof,[true,true]);assert.deepEqual(errors,[]);assert.equal(overflow,false);
        resolve({command,args,code,signal,eof,stdout:Buffer.concat(chunks[0]).toString(),
          stderr:Buffer.concat(chunks[1]).toString()});
      }catch(error){reject(error);}
    });
  });
}
function zero(r,label){
  assert.equal(r.code,0,label);assert.equal(r.signal,null);
  assert.deepEqual(r.eof,[true,true]);assert.equal(r.stdout,'',label+' stdout');
  assert.equal(r.stderr,'',label+' stderr');
}
async function invoke(){
  const held=[],checks=[],results=[],closeErrors=[];let closed=0,receipt,fixture=null;
  const begin=new Date().toISOString();
  try{
    held.push(hold(headerPath,{uid:501,sha:HEADER_SHA}));
    held.push(hold(selfPath,{uid:501}));
    let source=null;
    try{source=hold(sourcePath,{uid:501});held.push(source);}
    catch(error){if(error.code!=='ENOENT')throw error;absent(sourcePath);checks.push(()=>absent(sourcePath));}
    assert.ok(mode==='baseline' || source!==null,'derivative requires actual implementation');
    for(const [filename,inode,size,sha,uid]of[
      [CLANG,14827087,290664032,'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d',0],
      [LD,14827148,4953232,'28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d',0],
      [NM,14827169,33125008,'9097f9662024989b801a1448eea2a71a4e916537a595cbaf34d4d051480236f6',0],
      [OTOOL,14827173,138208,'61ff2c63cf68eeeadf9c4700dadb8271740ff4960f98500f30db82b31521c0de',0],
      [NODE,15033141,68032,'59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553',501]
    ])held.push(hold(filename,{uid,inode,size,sha,limit:size}));
    assert.equal(fs.realpathSync(process.execPath),NODE,'fixed test runtime');
    for(const [filename,sha]of[
      [SDK+'/SDKSettings.json','f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'],
      [SDK+'/usr/lib/libSystem.B.tbd','20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57'],
      [CLT+'/usr/share/man/man1/ld.1','8570994697756ef9bf0146983a6971892d99cb830a2b36f93fb0d049835e81d5']
    ])held.push(hold(filename,{uid:0,sha}));
    const parents=new Set();
    for(const item of held){let d=path.dirname(item.filename);while(d!=='/'){parents.add(d);d=path.dirname(d);}}
    for(const d of parents)checks.push(directory(d));
    assert.equal(fs.lstatSync(SDK,{bigint:true}).ino,14162438n);
    assert.equal(fs.lstatSync(RESOURCE,{bigint:true}).ino,6714331n);
    assert.equal(fs.realpathSync(RESOURCE),RESOURCE);
    assert.equal(fs.lstatSync(RESOURCE,{bigint:true}).uid,0n);
    checks.push(directory(RESOURCE));
    const dir=fs.mkdtempSync('/private/tmp/setfarm-remap-policy-model.');
    fixture=dir;
    fs.chmodSync(dir,0o700);checks.push(directory(dir));
    const copy=(name,body)=>{
      const filename=dir+'/'+name;const bytes=Buffer.from(body);
      fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
      held.push(hold(filename,{uid:501,sha:hash(bytes)}));return filename;
    };
    const header=copy('task6a-origin-native-remap-policy-v2.h',held[0].read());
    const driver=copy('driver.c',DRIVER);
    let candidate=null,mutation=null;
    if(source){
      let body=source.read().toString();
      if(mode==='omit-first-close'){
        const old='for (unsigned i = 0; i < 4; i++)';
        assert.equal(body.split(old).length,2,'unique first-disposal omission anchor');
        body=body.replace(old,'for (unsigned i = 1; i < 4; i++)');
        mutation={kind:'omit-first-close',sha:hash(body)};
      }
      candidate=copy('policy.c',body);
    }
    const check=()=>{
      assert.equal(new Set(held.map(x=>x.fd)).size,held.length);
      for(const c of checks)c();for(const x of held)x.check();
    };
    const flags=['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'-integrated-as','-nostdinc',
      '-fno-modules','-fno-implicit-modules','-fno-implicit-module-maps','-fno-lto',
      '-fno-builtin','-fstack-protector-strong','-std=c11','-O0','-Wall','-Wextra','-Werror'];
    const objects=[];
    for(const filename of [candidate,driver].filter(Boolean)){
      check();const object=filename.replace(/\.c$/,'.o');
      const args=[...flags,...(!source?['-DSF_REMAP_POLICY_UNAVAILABLE=1']:[]),'-c',filename,'-o',object];
      const actual=await settled(CLANG,args,dir);results.push(actual);zero(actual,'compile');
      held.push(hold(object,{uid:501}));objects.push(object);check();
    }
    const binary=dir+'/model';
    check();const link=await settled(CLANG,['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'--ld-path='+LD,'-fno-lto','-nostdlib',
      '-Wl,-Z','-Wl,-syslibroot,'+SDK,...objects,SDK+'/usr/lib/libSystem.B.tbd','-o',binary],dir);
    results.push(link);zero(link,'link');held.push(hold(binary,{uid:501}));check();
    const imports=await settled(NM,['-uj',binary],dir);results.push(imports);
    assert.equal(imports.code,0);assert.equal(imports.stderr,'');
    assert.deepEqual(imports.stdout.trim().split('\n').sort(),['___stack_chk_fail','___stack_chk_guard']);
    check();const dependencies=await settled(OTOOL,['-L',binary],dir);results.push(dependencies);
    assert.equal(dependencies.code,0);assert.equal(dependencies.stderr,'');
    const lines=dependencies.stdout.trim().split('\n');assert.equal(lines.shift(),binary+':');
    assert.equal(lines.length,1);
    assert.match(lines[0],/^\s+\/usr\/lib\/libSystem\.B\.dylib \(compatibility version [0-9.]+, current version [0-9.]+\)$/);
    check();const run=await settled(binary,[],dir);results.push(run);
    assert.equal(run.stdout,'');assert.equal(run.stderr,'');check();
    const expected=['driver.c','driver.o','model','task6a-origin-native-remap-policy-v2.h',
      ...(source?['policy.c','policy.o']:[])].sort();
    assert.deepEqual(fs.readdirSync(dir).sort(),expected);
    receipt={kind:'C-policy MEMORY-MODEL computation; NO physical native ownership',begin,
      mode,sourcePresent:source!==null,fixture:dir,header,mutation,results,run,
      inputs:held.map(x=>({path:x.filename,sha:x.sha,ino:String(x.stat.ino),
        bytes:String(x.stat.size),mode:Number(x.stat.mode&0o777n)}))};
  }finally{
    for(const c of checks){
      try{c();}catch(error){closeErrors.push({operation:'directory-or-absence-recheck',error:String(error)});}
    }
    for(const x of held){
      try{x.check();}catch(error){closeErrors.push({path:x.filename,operation:'recheck',error:String(error)});}
      try{x.close();closed++;}catch(error){closeErrors.push({path:x.filename,operation:'close',error:String(error)});}
    }
    const footer={end:new Date().toISOString(),held:held.length,checkedOnceCloses:closed,closeErrors};
    if(receipt)Object.assign(receipt,footer);
    console.log(JSON.stringify(receipt??{kind:'unqualified model setup failure',begin,fixture,
      results,inputs:held.map(x=>({path:x.filename,sha:x.sha,ino:String(x.stat.ino),
        bytes:String(x.stat.size)})),...footer}));
    assert.deepEqual(closeErrors,[],'all original input holders rechecked and closed once');
    assert.equal(closed,held.length);
  }
  return receipt;
}
test('actual C remap policy preserves occurrence identity and stops on uncertainty',
  {skip:!enabled},async()=>{
    const observed=await invoke();
    // UNWRAPPED ordinary oracle: missing implementation is a genuine failure.
    assert.equal(observed.run.code,0,
      observed.run.code===71?'MissingRemapPolicy: actual C implementation unavailable':
      'actual C model policy rejected the independent behavioral oracle');
  });
