#include "task6a-origin-native-remap-policy-v2.h"

/* Private same-owner policy. The caller supplies physical custody and terminal. */
static int canonical(const struct sf_remap_policy_v2 *p) {
    if (p->ready != 1 || p->entered != 0 || p->burned != 0) return 0;
    for (unsigned i = 0; i < 8; i++) {
        const struct sf_remap_occurrence_v2 *o = p->occurrence + i;
        const struct sf_remap_action_v2 *a = p->action + i;
        if (o->id != i + 1 || o->fd != (i < 6 ? (int)i + 3 : (int)i - 3) ||
            o->state != (i < 6 ? SF_R_HELD : SF_R_EMPTY) ||
            a->attempted != 0 || a->returned != 0 || a->rc != 0 || a->error != 0)
            return 0;
    }
    return 1;
}

static int burn(struct sf_remap_policy_v2 *p) {
    p->burned = 1;
    return 0;
}

static int dispose(struct sf_remap_policy_v2 *p,
                   const struct sf_remap_ports_v2 *ports,
                   unsigned source, unsigned action) {
    struct sf_remap_occurrence_v2 *o = p->occurrence + source;
    struct sf_remap_action_v2 *a = p->action + action;
    a->attempted = 1;
    o->state = SF_R_CLOSING;
    const struct sf_remap_call_v2 result = ports->close_one(ports->context, o->fd);
    a->rc = result.rc;
    a->error = result.error;
    a->returned = 1;
    o->state = result.rc == 0 ? SF_R_SETTLED : SF_R_UNKNOWN;
    return result.rc == 0 && p->burned == 0 ? 1 : burn(p);
}

static int acquire(struct sf_remap_policy_v2 *p,
                   const struct sf_remap_ports_v2 *ports, unsigned slot) {
    struct sf_remap_occurrence_v2 *o = p->occurrence + slot + 6;
    struct sf_remap_action_v2 *a = p->action + slot + 4;
    a->attempted = 1;
    o->state = SF_R_PENDING;
    const struct sf_remap_call_v2 result =
        ports->duplicate(ports->context, p->occurrence[slot + 4].fd, o->fd);
    a->rc = result.rc;
    a->error = result.error;
    a->returned = 1;
    if (result.rc != o->fd) {
        o->state = SF_R_UNKNOWN;
        return burn(p);
    }
    o->state = SF_R_HELD;
    if (p->burned != 0) return 0;
    if (ports->binding_valid(ports->context, o->fd, o->id) != 1 ||
        p->burned != 0) return burn(p);
    return 1;
}

enum sf_remap_result_v2 sf_remap_policy_run_v2(
    struct sf_remap_policy_v2 *p, const struct sf_remap_ports_v2 *ports) {
    if (!p) return SF_R_REFUSED;
    if (!ports || !ports->close_one || !ports->duplicate ||
        !ports->binding_valid || !canonical(p)) {
        burn(p);
        return SF_R_REFUSED;
    }
    p->entered = 1;
    for (unsigned i = 0; i < 4; i++)
        if (!dispose(p, ports, i, i)) return SF_R_BURNED;
    for (unsigned i = 0; i < 2; i++)
        if (!acquire(p, ports, i)) return SF_R_BURNED;
    for (unsigned i = 4; i < 6; i++)
        if (!dispose(p, ports, i, i + 2)) return SF_R_BURNED;
    for (unsigned i = 0; i < 8; i++)
        if (p->occurrence[i].state != (i < 6 ? SF_R_SETTLED : SF_R_HELD) ||
            p->action[i].attempted != 1 || p->action[i].returned != 1) {
            burn(p);
            return SF_R_BURNED;
        }
    return p->burned == 0 ? SF_R_COMPLETE : SF_R_BURNED;
}
