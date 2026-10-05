import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const SOURCE = new URL('../task6a-origin-native-task-port-v2.c', import.meta.url);
// Explicit test-process-only opt-in; never ambient native execution in a glob.
const REFUSAL_TEST_ENABLED = process.env.SETFARM_TASK6A_NATIVE_TASK_PORT_TEST === 'refusal';
const LIFECYCLE_TEST_ENABLED = process.env.SETFARM_TASK6A_NATIVE_TASK_PORT_TEST === 'lifecycle';
const DELIVERED_ENTRY = new URL('../task6a-protected-origin-entry-v2.mjs', import.meta.url);
const CLANG = '/Library/Developer/CommandLineTools/usr/bin/clang';
const LD = '/Library/Developer/CommandLineTools/usr/bin/ld';
const NODE = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const SDK = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const RESOURCE = '/Library/Developer/CommandLineTools/usr/lib/clang/21';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ENTRY = "import {writeFileSync} from 'node:fs';\n" +
  "writeFileSync(new URL('./entry-started', import.meta.url), 'entry started\\n', {flag:'wx',mode:0o600});\n" +
  "process.exit(2);\n";
const EARLY_EXIT_ENTRY = "import process from 'node:process';\nprocess.exit(2);\n";
const CONTROLS = ['none', 'synthetic-failure', 'delayed-synthetic-failure',
  'join-eligibility', 'delayed-no-consume-gate', 'create-failure',
  'burn-before-admission', 'early-target-exit', 'post-join-budget',
  'post-join-no-budget-gate'];

