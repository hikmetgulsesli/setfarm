#define _DARWIN_C_SOURCE 1
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <mach/mach.h>
#include <pthread.h>
#include <signal.h>
#include <spawn.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

/* Ordinary acquisition lifecycle checkpoint; always unqualified/refused. */
enum Admission { READY, IN_FLIGHT, BURNED, BURNED_IN_FLIGHT };
struct Request {
    pid_t child;
    mach_port_t self;
    uint64_t deadline_ns;
    atomic_int admission;
    atomic_bool done;
    bool attempted;
    int unavailable_reason;
    kern_return_t status;
    mach_port_t returned;
};
struct failure { const char *operation; int code, resource; uint64_t observations; };
struct owner {
    pid_t child;
    int born, reaped, status, burned, child_uncertain, observed_dead;
    int input, output, error;
    int output_eof, error_eof;
    size_t output_bytes, error_bytes;
    uint64_t deadline;
    mach_port_t task_port;
    int task_port_owned;
    struct failure failures[32];
    size_t failure_count;
    int failure_overflow;
    pthread_t request_thread;
    bool thread_created, thread_join_attempted, thread_joined;
    struct Request request;
};

static uint64_t now_ns(void) {
    struct timespec value;
    if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) return 0;
    return (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
}

static void burn_request(struct owner *o) {
    int state = atomic_load_explicit(&o->request.admission, memory_order_acquire);
    for (;;) {
        int next;
        switch (state) {
            case READY: next = BURNED; break;
            case IN_FLIGHT: next = BURNED_IN_FLIGHT; break;
            case BURNED: case BURNED_IN_FLIGHT: return;
            default: o->failure_overflow = 1; return;
        }
        if (atomic_compare_exchange_strong_explicit(&o->request.admission,
            &state, next, memory_order_acq_rel, memory_order_acquire)) return;
    }
}

static void record_failure(struct owner *o, const char *operation, int code, int resource) {
    o->burned = 1;
    burn_request(o);
    for (size_t i = 0; i < o->failure_count; i++) {
        struct failure *f = o->failures + i;
        if (f->code == code && f->resource == resource && !strcmp(f->operation, operation)) {
            if (f->observations != UINT64_MAX) f->observations++;
            else o->failure_overflow = 1;
            return;
        }
    }
    if (o->failure_count < 32)
        o->failures[o->failure_count++] = (struct failure){operation, code, resource, 1};
    else o->failure_overflow = 1;
}
static void fail(struct owner *o, const char *operation, int code) {
    record_failure(o, operation, code, -1);
}

static void close_owned(struct owner *o, int *slot) {
    int original = *slot;
    if (original < 0) return;
    *slot = -1;
    if (close(original) != 0) record_failure(o, "close", errno, original);
}
static bool can_consume_target_status(const struct owner *o) {
    return !o->thread_created || o->thread_joined;
}

/* Relative backoff remains usable after qualification has expired. */
static void backoff(struct owner *o) {
    struct timespec left = {0, 50000000};
    while (nanosleep(&left, &left) != 0) {
        if (errno != EINTR) { fail(o, "backoff", errno); break; }
    }
}
static int on_time(struct owner *o) {
    uint64_t now = now_ns();
    if (!now || now >= o->deadline) {
        fail(o, now ? "protocol-deadline" : "protocol-clock", 0); return 0;
    }
    return !o->burned;
}

/* This observer never consumes status, even before request creation. */
static int observe_target(struct owner *o, int require_live) {
    if (!o->born) return 1;
    if (o->child_uncertain || o->reaped) return 0;
    if (!o->observed_dead) {
        siginfo_t info;
        memset(&info, 0, sizeof info);
        int rc = waitid(P_PID, (id_t)o->child, &info, WEXITED | WNOHANG | WNOWAIT);
        if (rc != 0) {
            int saved = errno;
            if (saved == EINTR) return 1;
            o->child_uncertain = 1; fail(o, "waitid-ownership-uncertain", saved); return 0;
        }
        if (info.si_pid == 0) return 1;
        if (info.si_pid != o->child ||
            (info.si_code != CLD_EXITED && info.si_code != CLD_KILLED && info.si_code != CLD_DUMPED)) {
            o->child_uncertain = 1; fail(o, "waitid-identity", 0); return 0;
        }
        o->observed_dead = 1;
        burn_request(o);
    }
    if (require_live) fail(o, "early-child-exit", 0);
    return !require_live;
}

