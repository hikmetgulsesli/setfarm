/* Uncompiled ordinary observer ABI candidate; no runtime admission. */
#ifndef T6A_ORDINARY_OBSERVER_ABI_GUARD_V1
#define T6A_ORDINARY_OBSERVER_ABI_GUARD_V1
#include <stddef.h>
#include <stdint.h>
#include <libproc.h>
#include <sys/proc_info.h>
#include <mach/mach.h>
#include <mach/task_info.h>
#if !defined(__APPLE__) || !defined(__MACH__)
#error "fixed Darwin observer ABI required"
#endif
#if !defined(__aarch64__) && !defined(__arm64__)
#error "fixed arm64 observer ABI required"
#endif
#if !defined(__LP64__) || !defined(__BYTE_ORDER__) || !defined(__ORDER_LITTLE_ENDIAN__) || __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error "fixed LP64 little-endian observer ABI required"
#endif
_Static_assert(sizeof(int)==4, "retained ABI contract 01");
_Static_assert(sizeof(long)==8, "retained ABI contract 02");
_Static_assert(sizeof(void*)==8, "retained ABI contract 03");
_Static_assert(sizeof(size_t)==8, "retained ABI contract 04");
_Static_assert(sizeof(pid_t)==4, "retained ABI contract 05");
_Static_assert(sizeof(uid_t)==4, "retained ABI contract 06");
_Static_assert(sizeof(gid_t)==4, "retained ABI contract 07");
_Static_assert(sizeof(uint64_t)==8, "retained ABI contract 08");
_Static_assert(sizeof(struct proc_regioninfo)==96, "retained ABI contract 09");
_Static_assert(sizeof(struct proc_bsdinfo)==136, "retained ABI contract 10");
_Static_assert(sizeof(audit_token_t)==32, "retained ABI contract 11");
_Static_assert(TASK_AUDIT_TOKEN_COUNT==8, "retained ABI contract 12");
_Static_assert(sizeof(mach_msg_type_number_t)==4, "retained ABI contract 13");
_Static_assert(sizeof(mach_port_t)==4, "retained ABI contract 14");
_Static_assert(sizeof(kern_return_t)==4, "retained ABI contract 15");
_Static_assert(PROC_PIDREGIONINFO==7, "retained ABI contract 16");
_Static_assert(PROC_PIDTBSDINFO==3, "retained ABI contract 17");
_Static_assert(offsetof(struct proc_regioninfo,pri_protection)==0, "retained ABI contract 18");
_Static_assert(offsetof(struct proc_regioninfo,pri_max_protection)==4, "retained ABI contract 19");
_Static_assert(offsetof(struct proc_regioninfo,pri_inheritance)==8, "retained ABI contract 20");
_Static_assert(offsetof(struct proc_regioninfo,pri_flags)==12, "retained ABI contract 21");
_Static_assert(offsetof(struct proc_regioninfo,pri_offset)==16, "retained ABI contract 22");
_Static_assert(offsetof(struct proc_regioninfo,pri_behavior)==24, "retained ABI contract 23");
_Static_assert(offsetof(struct proc_regioninfo,pri_user_wired_count)==28, "retained ABI contract 24");
_Static_assert(offsetof(struct proc_regioninfo,pri_user_tag)==32, "retained ABI contract 25");
_Static_assert(offsetof(struct proc_regioninfo,pri_pages_resident)==36, "retained ABI contract 26");
_Static_assert(offsetof(struct proc_regioninfo,pri_pages_shared_now_private)==40, "retained ABI contract 27");
_Static_assert(offsetof(struct proc_regioninfo,pri_pages_swapped_out)==44, "retained ABI contract 28");
_Static_assert(offsetof(struct proc_regioninfo,pri_pages_dirtied)==48, "retained ABI contract 29");
_Static_assert(offsetof(struct proc_regioninfo,pri_ref_count)==52, "retained ABI contract 30");
_Static_assert(offsetof(struct proc_regioninfo,pri_shadow_depth)==56, "retained ABI contract 31");
_Static_assert(offsetof(struct proc_regioninfo,pri_share_mode)==60, "retained ABI contract 32");
_Static_assert(offsetof(struct proc_regioninfo,pri_private_pages_resident)==64, "retained ABI contract 33");
_Static_assert(offsetof(struct proc_regioninfo,pri_shared_pages_resident)==68, "retained ABI contract 34");
_Static_assert(offsetof(struct proc_regioninfo,pri_obj_id)==72, "retained ABI contract 35");
_Static_assert(offsetof(struct proc_regioninfo,pri_depth)==76, "retained ABI contract 36");
_Static_assert(offsetof(struct proc_regioninfo,pri_address)==80, "retained ABI contract 37");
_Static_assert(offsetof(struct proc_regioninfo,pri_size)==88, "retained ABI contract 38");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_pid)==12, "retained ABI contract 39");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_ppid)==16, "retained ABI contract 40");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_uid)==20, "retained ABI contract 41");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_gid)==24, "retained ABI contract 42");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_ruid)==28, "retained ABI contract 43");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_rgid)==32, "retained ABI contract 44");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_start_tvsec)==120, "retained ABI contract 45");
_Static_assert(offsetof(struct proc_bsdinfo,pbi_start_tvusec)==128, "retained ABI contract 46");
_Static_assert(TASK_AUDIT_TOKEN==15, "SDK audit flavor is15, wire API remains6");
_Static_assert(MACH_PORT_TYPE_SEND==0x10000, "fixed send-right bit");
_Static_assert(MACH_PORT_TYPE_DEAD_NAME==0x100000, "fixed dead-name bit");
#endif