// Closed ordinary test-copy instrumentation. No target Mach operation occurs:
// the request shim returns explicitly synthetic KERN_FAILURE/MACH_PORT_NULL.
// Real spawn, thread, join, wait, read and close calls precede macro redirection.
const LIFECYCLE_PREFIX = String.raw`
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
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
static _Atomic(const char *) probe_events[128];
static atomic_uint probe_event_count;
static atomic_bool probe_overflow, probe_reaped, probe_fault;
static pid_t probe_child;
static pthread_t probe_thread;
static bool probe_create_attempted, probe_created, probe_join_attempted, probe_joined;
static bool probe_observed_dead, probe_uncertain;
static uint64_t probe_join_deadline;
static bool probe_join_was_unburned;
static void *(*probe_start)(void *);
static void *probe_argument;
static int probe_fds[6], probe_closed[6];
static unsigned probe_fd_count;
static void probe_event(const char *event) {
    int saved = errno;
    unsigned slot = atomic_fetch_add_explicit(&probe_event_count, 1, memory_order_relaxed);
    if (slot < 128) atomic_store_explicit(&probe_events[slot], event, memory_order_release);
    else atomic_store_explicit(&probe_overflow, true, memory_order_release);
    errno = saved;
}
static void probe_bad(void) {
    atomic_store_explicit(&probe_fault, true, memory_order_release);
    probe_event("harness-fault");
}
static void *probe_start_thread(void *unused) {
    (void)unused;
    probe_event("worker-enter");
    void *result = probe_start(probe_argument);
    probe_event("worker-return");
    return result;
}
static __attribute__((unused)) int probe_create(pthread_t *thread, const pthread_attr_t *attr,
    void *(*start)(void *), void *argument) {
    if (probe_create_attempted || attr != NULL) { probe_bad(); return EINVAL; }
    probe_create_attempted = true;
    probe_start = start; probe_argument = argument;
    probe_event("create-request");
    if (PROBE_CREATE_FAILED) { probe_event("create-synthetic-failure"); return EAGAIN; }
    int result = pthread_create(thread, attr, probe_start_thread, NULL);
    if (!result) { probe_thread = *thread; probe_created = true; probe_event("create-success"); }
    return result;
}
static __attribute__((unused)) int probe_join(pthread_t thread, void **result) {
    if (!probe_created || probe_join_attempted || !pthread_equal(thread, probe_thread)) {
        probe_bad(); return EINVAL;
    }
    probe_join_attempted = true;
    if (PROBE_JOIN_DELAYED) {
        struct timespec now;
        if (!probe_join_was_unburned || !probe_join_deadline ||
            clock_gettime(CLOCK_MONOTONIC, &now) != 0 ||
            (uint64_t)now.tv_sec * UINT64_C(1000000000) + (uint64_t)now.tv_nsec >= probe_join_deadline)
            probe_bad();
        else probe_event("pre-join-within-budget");
    }
    int rc = pthread_join(thread, result);
    if (!rc) { probe_joined = true; probe_event("actual-join-success"); }
    if (!rc && PROBE_JOIN_DELAYED) {
        struct timespec left = {3, 200000000}, now;
        while (nanosleep(&left, &left) != 0) {
            if (errno != EINTR) { probe_event("delay-failed"); break; }
        }
        probe_event("join-delay-complete");
        if (clock_gettime(CLOCK_MONOTONIC, &now) != 0 ||
            (uint64_t)now.tv_sec * UINT64_C(1000000000) + (uint64_t)now.tv_nsec < probe_join_deadline)
            probe_bad();
        else probe_event("join-return-after-budget");
    }
    return rc;
}
static __attribute__((unused)) kern_return_t probe_request(mach_port_name_t self, int child,
    mach_port_name_t *returned) {
    if (!probe_child || child != probe_child || self != mach_task_self() ||
        atomic_load_explicit(&probe_reaped, memory_order_acquire)) {
        probe_bad(); probe_event("after-reap-target-call");
        *returned = MACH_PORT_NULL; return KERN_FAILURE;
    }
    probe_event("synthetic-request");
    if (PROBE_DELAYED) {
        struct timespec left = {3, 200000000};
        while (nanosleep(&left, &left) != 0) {
            if (errno != EINTR) { probe_event("delay-failed"); break; }
        }
    }
    *returned = MACH_PORT_NULL;
    return KERN_FAILURE;
}
static __attribute__((unused)) int probe_spawn(pid_t *pid, const char *path,
    const posix_spawn_file_actions_t *actions, const posix_spawnattr_t *attributes,
    char *const argv[], char *const env[]) {
    const char *compiled_source = __FILE__;
    const char *slash = strrchr(compiled_source, '/');
    char entry[PATH_MAX];
    const char suffix[] = "/task6a-protected-origin-entry-v2.mjs";
    if (!slash || (size_t)(slash - compiled_source) + sizeof suffix > sizeof entry) {
        probe_bad(); return EINVAL;
    }
    size_t length = (size_t)(slash - compiled_source);
    memcpy(entry, compiled_source, length); memcpy(entry + length, suffix, sizeof suffix);
    if (probe_child || strcmp(path, "/opt/homebrew/Cellar/node/26.4.0/bin/node") ||
        strcmp(argv[0], path) || strcmp(argv[1], entry) || argv[2] ||
        strcmp(env[0], "PATH=/usr/bin:/bin") || strcmp(env[1], "LANG=C") ||
        strcmp(env[2], "LC_ALL=C") || env[3]) { probe_bad(); return EINVAL; }
    int rc = posix_spawn(pid, path, actions, attributes, argv, env);
    if (!rc && *pid > 1) { probe_child = *pid; probe_event("target-spawn"); }
    return rc;
}
static __attribute__((unused)) int probe_waitid(idtype_t kind, id_t pid,
    siginfo_t *info, int flags) {
    if (kind != P_PID || !probe_child || pid != (id_t)probe_child ||
        flags != (WEXITED | WNOHANG | WNOWAIT) ||
        atomic_load_explicit(&probe_reaped, memory_order_acquire)) {
        probe_bad(); errno = ECHILD; return -1;
    }
    int rc = waitid(kind, pid, info, flags), saved = errno;
    if (!rc && info->si_pid == probe_child &&
        (info->si_code == CLD_EXITED || info->si_code == CLD_KILLED || info->si_code == CLD_DUMPED)) {
        probe_observed_dead = true;
        probe_event("target-dead-observed");
    } else if ((!rc && info->si_pid != 0) || (rc != 0 && saved != EINTR)) {
        probe_uncertain = true; probe_bad();
    }
    errno = saved; return rc;
}
static __attribute__((unused)) pid_t probe_waitpid(pid_t pid, int *status, int flags) {
    if (!probe_child || pid != probe_child || flags != WNOHANG ||
        atomic_load_explicit(&probe_reaped, memory_order_acquire)) {
        probe_bad(); errno = ECHILD; return -1;
    }
    pid_t rc = waitpid(pid, status, flags); int saved = errno;
    if (rc == probe_child) {
        atomic_store_explicit(&probe_reaped, true, memory_order_release);
        probe_event("target-reap");
        if (WIFEXITED(*status) && WEXITSTATUS(*status) == 2) probe_event("target-exit-2");
    } else if ((rc < 0 && saved != EINTR) || rc > 0) { probe_uncertain = true; probe_bad(); }
    errno = saved; return rc;
}
static __attribute__((unused)) int probe_pipe(int pair[2]) {
    if (probe_fd_count > 4) { probe_bad(); errno = EMFILE; return -1; }
    int rc = pipe(pair), saved = errno;
    if (!rc) {
        probe_fds[probe_fd_count++] = pair[0]; probe_fds[probe_fd_count++] = pair[1];
        probe_event("pipe");
    }
    errno = saved; return rc;
}
static __attribute__((unused)) int probe_close(int fd) {
    for (unsigned i = 0; i < probe_fd_count; i++) if (probe_fds[i] == fd) {
        if (probe_closed[i]++) { probe_bad(); errno = EBADF; return -1; }
        int rc = close(fd), saved = errno;
        if (!rc) probe_event(i == 1 ? "input-close" : "pipe-close");
        errno = saved; return rc;
    }
    probe_bad(); errno = EBADF; return -1;
}
static __attribute__((unused)) ssize_t probe_read(int fd, void *bytes, size_t length) {
    if (probe_fd_count != 6 ||
        !((fd == probe_fds[2] && !probe_closed[2]) || (fd == probe_fds[4] && !probe_closed[4]))) {
        probe_bad(); errno = EBADF; return -1;
    }
    ssize_t rc = read(fd, bytes, length); int saved = errno;
    if (rc == 0 && probe_fd_count == 6) {
        if (fd == probe_fds[2]) probe_event("stdout-eof");
        else if (fd == probe_fds[4]) probe_event("stderr-eof");
    }
    errno = saved; return rc;
}
static __attribute__((unused)) int probe_kill(pid_t pid, int signal) {
    if (!probe_child || pid != probe_child || probe_uncertain || probe_observed_dead ||
        atomic_load_explicit(&probe_reaped, memory_order_acquire) ||
        (signal != SIGTERM && signal != SIGKILL)) {
        probe_bad(); probe_event("after-reap-target-call"); errno = ESRCH; return -1;
    }
    int rc = kill(pid, signal), saved = errno;
    if (!rc) probe_event(signal == SIGTERM ? "signal-term" : "signal-kill");
    errno = saved; return rc;
}
static void probe_finish(void) {
    // Never manufacture settlement by exiting an actually unjoined owner.
    if ((probe_created && !probe_joined) || (probe_child &&
        !atomic_load_explicit(&probe_reaped, memory_order_acquire))) {
        const struct timespec pause = {0, 50000000};
        for (;;) (void)nanosleep(&pause, NULL);
    }
    FILE *trace = fopen("native-trace", "wx");
    if (!trace) { (void)fputs("TASK6A_TEST_TRACE_FAILED\n", stderr); return; }
    int failed = 0;
    unsigned count = atomic_load_explicit(&probe_event_count, memory_order_acquire);
    if (count > 128 || atomic_load_explicit(&probe_overflow, memory_order_acquire)) {
        if (fputs("trace-overflow\n", trace) == EOF) failed = 1;
    }
    if (atomic_load_explicit(&probe_fault, memory_order_acquire)) {
        if (fputs("sticky-harness-fault\n", trace) == EOF) failed = 1;
    }
    for (unsigned i = 0; i < count && i < 128; i++) {
        const char *event = atomic_load_explicit(&probe_events[i], memory_order_acquire);
        if (fprintf(trace, "%s\n", event ? event : "trace-unpublished") < 0) failed = 1;
    }
    if (fclose(trace) != 0) failed = 1;
    if (failed) (void)fputs("TASK6A_TEST_TRACE_FAILED\n", stderr);
}
static __attribute__((constructor)) void probe_initialize(void) {
    if (atexit(probe_finish) != 0) abort();
}
#define pthread_create probe_create
#define pthread_join probe_join
#define task_for_pid probe_request
#define posix_spawn probe_spawn
#define waitid probe_waitid
#define waitpid probe_waitpid
#define pipe probe_pipe
#define close probe_close
#define read probe_read
#define kill probe_kill
`;

