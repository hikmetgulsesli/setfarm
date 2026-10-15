/*
 * UNCOMPILED OUTSIDE ordinary new-component candidate.
 * Sole target input is the inherited private FD3 from the reviewed Perl owner.
 * No public PID/path/env option, target fork/reap/signal, VM read, or admission.
 * Build must force-include the separately pinned observer-abi-guard.h.
 */
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <libproc.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <sys/proc_info.h>
#include <mach/mach.h>
#include <mach/task_info.h>

#ifndef T6A_ORDINARY_OBSERVER_ABI_GUARD_V1
#error "reviewed ABI guard must be force-included by the fixed build recorder"
#endif

#define NS UINT64_C(1000000000)
#define ADDRESS_LIMIT (UINT64_C(1)<<48)
#define FRAME_LIMIT 8322U
#define NORMAL_FRAME_LIMIT 8258U
#define CLEAN_FRAME_LIMIT 64U
#define OUTPUT_LIMIT 2097152U
#define RAW_LIMIT 1048576U
#define OS_LIMIT 131072U
#define IO_LIMIT 32768U
#define CLEAN_IO_RESERVE 4096U
#define READ_LIMIT 16384U
#define CLEAN_OS_LIMIT 4096U
#define PHYSICAL_RESERVE 8U
#define TARGET_LIMIT 8207U
#define REGION_LIMIT 8194U
#define ROW_LIMIT 4096U

enum { ACK=1, REGION=2, SAMPLE_END=3, FAILURE=4, CLOSED=5, NATIVE=6 };
enum { ARGUMENT=1, WIRE=2, OWNERSHIP=3, NATIVE_RESULT=4, PACKET=5,
       NONPROGRESS=6, QUOTA=7, DEADLINE=8, IO=9, EARLY_EXIT=10,
       CLEANUP_UNKNOWN=11, POLICY_UNSUPPORTED=12 };
enum { PARENT_API=1, BSD_API=2, NAME_API=3, TYPE_API=4, PID_API=5,
       AUDIT_API=6, DEALLOC_API=7, CLOSE_API=8 };
struct packet { unsigned char bytes[304]; uint32_t size, seq, type, api; };
struct cause { uint32_t seq, api, type; };
struct observer {
    uint32_t phase, sequence, frames, normal_frames, cleanup_frames;
    uint32_t output_reserved, raw_reserved, target_calls, region_calls;
    uint32_t os_calls, io_calls, read_calls, cleanup_calls, physical_calls;
    uint32_t input_bytes, native_records, primary_sent, failures;
    uint64_t start, normal_deadline, stage_deadline, report_deadline;
    pid_t parent, node;
    unsigned char binding[32];
    struct proc_bsdinfo original_bsd;
    audit_token_t original_audit;
    struct cause last[4];
    mach_port_t name;
    int name_known, name_attempted, name_closed, name_close_failed;
    int fd3_attempted, fd3_closed, output_failed, clock_failed;
    int reporting, cleaning, failure, stop_received, bind_complete;
};
static struct observer g;

