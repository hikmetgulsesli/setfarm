/* Job-routed four-frame mechanics DATA only; no owner, phase or startup authority. */
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <bsm/libbsm.h>
#include <stdint.h>
#include <stdatomic.h>
#include <string.h>
#include <unistd.h>

static const name_t controller_service="com.setrox.setfarm.dashboard-cutover.control.v4";
static const name_t dashboard_service="com.setrox.setfarm.dashboard-cutover.job.v4";
enum { LIMIT=1024, PREFIX=sizeof(mach_msg_header_t)+sizeof(uint32_t) };
enum { NONE,PENDING,HELD,DISPOSING,SETTLED,UNKNOWN };
enum { IDLE=0,ACTIVE=1,CONTROLLER_HELLO=2,BURNED=3,CONTROLLER_ACK=4,CLIENT_CHALLENGE=5,DONE=6 };
enum { HELLO,CHALLENGE,ACK,GRANT };
static _Atomic unsigned lifecycle=IDLE;
static _Atomic uintptr_t original_environment;
static _Atomic unsigned intrinsic_unknown_status;
struct right {volatile mach_port_name_t name;volatile unsigned state;volatile kern_return_t status,close_status;};
struct message {
    union {mach_msg_header_t header;uint8_t raw[PREFIX+LIMIT+sizeof(mach_msg_audit_trailer_t)];} buffer;
    volatile unsigned attempt,bsm_attempt[3];
    volatile mach_msg_return_t status;
    uint32_t length;
    volatile uid_t euid;volatile pid_t pid;volatile int version;
};
static struct {
    struct right endpoint,send,challenge_reply;
    struct message frames[4];
    uid_t peer_euid;pid_t peer_pid;int peer_version;
    volatile unsigned publication_attempt[3][7];
    volatile napi_status publication_status[3][7];
} vault;

static int active(void){return atomic_load(&lifecycle)==ACTIVE;}
static napi_value refuse(napi_env env){
    /* The sole bounded after-burn publication exception; never a normal port. */
    bool pending=false;
    if(napi_is_exception_pending(env,&pending)==napi_ok && pending){
        napi_value ignored;(void)napi_get_and_clear_last_exception(env,&ignored);
    }
    (void)napi_throw_error(env,NULL,"DASHBOARD_CUTOVER_MACH_JOB_CONTROL_REFUSED");return NULL;
}
static napi_value burn(napi_env env){atomic_store(&lifecycle,BURNED);return refuse(env);}

static int acquire_dashboard_send(void){
    struct right *r=&vault.send;
    mach_port_t name=MACH_PORT_NULL;
    if(!active() || r->state!=NONE)return 0;
    r->state=PENDING;
    kern_return_t k=bootstrap_look_up(bootstrap_port,dashboard_service,&name);
    r->name=name;r->status=k;
    r->state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
    return active() && r->state==HELD;
}

static int acquire(int controller){
    mach_port_t name=MACH_PORT_NULL;
    struct right *r=&vault.endpoint;
    if(!active() || r->state!=NONE)return 0;
    r->state=PENDING;
    kern_return_t k=bootstrap_check_in(bootstrap_port,controller?controller_service:dashboard_service,&name);
    r->name=name;r->status=k;
    r->state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
    if(!active() || r->state!=HELD)return 0;
    if(!controller){
        r=&vault.send;name=MACH_PORT_NULL;
        if(!active() || r->state!=NONE)return 0;
        r->state=PENDING;
        k=bootstrap_look_up(bootstrap_port,controller_service,&name);
        r->name=name;r->status=k;
        r->state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
        if(!active() || r->state!=HELD)return 0;
    }
    return 1;
}

