#define _DARWIN_C_SOURCE 1
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <mach/mach.h>
#include <mach/task_info.h>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

/* Ordinary NAME diagnostic only; never a protected origin or CONTROL owner. */
struct failure { const char *operation; int code, resource; uint64_t observations; };
struct owner {
    pid_t child;
    int born, reaped, status, burned, child_uncertain;
    int input, output, error;
    int output_eof, error_eof;
    size_t output_bytes, error_bytes;
    uint64_t deadline;
    mach_port_t name;
    int name_owned;
    struct failure failures[32];
    size_t failure_count;
    int failure_overflow;
};

static uint64_t now_ns(void) {
    struct timespec value;
    if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) return 0;
    return (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
}

static void record_failure(struct owner *o, const char *operation, int code, int resource) {
    o->burned = 1;
    for (size_t i = 0; i < o->failure_count; i++) {
        struct failure *record = o->failures + i;
        if (record->resource == resource && record->code == code &&
            strcmp(record->operation, operation) == 0) {
            if (record->observations != UINT64_MAX) record->observations++;
            else o->failure_overflow = 1;
            return;
        }
    }
    if (o->failure_count < 32) {
        o->failures[o->failure_count++] = (struct failure){operation, code, resource, 1};
    } else {
        o->failure_overflow = 1;
        /* New overflow causes stay visible, never silently dropped or positive. */
        (void)fprintf(stderr, "TASK6A_NATIVE_NAME_PROBE_FAILURE_OVERFLOW %s %d %d\n",
            operation, code, resource);
    }
}

static void fail(struct owner *o, const char *operation, int code) {
    record_failure(o, operation, code, -1);
}

/* Mark each original descriptor consumed before the sole close attempt.
 * EINTR or other errors remain failures; retry could close a reused descriptor. */
static void close_owned(struct owner *o, int *slot) {
    int original = *slot;
    if (original < 0) return;
    *slot = -1;
    if (close(original) != 0) record_failure(o, "close", errno, original);
}

static int on_time(struct owner *o) {
    uint64_t now = now_ns();
    if (!now || now >= o->deadline) { fail(o, "protocol-deadline", 0); return 0; }
    return 1;
}

static int within_budget(struct owner *o) {
    return !o->burned && on_time(o);
}

/* The only reaper. Consuming status permanently closes all target operations. */
static int observe_child(struct owner *o, int require_live) {
    if (!o->born) return 1;
    if (o->child_uncertain) return 0;
    if (!o->reaped) {
        pid_t result = waitpid(o->child, &o->status, WNOHANG);
        if (result == o->child) { o->reaped = 1; o->burned = 1; }
        else if (result < 0) {
            if (errno == EINTR) return 1;
            o->child_uncertain = 1; fail(o, "waitpid-ownership-uncertain", errno); return 0;
        } else if (result != 0) {
            o->child_uncertain = 1; fail(o, "waitpid-identity", 0); return 0;
        }
    }
    if (require_live && o->reaped) { fail(o, "early-child-exit", 0); return 0; }
    return 1;
}

static int poll_owned(struct owner *o, short input_events, uint64_t deadline) {
    uint64_t now = now_ns();
    if (!now || now >= deadline) return 0;
    int timeout = (int)((deadline - now + UINT64_C(999999)) / UINT64_C(1000000));
    if (timeout > 50) timeout = 50;
    struct pollfd fds[3] = {
        {o->input, input_events, 0}, {o->output, POLLIN, 0}, {o->error, POLLIN, 0}
    };
    int rc = poll(fds, 3, timeout);
    if (rc < 0) { if (errno == EINTR) return 1; fail(o, "poll", errno); return -1; }
    for (size_t i = 0; i < 3; i++)
        if (fds[i].revents & POLLNVAL) { fail(o, "invalid-pipe", 0); return -1; }
    return 1;
}

static int empty_stderr(struct owner *o) {
    if (o->error < 0) return 1;
    char bytes[256];
    ssize_t count = read(o->error, bytes, sizeof bytes);
    if (count > 0) {
        o->error_bytes += (size_t)count;
        fail(o, "child-stderr", 0); return 0;
    }
    if (count == 0) { o->error_eof = 1; close_owned(o, &o->error); return 1; }
    if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) return 1;
    fail(o, "stderr-read", errno); return 0;
}

static int read_frame(struct owner *o, const char *expected, size_t length, int live) {
    size_t offset = 0;
    while (offset < length) {
        if ((live && !within_budget(o)) || !observe_child(o, live)) return 0;
        if (!empty_stderr(o)) return 0;
        uint64_t now = now_ns();
        if (!now || now >= o->deadline) { fail(o, "protocol-deadline", 0); return 0; }
        char bytes[256];
        ssize_t count = read(o->output, bytes, sizeof bytes);
        if (count > 0) {
            o->output_bytes += (size_t)count;
            if ((size_t)count > length - offset ||
                memcmp(bytes, expected + offset, (size_t)count) != 0) {
                fail(o, "protocol-frame", 0); return 0;
            }
            offset += (size_t)count;
        } else if (count == 0) {
            o->output_eof = 1; close_owned(o, &o->output);
            fail(o, "early-stdout-eof", 0); return 0;
        } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
            fail(o, "stdout-read", errno); return 0;
        } else if (poll_owned(o, 0, o->deadline) <= 0) {
            fail(o, "protocol-deadline", 0); return 0;
        }
    }
    return on_time(o) && (!live || (within_budget(o) && observe_child(o, 1)));
}