function instrumentLifecycle(original, control) {
  assert.ok(CONTROLS.includes(control));
  if (control === 'none') return original;
  let body = original.toString();
  if (control === 'delayed-no-consume-gate') {
    // Deliberately break only status consumption, not the main exit predicate.
    // The fake request performs no PID operation after its finite delay.
    const guard = 'if (!o->born || o->reaped || o->child_uncertain || !can_consume_target_status(o)) return;';
    assert.equal(body.split(guard).length, 2, 'unique consumption mutation anchor');
    body = body.replace(guard, 'if (!o->born || o->reaped || o->child_uncertain) return;');
  }
  const postJoin = ['post-join-budget', 'post-join-no-budget-gate'].includes(control);
  if (postJoin) {
    const join = 'int rc = pthread_join(o->request_thread, NULL);';
    assert.equal(body.split(join).length, 2, 'unique original join capture');
    body = body.replace(join, 'probe_join_deadline = o->deadline;\n' +
      '    probe_join_was_unburned = !o->burned;\n    ' + join);
  }
  if (control === 'post-join-no-budget-gate') {
    const check = 'int timely = on_time(o);';
    assert.equal(body.split(check).length, 2, 'unique post-join budget mutation anchor');
    body = body.replace(check, 'int timely = !o->burned;');
  }
  let pureMain = '';
  if (control === 'join-eligibility') {
    pureMain = String.raw`
#undef main
int main(void) {
    struct owner owner = {0};
    bool no_thread = can_consume_target_status(&owner);
    owner.thread_created = true;
    bool unjoined = can_consume_target_status(&owner);
    owner.thread_joined = true;
    bool joined = can_consume_target_status(&owner);
    return printf("[%s,%s,%s]\n", no_thread ? "true" : "false",
        unjoined ? "true" : "false", joined ? "true" : "false") < 0 ? 2 : 0;
}
`;
  }
  if (control === 'burn-before-admission') {
    pureMain = String.raw`
#undef main
int main(void) {
    struct owner owner = {0};
    atomic_init(&owner.request.admission, READY);
    atomic_init(&owner.request.done, false);
    uint64_t start = now_ns();
    if (!start || start > UINT64_MAX - UINT64_C(3000000000)) return 2;
    owner.request.deadline_ns = start + UINT64_C(3000000000);
    burn_request(&owner);
    (void)request_task_port(&owner.request);
    return printf("[%s,%s,%d,%s,%s,%s]\n", owner.request.attempted ? "true" : "false",
        atomic_load_explicit(&owner.request.done, memory_order_acquire) ? "true" : "false",
        owner.request.unavailable_reason,
        atomic_load_explicit(&owner.request.admission, memory_order_acquire) == BURNED ? "true" : "false",
        owner.request.returned == MACH_PORT_NULL ? "true" : "false",
        owner.request.status == KERN_FAILURE ? "true" : "false") < 0 ? 2 : 0;
}
`;
  }
  if (pureMain) body = '#define main taskport_production_main\n' + body + pureMain;
  const delayed = ['delayed-synthetic-failure', 'delayed-no-consume-gate'].includes(control);
  return Buffer.from(LIFECYCLE_PREFIX.replaceAll('PROBE_DELAYED', delayed ? '1' : '0')
    .replaceAll('PROBE_CREATE_FAILED', control === 'create-failure' ? '1' : '0')
    .replaceAll('PROBE_JOIN_DELAYED', postJoin ? '1' : '0') + '\n' + body);
}