static int send_frame(unsigned index,const uint8_t *input,size_t length,int controller){
    struct message *f=&vault.frames[index];
    struct right *destination=index==ACK?&vault.challenge_reply:&vault.send;
    if(!active() || f->attempt!=NONE || vault.endpoint.state!=HELD ||
        destination->state!=HELD || (controller?(index!=CHALLENGE && index!=GRANT):(index!=HELLO && index!=ACK)))return 0;
    memset(&f->buffer,0,sizeof f->buffer);f->length=(uint32_t)length;
    f->buffer.header.msgh_bits=MACH_MSGH_BITS(index==ACK?MACH_MSG_TYPE_MOVE_SEND_ONCE:MACH_MSG_TYPE_COPY_SEND,
        index==CHALLENGE?MACH_MSG_TYPE_MAKE_SEND_ONCE:0);
    f->buffer.header.msgh_size=(mach_msg_size_t)(PREFIX+round_msg(length));
    f->buffer.header.msgh_remote_port=destination->name;
    f->buffer.header.msgh_local_port=index==CHALLENGE?vault.endpoint.name:MACH_PORT_NULL;
    f->buffer.header.msgh_id=(mach_msg_id_t)(0x53463331+index);
    memcpy(f->buffer.raw+sizeof(mach_msg_header_t),&f->length,sizeof f->length);
    memcpy(f->buffer.raw+PREFIX,input,length);
    if(!active())return 0;
    f->attempt=PENDING;if(index==ACK)destination->state=DISPOSING;
    mach_msg_return_t k=mach_msg(&f->buffer.header,MACH_SEND_MSG|MACH_SEND_TIMEOUT|MACH_SEND_INTERRUPT,
        f->buffer.header.msgh_size,0,MACH_PORT_NULL,5000,MACH_PORT_NULL);
    f->status=k;f->attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if(index==ACK){destination->status=k;destination->state=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;}
    return active() && f->attempt==SETTLED;
}

static int receive_frame(unsigned index,int controller){
    struct message *f=&vault.frames[index];
    struct right *reply=&vault.challenge_reply;
    if(!active() || f->attempt!=NONE || vault.endpoint.state!=HELD ||
        (controller?(index!=HELLO && index!=ACK):(index!=CHALLENGE && index!=GRANT)))return 0;
    memset(&f->buffer,0,sizeof f->buffer);
    if(!active())return 0;
    f->attempt=PENDING;
    mach_msg_return_t k=mach_msg(&f->buffer.header,MACH_RCV_MSG|MACH_RCV_TIMEOUT|MACH_RCV_INTERRUPT|
        MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)|MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT),
        0,sizeof f->buffer,vault.endpoint.name,5000,MACH_PORT_NULL);
    f->status=k;f->attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if(k==MACH_MSG_SUCCESS && index==CHALLENGE){
        reply->name=f->buffer.header.msgh_remote_port;reply->status=k;
        reply->state=MACH_PORT_VALID(reply->name) &&
            f->buffer.header.msgh_bits==MACH_MSGH_BITS(MACH_MSG_TYPE_PORT_SEND_ONCE,MACH_MSG_TYPE_PORT_SEND)?HELD:UNKNOWN;
    }
    if(!active() || f->attempt!=SETTLED)return 0;
    mach_msg_header_t h=f->buffer.header;
    if(h.msgh_size<PREFIX || h.msgh_size>PREFIX+LIMIT)return 0;
    memcpy(&f->length,f->buffer.raw+sizeof h,sizeof f->length);
    if(f->length<1 || f->length>LIMIT)return 0;
    size_t padded=round_msg(f->length),size=PREFIX+padded;
    unsigned bits=MACH_MSGH_BITS(index==CHALLENGE?MACH_MSG_TYPE_PORT_SEND_ONCE:0,
        index==ACK?MACH_MSG_TYPE_PORT_SEND_ONCE:MACH_MSG_TYPE_PORT_SEND);
    if(h.msgh_bits!=bits || h.msgh_size!=size || h.msgh_id!=(mach_msg_id_t)(0x53463331+index) ||
        h.msgh_local_port!=vault.endpoint.name || h.msgh_voucher_port!=MACH_PORT_NULL ||
        (index==CHALLENGE?reply->state!=HELD:h.msgh_remote_port!=MACH_PORT_NULL))return 0;
    for(size_t i=f->length;i<padded;i++)if(f->buffer.raw[PREFIX+i]!=0)return 0;
    size_t offset=round_msg(h.msgh_size);
    if(offset>sizeof f->buffer || sizeof(mach_msg_audit_trailer_t)>sizeof f->buffer-offset)return 0;
    mach_msg_audit_trailer_t trailer;memcpy(&trailer,f->buffer.raw+offset,sizeof trailer);
    if(trailer.msgh_trailer_type!=MACH_MSG_TRAILER_FORMAT_0 || trailer.msgh_trailer_size!=sizeof trailer)return 0;

    if(!active())return 0;
    f->bsm_attempt[0]=PENDING;f->euid=audit_token_to_euid(trailer.msgh_audit);f->bsm_attempt[0]=SETTLED;
    if(!active() || f->euid==0 || f->euid!=geteuid() || (index>=ACK && f->euid!=vault.peer_euid))return 0;
    if(!active())return 0;
    f->bsm_attempt[1]=PENDING;f->pid=audit_token_to_pid(trailer.msgh_audit);f->bsm_attempt[1]=SETTLED;
    if(!active() || f->pid<=0 || f->pid==getpid() || (index>=ACK && f->pid!=vault.peer_pid))return 0;
    if(!active())return 0;
    f->bsm_attempt[2]=PENDING;f->version=audit_token_to_pidversion(trailer.msgh_audit);f->bsm_attempt[2]=SETTLED;
    if(!active() || f->version<=0 || (index>=ACK && f->version!=vault.peer_version))return 0;
    if(index<ACK){vault.peer_euid=f->euid;vault.peer_pid=f->pid;vault.peer_version=f->version;}
    return active();
}

