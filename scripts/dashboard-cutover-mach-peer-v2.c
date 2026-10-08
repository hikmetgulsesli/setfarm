/* Closed two-birth echo mechanics DATA only; no owner or startup authority. */
#include <node_api.h>
#include <mach/mach.h>
#include <servers/bootstrap.h>
#include <bsm/libbsm.h>
#include <stdint.h>
#include <stdatomic.h>
#include <string.h>
#include <unistd.h>

static const name_t service="com.setrox.setfarm.dashboard-cutover.peer.v2";
enum { LIMIT=1024, REQUEST_ID=0x53463233, REPLY_ID=0x53463234,
    PREFIX=sizeof(mach_msg_header_t)+sizeof(uint32_t) };
enum { NONE,PENDING,HELD,DISPOSING,SETTLED,UNKNOWN };
static _Atomic unsigned lifecycle=0; /* idle, active, completed, burned */
static struct {
    volatile mach_port_name_t receive_name,send_name,reply_name;
    volatile unsigned receive_state,send_state,reply_state,send_attempt,receive_attempt;
    volatile kern_return_t acquire_status,allocate_status,send_status,receive_status;
    volatile kern_return_t receive_close_status,send_close_status;
    uint8_t input[LIMIT];
    union { mach_msg_header_t header;uint8_t raw[PREFIX+LIMIT+sizeof(mach_msg_audit_trailer_t)]; } sent,received;
} vault;

static int active(void){return atomic_load(&lifecycle)==1u;}
static napi_value refuse(napi_env env){
    bool pending=false;
    if(napi_is_exception_pending(env,&pending)==napi_ok && pending){
        napi_value ignored;(void)napi_get_and_clear_last_exception(env,&ignored);
    }
    (void)napi_throw_error(env,NULL,"DASHBOARD_CUTOVER_MACH_PEER_REFUSED");return NULL;
}
static napi_value burn(napi_env env){atomic_store(&lifecycle,3u);return refuse(env);}

static void frame(int controller,size_t length){
    memset(&vault.sent,0,sizeof vault.sent);
    vault.sent.header.msgh_bits=controller?MACH_MSGH_BITS(MACH_MSG_TYPE_MOVE_SEND_ONCE,0)
        :MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND,MACH_MSG_TYPE_MAKE_SEND_ONCE);
    vault.sent.header.msgh_size=(mach_msg_size_t)(PREFIX+round_msg(length));
    vault.sent.header.msgh_remote_port=controller?vault.reply_name:vault.send_name;
    vault.sent.header.msgh_local_port=controller?MACH_PORT_NULL:vault.receive_name;
    vault.sent.header.msgh_id=controller?REPLY_ID:REQUEST_ID;
    uint32_t n=(uint32_t)length;
    memcpy(vault.sent.raw+sizeof(mach_msg_header_t),&n,sizeof n);
    memcpy(vault.sent.raw+PREFIX,vault.input,length);
}

static int send_frame(int controller){
    if(!active())return 0;
    vault.send_attempt=PENDING;
    if(controller)vault.reply_state=DISPOSING;
    kern_return_t k=mach_msg(&vault.sent.header,MACH_SEND_MSG|MACH_SEND_TIMEOUT|MACH_SEND_INTERRUPT,
        vault.sent.header.msgh_size,0,MACH_PORT_NULL,5000,MACH_PORT_NULL);
    vault.send_status=k;vault.send_attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if(controller)vault.reply_state=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    return active() && vault.send_attempt==SETTLED;
}

static int receive_frame(int controller,size_t length,pid_t *pid,uid_t *euid,int *version){
    memset(&vault.received,0,sizeof vault.received);
    if(!active())return 0;
    vault.receive_attempt=PENDING;
    kern_return_t k=mach_msg(&vault.received.header,MACH_RCV_MSG|MACH_RCV_TIMEOUT|MACH_RCV_INTERRUPT|
        MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)|MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT),
        0,sizeof vault.received,vault.receive_name,5000,MACH_PORT_NULL);
    vault.receive_status=k;vault.receive_attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if(k==MACH_MSG_SUCCESS && controller){
        /* Register the returned occurrence/buffer before any publication/burn check. */
        vault.reply_name=vault.received.header.msgh_remote_port;
        vault.reply_state=MACH_PORT_VALID(vault.reply_name) &&
            vault.received.header.msgh_bits==MACH_MSGH_BITS(MACH_MSG_TYPE_PORT_SEND_ONCE,MACH_MSG_TYPE_PORT_SEND)
            ?HELD:UNKNOWN;
    }
    if(!active() || vault.receive_attempt!=SETTLED)return 0;
    mach_msg_header_t h=vault.received.header;
    unsigned bits=controller?MACH_MSGH_BITS(MACH_MSG_TYPE_PORT_SEND_ONCE,MACH_MSG_TYPE_PORT_SEND)
        :MACH_MSGH_BITS(0,MACH_MSG_TYPE_PORT_SEND_ONCE);
    size_t padded=round_msg(length),size=PREFIX+padded;
    if(h.msgh_bits!=bits || h.msgh_local_port!=vault.receive_name || h.msgh_voucher_port!=MACH_PORT_NULL ||
        h.msgh_id!=(controller?REQUEST_ID:REPLY_ID) || h.msgh_size!=size ||
        (controller?vault.reply_state!=HELD:h.msgh_remote_port!=MACH_PORT_NULL))return 0;
    uint32_t received_length=0;memcpy(&received_length,vault.received.raw+sizeof h,sizeof received_length);
    if(received_length!=length || memcmp(vault.received.raw+PREFIX,vault.input,length))return 0;
    for(size_t i=length;i<padded;i++)if(vault.received.raw[PREFIX+i]!=0)return 0;
    size_t offset=round_msg(h.msgh_size);
    if(offset>sizeof vault.received || sizeof(mach_msg_audit_trailer_t)>sizeof vault.received-offset)return 0;
    mach_msg_audit_trailer_t trailer;memcpy(&trailer,vault.received.raw+offset,sizeof trailer);
    if(trailer.msgh_trailer_type!=MACH_MSG_TRAILER_FORMAT_0 || trailer.msgh_trailer_size!=sizeof trailer)return 0;
    *pid=audit_token_to_pid(trailer.msgh_audit);*euid=audit_token_to_euid(trailer.msgh_audit);
    *version=audit_token_to_pidversion(trailer.msgh_audit);
    return *pid>0 && *pid!=getpid() && *euid==geteuid() && *version>0 && active();
}