function sameStat(a, b) {
  return ['dev', 'ino', 'uid', 'gid', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
    .every(key => a[key] === b[key]);
}

function checkSystemDirectory(filename, expectedInode) {
  let current = '';
  for (const part of filename.split('/').filter(Boolean)) {
    current += '/' + part;
    const stat = fs.lstatSync(current, {bigint: true});
    assert.ok(stat.isDirectory(), 'physical directory: ' + current);
    assert.equal(stat.uid, 0n);
    assert.equal(stat.gid, 0n);
    assert.equal(stat.mode & 0o022n, 0n);
    if (current === filename && expectedInode) assert.equal(stat.ino, BigInt(expectedInode));
  }
}

function holdRegular(filename, expectedHash, expectedUid) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const initial = fs.fstatSync(fd, {bigint: true});
    assert.ok(initial.isFile());
    assert.equal(initial.nlink, 1n);
    assert.equal(initial.uid, BigInt(expectedUid));
    assert.equal(initial.mode & 0o022n, 0n);
    const bytes = fs.readFileSync(fd);
    assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
    assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
    if (expectedHash) assert.equal(sha256(bytes), expectedHash);
    return {
      bytes,
      check() {
        assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
        assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
        const final = Buffer.alloc(bytes.length);
        let offset = 0;
        while (offset < final.length) {
          const count = fs.readSync(fd, final, offset, final.length - offset, offset);
          assert.ok(count > 0);
          offset += count;
        }
        assert.deepEqual(final, bytes);
        assert.ok(sameStat(initial, fs.fstatSync(fd, {bigint: true})));
        assert.ok(sameStat(initial, fs.lstatSync(filename, {bigint: true})));
      },
      close() { fs.closeSync(fd); },
    };
  } catch (error) {
    try { fs.closeSync(fd); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'read and close failed'); }
    throw error;
  }
}