static void consume_target_status(struct owner *o) {
    if (!o->born || o->reaped || o->child_uncertain || !can_consume_target_status(o)) return;
    pid_t result = waitpid(o->child, &o->status, WNOHANG);
    if (result == o->child) { o->reaped = 1; o->observed_dead = 1; }
    else if (result < 0 && errno != EINTR) {
        o->child_uncertain = 1; fail(o, "waitpid-ownership-uncertain", errno);
    } else if (result > 0) {
        o->child_uncertain = 1; fail(o, "waitpid-identity", 0);
    }
}

static void drain_stream(struct owner *o, int *slot, int *eof, size_t *total, int is_error) {
    if (*slot < 0) return;
    char bytes[256];
    ssize_t count = read(*slot, bytes, sizeof bytes);
    if (count > 0) {
        if (*total > 4096 - (size_t)count) {
            fail(o, "output-limit", 0); close_owned(o, slot); return;
        }
        *total += (size_t)count;
        if (is_error) fail(o, "child-stderr", 0);
        else fail(o, "unexpected-output", 0);
    } else if (count == 0) {
        *eof = 1; close_owned(o, slot);
    } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
        fail(o, is_error ? "stderr-read" : "stdout-read", errno);
        close_owned(o, slot);
    }
}

static int read_ready(struct owner *o) {
    char frame[6];
    size_t used = 0;
    while (!o->burned && on_time(o) && observe_target(o, 1)) {
        drain_stream(o, &o->error, &o->error_eof, &o->error_bytes, 1);
        if (o->burned) break;
        ssize_t count = read(o->output, frame + used, sizeof frame - used);
        if (count > 0) {
            used += (size_t)count; o->output_bytes += (size_t)count;
            if (used == sizeof frame) {
                if (memcmp(frame, "READY\n", sizeof frame)) fail(o, "protocol-frame", 0);
                return !o->burned && on_time(o) && observe_target(o, 1);
            }
        } else if (count == 0) {
            o->output_eof = 1; close_owned(o, &o->output); fail(o, "ready-eof", 0);
        } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
            fail(o, "ready-read", errno);
        }
        if (!o->burned) backoff(o);
    }
    return 0;
}

static int setup_child(struct owner *o, const char *entry) {
    int ends[6] = {-1, -1, -1, -1, -1, -1};
    posix_spawn_file_actions_t actions;
    posix_spawnattr_t attributes;
    int actions_owned = 0, attributes_owned = 0, rc = 0;
    struct sigaction previous, ignored;
    if (sigaction(SIGCHLD, NULL, &previous) != 0) { fail(o, "sigchld-query", errno); goto done; }
    if (previous.sa_handler != SIG_DFL || (previous.sa_flags & SA_NOCLDWAIT)) {
        fail(o, "sigchld-reaper", 0); goto done;
    }
    memset(&ignored, 0, sizeof ignored); ignored.sa_handler = SIG_IGN;
    if (sigemptyset(&ignored.sa_mask) != 0 || sigaction(SIGPIPE, &ignored, NULL) != 0) {
        fail(o, "parent-sigpipe", errno); goto done;
    }
    for (size_t i = 0; i < 6; i += 2) {
        if (pipe(ends + i) != 0) { fail(o, "pipe", errno); goto done; }
        for (size_t j = i; j < i + 2; j++) {
            if (ends[j] < 3 || fcntl(ends[j], F_SETFD, FD_CLOEXEC) != 0 ||
                fcntl(ends[j], F_GETFD) != FD_CLOEXEC) {
                fail(o, "pipe-cloexec", errno); goto done;
            }
        }
    }
    const int parent_ends[3] = {ends[1], ends[2], ends[4]};
    for (size_t i = 0; i < 3; i++) {
        int flags = fcntl(parent_ends[i], F_GETFL);
        if (flags < 0 || fcntl(parent_ends[i], F_SETFL, flags | O_NONBLOCK) != 0) {
            fail(o, "parent-pipe-nonblock", errno); goto done;
        }
        int verified = fcntl(parent_ends[i], F_GETFL);
        if (verified < 0 || (verified & O_NONBLOCK) == 0) {
            fail(o, "parent-pipe-nonblock", errno); goto done;
        }
    }
    rc = posix_spawn_file_actions_init(&actions);
    if (rc) { fail(o, "spawn-actions-init", rc); goto done; }
    actions_owned = 1;
    rc = posix_spawnattr_init(&attributes);
    if (rc) { fail(o, "spawn-attrs-init", rc); goto done; }
    attributes_owned = 1;
    const int sources[3] = {ends[0], ends[3], ends[5]};
    for (int i = 0; i < 3; i++) {
        rc = posix_spawn_file_actions_adddup2(&actions, sources[i], i);
        if (rc) { fail(o, "spawn-dup", rc); goto done; }
        rc = posix_spawn_file_actions_addclose(&actions, sources[i]);
        if (rc) { fail(o, "spawn-close-action", rc); goto done; }
    }
    sigset_t mask, defaults;
    if (sigemptyset(&mask) != 0 || sigemptyset(&defaults) != 0 ||
        sigaddset(&defaults, SIGPIPE) != 0 || sigaddset(&defaults, SIGCHLD) != 0) {
        fail(o, "child-signals", errno); goto done;
    }
    rc = posix_spawnattr_setsigmask(&attributes, &mask);
    if (!rc) rc = posix_spawnattr_setsigdefault(&attributes, &defaults);
    if (!rc) rc = posix_spawnattr_setflags(&attributes,
        POSIX_SPAWN_CLOEXEC_DEFAULT | POSIX_SPAWN_SETSIGMASK | POSIX_SPAWN_SETSIGDEF);
    if (rc) { fail(o, "spawn-signals", rc); goto done; }
    char *const child_argv[] = {
        "/opt/homebrew/Cellar/node/26.4.0/bin/node", (char *)entry, NULL
    };
    char *const child_env[] = {"PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C", NULL};
    rc = posix_spawn(&o->child, child_argv[0], &actions, &attributes, child_argv, child_env);
    if (rc) { fail(o, "spawn", rc); goto done; }
    if (o->child <= 1) {
        o->born = 1; o->child_uncertain = 1;
        fail(o, "spawn-identity-unknown", 0); goto done;
    }
    o->born = 1;
    o->input = ends[1]; ends[1] = -1;
    o->output = ends[2]; ends[2] = -1;
    o->error = ends[4]; ends[4] = -1;
done:
    if (attributes_owned && (rc = posix_spawnattr_destroy(&attributes))) fail(o, "spawn-attrs-destroy", rc);
    if (actions_owned && (rc = posix_spawn_file_actions_destroy(&actions))) fail(o, "spawn-actions-destroy", rc);
    for (size_t i = 0; i < 6; i++) close_owned(o, &ends[i]);
    return o->failure_count == 0;
}

