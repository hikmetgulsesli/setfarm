#ifndef SF_ORIGIN_BOOTSTRAP_PREFIX_POLICY_V2_H
#define SF_ORIGIN_BOOTSTRAP_PREFIX_POLICY_V2_H
#include "task6a-origin-native-remap-policy-v2.h"
/* Private memory prefix only: no physical owner, guard, census or permission. */
enum sf_prefix_phase_v2 { SF_P_UNBOUND, SF_P_GENESIS, SF_P_DISABLE, SF_P_MASK,
    SF_P_ENTRY, SF_P_REMAP, SF_P_POST, SF_P_COMPLETE };
enum sf_prefix_result_v2 { SF_P_REFUSED, SF_P_BURNED, SF_P_PREFIX_COMPLETE,
    SF_P_UNAVAILABLE };
struct sf_prefix_call_v2 { int rc, error, output; };
struct sf_prefix_receipt_v2 {
    unsigned attempted, returned;
    int rc, error, output;
};
struct sf_prefix_policy_v2 {
    unsigned entered, burned;
    enum sf_prefix_phase_v2 phase;
    struct sf_remap_occurrence_v2 stdio[3];
    struct sf_remap_policy_v2 remap;
    struct sf_prefix_receipt_v2 genesis[9];
    struct sf_prefix_receipt_v2 disable, mask, entry, post, binding[2];
};
struct sf_prefix_ports_v2 {
    void *context;
    int (*genesis)(void *, unsigned, int);
    struct sf_prefix_call_v2 (*disable)(void *);
    struct sf_prefix_call_v2 (*mask)(void *);
    int (*entry)(void *);
    struct sf_remap_call_v2 (*close_one)(void *, int);
    struct sf_remap_call_v2 (*duplicate)(void *, int, int);
    int (*binding_valid)(void *, int, unsigned);
    int (*post)(void *);
};
enum sf_prefix_result_v2 sf_bootstrap_prefix_run_v2(
    struct sf_prefix_policy_v2 *, const struct sf_prefix_ports_v2 *);
#endif