function entryStarted(directory, held) {
  try {
    held.push(holdRegular(directory + '/entry-started', sha256('entry started\n'), 501));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function checkPrivateDirectory(filename, initial) {
  const actual = fs.lstatSync(filename, {bigint: true});
  assert.ok(actual.isDirectory());
  assert.equal(actual.uid, 501n);
  assert.equal(actual.gid, 0n);
  assert.equal(actual.mode & 0o777n, 0o700n);
  if (initial) {
    assert.equal(actual.dev, initial.dev);
    assert.equal(actual.ino, initial.ino);
  }
  return actual;
}

// All original exit/close/error listeners precede stream handling. Drain to
// natural close; never kill an uncertain compiler/child or synthesize closure.
function settled(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd, env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TMPDIR: cwd},
      stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    const stdout = [], stderr = [], failures = [];
    let total = 0, overflow = false, missingStream = false, exit = null;
    let stdoutEnded = false, stderrEnded = false;
    child.on('error', error => { failures.push(error); });
    child.on('exit', (code, signal) => { exit = {code, signal}; });
    child.on('close', (code, signal) => {
      if (missingStream) failures.push(new Error('owned child output stream missing'));
      if (failures.length) return reject(new AggregateError(failures, 'owned child failed after close'));
      try {
        assert.ok(!overflow, 'output overflow after definite close');
        assert.deepEqual(exit, {code, signal});
        assert.equal(signal, null);
        assert.ok(stdoutEnded && stderrEnded, 'both output EOF required');
        resolve({code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString()});
      } catch (error) { reject(error); }
    });
    for (const [stream, chunks, isStdout] of [[child.stdout, stdout, true], [child.stderr, stderr, false]]) {
      if (!stream) { missingStream = true; continue; }
      try {
        stream.on('error', error => { failures.push(error); });
        stream.on('end', () => {
          if (isStdout) stdoutEnded = true;
          else stderrEnded = true;
        });
        stream.on('data', bytes => {
          try {
            total += bytes.length;
            if (total <= 1_048_576) chunks.push(bytes);
            else overflow = true;
          } catch (error) { failures.push(error); }
        });
      } catch (error) { failures.push(error); }
    }
  });
}