/* Worker touches only immutable request inputs, admission and its result slot. */
static void *request_task_port(void *argument) {
    struct Request *request = argument;
    request->attempted = false;
    request->unavailable_reason = 0;
    request->status = KERN_FAILURE;
    request->returned = MACH_PORT_NULL;
    uint64_t now = now_ns();
    int expected = READY;
    if (!now) request->unavailable_reason = 1;
    else if (now >= request->deadline_ns) request->unavailable_reason = 2;
    else if (!atomic_compare_exchange_strong_explicit(&request->admission,
        &expected, IN_FLIGHT, memory_order_acq_rel, memory_order_acquire))
        request->unavailable_reason = 3;
    else {
        request->attempted = true;
        request->status = task_for_pid(request->self, request->child, &request->returned);
    }
    atomic_store_explicit(&request->done, true, memory_order_release);
    return NULL;
}

static void dispose_task_port(struct owner *o) {
    if (!o->task_port_owned) return;
    mach_port_t original = o->task_port;
    o->task_port_owned = 0; o->task_port = MACH_PORT_NULL;
    kern_return_t rc = mach_port_deallocate(mach_task_self(), original);
    if (rc != KERN_SUCCESS) record_failure(o, "task-port-dispose", rc, (int)original);
}

static void join_request(struct owner *o) {
    if (!o->thread_created || o->thread_join_attempted ||
        !atomic_load_explicit(&o->request.done, memory_order_acquire)) return;
    /* Observed completion is not settlement or renewed qualification. */
    (void)on_time(o);
    o->thread_join_attempted = true;
    int rc = pthread_join(o->request_thread, NULL);
    if (rc != 0) { fail(o, "request-join-uncertain", rc); return; }
    o->thread_joined = true;
    /* Register every candidate before clock/result classification can fail. */
    if (MACH_PORT_VALID(o->request.returned)) {
        o->task_port = o->request.returned; o->task_port_owned = 1;
    }
    int timely = on_time(o);
    if (!timely) fail(o, "request-burned", 0);
    else if (!o->request.attempted)
        fail(o, "request-unavailable", o->request.unavailable_reason);
    else if (o->request.status != KERN_SUCCESS) fail(o, "task-port-denied", o->request.status);
    else if (!o->task_port_owned) fail(o, "invalid-task-port", 0);
    else fail(o, "task-port-unqualified", 0);
    /* This checkpoint has no forward binding/audit/protocol success path. */
    dispose_task_port(o);
}