static void put32(unsigned char *p,uint32_t x) {
    p[0]=(unsigned char)x;p[1]=(unsigned char)(x>>8);
    p[2]=(unsigned char)(x>>16);p[3]=(unsigned char)(x>>24);
}
static void put64(unsigned char *p,uint64_t x) {
    put32(p,(uint32_t)x);put32(p+4,(uint32_t)(x>>32));
}
static uint32_t get32(const unsigned char *p) {
    return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);
}
static uint64_t get64(const unsigned char *p) {
    return (uint64_t)get32(p)|((uint64_t)get32(p+4)<<32);
}
static uint64_t minimum(uint64_t a,uint64_t b) { return a<b?a:b; }
static int refuse(int reason) { if(!g.failure)g.failure=reason;return 0; }
static int os_charge(int physical) {
    if(physical) {
        /* These slots were reserved before any positive work. Never skip a
         * different known close because a prior close/publication failed. */
        if(g.physical_calls>=PHYSICAL_RESERVE)return refuse(QUOTA);
        ++g.physical_calls;return 1;
    }
    if(g.cleaning||g.reporting) {
        if(g.cleanup_calls>=CLEAN_OS_LIMIT-PHYSICAL_RESERVE)return refuse(QUOTA);
        ++g.cleanup_calls;return 1;
    }
    if(g.os_calls>=OS_LIMIT)return refuse(QUOTA);
    ++g.os_calls;return 1;
}
static int io_charge(int is_read) {
    uint32_t limit=(g.cleaning||g.reporting)?IO_LIMIT:IO_LIMIT-CLEAN_IO_RESERVE;
    if(g.io_calls>=limit||(is_read&&g.read_calls>=READ_LIMIT))return refuse(QUOTA);
    ++g.io_calls;if(is_read)++g.read_calls;return os_charge(0);
}
static int clock_ns(uint64_t *out) {
    struct timespec ts={0,0};
    if(!os_charge(0))return 0;
    errno=0;int r=clock_gettime(CLOCK_MONOTONIC,&ts);int e=errno;
    (void)e;
    if(r!=0||ts.tv_sec<0||ts.tv_nsec<0||ts.tv_nsec>=1000000000L||
       (uint64_t)ts.tv_sec>(UINT64_MAX-NS)/NS) {
        g.clock_failed=1;return refuse(IO);
    }
    *out=(uint64_t)ts.tv_sec*NS+(uint64_t)ts.tv_nsec;return 1;
}
static int normal_time(void) {
    /* Sticky refusal precedes even another normal clock/API attempt. Native
     * original publication and independent physical cleanup bypass this gate. */
    if(g.failure||g.clock_failed||g.output_failed)return 0;
    uint64_t now;
    if(!clock_ns(&now))return 0;
    if(now>=g.normal_deadline||now>=g.stage_deadline)return refuse(DEADLINE);
    return 1;
}
static void reporting_from(uint64_t now) {
    if(!g.reporting) {g.reporting=1;g.report_deadline=now+NS;}
}
static int packet_begin(struct packet *p,uint32_t type,uint32_t length,
                        uint64_t address,uint32_t raw_bytes,int target) {
    uint32_t size=32U+length;
    int cleanup=g.cleaning||g.reporting;
    if(length>272U||g.frames>=FRAME_LIMIT||
       (!cleanup&&g.normal_frames>=NORMAL_FRAME_LIMIT)||
       (cleanup&&g.cleanup_frames>=CLEAN_FRAME_LIMIT)||
       size>OUTPUT_LIMIT-g.output_reserved||raw_bytes>RAW_LIMIT-g.raw_reserved||
       (target&&g.target_calls>=TARGET_LIMIT))return refuse(QUOTA);
    memset(p,0,sizeof(*p));
    p->size=size;p->seq=++g.sequence;p->type=type;
    ++g.frames;if(cleanup)++g.cleanup_frames;else ++g.normal_frames;
    g.output_reserved+=size;g.raw_reserved+=raw_bytes;if(target)++g.target_calls;
    memcpy(p->bytes,"T6ARP001",8);put32(p->bytes+8,type);put32(p->bytes+12,g.phase);
    put32(p->bytes+16,p->seq);put32(p->bytes+20,length);put64(p->bytes+24,address);
    return 1;
}
static int poll_owned(int fd,short wanted,uint64_t limit) {
    uint64_t now;struct pollfd p={fd,wanted,0};
    if(!clock_ns(&now))return 0;
    if(now>=limit)return refuse(DEADLINE);
    uint64_t remaining=limit-now;
    int timeout=(int)minimum((remaining+999999U)/1000000U,50U);
    if(!io_charge(0))return 0;
    errno=0;int r=poll(&p,1,timeout);int e=errno;
    if(r<0) {if(e==EINTR)return 1;return refuse(IO);}
    if(r>0&&(p.revents&POLLNVAL))return refuse(IO);
    return 1;
}
static int packet_publish(struct packet *p,int native_original) {
    uint32_t at=0;
    if(g.output_failed||g.clock_failed) {g.output_failed=1;return 0;}
    while(at<p->size) {
        uint64_t now;
        if(!clock_ns(&now)) {g.output_failed=1;return 0;}
        uint64_t limit=(g.reporting||g.cleaning)?g.report_deadline:
            minimum(g.normal_deadline,g.stage_deadline);
        if(now>=limit) {
            /* A completed native call's original is copied before this check.
             * Spend only the finite reporting reserve to retain that packet.
             * A late result can never restore normal success. */
            if(native_original&&!g.reporting&&!g.cleaning) {
                refuse(DEADLINE);reporting_from(now);limit=g.report_deadline;
            } else {g.output_failed=1;return refuse(DEADLINE);}
        }
        if(!io_charge(0)) {g.output_failed=1;return 0;}
        errno=0;ssize_t r=write(STDOUT_FILENO,p->bytes+at,p->size-at);int e=errno;
        if(r>0&&(uint64_t)r<=p->size-at) {at+=(uint32_t)r;continue;}
        if(r<0&&e==EINTR)continue;
        if(r<0&&(e==EAGAIN||e==EWOULDBLOCK)) {
            if(!poll_owned(STDOUT_FILENO,POLLOUT,limit)) {g.output_failed=1;return 0;}
            continue;
        }
        g.output_failed=1;return refuse(IO);
    }
    /* Keep a fully published original even if its final write or this clock
     * returns late. Latch lateness before the caller interprets success. */
    uint64_t completed;
    if(clock_ns(&completed)) {
        uint64_t limit=(g.reporting||g.cleaning)?g.report_deadline:
            minimum(g.normal_deadline,g.stage_deadline);
        if(completed>=limit) {
            refuse(DEADLINE);
            if(native_original&&!g.reporting&&!g.cleaning)reporting_from(completed);
        }
    }
    return 1;
}
static int native_begin(struct packet *p,uint32_t api,uint32_t raw_length,int target) {
    if(!normal_time()||!os_charge(0))return 0;
    if(!packet_begin(p,NATIVE,16U+raw_length,0,raw_length,target))return 0;
    p->api=api;return 1;
}
static int native_finish(struct packet *p,int result,int e,
                         const void *raw,uint32_t raw_length) {
    /* Called immediately after the native return/errno and any original
     * successful NAME enrollment. No predicate/clock precedes the raw copy. */
    put32(p->bytes+32,p->api);put32(p->bytes+36,(uint32_t)result);
    put32(p->bytes+40,(uint32_t)e);put32(p->bytes+44,raw_length);
    if(raw_length)memcpy(p->bytes+48,raw,raw_length);
    if(!packet_publish(p,1))return 0;
    ++g.native_records;g.last[g.phase]=(struct cause){p->seq,p->api,NATIVE};
    return !g.failure;
}
static int parent_query(void) {
    struct packet p;pid_t value;
    if(!native_begin(&p,PARENT_API,4,0))return 0;
    errno=0;value=getppid();int e=errno;
    if(!native_finish(&p,(int)value,e,&value,4))return 0;
    return value==g.parent?1:refuse(OWNERSHIP);
}
static int bsd_query(int initial) {
    struct packet p;struct proc_bsdinfo value;memset(&value,0,sizeof(value));
    if(!native_begin(&p,BSD_API,136,1))return 0;
    errno=0;int r=proc_pidinfo((int)g.node,PROC_PIDTBSDINFO,0,&value,sizeof(value));int e=errno;
    if(!native_finish(&p,r,e,&value,136))return 0;
    if(r!=136)return refuse(NATIVE_RESULT);
    if(value.pbi_pid!=(uint32_t)g.node||value.pbi_ppid!=(uint32_t)g.parent||
       value.pbi_uid!=70U||value.pbi_ruid!=70U||value.pbi_gid!=70U||value.pbi_rgid!=70U||
       value.pbi_start_tvsec==0||value.pbi_start_tvusec>=1000000U)return refuse(OWNERSHIP);
    if(initial)g.original_bsd=value;
    else if(value.pbi_start_tvsec!=g.original_bsd.pbi_start_tvsec||
            value.pbi_start_tvusec!=g.original_bsd.pbi_start_tvusec)return refuse(OWNERSHIP);
    return 1;
}
static int name_query(void) {
    struct packet p;mach_port_t value=MACH_PORT_NULL;
    if(!native_begin(&p,NAME_API,4,1))return 0;
    errno=0;kern_return_t r=task_name_for_pid(mach_task_self(),g.node,&value);int e=errno;
    /* The single eligible actual successful output is owned before publication
     * or another potentially fallible observation. Failed nonnull output is
     * retained below as unknown; it is never guessed deallocated/adopted. */
    if(r==KERN_SUCCESS&&value!=MACH_PORT_NULL) {g.name=value;g.name_known=1;}
    if(!native_finish(&p,r,e,&value,4))return 0;
    return r==KERN_SUCCESS&&g.name_known?1:refuse(NATIVE_RESULT);
}
static int type_query(void) {
    struct packet p;mach_port_type_t value=0;
    if(!native_begin(&p,TYPE_API,4,1))return 0;
    errno=0;kern_return_t r=mach_port_type(mach_task_self(),g.name,&value);int e=errno;
    if(!native_finish(&p,r,e,&value,4))return 0;
    if(r!=KERN_SUCCESS)return refuse(NATIVE_RESULT);
    return (value&MACH_PORT_TYPE_SEND)&&!(value&MACH_PORT_TYPE_DEAD_NAME)?1:refuse(OWNERSHIP);
}
static int pid_query(void) {
    struct packet p;int value=0;
    if(!native_begin(&p,PID_API,4,1))return 0;
    errno=0;kern_return_t r=pid_for_task(g.name,&value);int e=errno;
    if(!native_finish(&p,r,e,&value,4))return 0;
    if(r!=KERN_SUCCESS)return refuse(NATIVE_RESULT);
    return value==(int)g.node?1:refuse(OWNERSHIP);
}
static int audit_query(int initial) {
    struct packet p;audit_token_t value;memset(&value,0,sizeof(value));
    mach_msg_type_number_t count=TASK_AUDIT_TOKEN_COUNT;unsigned char raw[36];
    if(!native_begin(&p,AUDIT_API,36,1))return 0;
    errno=0;kern_return_t r=task_info(g.name,TASK_AUDIT_TOKEN,(task_info_t)&value,&count);int e=errno;
    put32(raw,count);memcpy(raw+4,&value,32);
    if(!native_finish(&p,r,e,raw,36))return 0;
    if(r!=KERN_SUCCESS||count!=8U)return refuse(NATIVE_RESULT);
    uint32_t token[8];memcpy(token,&value,sizeof(token));
    if(token[1]!=70U||token[2]!=70U||token[3]!=70U||token[4]!=70U||
       token[5]!=(uint32_t)g.node)return refuse(OWNERSHIP);
    if(initial)g.original_audit=value;
    else if(memcmp(&value,&g.original_audit,sizeof(value))!=0)return refuse(OWNERSHIP);
    return 1;
}
static int control(uint32_t kind,const void *payload,uint32_t length) {
    struct packet p;if(!normal_time()||!packet_begin(&p,kind,length,0,0,0))return 0;
    if(length)memcpy(p.bytes+32,payload,length);
    return packet_publish(&p,0)&&!g.failure&&!g.clock_failed&&!g.output_failed&&normal_time();
}
static int bind_target(void) {
    if(!parent_query()||!bsd_query(1)||!name_query()||!type_query()||
       !pid_query()||!audit_query(1))return 0;
    if(!control(ACK,NULL,0))return 0;
    g.bind_complete=1;return 1;
}
static int sample(void) {
    uint32_t rows=0,attempts=0;uint64_t cursor=0;int terminal_return=0,terminal_errno=0,ended=0;
    if(!parent_query()||!bsd_query(0)||!audit_query(0))return 0;
    for(attempts=1;attempts<=ROW_LIMIT+1U;++attempts) {
        struct packet p;struct proc_regioninfo value;memset(&value,0,sizeof(value));
        if(!normal_time()||!os_charge(0))return 0;
        if(g.region_calls>=REGION_LIMIT)return refuse(QUOTA);
        if(!packet_begin(&p,REGION,104,cursor,96,1))return 0;
        ++g.region_calls;
        errno=0;int r=proc_pidinfo((int)g.node,PROC_PIDREGIONINFO,cursor,&value,sizeof(value));int e=errno;
        put32(p.bytes+32,(uint32_t)r);put32(p.bytes+36,(uint32_t)e);memcpy(p.bytes+40,&value,96);
        if(!packet_publish(&p,1))return 0;
        ++g.native_records;g.last[g.phase]=(struct cause){p.seq,0,REGION};
        if(g.failure)return 0;
        if(r==96) {
            if(rows>=ROW_LIMIT)return refuse(QUOTA);
            if(value.pri_size==0||value.pri_address<cursor||value.pri_address>ADDRESS_LIMIT||
               value.pri_size>ADDRESS_LIMIT||value.pri_address>ADDRESS_LIMIT-value.pri_size)
                return refuse(PACKET);
            uint64_t next=value.pri_address+value.pri_size;
            if(next<=cursor)return refuse(NONPROGRESS);
            ++rows;cursor=next;continue;
        }
        terminal_return=r;terminal_errno=e;
        if(r==0&&e==EINVAL&&rows>0) {ended=1;break;}
        /* First0/EINVAL, errors and short returns retain the actual full96
         * buffer. Only the independent harness can classify capability RED. */
        return refuse(NATIVE_RESULT);
    }
    if(!ended)return refuse(QUOTA);
    if(!audit_query(0)||!bsd_query(0)||!parent_query())return 0;
    unsigned char end[16];put32(end,rows);put32(end+4,attempts);
    put32(end+8,(uint32_t)terminal_return);put32(end+12,(uint32_t)terminal_errno);
    return control(SAMPLE_END,end,16);
}
static int read_bytes(unsigned char *bytes,uint32_t length,uint64_t limit,int require_eof) {
    uint32_t at=0;
    while(at<length) {
        uint64_t now;if(!clock_ns(&now))return 0;
        if(now>=limit)return refuse(DEADLINE);
        if(!io_charge(1))return 0;
        errno=0;ssize_t r=read(3,bytes+at,length-at);int e=errno;
        if(r>0&&(uint64_t)r<=length-at) {
            g.input_bytes+=(uint32_t)r;
            if(g.input_bytes>192U)return refuse(WIRE);
            if(require_eof)return refuse(WIRE);
            at+=(uint32_t)r;continue;
        }
        if(r==0)return require_eof?1:refuse(IO);
        if(r<0&&e==EINTR)continue;
        if(r<0&&(e==EAGAIN||e==EWOULDBLOCK)) {
            if(!poll_owned(3,POLLIN,limit))return 0;
            continue;
        }
        return refuse(IO);
    }
    return require_eof?refuse(WIRE):1;
}
static int command(uint32_t opcode) {
    unsigned char bytes[48];uint64_t now;
    g.phase=opcode-1U;
    if(!clock_ns(&now))return 0;
    g.stage_deadline=g.normal_deadline;
    uint64_t read_limit=opcode==1U?minimum(g.normal_deadline,now+5U*NS):g.normal_deadline;
    if(!read_bytes(bytes,48,read_limit,0))return 0;
    if(memcmp(bytes,"T6ARQ001",8)!=0||get32(bytes+8)!=1U||
       get32(bytes+12)!=opcode||get64(bytes+24)!=1U||get64(bytes+40)!=0U)return refuse(WIRE);
    if(opcode==1U) {
        uint32_t parent=get32(bytes+16),node=get32(bytes+20);uint64_t deadline=get64(bytes+32);
        if(parent<=1U||node<=1U||parent>INT_MAX||node>INT_MAX||parent==node)return refuse(OWNERSHIP);
        if(!clock_ns(&now))return 0;
        if(deadline<=now||deadline>g.start+15U*NS)return refuse(DEADLINE);
        g.parent=(pid_t)parent;g.node=(pid_t)node;memcpy(g.binding,bytes+16,32);
        g.normal_deadline=deadline;
    } else if(memcmp(g.binding,bytes+16,32)!=0)return refuse(WIRE);
    if(!clock_ns(&now))return 0;
    g.stage_deadline=minimum(g.normal_deadline,now+(opcode==4U?NS:3U*NS));
    return normal_time();
}
static int emit_failure(uint32_t stage,uint32_t reason,struct cause cause) {
    struct packet p;unsigned char payload[16];
    if(g.failures>=3U||g.output_failed||g.clock_failed)return 0;
    /* No forged reference: an absent current-phase native cause is reportable
     * with zero only before ANY original native/REGION packet exists. */
    if(cause.seq==0&&g.native_records)return 0;
    put32(payload,stage);put32(payload+4,reason);put32(payload+8,cause.api);put32(payload+12,cause.seq);
    if(!packet_begin(&p,FAILURE,16,0,0,0))return 0;
    memcpy(p.bytes+32,payload,16);
    if(!packet_publish(&p,0))return 0;
    ++g.failures;return 1;
}
static void primary_failure(void) {
    uint64_t now;
    if(!g.failure||!clock_ns(&now))return;
    reporting_from(now);
    g.primary_sent=(uint32_t)emit_failure(g.phase+1U,(uint32_t)g.failure,g.last[g.phase]);
}
static int cleanup_native(uint32_t api,int r,int e,const void *raw,uint32_t length,
                          struct cause *saved) {
    struct packet p;
    if(!packet_begin(&p,NATIVE,16U+length,0,length,0))return 0;
    p.api=api;
    put32(p.bytes+32,api);put32(p.bytes+36,(uint32_t)r);put32(p.bytes+40,(uint32_t)e);put32(p.bytes+44,length);
    if(length)memcpy(p.bytes+48,raw,length);
    if(!packet_publish(&p,1))return 0;
    ++g.native_records;*saved=(struct cause){p.seq,api,NATIVE};g.last[3]=*saved;return 1;
}
static void physical_cleanup(void) {
    uint64_t now=0;struct cause c={0,0,0};int can_report=g.stop_received||g.primary_sent;
    g.cleaning=1;g.phase=3;
    if(clock_ns(&now)) {g.report_deadline=now+NS;g.reporting=1;}
    else can_report=0;
    if(g.name_known&&!g.name_attempted) {
        g.name_attempted=1;
        int charged=os_charge(1);kern_return_t r=KERN_FAILURE;int e=0;
        if(charged) {errno=0;r=mach_port_deallocate(mach_task_self(),g.name);e=errno;}
        g.name_closed=charged&&r==KERN_SUCCESS;g.name_close_failed=!g.name_closed;
        if(charged&&can_report&&cleanup_native(DEALLOC_API,r,e,NULL,0,&c)&&!g.name_closed)
            (void)emit_failure(5,NATIVE_RESULT,c);
    }
    if(!g.fd3_attempted) {
        /* Intent is latched before either fallible close or independent check. */
        g.fd3_attempted=1;int r=-1,e=0,live=0,live_errno=0,close_called=0;
        if(os_charge(1)) {close_called=1;errno=0;r=close(3);e=errno;}
        if(os_charge(1)) {errno=0;live=fcntl(3,F_GETFD);live_errno=errno;}
        g.fd3_closed=r==0&&live==-1&&live_errno==EBADF;
        int fd=3;
        if(close_called&&can_report&&cleanup_native(CLOSE_API,r,e,&fd,4,&c)&&!g.fd3_closed)
            (void)emit_failure(5,CLEANUP_UNKNOWN,c);
    }
    if(can_report) {
        unsigned char payload[16];struct packet p;
        int bad=g.name_close_failed||!g.fd3_closed||!g.name_known;
        uint32_t flags=(g.name_closed?1U:0U)|(g.fd3_closed?2U:0U)|4U|(bad?8U:0U);
        put32(payload,g.name_known?1U:0U);put32(payload+4,g.name_attempted?1U:0U);
        put32(payload+8,g.name_close_failed?1U:0U);put32(payload+12,flags);
        if(packet_begin(&p,CLOSED,16,0,0,0)) {memcpy(p.bytes+32,payload,16);(void)packet_publish(&p,0);}
    }
}
static int reporting_close(int fd) {
    int r=-1,live=0,e=0;
    if(os_charge(1)) {errno=0;r=close(fd);}
    if(os_charge(1)) {errno=0;live=fcntl(fd,F_GETFD);e=errno;}
    return r==0&&live==-1&&e==EBADF;
}
static int initialize(void) {
    /* Exact inherited FD3/stdout/stderr are known from the fixed Perl dup2
     * composition, not discovered through an external descriptor census. */
    if(!clock_ns(&g.start))return 0;
    g.normal_deadline=g.start+15U*NS;g.stage_deadline=g.normal_deadline;
    if(!os_charge(0))return 0;
    errno=0;
    if(signal(SIGPIPE,SIG_IGN)==SIG_ERR)return refuse(IO);
    if(!os_charge(0))return 0;
    uid_t uid=getuid();
    if(!os_charge(0))return 0;
    uid_t euid=geteuid();
    if(!os_charge(0))return 0;
    gid_t gid=getgid();
    if(!os_charge(0))return 0;
    gid_t egid=getegid();
    if(uid!=0U||euid!=0U||gid!=0U||egid!=0U)return refuse(OWNERSHIP);
    for(int index=0;index<2;++index) {
        int fd=index==0?3:STDOUT_FILENO;
        if(!os_charge(0))return 0;
        errno=0;int flags=fcntl(fd,F_GETFL);
        if(flags<0)return refuse(IO);
        if(!os_charge(0))return 0;
        errno=0;
        if(fcntl(fd,F_SETFL,flags|O_NONBLOCK)!=0)return refuse(IO);
    }
    return 1;
}
int main(int argc,char **argv) {
    (void)argv;int healthy=0;
    if(argc!=1)refuse(ARGUMENT);
    else if(initialize()&&command(1)&&bind_target()&&command(2)&&sample()&&
            command(3)&&sample()&&command(4)) {
        /* STOP is only the fixed owner command after its actual Node wait0.
         * C neither polls a caller PID nor pretends it can reap its sibling. */
        g.stop_received=1;
        unsigned char trailing=0;
        if(read_bytes(&trailing,1,g.stage_deadline,1)&&normal_time())healthy=1;
    }
    if(!healthy)primary_failure();
    physical_cleanup();
    uint64_t after_cleanup=0;
    int on_time=clock_ns(&after_cleanup)&&after_cleanup<g.normal_deadline&&
        after_cleanup<g.stage_deadline;
    int qualified=healthy&&on_time&&!g.failure&&!g.output_failed&&!g.clock_failed&&
        g.name_known&&g.name_closed&&g.fd3_closed&&g.physical_calls<=PHYSICAL_RESERVE;
    /* CLOSED is pre-output-close DATA. These actual final closes have separate
     * parent EOF/terminal evidence; their return is not fabricated in CLOSED. */
    int stdout_closed=reporting_close(STDOUT_FILENO);
    int stderr_closed=reporting_close(STDERR_FILENO);
    uint64_t after_closes=0;
    int final_time=clock_ns(&after_closes)&&after_closes<g.normal_deadline&&
        after_closes<g.stage_deadline;
    return qualified&&final_time&&stdout_closed&&stderr_closed?0:2;
}