async function invokeOwnedTaskPortProbe(args, stage = 'execute', fixture = 'delivered', control = 'none') {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === 'unexpected'));
  assert.equal(stage, 'execute');
  assert.ok(['delivered', 'early-exit'].includes(fixture));
  assert.ok(CONTROLS.includes(control));
  assert.equal(fixture === 'early-exit', control === 'early-target-exit');
  if (args.length) assert.equal(control, 'none');
  else assert.notEqual(control, 'none');
  const held = [], directories = [], symlinks = [];
  let atomicHeaderAbsent = false;
  let primary = null;
  try {
    held.push(holdRegular(fileURLToPath(SOURCE), null, 501));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      availability: 'source-unavailable', code: null,
      stdout: '', stderr: '', entryStarted: null,
    };
  }
  try {
    assert.equal(process.platform, 'darwin');
    assert.equal(process.getuid(), 501);
    assert.equal(process.geteuid(), 501);
    held.push(holdRegular(fileURLToPath(import.meta.url), null, 501));
    held.push(holdRegular(CLANG, 'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d', 0));
    held.push(holdRegular(LD, '28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d', 0));
    held.push(holdRegular(NODE, '59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553', 501));
    checkSystemDirectory('/Library/Developer/CommandLineTools/usr/bin');
    checkSystemDirectory(SDK, 14162438);
    checkSystemDirectory(RESOURCE, 6714331);
    for (const directory of [SDK + '/usr/include', RESOURCE + '/include', SDK + '/usr/lib'])
      checkSystemDirectory(directory);
    const settings = holdRegular(SDK + '/SDKSettings.json',
      'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe', 0);
    held.push(settings);
    assert.equal(JSON.parse(settings.bytes).CanonicalName, 'macosx26.5');
    assert.equal(JSON.parse(settings.bytes).MinimalDisplayName, '26.5');
    held.push(holdRegular(SDK + '/usr/lib/libSystem.B.tbd',
      '20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57', 0));
    if (control !== 'none') {
      const path = SDK + '/usr/include/pthread.h';
      const stat = fs.lstatSync(path, {bigint: true});
      assert.ok(stat.isSymbolicLink());
      assert.equal(stat.uid, 0n); assert.equal(stat.gid, 0n); assert.equal(stat.nlink, 1n);
      assert.equal(fs.readlinkSync(path), 'pthread/pthread.h');
      assert.equal(fs.realpathSync(path), SDK + '/usr/include/pthread/pthread.h');
      symlinks.push({path, stat});
      checkSystemDirectory(SDK + '/usr/include/pthread');
      held.push(holdRegular(SDK + '/usr/include/pthread/pthread.h',
        '9d621c730d1d96b600893b0e3e4c45822a24d565e7b6b166973c41a6a2eb02e7', 0));
      held.push(holdRegular(SDK + '/usr/include/sys/wait.h',
        'b77f7dd6f592eba8b0d51c15c7b975472fdad50c12ea296f74f062cbf98dcbf7', 0));
      held.push(holdRegular(RESOURCE + '/include/stdatomic.h',
        '728b690f127fc85faa32b9031e3a0019da92f77db92ca91b749571e45617a9ea', 0));
      // Prevent include_next from selecting an unreviewed SDK atomic header.
      assert.throws(() => fs.lstatSync(SDK + '/usr/include/stdatomic.h'), {code: 'ENOENT'});
      atomicHeaderAbsent = true;
    }
    let deliveredEntry = null;
    if (args.length === 0) {
      deliveredEntry = holdRegular(fileURLToPath(DELIVERED_ENTRY),
        'bbcf752ef274b04c2b8bb99434d0a738de0b3aa9ce8c85aa0476eec4351560b7', 501);
      held.push(deliveredEntry);
    }
    const directory = fs.mkdtempSync('/private/tmp/setfarm-native-task-port-test.');
    fs.chmodSync(directory, 0o700);
    directories.push({path: directory, stat: checkPrivateDirectory(directory)});
    const source = directory + '/task6a-origin-native-task-port-v2.c';
    const object = directory + '/probe.o', binary = directory + '/probe';
    const fixtureEntry = directory + '/task6a-protected-origin-entry-v2.mjs';
    const compiledBytes = instrumentLifecycle(held[0].bytes, control);
    const entryBytes = fixture === 'early-exit' ? Buffer.from(EARLY_EXIT_ENTRY)
      : deliveredEntry ? deliveredEntry.bytes : Buffer.from(ENTRY);
    fs.writeFileSync(source, compiledBytes, {flag: 'wx', mode: 0o600});
    fs.writeFileSync(fixtureEntry, entryBytes, {flag: 'wx', mode: 0o600});
    held.push(holdRegular(source, sha256(compiledBytes), 501));
    held.push(holdRegular(fixtureEntry, sha256(entryBytes), 501));
    const compile = await settled(CLANG, [
      '--no-default-config', '--target=arm64-apple-macos26.5',
      '-resource-dir', RESOURCE, '-isysroot', SDK, '-integrated-as',
      '-nostdinc', '-isystem', RESOURCE + '/include', '-isystem', SDK + '/usr/include',
      '-fno-modules', '-fno-lto', '-std=c11', '-O0', '-Wall', '-Wextra', '-Werror',
      '-c', source, '-o', object,
    ], directory);
    assert.deepEqual(compile, {code: 0, stdout: '', stderr: ''});
    const objectInput = holdRegular(object, null, 501);
    held.push(objectInput);
    const calibration = fs.mkdtempSync('/private/tmp/setfarm-native-task-port-witness.');
    fs.chmodSync(calibration, 0o700);
    directories.push({path: calibration, stat: checkPrivateDirectory(calibration)});
    const calibrationEntry = calibration + '/task6a-protected-origin-entry-v2.mjs';
    fs.writeFileSync(calibrationEntry, ENTRY, {flag: 'wx', mode: 0o600});
    held.push(holdRegular(calibrationEntry, sha256(ENTRY), 501));
    const observed = await settled(NODE, [calibrationEntry], calibration);
    assert.deepEqual(observed, {code: 2, stdout: '', stderr: ''});
    assert.equal(entryStarted(calibration, held), true, 'startup witness must actually work');
    const link = await settled(CLANG, [
      '--no-default-config', '--target=arm64-apple-macos26.5',
      '-resource-dir', RESOURCE, '-isysroot', SDK, '--ld-path=' + LD,
      '-fno-lto', '-nostdlib', '-Wl,-Z', '-Wl,-syslibroot,' + SDK,
      object, SDK + '/usr/lib/libSystem.B.tbd', '-o', binary,
    ], directory);
    assert.deepEqual(link, {code: 0, stdout: '', stderr: ''});
    const binaryInput = holdRegular(binary, null, 501);
    held.push(binaryInput);
    const actual = await settled(binary, args, directory);
    let trace = null;
    if (control !== 'none') {
      const traceInput = holdRegular(directory + '/native-trace', null, 501);
      held.push(traceInput);
      assert.ok(traceInput.bytes.length <= 8192);
      trace = traceInput.bytes.toString();
    }
    return {
      ...actual, trace, availability: 'executed-ordinary',
      entryStarted: args.length ? entryStarted(directory, held) : null,
      evidence: {
        directory, calibration, sourceHash: sha256(held[0].bytes),
        objectHash: sha256(objectInput.bytes), binaryHash: sha256(binaryInput.bytes),
        compiledSourceHash: sha256(compiledBytes), instrumented: control !== 'none', control,
        entryHash: sha256(entryBytes), compilerExit: compile.code, linkerExit: link.code,
        witnessExit: observed.code, definiteExitCloseAndBothEof: true,
        actualExitCode: actual.code, actualStdout: actual.stdout, actualStderr: actual.stderr,
        entryKind: fixture === 'early-exit' ? 'early-exit-builtin-test'
          : deliveredEntry ? 'exact-delivered-builtin' : 'startup-witness',
        ...(trace === null ? {} : {trace, traceHash: sha256(trace)}),
        productionAuthority: false, controlUsable: false,
        completeNativeClosure: false, protectedOrigin: false,
      },
    };
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    // Retain original fresh artifacts on every outcome; check all, close all.
    const errors = [];
    for (const link of symlinks) {
      try {
        assert.ok(sameStat(link.stat, fs.lstatSync(link.path, {bigint: true})));
        assert.equal(fs.readlinkSync(link.path), 'pthread/pthread.h');
        assert.equal(fs.realpathSync(link.path), SDK + '/usr/include/pthread/pthread.h');
      } catch (error) { errors.push(error); }
    }
    if (atomicHeaderAbsent) {
      try { assert.throws(() => fs.lstatSync(SDK + '/usr/include/stdatomic.h'), {code: 'ENOENT'}); }
      catch (error) { errors.push(error); }
    }
    for (const directory of directories) {
      try { checkPrivateDirectory(directory.path, directory.stat); }
      catch (error) { errors.push(error); }
    }
    for (const [directory, inode] of [[SDK, 14162438], [RESOURCE, 6714331]]) {
      try { checkSystemDirectory(directory, inode); }
      catch (error) { errors.push(error); }
    }
    for (const item of held) {
      try { item.check(); } catch (error) { errors.push(error); }
    }
    for (const item of held.reverse()) {
      try { item.close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(primary ? [primary, ...errors] : errors,
      'original input/output custody failed');
  }
}

// Catches acceptance of a public argument or entry startup before refusal.
// Missing-source assertion is support RED, not a kernel/capability witness.
test('ordinary native task-port parent refuses an extra argument before entry start',
  {skip: !REFUSAL_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe(['unexpected']);
  t.diagnostic('actual support: ' + actual.availability);
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 2, 'actual support: ' + actual.availability);
  assert.equal(actual.stdout, '');
  assert.ok(!actual.stderr.includes('TASK6A_TEST_TRACE_FAILED'), 'trace output failed');
  assert.equal(actual.stderr, 'TASK6A_NATIVE_TASK_PORT_PROBE_REFUSED\n');
  assert.equal(actual.entryStarted, false);
});