static int dispose(int controller){
    struct right *r=&vault.endpoint;
    if(!active() || r->state!=HELD || vault.send.state!=HELD ||
        (!controller && vault.challenge_reply.state!=SETTLED))return 0;
    r->state=DISPOSING;
    kern_return_t k=mach_port_mod_refs(mach_task_self(),r->name,MACH_PORT_RIGHT_RECEIVE,-1);
    r->close_status=k;r->state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
    if(!active() || r->state!=SETTLED)return 0;
    r=&vault.send;
    if(!active() || r->state!=HELD)return 0;
    r->state=DISPOSING;k=mach_port_deallocate(mach_task_self(),r->name);
    r->close_status=k;r->state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
    return active() && r->state==SETTLED;
}

/* Every success publication has separate before/after admission and disposition. */
#define DATA_PORT(call) do { \
    if(!active() || port>=7)return burn(env); \
    vault.publication_attempt[publication][port]=PENDING; \
    napi_status returned=(call); \
    vault.publication_status[publication][port]=returned; \
    vault.publication_attempt[publication][port]=returned==napi_ok?SETTLED:UNKNOWN; \
    port++;if(!active() || returned!=napi_ok)return burn(env); \
} while(0)

static napi_value publish(napi_env env,unsigned index,unsigned publication,unsigned next,int terminal_empty){
    napi_value result,values[4];unsigned port=0;
    DATA_PORT(napi_create_object(env,&result));
    if(!terminal_empty){
        struct message *f=&vault.frames[index];
        DATA_PORT(napi_create_buffer_copy(env,f->length,f->buffer.raw+PREFIX,NULL,&values[0]));
        DATA_PORT(napi_create_uint32(env,(uint32_t)f->euid,&values[1]));
        DATA_PORT(napi_create_uint32(env,(uint32_t)f->pid,&values[2]));
        DATA_PORT(napi_create_uint32(env,(uint32_t)f->version,&values[3]));
        napi_property_descriptor fields[]={
            {.utf8name="bytes",.value=values[0],.attributes=napi_enumerable},
            {.utf8name="euid",.value=values[1],.attributes=napi_enumerable},
            {.utf8name="pid",.value=values[2],.attributes=napi_enumerable},
            {.utf8name="pidversion",.value=values[3],.attributes=napi_enumerable},
        };
        DATA_PORT(napi_define_properties(env,result,4,fields));
    }
    DATA_PORT(napi_object_freeze(env,result));
    unsigned expected=ACTIVE;
    if(!atomic_compare_exchange_strong(&lifecycle,&expected,next))return burn(env);
    return result;
}

