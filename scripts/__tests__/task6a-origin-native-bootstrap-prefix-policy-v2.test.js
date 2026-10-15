import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import test from 'node:test';

/* Actual composed C prefix; synthetic receipts only, never physical native ownership. */
const FLAG='SETFARM_ALLOW_NATIVE_BOOTSTRAP_PREFIX_MODEL_V2';
const enabled=process.env[FLAG]==='1';
assert.ok(process.env[FLAG]===undefined || enabled,'closed model-only opt-in');
for(const [name,value] of Object.entries(process.env))
  if(name!==FLAG && (name.startsWith('SETFARM_TASK6A_NATIVE_') ||
     (name.startsWith('SETFARM_ALLOW_') && /NATIVE|COOPERATIVE|TASK6A/.test(name))))
    assert.equal(value,undefined,'no adjacent native effect opt-in: '+name);
const mode=process.env.SETFARM_NATIVE_BOOTSTRAP_PREFIX_MODEL_MODE??'baseline';
assert.ok(['baseline','omit-cross-burn'].includes(mode),'closed model derivative');
const here=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.dirname(here);
const sourcePath=ROOT+'/task6a-origin-native-bootstrap-prefix-policy-v2.c';
const remapSourcePath=ROOT+'/task6a-origin-native-remap-policy-v2.c';
const remapHeaderPath=ROOT+'/task6a-origin-native-remap-policy-v2.h';
const headerPath=ROOT+'/task6a-origin-native-bootstrap-prefix-policy-v2.h';
const selfPath=fileURLToPath(import.meta.url);
const CLT='/Library/Developer/CommandLineTools';
const CLANG=CLT+'/usr/bin/clang',LD=CLT+'/usr/bin/ld';
const NM=CLT+'/usr/bin/llvm-nm',OTOOL=CLT+'/usr/bin/llvm-otool';
const SDK=CLT+'/SDKs/MacOSX26.5.sdk',RESOURCE=CLT+'/usr/lib/clang/21';
const NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const hash=b=>createHash('sha256').update(b).digest('hex');
const DRIVER="#include \"task6a-origin-native-bootstrap-prefix-policy-v2.h\"\n#ifdef SF_BOOTSTRAP_PREFIX_UNAVAILABLE\nenum sf_prefix_result_v2 sf_bootstrap_prefix_run_v2(\n    struct sf_prefix_policy_v2 *p,const struct sf_prefix_ports_v2 *ports) {\n    (void)p;(void)ports;return SF_P_UNAVAILABLE;\n}\n#endif\n/* Synthetic receipts ONLY: these numbers never identify acquired OS FDs. */\nstruct model {\n    struct sf_prefix_policy_v2 *p;\n    const struct sf_prefix_ports_v2 *ports;\n    int calls,error,fault,rc,output,saved,nested_at,nested_kind;\n};\nstatic const int kinds[23]={0,0,0,0,0,0,0,0,0,1,2,3,4,4,4,4,5,6,5,6,4,4,7};\nstatic const int fds[23]={0,1,2,3,4,5,6,7,8,-1,-1,-1,3,4,5,6,7,3,8,4,7,8,-1};\nstatic const int aux[23]={1,2,3,4,5,6,7,8,9,-1,-1,-1,-1,-1,-1,-1,3,7,4,8,-1,-1,-1};\nstatic const int close_at[6]={12,13,14,15,20,21};\nstatic void copy_receipt(struct sf_prefix_receipt_v2 *d,const struct sf_prefix_receipt_v2 *s) {\n    d->attempted=s->attempted;d->returned=s->returned;\n    d->rc=s->rc;d->error=s->error;d->output=s->output;\n}\nstatic int same_receipt(const struct sf_prefix_receipt_v2 *a,const struct sf_prefix_receipt_v2 *b) {\n    return a->attempted==b->attempted&&a->returned==b->returned&&a->rc==b->rc&&\n           a->error==b->error&&a->output==b->output;\n}\nstatic void copy_policy(struct sf_prefix_policy_v2 *d,const struct sf_prefix_policy_v2 *s) {\n    d->entered=s->entered;d->burned=s->burned;d->phase=s->phase;\n    d->remap.ready=s->remap.ready;d->remap.entered=s->remap.entered;d->remap.burned=s->remap.burned;\n    for(int i=0;i<3;i++){d->stdio[i].id=s->stdio[i].id;d->stdio[i].fd=s->stdio[i].fd;d->stdio[i].state=s->stdio[i].state;}\n    for(int i=0;i<8;i++){\n        d->remap.occurrence[i].id=s->remap.occurrence[i].id;\n        d->remap.occurrence[i].fd=s->remap.occurrence[i].fd;\n        d->remap.occurrence[i].state=s->remap.occurrence[i].state;\n        d->remap.action[i].attempted=s->remap.action[i].attempted;\n        d->remap.action[i].returned=s->remap.action[i].returned;\n        d->remap.action[i].rc=s->remap.action[i].rc;\n        d->remap.action[i].error=s->remap.action[i].error;\n    }\n    for(int i=0;i<9;i++)copy_receipt(d->genesis+i,s->genesis+i);\n    copy_receipt(&d->disable,&s->disable);copy_receipt(&d->mask,&s->mask);\n    copy_receipt(&d->entry,&s->entry);copy_receipt(&d->post,&s->post);\n    for(int i=0;i<2;i++)copy_receipt(d->binding+i,s->binding+i);\n}\nstatic int same_policy(const struct sf_prefix_policy_v2 *a,const struct sf_prefix_policy_v2 *b) {\n    /* Only the TWO sticky burn fields are intentionally excluded. */\n    if(a->entered!=b->entered||a->phase!=b->phase||a->remap.ready!=b->remap.ready||\n       a->remap.entered!=b->remap.entered)return 0;\n    for(int i=0;i<3;i++)if(a->stdio[i].id!=b->stdio[i].id||a->stdio[i].fd!=b->stdio[i].fd||a->stdio[i].state!=b->stdio[i].state)return 0;\n    for(int i=0;i<8;i++)if(a->remap.occurrence[i].id!=b->remap.occurrence[i].id||\n       a->remap.occurrence[i].fd!=b->remap.occurrence[i].fd||a->remap.occurrence[i].state!=b->remap.occurrence[i].state||\n       a->remap.action[i].attempted!=b->remap.action[i].attempted||\n       a->remap.action[i].returned!=b->remap.action[i].returned||\n       a->remap.action[i].rc!=b->remap.action[i].rc||a->remap.action[i].error!=b->remap.action[i].error)return 0;\n    for(int i=0;i<9;i++)if(!same_receipt(a->genesis+i,b->genesis+i))return 0;\n    if(!same_receipt(&a->disable,&b->disable)||!same_receipt(&a->mask,&b->mask)||\n       !same_receipt(&a->entry,&b->entry)||!same_receipt(&a->post,&b->post))return 0;\n    for(int i=0;i<2;i++)if(!same_receipt(a->binding+i,b->binding+i))return 0;\n    return 1;\n}\nstatic void zero_receipt(struct sf_prefix_receipt_v2 *r) {\n    r->attempted=0;r->returned=0;r->rc=0;r->error=0;r->output=0;\n}\nstatic struct sf_prefix_receipt_v2 *receipt(struct sf_prefix_policy_v2 *p,int at) {\n    if(at>=0&&at<9)return p->genesis+at;\n    if(at==9)return &p->disable;if(at==10)return &p->mask;if(at==11)return &p->entry;\n    if(at==17)return p->binding;if(at==19)return p->binding+1;if(at==22)return &p->post;\n    return 0;\n}\nstatic int action_index(int at) {\n    if(at>=12&&at<=15)return at-12;\n    if(at==16)return 4;if(at==18)return 5;if(at==20)return 6;if(at==21)return 7;\n    return -1;\n}\nstatic struct sf_remap_occurrence_v2 *origin(struct sf_prefix_policy_v2 *p,int i) {\n    return i<3?p->stdio+i:p->remap.occurrence+i-3;\n}\nstatic int reenter(struct model *m,int kind) {\n    struct sf_prefix_policy_v2 before;copy_policy(&before,m->p);int calls=m->calls;\n    if(kind==1){\n        if(sf_bootstrap_prefix_run_v2(m->p,m->ports)!=SF_P_REFUSED||\n           m->p->burned!=1||m->p->remap.burned!=1)return 0;\n    }else{\n        /* ready is0 or entered is1: existing policy must REFUSE without ports. */\n        struct sf_remap_ports_v2 r;\n        r.context=m;r.close_one=m->ports->close_one;\n        r.duplicate=m->ports->duplicate;r.binding_valid=m->ports->binding_valid;\n        if(sf_remap_policy_run_v2(&m->p->remap,&r)!=SF_R_REFUSED||\n           m->p->remap.burned!=1)return 0;\n    }\n    return m->calls==calls&&same_policy(&before,m->p);\n}\nstatic int enter(struct model *m,int kind,int fd,int extra) {\n    int at=m->calls++;\n    if(at<0||at>=23||kinds[at]!=kind||fds[at]!=fd||aux[at]!=extra){m->error=1;return at;}\n    struct sf_prefix_receipt_v2 *r=receipt(m->p,at);\n    int ai=action_index(at);\n    if(r&&(r->attempted!=1||r->returned!=0))m->error=1;\n    if(ai>=0&&(m->p->remap.action[ai].attempted!=1||m->p->remap.action[ai].returned!=0))m->error=1;\n    enum sf_prefix_phase_v2 phase=at<9?SF_P_GENESIS:at==9?SF_P_DISABLE:at==10?SF_P_MASK:\n        at==11?SF_P_ENTRY:at==22?SF_P_POST:SF_P_REMAP;\n    if(m->p->phase!=phase||m->p->entered!=1)m->error=1;\n    if(at==0)for(int i=0;i<9;i++){\n        struct sf_remap_occurrence_v2 *o=origin(m->p,i);\n        if(o->state!=SF_R_PENDING||o->fd!=i||o->id!=(unsigned)(i<3?i+1:i-2))m->error=1;\n    }\n    if(at<12&&(m->p->remap.ready!=0||m->p->remap.entered!=0))m->error=1;\n    if(at==12&&(m->p->disable.returned!=1||m->p->disable.rc!=0||\n       (m->p->disable.output!=0&&m->p->disable.output!=1)||m->p->mask.returned!=1||\n       m->p->mask.rc!=0||m->p->mask.output!=1||m->p->entry.returned!=1||m->p->entry.rc!=1))m->error=1;\n    if(at==m->nested_at&&!reenter(m,m->nested_kind))m->error=1;\n    return at;\n}\nstatic int genesis(void *v,unsigned id,int fd) {\n    struct model *m=v;int at=enter(m,0,fd,(int)id);return at==m->fault?m->rc:1;\n}\nstatic struct sf_prefix_call_v2 disable(void *v) {\n    struct model *m=v;int at=enter(m,1,-1,-1);struct sf_prefix_call_v2 r;\n    r.rc=at==m->fault?m->rc:0;r.error=at==m->fault?5:0;r.output=at==m->fault?m->output:m->saved;return r;\n}\nstatic struct sf_prefix_call_v2 mask(void *v) {\n    struct model *m=v;int at=enter(m,2,-1,-1);struct sf_prefix_call_v2 r;\n    r.rc=at==m->fault?m->rc:0;r.error=at==m->fault?5:0;r.output=at==m->fault?m->output:1;return r;\n}\nstatic int entry(void *v){struct model *m=v;int at=enter(m,3,-1,-1);return at==m->fault?m->rc:1;}\nstatic struct sf_remap_call_v2 close_one(void *v,int fd) {\n    struct model *m=v;int at=enter(m,4,fd,-1);struct sf_remap_call_v2 r;\n    r.rc=at==m->fault?m->rc:0;r.error=at==m->fault?5:0;return r;\n}\nstatic struct sf_remap_call_v2 duplicate(void *v,int fd,int target) {\n    struct model *m=v;int at=enter(m,5,fd,target);struct sf_remap_call_v2 r;\n    r.rc=at==m->fault?m->rc:target;r.error=at==m->fault?5:0;return r;\n}\nstatic int binding(void *v,int fd,unsigned id){struct model *m=v;int at=enter(m,6,fd,(int)id);return at==m->fault?m->rc:1;}\nstatic int post(void *v){struct model *m=v;int at=enter(m,7,-1,-1);return at==m->fault?m->rc:1;}\nstatic void setup(struct sf_prefix_policy_v2 *p,struct model *m,struct sf_prefix_ports_v2 *ports) {\n    p->entered=0;p->burned=0;p->phase=SF_P_UNBOUND;\n    p->remap.ready=0;p->remap.entered=0;p->remap.burned=0;\n    for(int i=0;i<3;i++){p->stdio[i].id=0;p->stdio[i].fd=0;p->stdio[i].state=SF_R_EMPTY;}\n    for(int i=0;i<8;i++){\n        p->remap.occurrence[i].id=0;p->remap.occurrence[i].fd=0;p->remap.occurrence[i].state=SF_R_EMPTY;\n        p->remap.action[i].attempted=0;p->remap.action[i].returned=0;p->remap.action[i].rc=0;p->remap.action[i].error=0;\n    }\n    for(int i=0;i<9;i++)zero_receipt(p->genesis+i);\n    zero_receipt(&p->disable);zero_receipt(&p->mask);zero_receipt(&p->entry);zero_receipt(&p->post);\n    for(int i=0;i<2;i++)zero_receipt(p->binding+i);\n    m->p=p;m->ports=ports;m->calls=0;m->error=0;m->fault=-1;m->rc=-1;m->output=0;\n    m->saved=0;m->nested_at=-1;m->nested_kind=0;\n    ports->context=m;ports->genesis=genesis;ports->disable=disable;ports->mask=mask;\n    ports->entry=entry;ports->close_one=close_one;ports->duplicate=duplicate;\n    ports->binding_valid=binding;ports->post=post;\n}\nstatic int model_initial(const struct model *m,const struct sf_prefix_policy_v2 *p,\n                         const struct sf_prefix_ports_v2 *ports) {\n    return m->p==p&&m->ports==ports&&m->calls==0&&m->error==0&&m->fault==-1&&\n        m->rc==-1&&m->output==0&&m->saved==0&&m->nested_at==-1&&m->nested_kind==0&&\n        ports->context==m&&ports->genesis==genesis&&ports->disable==disable&&\n        ports->mask==mask&&ports->entry==entry&&ports->close_one==close_one&&\n        ports->duplicate==duplicate&&ports->binding_valid==binding&&ports->post==post;\n}\nstatic int verify(struct sf_prefix_policy_v2 *p,struct model *m,int end,int burned) {\n    if(m->error||m->calls!=end+1||p->entered!=1||p->burned!=(unsigned)burned||p->remap.burned!=(unsigned)burned)return 0;\n    for(int at=0;at<23;at++){\n        struct sf_prefix_receipt_v2 *r=receipt(p,at);int ai=action_index(at),done=at<=end;\n        int rc=kinds[at]==4?0:kinds[at]==5?aux[at]:at==9||at==10?0:1;\n        int output=at==9?m->saved:at==10?1:0;\n        if(at==m->fault){rc=m->rc;if(at==9||at==10)output=m->output;}\n        if(r&&(r->attempted!=(unsigned)done||r->returned!=(unsigned)done||\n           r->rc!=(done?rc:0)||r->error!=(done&&at==m->fault&&(at==9||at==10)?5:0)||\n           r->output!=(done?output:0)))return 0;\n        if(ai>=0&&(p->remap.action[ai].attempted!=(unsigned)done||\n           p->remap.action[ai].returned!=(unsigned)done||p->remap.action[ai].rc!=(done?rc:0)||\n           p->remap.action[ai].error!=(done&&at==m->fault?5:0)))return 0;\n    }\n    for(int i=0;i<9;i++){\n        struct sf_remap_occurrence_v2 *o=origin(p,i);\n        enum sf_remap_state_v2 state=i<=end?SF_R_HELD:SF_R_PENDING;\n        if(i==end&&end<9&&m->fault==end&&m->rc!=1)state=SF_R_UNKNOWN;\n        if(i>=3&&end>=9){\n            int at=close_at[i-3];\n            if(at<=end)state=at==m->fault&&m->rc!=0?SF_R_UNKNOWN:SF_R_SETTLED;\n        }\n        if(o->id!=(unsigned)(i<3?i+1:i-2)||o->fd!=i||o->state!=state)return 0;\n    }\n    for(int i=0;i<2;i++){\n        int at=i==0?16:18;struct sf_remap_occurrence_v2 *o=p->remap.occurrence+i+6;\n        enum sf_remap_state_v2 state=end<at?SF_R_EMPTY:at==m->fault&&m->rc!=i+3?SF_R_UNKNOWN:SF_R_HELD;\n        if(o->id!=(unsigned)i+7||o->fd!=i+3||o->state!=state)return 0;\n    }\n    if(p->remap.ready!=(unsigned)(end>=12)||p->remap.entered!=(unsigned)(end>=12))return 0;\n    enum sf_prefix_phase_v2 phase=!burned?SF_P_COMPLETE:end<9?SF_P_GENESIS:end==9?SF_P_DISABLE:\n        end==10?SF_P_MASK:end==11?SF_P_ENTRY:end==22?SF_P_POST:SF_P_REMAP;\n    return p->phase==phase;\n}\nstatic int refused_preserves(struct sf_prefix_policy_v2 *p,struct model *m,struct sf_prefix_ports_v2 *ports) {\n    struct sf_prefix_policy_v2 before;copy_policy(&before,p);int calls=m->calls;\n    return sf_bootstrap_prefix_run_v2(p,ports)==SF_P_REFUSED&&p->burned==1&&\n           p->remap.burned==1&&m->calls==calls&&same_policy(&before,p);\n}\nint main(void) {\n    struct sf_prefix_policy_v2 p;struct model m;struct sf_prefix_ports_v2 ports;\n    struct sf_prefix_policy_v2 before;\n    setup(&p,&m,&ports);copy_policy(&before,&p);\n    enum sf_prefix_result_v2 result=sf_bootstrap_prefix_run_v2(&p,&ports);\n    if(result==SF_P_UNAVAILABLE) {\n        if(!same_policy(&before,&p)||p.burned!=before.burned||\n           p.remap.burned!=before.remap.burned||!model_initial(&m,&p,&ports)) {\n            return 72;\n        }\n        return 71;\n    }\n    if(result!=SF_P_PREFIX_COMPLETE||!verify(&p,&m,22,0))return 80;\n    if(!refused_preserves(&p,&m,&ports))return 81;\n    setup(&p,&m,&ports);m.saved=1;\n    if(sf_bootstrap_prefix_run_v2(&p,&ports)!=SF_P_PREFIX_COMPLETE||!verify(&p,&m,22,0))return 82;\n    const int bad[3]={0,-1,2};\n    for(int at=0;at<23;at++)for(int b=0;b<3;b++){\n        setup(&p,&m,&ports);m.fault=at;\n        m.rc=kinds[at]==4?(b==0?-1:b==1?1:2):kinds[at]==5?(b==0?-1:b==1?0:9):\n             at==9||at==10?(b==0?-1:b==1?1:2):bad[b];\n        m.output=0;\n        if(sf_bootstrap_prefix_run_v2(&p,&ports)!=SF_P_BURNED||!verify(&p,&m,at,1))return 100+at;\n        if(!refused_preserves(&p,&m,&ports))return 124;\n    }\n    const int illegal[3]={-1,2,3};\n    for(int at=9;at<=10;at++)for(int b=0;b<3;b++){\n        setup(&p,&m,&ports);m.fault=at;m.rc=0;m.output=at==9?illegal[b]:bad[b];\n        if(sf_bootstrap_prefix_run_v2(&p,&ports)!=SF_P_BURNED||!verify(&p,&m,at,1))return 125+at;\n        if(!refused_preserves(&p,&m,&ports))return 136;\n    }\n    for(int kind=1;kind<=2;kind++)for(int at=0;at<23;at++){\n        setup(&p,&m,&ports);m.nested_at=at;m.nested_kind=kind;\n        if(sf_bootstrap_prefix_run_v2(&p,&ports)!=SF_P_BURNED||!verify(&p,&m,at,1))return 140+at;\n        if(!refused_preserves(&p,&m,&ports))return 164;\n        /* Interrupted error results are preserved too, not replaced by BURNED. */\n        setup(&p,&m,&ports);m.nested_at=at;m.nested_kind=kind;m.fault=at;m.rc=-1;m.output=3;\n        if(sf_bootstrap_prefix_run_v2(&p,&ports)!=SF_P_BURNED||!verify(&p,&m,at,1))return 170+at;\n    }\n    for(int bad_port=0;bad_port<9;bad_port++){\n        setup(&p,&m,&ports);\n        if(bad_port==0)ports.genesis=0;if(bad_port==1)ports.disable=0;\n        if(bad_port==2)ports.mask=0;if(bad_port==3)ports.entry=0;\n        if(bad_port==4)ports.close_one=0;if(bad_port==5)ports.duplicate=0;\n        if(bad_port==6)ports.binding_valid=0;if(bad_port==7)ports.post=0;\n        if(!refused_preserves(&p,&m,bad_port==8?0:&ports))return 200+bad_port;\n    }\n    for(int dirty=0;dirty<10;dirty++){\n        setup(&p,&m,&ports);\n        if(dirty==0)p.entered=1;if(dirty==1)p.phase=SF_P_GENESIS;\n        if(dirty==2)p.remap.ready=1;if(dirty==3)p.burned=1;\n        if(dirty==4)p.remap.burned=1;if(dirty==5)p.stdio[2].id=3;\n        if(dirty==6)p.remap.occurrence[7].fd=4;if(dirty==7)p.genesis[8].returned=1;\n        if(dirty==8)p.post.error=5;if(dirty==9)p.remap.action[7].rc=9;\n        if(!refused_preserves(&p,&m,&ports))return 210+dirty;\n    }\n    setup(&p,&m,&ports);copy_policy(&before,&p);\n    if(sf_bootstrap_prefix_run_v2(0,&ports)!=SF_P_REFUSED||!same_policy(&before,&p)||\n       p.burned!=before.burned||p.remap.burned!=before.remap.burned||!model_initial(&m,&p,&ports))return 220;\n    return 0;\n}\n";
const HEADER_SHA='ad64d936990c55d0600ca259f5a416e2dbc8cbaa378f7208c9a00f6b4252236f';
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
    const remapSource=hold(remapSourcePath,{uid:501,sha:'4d57f44fdbafecf262139d6be08d9bebdbd788e32d5a12b4634ce60057a903c6'});held.push(remapSource);
    const remapHeader=hold(remapHeaderPath,{uid:501,sha:'ed8870670992d954b7496e601b1f56339be639afa1743a043b4938b211e8cab7'});held.push(remapHeader);
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
    const dir=fs.mkdtempSync('/private/tmp/setfarm-bootstrap-prefix-model.');
    fixture=dir;
    fs.chmodSync(dir,0o700);checks.push(directory(dir));
    const copy=(name,body)=>{
      const filename=dir+'/'+name;const bytes=Buffer.from(body);
      fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
      held.push(hold(filename,{uid:501,sha:hash(bytes)}));return filename;
    };
    const header=copy('task6a-origin-native-bootstrap-prefix-policy-v2.h',held[0].read());
    copy('task6a-origin-native-remap-policy-v2.h',remapHeader.read());
    const remapCandidate=copy('remap.c',remapSource.read());
    const driver=copy('driver.c',DRIVER);
    let candidate=null,mutation=null;
    if(source){
      let body=source.read().toString();
      if(mode==='omit-cross-burn'){
        const old='if (p->burned || p->remap.burned)';
        assert.equal(body.split(old).length,2,'unique cross-burn omission anchor');
        body=body.replace(old,'if (p->burned)');
        mutation={kind:'omit-cross-burn',sha:hash(body)};
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
    for(const filename of [remapCandidate,candidate,driver].filter(Boolean)){
      check();const object=filename.replace(/\.c$/,'.o');
      const args=[...flags,...(!source?['-DSF_BOOTSTRAP_PREFIX_UNAVAILABLE=1']:[]),'-c',filename,'-o',object];
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
    const expected=['driver.c','driver.o','model','remap.c','remap.o','task6a-origin-native-remap-policy-v2.h','task6a-origin-native-bootstrap-prefix-policy-v2.h',
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
test('actual C bootstrap prefix composes one ledger and rejects every uncertain continuation',
  {skip:!enabled},async()=>{
    const observed=await invoke();
    // UNWRAPPED ordinary oracle: missing implementation is a genuine failure.
    assert.equal(observed.run.code,0,
      observed.run.code===71?'MissingBootstrapPrefixPolicy: actual C implementation unavailable':
      'actual C model policy rejected the independent behavioral oracle');
  });