function assertLifecycle(actual, delayed) {
  const events = actual.trace.trim().split('\n').filter(Boolean);
  const count = name => events.filter(event => event === name).length;
  const event = name => {
    assert.ok(events.includes(name), 'missing actual lifecycle event: ' + name);
    return events.indexOf(name);
  };
  assert.equal(actual.code, 2);
  assert.equal(actual.stdout, '');
  assert.ok(!actual.stderr.includes('TASK6A_TEST_TRACE_FAILED'), 'trace output failed');
  assert.equal(count('target-spawn'), 1);
  assert.equal(count('create-success'), 1);
  assert.equal(count('create-request'), 1);
  assert.equal(count('worker-enter'), 1);
  assert.equal(count('worker-return'), 1);
  assert.equal(count('actual-join-success'), 1);
  assert.equal(count('synthetic-request'), 1);
  assert.equal(count('target-reap'), 1);
  assert.equal(count('after-reap-target-call'), 0);
  assert.equal(count('trace-overflow'), 0);
  assert.equal(count('trace-unpublished'), 0);
  assert.equal(count('delay-failed'), 0);
  assert.equal(count('harness-fault'), 0);
  assert.equal(count('sticky-harness-fault'), 0);
  assert.equal(count('stdout-eof'), 1);
  assert.equal(count('stderr-eof'), 1);
  assert.equal(count('input-close'), 1);
  assert.equal(count('pipe-close'), 5);
  if (delayed) assert.ok(event('target-dead-observed') < event('actual-join-success'));
  assert.ok(event('create-request') < event('worker-enter'));
  assert.ok(event('worker-return') < event('actual-join-success'));
  assert.ok(event('actual-join-success') < event('target-reap'),
    'actual join must precede target reap');
}

// Catches allowing a created but unjoined owner to consume target status.
// Pure predicate coverage only: production main and thread/spawn never run.
test('ordinary task-port consumption eligibility requires settled request',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'join-eligibility');
  t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 0);
  assert.equal(actual.stdout, '[true,false,true]\n');
  assert.deepEqual(JSON.parse(actual.stdout), [true, false, true]);
  assert.equal(actual.stderr, '');
  assert.equal(actual.trace, '');
});

// Actual early waitpid consumption must fail the same normal ordering oracle.
// Independent lifecycle/fault facts are checked before its precise rejection.
test('ordinary task-port oracle rejects early reap in delayed consumption mutant',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'delayed-no-consume-gate');
  t.diagnostic(JSON.stringify(actual.evidence));
  assert.throws(() => assertLifecycle(actual, true),
    {code: 'ERR_ASSERTION', message: /actual join must precede target reap/});
});

