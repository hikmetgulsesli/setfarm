#ifndef SF_ORIGIN_REMAP_POLICY_V2_H
#define SF_ORIGIN_REMAP_POLICY_V2_H
/* Private policy only: no guard, syscall, owner terminal or public authority. */
enum sf_remap_state_v2 { SF_R_EMPTY, SF_R_HELD, SF_R_CLOSING,
                         SF_R_PENDING, SF_R_SETTLED, SF_R_UNKNOWN };
enum sf_remap_result_v2 { SF_R_REFUSED, SF_R_BURNED, SF_R_COMPLETE,
                          SF_R_UNAVAILABLE };
struct sf_remap_call_v2 { int rc; int error; };
struct sf_remap_occurrence_v2 {
    unsigned id; int fd; enum sf_remap_state_v2 state;
};
struct sf_remap_action_v2 {
    unsigned attempted, returned;
    int rc, error;
};
struct sf_remap_policy_v2 {
    unsigned ready, entered, burned;
    struct sf_remap_occurrence_v2 occurrence[8];
    struct sf_remap_action_v2 action[8];
};
struct sf_remap_ports_v2 {
    void *context;
    struct sf_remap_call_v2 (*close_one)(void *, int);
    struct sf_remap_call_v2 (*duplicate)(void *, int, int);
    int (*binding_valid)(void *, int, unsigned);
};
enum sf_remap_result_v2 sf_remap_policy_run_v2(
    struct sf_remap_policy_v2 *, const struct sf_remap_ports_v2 *);
#endif
