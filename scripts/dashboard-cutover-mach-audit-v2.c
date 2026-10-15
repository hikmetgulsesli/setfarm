/* Closed local mechanics only. No endpoint, owner or startup authority. */
#include <node_api.h>
#include <mach/mach.h>
#include <bsm/libbsm.h>
#include <stdint.h>
#include <stdatomic.h>
#include <string.h>
#include <unistd.h>

enum { LIMIT=1024, MESSAGE_ID=0x53463232, PREFIX=sizeof(mach_msg_header_t)+sizeof(uint32_t) };
enum { NONE, PENDING, HELD, DISPOSING, SETTLED, UNKNOWN };
/* 0 idle, 1 active, 2 completed, 3 permanently burned. */
static _Atomic unsigned lifecycle=0;
static struct {
    volatile mach_port_name_t name;
    volatile unsigned receive_state,send_state,send_attempt,receive_attempt;
    volatile kern_return_t allocate_status,insert_status,send_status,receive_status;
    volatile kern_return_t send_close_status,receive_close_status;
    uint8_t input[LIMIT];
    union {
        mach_msg_header_t header;
        uint8_t raw[PREFIX+LIMIT+sizeof(mach_msg_audit_trailer_t)];
    } sent,received;
} vault;

static int active(void) { return atomic_load(&lifecycle)==1u; }

static napi_value refuse(napi_env env) {
    bool pending=false;
    if (napi_is_exception_pending(env,&pending)==napi_ok && pending) {
        napi_value ignored;
        (void)napi_get_and_clear_last_exception(env,&ignored);
    }
    (void)napi_throw_error(env,NULL,"DASHBOARD_CUTOVER_LOCAL_MACH_AUDIT_REFUSED");
    return NULL;
}

static napi_value burn(napi_env env) {
    atomic_store(&lifecycle,3u);
    return refuse(env);
}