function assertNoRequestLifecycle(actual, createFailure) {
  const events = actual.trace.trim().split('\n').filter(Boolean);
  const count = name => events.filter(event => event === name).length;
  assert.equal(actual.code, 2);
  assert.equal(actual.stdout, '');
  assert.ok(!actual.stderr.includes('TASK6A_TEST_TRACE_FAILED'));
  assert.ok(!actual.stderr.includes('TASK6A_NATIVE_TASK_PORT_PROBE_FAILURE_RECORD_OVERFLOW'));
  for (const name of ['target-spawn', 'target-reap', 'stdout-eof', 'stderr-eof',
    'input-close', 'target-exit-2']) assert.equal(count(name), 1, name);
  assert.equal(count('pipe'), 3);
  assert.equal(count('pipe-close'), 5);
  assert.equal(count('create-request'), createFailure ? 1 : 0);
  assert.equal(count('create-synthetic-failure'), createFailure ? 1 : 0);
  for (const name of ['create-success', 'worker-enter', 'worker-return',
    'synthetic-request', 'actual-join-success', 'after-reap-target-call',
    'trace-overflow', 'trace-unpublished', 'delay-failed', 'harness-fault',
    'sticky-harness-fault']) assert.equal(count(name), 0, name);
}

// Catches waiting for a nonexistent thread or skipping no-thread child cleanup.
test('ordinary task-port owner settles target after nominated create failure',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'create-failure');
  t.diagnostic(JSON.stringify(actual.evidence));
  assertNoRequestLifecycle(actual, true);
  assert.match(actual.stderr, /^TASK6A_NATIVE_TASK_PORT_PROBE_FAILED request-create /m);
});

// Catches admitting the actual worker after sequential READY-to-BURNED transition.
// No thread/race/target is created; this is not concurrent arbitration evidence.
test('ordinary task-port worker refuses admission after prior burn',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'burn-before-admission');
  t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 0);
  assert.equal(actual.stdout, '[false,true,3,true,true,true]\n');
  assert.equal(actual.stderr, '');
  assert.equal(actual.trace, '');
});

// Catches creating a request after actual EOF/death before READY.
test('ordinary task-port owner refuses early target exit before request creation',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'early-exit', 'early-target-exit');
  t.diagnostic(JSON.stringify(actual.evidence));
  assertNoRequestLifecycle(actual, false);
  assert.match(actual.stderr, /^TASK6A_NATIVE_TASK_PORT_PROBE_FAILED (ready-eof|early-child-exit) /m);
  assert.equal(actual.evidence.entryKind, 'early-exit-builtin-test');
});

function assertPostJoinExpiry(actual) {
  assertLifecycle(actual, false);
  const events = actual.trace.trim().split('\n');
  for (const name of ['pre-join-within-budget', 'join-delay-complete', 'join-return-after-budget'])
    assert.equal(events.filter(event => event === name).length, 1, name);
  const order = ['pre-join-within-budget', 'actual-join-success', 'join-delay-complete',
    'join-return-after-budget', 'input-close', 'target-reap'];
  for (let i = 1; i < order.length; i++)
    assert.ok(events.indexOf(order[i - 1]) < events.indexOf(order[i]), order[i]);
  assert.match(actual.stderr, /^TASK6A_NATIVE_TASK_PORT_PROBE_FAILED request-burned /m,
    'post-join expiry must burn request result');
  assert.doesNotMatch(actual.stderr,
    /^TASK6A_NATIVE_TASK_PORT_PROBE_FAILED (request-unavailable|task-port-denied|invalid-task-port|task-port-unqualified) /m);
}

// Catches using a pre-join time sample to classify a result returned after expiry.
test('ordinary task-port owner burns result after physical join crosses deadline',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'post-join-budget');
  t.diagnostic(JSON.stringify(actual.evidence));
  assertPostJoinExpiry(actual);
});

test('ordinary task-port oracle rejects omitted post-join budget check',
  {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', 'post-join-no-budget-gate');
  t.diagnostic(JSON.stringify(actual.evidence));
  assert.match(actual.stderr, /^TASK6A_NATIVE_TASK_PORT_PROBE_FAILED task-port-denied /m);
  assert.throws(() => assertPostJoinExpiry(actual),
    {code: 'ERR_ASSERTION', message: /post-join expiry must burn request result/});
});

for (const [control, delayed] of [['synthetic-failure', false], ['delayed-synthetic-failure', true]]) {
  // Catches missing owner lifecycle or consuming child status before real join.
  // Synthetic failure is never kernel acquisition or capability-denial evidence.
  test('ordinary task-port owner joins before reap under ' + control,
    {skip: !LIFECYCLE_TEST_ENABLED}, async t => {
    const actual = await invokeOwnedTaskPortProbe([], 'execute', 'delivered', control);
    t.diagnostic(JSON.stringify(actual.evidence));
    assertLifecycle(actual, delayed);
  });
}