static napi_value observe(napi_env env,napi_callback_info info,int controller){
    if(active())return burn(env);
    size_t argc=2,length=0,offset=0;napi_value argv[2],backing;napi_typedarray_type type;
    void *data=NULL;bool typed=false,arraybuffer=false,detached=true;uint8_t local[LIMIT];
    if(napi_get_cb_info(env,info,&argc,argv,NULL,NULL)!=napi_ok || argc!=1 ||
        napi_is_typedarray(env,argv[0],&typed)!=napi_ok || !typed ||
        napi_get_typedarray_info(env,argv[0],&type,&length,&data,&backing,&offset)!=napi_ok ||
        type!=napi_uint8_array || !data || length<1 || length>LIMIT ||
        napi_is_arraybuffer(env,backing,&arraybuffer)!=napi_ok || !arraybuffer ||
        napi_is_detached_arraybuffer(env,backing,&detached)!=napi_ok || detached)return refuse(env);
    memcpy(local,data,length);
    unsigned expected=0;if(!atomic_compare_exchange_strong(&lifecycle,&expected,1u))return burn(env);
    memcpy(vault.input,local,length);

    mach_port_t name=MACH_PORT_NULL;kern_return_t k;
    if(!active())return burn(env);
    if(controller){
        vault.receive_state=PENDING;k=bootstrap_check_in(bootstrap_port,service,&name);
        vault.receive_name=name;vault.acquire_status=k;
        vault.receive_state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
        if(!active() || vault.receive_state!=HELD)return burn(env);
    }else{
        vault.send_state=PENDING;k=bootstrap_look_up(bootstrap_port,service,&name);
        vault.send_name=name;vault.acquire_status=k;
        vault.send_state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
        if(!active() || vault.send_state!=HELD)return burn(env);
        name=MACH_PORT_NULL;vault.receive_state=PENDING;
        k=mach_port_allocate(mach_task_self(),MACH_PORT_RIGHT_RECEIVE,&name);
        vault.receive_name=name;vault.allocate_status=k;
        vault.receive_state=k==KERN_SUCCESS && MACH_PORT_VALID(name)?HELD:UNKNOWN;
        if(!active() || vault.receive_state!=HELD)return burn(env);
        frame(0,length);if(!send_frame(0))return burn(env);
    }

    pid_t pid=0;uid_t euid=0;int version=0;
    if(!receive_frame(controller,length,&pid,&euid,&version))return burn(env);
    if(controller){frame(1,length);if(!send_frame(1))return burn(env);}

    if(!active())return burn(env);
    vault.receive_state=DISPOSING;k=mach_port_mod_refs(mach_task_self(),vault.receive_name,MACH_PORT_RIGHT_RECEIVE,-1);
    vault.receive_close_status=k;vault.receive_state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
    if(!active() || vault.receive_state!=SETTLED)return burn(env);
    if(!controller){
        vault.send_state=DISPOSING;k=mach_port_deallocate(mach_task_self(),vault.send_name);
        vault.send_close_status=k;vault.send_state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
        if(!active() || vault.send_state!=SETTLED)return burn(env);
    }

    napi_value result,values[4];
    if(napi_create_object(env,&result)!=napi_ok ||
        napi_create_buffer_copy(env,length,vault.received.raw+PREFIX,NULL,&values[0])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)euid,&values[1])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)pid,&values[2])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)version,&values[3])!=napi_ok)return burn(env);
    napi_property_descriptor fields[]={
        {.utf8name="bytes",.value=values[0],.attributes=napi_enumerable},
        {.utf8name="euid",.value=values[1],.attributes=napi_enumerable},
        {.utf8name="pid",.value=values[2],.attributes=napi_enumerable},
        {.utf8name="pidversion",.value=values[3],.attributes=napi_enumerable},
    };
    if(napi_define_properties(env,result,4,fields)!=napi_ok || napi_object_freeze(env,result)!=napi_ok)return burn(env);
    expected=1u;if(!atomic_compare_exchange_strong(&lifecycle,&expected,2u))return burn(env);
    return result;
}

static napi_value controller(napi_env env,napi_callback_info info){return observe(env,info,1);}
static napi_value client(napi_env env,napi_callback_info info){return observe(env,info,0);}
NAPI_MODULE_INIT(){
    napi_property_descriptor methods[]={
        {.utf8name="observeControllerMachPeerV2",.method=controller,.attributes=napi_enumerable},
        {.utf8name="observeClientMachPeerV2",.method=client,.attributes=napi_enumerable},
    };
    if(napi_define_properties(env,exports,2,methods)!=napi_ok || napi_object_freeze(env,exports)!=napi_ok)return refuse(env);
    return exports;
}