static napi_value observe(napi_env env,napi_callback_info info) {
    if (active()) return burn(env); /* Before even inspecting caller arguments. */
    size_t argc=2,length=0,offset=0;
    napi_value argv[2],backing;
    napi_typedarray_type type;
    void *data=NULL;
    bool typed=false,arraybuffer=false,detached=true;
    uint8_t local[LIMIT];
    if (napi_get_cb_info(env,info,&argc,argv,NULL,NULL)!=napi_ok || argc!=1 ||
        napi_is_typedarray(env,argv[0],&typed)!=napi_ok || !typed ||
        napi_get_typedarray_info(env,argv[0],&type,&length,&data,&backing,&offset)!=napi_ok ||
        type!=napi_uint8_array || !data || length<1 || length>LIMIT ||
        napi_is_arraybuffer(env,backing,&arraybuffer)!=napi_ok || !arraybuffer ||
        napi_is_detached_arraybuffer(env,backing,&detached)!=napi_ok || detached)
        return refuse(env);
    memcpy(local,data,length);
    unsigned expected=0;
    if (!atomic_compare_exchange_strong(&lifecycle,&expected,1u)) return burn(env);
    memcpy(vault.input,local,length); /* Only the winning owner writes the vault. */

    mach_port_name_t name=MACH_PORT_NULL;
    if (!active()) return burn(env);
    vault.receive_state=PENDING;
    kern_return_t k=mach_port_allocate(mach_task_self(),MACH_PORT_RIGHT_RECEIVE,&name);
    vault.name=name; vault.allocate_status=k;
    vault.receive_state=k==KERN_SUCCESS && name!=MACH_PORT_NULL?HELD:UNKNOWN;
    if (!active() || vault.receive_state!=HELD) return burn(env);
    vault.send_state=PENDING;
    k=mach_port_insert_right(mach_task_self(),name,name,MACH_MSG_TYPE_MAKE_SEND);
    vault.insert_status=k; vault.send_state=k==KERN_SUCCESS?HELD:UNKNOWN;
    if (!active() || vault.send_state!=HELD) return burn(env);

    size_t padded=round_msg(length),size=PREFIX+padded;
    memset(&vault.sent,0,sizeof vault.sent);
    vault.sent.header.msgh_bits=MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND,0);
    vault.sent.header.msgh_size=(mach_msg_size_t)size;
    vault.sent.header.msgh_remote_port=name;
    vault.sent.header.msgh_id=MESSAGE_ID;
    uint32_t n=(uint32_t)length;
    memcpy(vault.sent.raw+sizeof(mach_msg_header_t),&n,sizeof n);
    memcpy(vault.sent.raw+PREFIX,vault.input,length);
    if (!active()) return burn(env); /* Admission follows frame construction. */
    vault.send_attempt=PENDING;
    k=mach_msg(&vault.sent.header,MACH_SEND_MSG|MACH_SEND_TIMEOUT|MACH_SEND_INTERRUPT,
        (mach_msg_size_t)size,0,MACH_PORT_NULL,1000,MACH_PORT_NULL);
    vault.send_status=k; vault.send_attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if (!active() || vault.send_attempt!=SETTLED) return burn(env);

    memset(&vault.received,0,sizeof vault.received);
    if (!active()) return burn(env);
    vault.receive_attempt=PENDING;
    k=mach_msg(&vault.received.header,MACH_RCV_MSG|MACH_RCV_TIMEOUT|MACH_RCV_INTERRUPT|
        MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0)|MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT),
        0,sizeof vault.received,name,1000,MACH_PORT_NULL);
    vault.receive_status=k; vault.receive_attempt=k==MACH_MSG_SUCCESS?SETTLED:UNKNOWN;
    if (!active() || vault.receive_attempt!=SETTLED) return burn(env);
    mach_msg_header_t h=vault.received.header;
    if (h.msgh_bits!=MACH_MSGH_BITS(0,MACH_MSG_TYPE_PORT_SEND) ||
        h.msgh_local_port!=name || h.msgh_remote_port!=MACH_PORT_NULL ||
        h.msgh_voucher_port!=MACH_PORT_NULL || h.msgh_id!=MESSAGE_ID || h.msgh_size!=size)
        return burn(env);
    uint32_t received_length=0;
    memcpy(&received_length,vault.received.raw+sizeof h,sizeof received_length);
    if (received_length!=length || memcmp(vault.received.raw+PREFIX,vault.input,length)) return burn(env);
    for (size_t i=length;i<padded;i++) if (vault.received.raw[PREFIX+i]!=0) return burn(env);
    size_t trailer_offset=round_msg(h.msgh_size);
    if (trailer_offset>sizeof vault.received || sizeof(mach_msg_audit_trailer_t)>sizeof vault.received-trailer_offset)
        return burn(env);
    mach_msg_audit_trailer_t trailer;
    memcpy(&trailer,vault.received.raw+trailer_offset,sizeof trailer);
    if (trailer.msgh_trailer_type!=MACH_MSG_TRAILER_FORMAT_0 || trailer.msgh_trailer_size!=sizeof trailer)
        return burn(env);
    pid_t pid=audit_token_to_pid(trailer.msgh_audit);
    uid_t euid=audit_token_to_euid(trailer.msgh_audit);
    int version=audit_token_to_pidversion(trailer.msgh_audit);
    if (pid!=getpid() || euid!=geteuid() || version<=0 || !active()) return burn(env);

    vault.send_state=DISPOSING;
    k=mach_port_deallocate(mach_task_self(),name);
    vault.send_close_status=k; vault.send_state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
    if (!active() || vault.send_state!=SETTLED) return burn(env);
    vault.receive_state=DISPOSING;
    k=mach_port_mod_refs(mach_task_self(),name,MACH_PORT_RIGHT_RECEIVE,-1);
    vault.receive_close_status=k; vault.receive_state=k==KERN_SUCCESS?SETTLED:UNKNOWN;
    if (!active() || vault.receive_state!=SETTLED) return burn(env);

    napi_value result,values[4];
    if (napi_create_object(env,&result)!=napi_ok ||
        napi_create_buffer_copy(env,length,vault.received.raw+PREFIX,NULL,&values[0])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)euid,&values[1])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)pid,&values[2])!=napi_ok ||
        napi_create_uint32(env,(uint32_t)version,&values[3])!=napi_ok) return burn(env);
    napi_property_descriptor fields[] = {
        {.utf8name="bytes",.value=values[0],.attributes=napi_enumerable},
        {.utf8name="euid",.value=values[1],.attributes=napi_enumerable},
        {.utf8name="pid",.value=values[2],.attributes=napi_enumerable},
        {.utf8name="pidversion",.value=values[3],.attributes=napi_enumerable},
    };
    if (napi_define_properties(env,result,4,fields)!=napi_ok ||
        napi_object_freeze(env,result)!=napi_ok) return burn(env);
    expected=1u;
    if (!atomic_compare_exchange_strong(&lifecycle,&expected,2u)) return burn(env);
    return result;
}

NAPI_MODULE_INIT() {
    napi_property_descriptor method={.utf8name="observeLocalMachAuditV2",.method=observe,.attributes=napi_enumerable};
    if (napi_define_properties(env,exports,1,&method)!=napi_ok ||
        napi_object_freeze(env,exports)!=napi_ok) return refuse(env);
    return exports;
}
