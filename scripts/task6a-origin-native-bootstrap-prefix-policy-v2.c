#include "task6a-origin-native-bootstrap-prefix-policy-v2.h"

/* Shared private FD-prefix computation; never physical execution authority. */
static int receipt_empty(const struct sf_prefix_receipt_v2 *r) {
    return r->attempted==0 && r->returned==0 && r->rc==0 &&
           r->error==0 && r->output==0;
}
static int occurrence_empty(const struct sf_remap_occurrence_v2 *o) {
    return o->id==0 && o->fd==0 && o->state==SF_R_EMPTY;
}
static int canonical(const struct sf_prefix_policy_v2 *p) {
    if(p->entered!=0 || p->burned!=0 || p->phase!=SF_P_UNBOUND ||
       p->remap.ready!=0 || p->remap.entered!=0 || p->remap.burned!=0) return 0;
    for(unsigned i=0;i<3;i++) if(!occurrence_empty(p->stdio+i)) return 0;
    for(unsigned i=0;i<8;i++) {
        const struct sf_remap_action_v2 *a=p->remap.action+i;
        if(!occurrence_empty(p->remap.occurrence+i) || a->attempted!=0 ||
           a->returned!=0 || a->rc!=0 || a->error!=0) return 0;
    }
    for(unsigned i=0;i<9;i++) if(!receipt_empty(p->genesis+i)) return 0;
    if(!receipt_empty(&p->disable) || !receipt_empty(&p->mask) ||
       !receipt_empty(&p->entry) || !receipt_empty(&p->post)) return 0;
    for(unsigned i=0;i<2;i++) if(!receipt_empty(p->binding+i)) return 0;
    return 1;
}
static int burn(struct sf_prefix_policy_v2 *p) {
    p->burned=1;
    p->remap.burned=1;
    return 0;
}
static int live(struct sf_prefix_policy_v2 *p) {
    if (p->burned || p->remap.burned) return burn(p);
    return 1;
}
static void seal_integer(struct sf_prefix_receipt_v2 *r,int rc) {
    r->rc=rc;
    r->error=0;
    r->output=0;
    r->returned=1;
}
static void seal_call(struct sf_prefix_receipt_v2 *r,
                      struct sf_prefix_call_v2 result) {
    r->rc=result.rc;
    r->error=result.error;
    r->output=result.output;
    r->returned=1;
}
struct bridge {
    struct sf_prefix_policy_v2 *p;
    const struct sf_prefix_ports_v2 *ports;
};
static struct sf_remap_call_v2 close_forward(void *context,int fd) {
    struct bridge *b=context;
    const struct sf_remap_call_v2 result=b->ports->close_one(b->ports->context,fd);
    (void)live(b->p);
    /* The old policy, not this wrapper, seals its sole action receipt. */
    return result;
}
static struct sf_remap_call_v2 duplicate_forward(void *context,int source,int target) {
    struct bridge *b=context;
    const struct sf_remap_call_v2 result=
        b->ports->duplicate(b->ports->context,source,target);
    (void)live(b->p);
    return result;
}
static int binding_forward(void *context,int fd,unsigned id) {
    struct bridge *b=context;
    if(id<7 || id>8) return burn(b->p);
    struct sf_prefix_receipt_v2 *r=b->p->binding+id-7;
    r->attempted=1;
    const int result=b->ports->binding_valid(b->ports->context,fd,id);
    seal_integer(r,result);
    (void)live(b->p);
    return result;
}
enum sf_prefix_result_v2 sf_bootstrap_prefix_run_v2(
    struct sf_prefix_policy_v2 *p,const struct sf_prefix_ports_v2 *ports) {
    if(!p) return SF_P_REFUSED;
    if(!ports || !ports->genesis || !ports->disable || !ports->mask ||
       !ports->entry || !ports->close_one || !ports->duplicate ||
       !ports->binding_valid || !ports->post || !canonical(p)) {
        burn(p);
        return SF_P_REFUSED;
    }
    p->entered=1;
    p->phase=SF_P_GENESIS;
    for(unsigned i=0;i<3;i++) {
        p->stdio[i].id=i+1;
        p->stdio[i].fd=(int)i;
        p->stdio[i].state=SF_R_PENDING;
    }
    for(unsigned i=0;i<8;i++) {
        p->remap.occurrence[i].id=i+1;
        p->remap.occurrence[i].fd=i<6?(int)i+3:(int)i-3;
        p->remap.occurrence[i].state=i<6?SF_R_PENDING:SF_R_EMPTY;
    }
    for(unsigned i=0;i<9;i++) {
        struct sf_remap_occurrence_v2 *o=i<3?p->stdio+i:p->remap.occurrence+i-3;
        struct sf_prefix_receipt_v2 *r=p->genesis+i;
        r->attempted=1;
        const int result=ports->genesis(ports->context,i+1,(int)i);
        seal_integer(r,result);
        o->state=result==1?SF_R_HELD:SF_R_UNKNOWN;
        if(result!=1 || !live(p)) {
            burn(p);
            return SF_P_BURNED;
        }
    }
    p->phase=SF_P_DISABLE;
    p->disable.attempted=1;
    const struct sf_prefix_call_v2 disabled=ports->disable(ports->context);
    seal_call(&p->disable,disabled);
    if(disabled.rc!=0 || (disabled.output!=0 && disabled.output!=1) || !live(p)) {
        burn(p);
        return SF_P_BURNED;
    }
    p->phase=SF_P_MASK;
    p->mask.attempted=1;
    const struct sf_prefix_call_v2 masked=ports->mask(ports->context);
    seal_call(&p->mask,masked);
    if(masked.rc!=0 || masked.output!=1 || !live(p)) {
        burn(p);
        return SF_P_BURNED;
    }
    p->phase=SF_P_ENTRY;
    p->entry.attempted=1;
    const int entry=ports->entry(ports->context);
    seal_integer(&p->entry,entry);
    if(entry!=1 || !live(p)) {
        burn(p);
        return SF_P_BURNED;
    }
    p->phase=SF_P_REMAP;
    p->remap.ready=1;
    struct bridge b;
    b.p=p;
    b.ports=ports;
    struct sf_remap_ports_v2 remap;
    remap.context=&b;
    remap.close_one=close_forward;
    remap.duplicate=duplicate_forward;
    remap.binding_valid=binding_forward;
    const enum sf_remap_result_v2 remapped=sf_remap_policy_run_v2(&p->remap,&remap);
    if(remapped!=SF_R_COMPLETE || !live(p)) {
        burn(p);
        return SF_P_BURNED;
    }
    p->phase=SF_P_POST;
    p->post.attempted=1;
    const int post=ports->post(ports->context);
    seal_integer(&p->post,post);
    if(post!=1 || !live(p)) {
        burn(p);
        return SF_P_BURNED;
    }
    p->phase=SF_P_COMPLETE;
    return SF_P_PREFIX_COMPLETE;
}