static int write_input(struct owner *o, const char *bytes, size_t length) {
    size_t offset = 0;
    while (offset < length) {
        if (!within_budget(o) || !observe_child(o, 1) || !empty_stderr(o)) return 0;
        ssize_t count = write(o->input, bytes + offset, length - offset);
        if (count > 0) offset += (size_t)count;
        else if (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) {
            if (poll_owned(o, POLLOUT, o->deadline) <= 0) {
                fail(o, "protocol-deadline", 0); return 0;
            }
        } else { fail(o, "stdin-write", count < 0 ? errno : 0); return 0; }
    }
    return within_budget(o) && observe_child(o, 1);
}

static void drain_output(struct owner *o, int strict) {
    if (o->output < 0) return;
    char bytes[256];
    ssize_t count = read(o->output, bytes, sizeof bytes);
    if (count > 0) {
        o->output_bytes += (size_t)count;
        if (strict) fail(o, "extra-stdout", 0);
    } else if (count == 0) {
        o->output_eof = 1; close_owned(o, &o->output);
    } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)
        fail(o, "stdout-drain", errno);
}

static void settle(struct owner *o) {
    close_owned(o, &o->input);
    uint64_t start = now_ns();
    uint64_t graceful = start + UINT64_C(150000000);
    uint64_t term = graceful + UINT64_C(200000000);
    uint64_t final = term + UINT64_C(1000000000);
    int term_sent = 0, kill_sent = 0, expiry_recorded = 0;
    while (o->born && (!o->reaped || !o->output_eof || !o->error_eof)) {
        (void)observe_child(o, 0);
        drain_output(o, o->failure_count == 0);
        (void)empty_stderr(o);
        uint64_t now = now_ns();
        if (!now || !start) { fail(o, "cleanup-clock", 0); now = final; }
        if (o->failure_count == 0 && now >= o->deadline) fail(o, "protocol-deadline", 0);
        /* Cleanup signals use ONLY original birth before exclusive reap. */
        if (!o->reaped && !o->child_uncertain && now >= graceful && !term_sent) {
            term_sent = 1;
            if (kill(o->child, SIGTERM) != 0) fail(o, "cleanup-term", errno);
        }
        if (!o->reaped && !o->child_uncertain && now >= term && !kill_sent) {
            kill_sent = 1;
            if (kill(o->child, SIGKILL) != 0) fail(o, "cleanup-kill", errno);
        }
        if (now >= final && !expiry_recorded) {
            expiry_recorded = 1; fail(o, "cleanup-deadline-unqualified", 0);
            if (!o->reaped || !o->output_eof || !o->error_eof) {
                (void)fputs("TASK6A_NATIVE_NAME_PROBE_UNSETTLED\n", stderr);
                (void)fflush(stderr);
            }
        }
        /* Late completion cannot erase the observed cleanup expiry. */
        if (o->reaped && o->output_eof && o->error_eof) break;
        /* Uncertain ownership cannot authorize a signal, another PID lookup,
         * positive return, or early NAME disposal. Retain this failed owner. */
        uint64_t next = now + UINT64_C(50000000);
        if (poll_owned(o, 0, next) <= 0) (void)poll(NULL, 0, 50);
    }
    close_owned(o, &o->output);
    close_owned(o, &o->error);
    if (o->name_owned) {
        o->name_owned = 0;
        kern_return_t rc = mach_port_deallocate(mach_task_self(), o->name);
        if (rc != KERN_SUCCESS) fail(o, "name-dispose", rc);
    }
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

static int bind_name(struct owner *o, audit_token_t *first) {
    if (!within_budget(o) || !observe_child(o, 1)) return 0;
    kern_return_t rc = task_name_for_pid(mach_task_self(), o->child, &o->name);
    if (rc != KERN_SUCCESS) { fail(o, "name-denied", rc); return 0; }
    if (!MACH_PORT_VALID(o->name)) { fail(o, "invalid-name-right", 0); return 0; }
    o->name_owned = 1;
    if (!within_budget(o) || !observe_child(o, 1)) return 0;
    mach_port_type_t type = 0;
    rc = mach_port_type(mach_task_self(), o->name, &type);
    if (rc != KERN_SUCCESS || !(type & MACH_PORT_TYPE_SEND) || (type & MACH_PORT_TYPE_DEAD_NAME)) {
        fail(o, "invalid-name-type", rc); return 0;
    }
    if (!within_budget(o) || !observe_child(o, 1)) return 0;
    int pid = 0;
    rc = pid_for_task(o->name, &pid);
    if (rc != KERN_SUCCESS || pid != o->child) { fail(o, "name-pid-mismatch", rc); return 0; }
    if (!within_budget(o) || !observe_child(o, 1)) return 0;
    mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
    rc = task_info(o->name, TASK_AUDIT_TOKEN, (task_info_t)first, &count);
    if (rc != KERN_SUCCESS) { fail(o, "audit-query-failed", rc); return 0; }
    if (count != TASK_AUDIT_TOKEN_COUNT) { fail(o, "audit-count-mismatch", 0); return 0; }
    return within_budget(o) && observe_child(o, 1);
}

int main(int argc, char **argv) {
    (void)argv;
    if (argc != 1 || getuid() == 0 || geteuid() != getuid()) {
        (void)fputs("TASK6A_NATIVE_NAME_PROBE_REFUSED\n", stderr); return 2;
    }
    const char *compiled_source = __FILE__;
    const char *slash = strrchr(compiled_source, '/');
    const char suffix[] = "/task6a-protected-origin-entry-v2.mjs";
    if (compiled_source[0] != '/' || !slash ||
        (size_t)(slash - compiled_source) + sizeof suffix > PATH_MAX) {
        (void)fputs("TASK6A_NATIVE_NAME_PROBE_REFUSED\n", stderr); return 2;
    }
    char entry[PATH_MAX];
    size_t directory_length = (size_t)(slash - compiled_source);
    memcpy(entry, compiled_source, directory_length);
    memcpy(entry + directory_length, suffix, sizeof suffix);
    struct owner o = {.input = -1, .output = -1, .error = -1, .name = MACH_PORT_NULL};
    uint64_t start = now_ns();
    o.deadline = start + UINT64_C(3000000000);
    if (!start) fail(&o, "protocol-clock", 0);
    audit_token_t first = {0}, second = {0};
    char nonces[3][65] = {{0}};
    if (o.failure_count == 0 && setup_child(&o, entry) &&
        read_frame(&o, "READY\n", 6, 1) && bind_name(&o, &first)) {
        for (size_t i = 0; i < 3 && !o.failure_count; i++) {
            unsigned char random[32];
            arc4random_buf(random, sizeof random);
            for (size_t j = 0; j < 32; j++) {
                const char hex[] = "0123456789abcdef";
                nonces[i][j * 2] = hex[random[j] >> 4];
                nonces[i][j * 2 + 1] = hex[random[j] & 15];
            }
            for (size_t j = 0; j < i; j++)
                if (memcmp(nonces[i], nonces[j], 65) == 0) fail(&o, "duplicate-challenge", 0);
            char challenge[76], pong[71];
            if (snprintf(challenge, sizeof challenge, "CHALLENGE %s\n", nonces[i]) != 75 ||
                snprintf(pong, sizeof pong, "PONG %s\n", nonces[i]) != 70) {
                fail(&o, "challenge-format", 0); break;
            }
            if (!write_input(&o, challenge, 75) || !read_frame(&o, pong, 70, 1)) break;
        }
        if (!o.failure_count && within_budget(&o) && observe_child(&o, 1)) {
            mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
            kern_return_t rc = task_info(o.name, TASK_AUDIT_TOKEN, (task_info_t)&second, &count);
            if (rc != KERN_SUCCESS) fail(&o, "audit-query-failed", rc);
            else if (count != TASK_AUDIT_TOKEN_COUNT) fail(&o, "audit-count-mismatch", 0);
            else if (memcmp(&first, &second, sizeof first) != 0) fail(&o, "audit-drift", 0);
        }
        if (!o.failure_count && write_input(&o, "END\n", 4)) {
            close_owned(&o, &o.input);
            if (!o.failure_count) (void)read_frame(&o, "END\n", 4, 0);
        }
    }
    settle(&o);
    if (!o.failure_count) (void)on_time(&o);
    if (!o.born || !o.reaped || !WIFEXITED(o.status) || WEXITSTATUS(o.status) != 0 ||
        !o.output_eof || !o.error_eof || o.output_bytes != 220 || o.error_bytes != 0)
        fail(&o, "child-lifecycle", 0);
    if (o.failure_count || o.failure_overflow) {
        for (size_t i = 0; i < o.failure_count; i++)
            (void)fprintf(stderr, "TASK6A_NATIVE_NAME_PROBE_FAILED %s %d resource=%d observations=%llu\n",
                o.failures[i].operation, o.failures[i].code, o.failures[i].resource,
                (unsigned long long)o.failures[i].observations);
        if (o.failure_overflow) (void)fputs("TASK6A_NATIVE_NAME_PROBE_FAILURE_RECORD_OVERFLOW\n", stderr);
        return 2;
    }
    const char diagnostic[] =
        "{\"schema\":\"setfarm.task6a-native-name-diagnostic.v2\","
        "\"outcome\":\"supportedNAME/unqualified\",\"nameBound\":true,\"auditStable\":true,"
        "\"challengesCompleted\":3,\"childReaped\":true,\"childExitCode\":0,\"childSignal\":null,"
        "\"stdoutEof\":true,\"stderrEof\":true,\"nameDisposed\":true,"
        "\"productionAuthority\":false,\"completeNativeClosure\":false,\"protectedOrigin\":false}\n";
    if (fputs(diagnostic, stdout) == EOF || fflush(stdout) != 0) return 2;
    return 0;
}