static napi_value step(napi_env env,napi_callback_info info,unsigned method){
    unsigned state=atomic_load(&lifecycle);
    if(state==ACTIVE)return burn(env);
    unsigned desired=method==0 || method==3?IDLE:method==1?CONTROLLER_HELLO:method==2?CONTROLLER_ACK:CLIENT_CHALLENGE;
    if(state==IDLE && desired!=IDLE)return refuse(env);
    if(state!=desired || (state!=IDLE && atomic_load(&original_environment)!=(uintptr_t)env))return burn(env);

    /* Intrinsic preclaim checks: no kernel ports, no caller getters/callbacks. */
    size_t argc=2,length=0,offset=0;napi_value argv[2],backing;napi_typedarray_type type;
    void *data=NULL;bool typed=false,arraybuffer=false,detached=true;uint8_t local[LIMIT];
    #define ARG_PORT(call) do { \
        napi_status returned=(call); \
        if(returned!=napi_ok){atomic_store(&intrinsic_unknown_status,(unsigned)returned);return burn(env);} \
    } while(0)
    ARG_PORT(napi_get_cb_info(env,info,&argc,argv,NULL,NULL));
    if(argc!=(method==0?0u:1u))return refuse(env);
    if(method!=0){
        ARG_PORT(napi_is_typedarray(env,argv[0],&typed));
        if(!typed)return refuse(env);
        ARG_PORT(napi_get_typedarray_info(env,argv[0],&type,&length,&data,&backing,&offset));
        if(type!=napi_uint8_array || !data || length<1 || length>LIMIT)return refuse(env);
        ARG_PORT(napi_is_arraybuffer(env,backing,&arraybuffer));
        if(!arraybuffer)return refuse(env);
        ARG_PORT(napi_is_detached_arraybuffer(env,backing,&detached));
        if(detached)return refuse(env);
        memcpy(local,data,length);
    }
    #undef ARG_PORT
    unsigned expected=state;
    if(!atomic_compare_exchange_strong(&lifecycle,&expected,ACTIVE))return burn(env);
    if(state==IDLE)atomic_store(&original_environment,(uintptr_t)env);
    if(!active() || geteuid()==0)return burn(env);

    if(method==0){
        if(!acquire(1) || !receive_frame(HELLO,1))return burn(env);
        return publish(env,HELLO,0,CONTROLLER_HELLO,0);
    }
    if(method==1){
        if(!acquire_dashboard_send() || !send_frame(CHALLENGE,local,length,1) || !receive_frame(ACK,1))return burn(env);
        return publish(env,ACK,1,CONTROLLER_ACK,0);
    }
    if(method==2){
        if(!send_frame(GRANT,local,length,1) || !dispose(1))return burn(env);
        return publish(env,GRANT,2,DONE,1);
    }
    if(method==3){
        if(!acquire(0) || !send_frame(HELLO,local,length,0) || !receive_frame(CHALLENGE,0))return burn(env);
        return publish(env,CHALLENGE,0,CLIENT_CHALLENGE,0);
    }
    if(!send_frame(ACK,local,length,0) || !receive_frame(GRANT,0) || !dispose(0))return burn(env);
    return publish(env,GRANT,1,DONE,0);
}

static napi_value controller_hello(napi_env env,napi_callback_info info){return step(env,info,0);}
static napi_value controller_challenge(napi_env env,napi_callback_info info){return step(env,info,1);}
static napi_value controller_grant(napi_env env,napi_callback_info info){return step(env,info,2);}
static napi_value client_hello(napi_env env,napi_callback_info info){return step(env,info,3);}
static napi_value client_ack(napi_env env,napi_callback_info info){return step(env,info,4);}
NAPI_MODULE_INIT(){
    napi_property_descriptor methods[]={
        {.utf8name="receiveControllerHelloV4",.method=controller_hello,.attributes=napi_enumerable},
        {.utf8name="challengeControllerAndReceiveAckV4",.method=controller_challenge,.attributes=napi_enumerable},
        {.utf8name="sendControllerGrantV4",.method=controller_grant,.attributes=napi_enumerable},
        {.utf8name="helloClientAndReceiveChallengeV4",.method=client_hello,.attributes=napi_enumerable},
        {.utf8name="ackClientAndReceiveGrantV4",.method=client_ack,.attributes=napi_enumerable},
    };
    if(napi_define_properties(env,exports,5,methods)!=napi_ok || napi_object_freeze(env,exports)!=napi_ok)return refuse(env);
    return exports;
}