static void signal_target(struct owner *o, int signal) {
    if (!o->born || o->reaped || o->child_uncertain || o->observed_dead) return;
    if (!observe_target(o, 0) || o->observed_dead || o->child_uncertain) return;
    if (kill(o->child, signal) != 0) fail(o, "cleanup-signal", errno);
}

int main(int argc, char **argv) {
    (void)argv;
    if (argc != 1 || getuid() == 0 || geteuid() != getuid()) {
        (void)fputs("TASK6A_NATIVE_TASK_PORT_PROBE_REFUSED\n", stderr); return 2;
    }
    const char *compiled_source = __FILE__;
    const char *slash = strrchr(compiled_source, '/');
    const char suffix[] = "/task6a-protected-origin-entry-v2.mjs";
    if (compiled_source[0] != '/' || !slash ||
        (size_t)(slash - compiled_source) + sizeof suffix > PATH_MAX) {
        (void)fputs("TASK6A_NATIVE_TASK_PORT_PROBE_REFUSED\n", stderr); return 2;
    }
    char entry[PATH_MAX];
    size_t length = (size_t)(slash - compiled_source);
    memcpy(entry, compiled_source, length); memcpy(entry + length, suffix, sizeof suffix);
    struct owner o = {.input = -1, .output = -1, .error = -1, .task_port = MACH_PORT_NULL};
    atomic_init(&o.request.admission, READY);
    atomic_init(&o.request.done, false);
    uint64_t start = now_ns();
    if (!start || start > UINT64_MAX - UINT64_C(3000000000)) fail(&o, "protocol-clock", 0);
    else o.deadline = start + UINT64_C(3000000000);
    if (!o.burned && setup_child(&o, entry) && read_ready(&o)) {
        o.request.child = o.child;
        o.request.self = mach_task_self();
        o.request.deadline_ns = o.deadline;
        int rc = pthread_create(&o.request_thread, NULL, request_task_port, &o.request);
        if (rc != 0) fail(&o, "request-create", rc);
        else o.thread_created = true;
    }

    uint64_t cleanup_start = 0;
    int term_attempted = 0, kill_attempted = 0, cleanup_expired = 0;
    for (;;) {
        uint64_t now = now_ns();
        if (!now || now >= o.deadline) fail(&o, now ? "protocol-deadline" : "protocol-clock", 0);
        (void)observe_target(&o, !o.burned);
        drain_stream(&o, &o.output, &o.output_eof, &o.output_bytes, 0);
        drain_stream(&o, &o.error, &o.error_eof, &o.error_bytes, 1);
        join_request(&o);
        if (o.burned || !o.thread_created) {
            close_owned(&o, &o.input);
            /* Cleanup grace begins after actual input close, not before join. */
            uint64_t cleanup_now = now_ns();
            if (!cleanup_now) fail(&o, "cleanup-clock", 0);
            if (!cleanup_start) cleanup_start = cleanup_now;
            if (cleanup_now && cleanup_start && cleanup_now >= cleanup_start) {
                uint64_t elapsed = cleanup_now - cleanup_start;
                if (!term_attempted && elapsed >= UINT64_C(100000000)) {
                    term_attempted = 1; signal_target(&o, SIGTERM);
                }
                if (!kill_attempted && elapsed >= UINT64_C(200000000)) {
                    kill_attempted = 1; signal_target(&o, SIGKILL);
                }
                /* Latch expiry before the completed-break check. */
                if (!cleanup_expired && elapsed >= UINT64_C(700000000)) {
                    cleanup_expired = 1; fail(&o, "cleanup-deadline", 0);
                }
            }
        }
        consume_target_status(&o);
        if (can_consume_target_status(&o) && (!o.born || o.reaped) &&
            o.input < 0 && o.output < 0 && o.error < 0) break;
        /* Joined=false, uncertainty or pending request retains the original owner. */
        backoff(&o);
    }
    dispose_task_port(&o);
    if (o.born && (!o.reaped || !o.output_eof || !o.error_eof)) fail(&o, "child-lifecycle", 0);
    for (size_t i = 0; i < o.failure_count; i++)
        (void)fprintf(stderr, "TASK6A_NATIVE_TASK_PORT_PROBE_FAILED %s %d resource=%d observations=%llu\n",
            o.failures[i].operation, o.failures[i].code, o.failures[i].resource,
            (unsigned long long)o.failures[i].observations);
    if (o.failure_overflow)
        (void)fputs("TASK6A_NATIVE_TASK_PORT_PROBE_FAILURE_RECORD_OVERFLOW\n", stderr);
    return 2;
}
