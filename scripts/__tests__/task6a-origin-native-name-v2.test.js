import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const SOURCE = new URL('../task6a-origin-native-name-v2.c', import.meta.url);
const DELIVERED_ENTRY = new URL('../task6a-protected-origin-entry-v2.mjs', import.meta.url);
// Explicit test-only opt-in. The normal script-test glob must not invoke CLT or
// host-specific native programs; this flag never reaches any spawned program.
const NATIVE_TEST_ENABLED = process.env.SETFARM_TASK6A_NATIVE_NAME_TEST === '1';
const COMPILE_TEST_ENABLED = process.env.SETFARM_TASK6A_NATIVE_NAME_TEST === 'compile';
const CLANG = '/Library/Developer/CommandLineTools/usr/bin/clang';
const LD = '/Library/Developer/CommandLineTools/usr/bin/ld';
const NODE = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const SDK = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const RESOURCE = '/Library/Developer/CommandLineTools/usr/lib/clang/21';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ENTRY = "import {writeFileSync} from 'node:fs';\n" +
  "writeFileSync(new URL('./entry-started', import.meta.url), 'entry started\\n', {flag:'wx',mode:0o600});\n" +
  "process.exit(2);\n";

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

function entryStarted(directory, held) {
  try {
    held.push(holdRegular(directory + '/entry-started', sha256('entry started\n'), 501));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function sameStat(a, b) {
  return ['dev', 'ino', 'uid', 'gid', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']
    .every(key => a[key] === b[key]);
}

// Closed ordinary test-copy mutations; never edits the delivered entry itself.
function fixtureBytes(original, fixture) {
  const variants = {
    delivered: null,
    'wrong-ready': ["write('READY\\n');", "write('WRONG\\n');"],
    'quiet-wrong-ready': ["write('READY\\n');", "write('WRONG\\n');"],
    'wrong-pong': [
      'seen.add(match[1]);write(`PONG ${match[1]}\\n`);',
      "seen.add(match[1]);const reply=(match[1][0]==='0'?'1':'0')+match[1].slice(1);write(`PONG ${reply}\\n`);",
    ],
    stderr: ["write('READY\\n');", "process.stderr.write('Q');write('READY\\n');"],
    deadline: ["write('READY\\n');", '/* owned test copy suppresses READY */'],
    'partial-ready': ["write('READY\\n');", "writeSync(1,'READ');closeSync(1);"],
    'malformed-end': ["process.stdout.end('END\\n',error=>{", "process.stdout.end('ENX\\n',error=>{"],
    'excess-output': ["process.stdout.end('END\\n',error=>{", "process.stdout.end('END\\nX',error=>{"],
    'nonzero-exit': ['process.exit(0);', 'process.exit(7);'],
    'cleanup-escalation': ["process.stdin.on('end',()=>{", "process.stdin.on('end',()=>{return;"],
  };
  assert.ok(Object.hasOwn(variants, fixture));
  if (fixture === 'delivered') return original;
  const [before, after] = variants[fixture];
  const text = original.toString();
  assert.equal(text.split(before).length, 2, 'unique owned fixture anchor');
  let changed = text.replace(before, after);
  if (fixture === 'partial-ready') {
    changed = "import {writeSync,closeSync} from 'node:fs';\n" + changed;
  }
  if (fixture === 'quiet-wrong-ready') {
    const refuseStderr = "  process.stderr.write('TASK6A_ORIGIN_ENTRY_REFUSED\\n');";
    assert.equal(changed.split(refuseStderr).length, 2);
    changed = changed.replace(refuseStderr, '  /* quiet owned refusal fixture */');
  }
  if (fixture === 'cleanup-escalation') {
    const ready = "write('READY\\n');";
    assert.equal(changed.split(ready).length, 2);
    changed = changed.replace(ready, "process.on('SIGTERM',()=>{});write('READY\\n');");
  }
  return Buffer.from(changed);
}

// Test-copy instrumentation only. Real calls occur before macro redirection;
// no DYLD hooks, caller selectors or production callbacks are introduced.
// A matching *actual* waitpid reap is latched before the source sees status.
const TRACE_PREFIX = String.raw`
static const char *probe_events[64];
static size_t probe_event_count;
static int probe_fault, probe_uncertain, probe_reaped, probe_disposed;
static pid_t probe_child;
static mach_port_name_t probe_name;
static int probe_fds[6], probe_closed[6];
static size_t probe_fd_count;

static void probe_event(const char *event) {
    int saved = errno;
    if (probe_event_count < 64) probe_events[probe_event_count++] = event;
    else probe_fault = 1;
    errno = saved;
}
static void probe_bad(void) { probe_fault = 1; probe_event("fault"); }
static int probe_pipe(int pair[2]) {
    int rc = pipe(pair), saved = errno;
    if (rc == 0 && probe_fd_count <= 4) {
        probe_fds[probe_fd_count++] = pair[0];
        probe_fds[probe_fd_count++] = pair[1];
        probe_event("pipe");
    } else probe_bad();
    errno = saved; return rc;
}
static int probe_close(int fd) {
    for (size_t i = 0; i < probe_fd_count; i++) if (probe_fds[i] == fd) {
        if (probe_closed[i]) { probe_bad(); errno = EBADF; return -1; }
        probe_closed[i] = 1;
        int rc = close(fd), saved = errno;
        if (rc == 0) probe_event("close"); else probe_bad();
        errno = saved; return rc;
    }
    probe_bad(); errno = EBADF; return -1;
}
static int probe_spawn(pid_t *pid, const char *path,
    const posix_spawn_file_actions_t *actions, const posix_spawnattr_t *attrs,
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
    int rc = posix_spawn(pid, path, actions, attrs, argv, env), saved = errno;
    if (!rc && *pid > 1) { probe_child = *pid; probe_event("spawn"); }
    else probe_bad();
    errno = saved; return rc;
}
static pid_t probe_wait(pid_t pid, int *status, int options) {
    if (pid != probe_child || !probe_child || probe_reaped || probe_uncertain ||
        options != WNOHANG) { probe_bad(); errno = ECHILD; return -1; }
    pid_t result = waitpid(pid, status, options); int saved = errno;
    if (result == probe_child) { probe_reaped = 1; probe_event("reap"); }
    else if ((result < 0 && saved != EINTR) || (result > 0)) {
        probe_uncertain = 1; probe_bad();
    }
    errno = saved; return result;
}
static int probe_kill(pid_t pid, int signal) {
    if (probe_reaped) {
        probe_event("blocked-kill"); errno = ESRCH; return -1;
    }
    if (probe_uncertain || !probe_child || pid != probe_child ||
        (signal != SIGTERM && signal != SIGKILL)) {
        probe_bad(); errno = ESRCH; return -1;
    }
    int rc = kill(pid, signal), saved = errno;
    probe_event("signal"); errno = saved; return rc;
}
static kern_return_t probe_name_for_pid(mach_port_name_t self, int pid,
    mach_port_name_t *name) {
    if (probe_reaped) { probe_event("blocked-name"); return KERN_INVALID_ARGUMENT; }
    if (probe_uncertain || !probe_child || probe_name || pid != probe_child ||
        self != mach_task_self()) { probe_bad(); return KERN_INVALID_ARGUMENT; }
    kern_return_t rc = task_name_for_pid(self, pid, name); int saved = errno;
    if (rc == KERN_SUCCESS && MACH_PORT_VALID(*name)) {
        probe_name = *name; probe_event("name");
    } else probe_bad();
    errno = saved; return rc;
}
static int probe_live_right(mach_port_name_t name) {
    if (probe_uncertain || !probe_child || !MACH_PORT_VALID(probe_name) ||
        probe_disposed || name != probe_name) { probe_bad(); return 0; }
    return 1;
}
static kern_return_t probe_type(ipc_space_t self, mach_port_name_t name,
    mach_port_type_t *type) {
    if (probe_reaped) { probe_event("blocked-type"); return KERN_INVALID_ARGUMENT; }
    if (!probe_live_right(name) || self != mach_task_self()) {
        probe_bad(); return KERN_INVALID_ARGUMENT;
    }
    kern_return_t rc = mach_port_type(self, name, type); int saved = errno;
    probe_event("type"); errno = saved; return rc;
}
static kern_return_t probe_pid(mach_port_name_t name, int *pid) {
    if (probe_reaped) { probe_event("blocked-pid"); return KERN_INVALID_ARGUMENT; }
    if (!probe_live_right(name)) return KERN_INVALID_ARGUMENT;
    kern_return_t rc = pid_for_task(name, pid); int saved = errno;
    probe_event("pid"); errno = saved; return rc;
}
static kern_return_t probe_info(task_name_t name, task_flavor_t flavor,
    task_info_t info, mach_msg_type_number_t *count) {
    // Check independent reap BEFORE inspecting a now-disposed right or count.
    if (probe_reaped) { probe_event("blocked-audit"); return KERN_INVALID_ARGUMENT; }
    if (!probe_live_right(name) || flavor != TASK_AUDIT_TOKEN ||
        *count != TASK_AUDIT_TOKEN_COUNT) { probe_bad(); return KERN_INVALID_ARGUMENT; }
    kern_return_t rc = task_info(name, flavor, info, count); int saved = errno;
    probe_event("audit"); errno = saved; return rc;
}
static kern_return_t probe_dispose(ipc_space_t self, mach_port_name_t name) {
    if (self != mach_task_self() || !MACH_PORT_VALID(probe_name) ||
        name != probe_name || probe_disposed) { probe_bad(); return KERN_INVALID_ARGUMENT; }
    probe_disposed = 1;
    kern_return_t rc = mach_port_deallocate(self, name); int saved = errno;
    if (rc == KERN_SUCCESS) probe_event("dispose"); else probe_bad();
    errno = saved; return rc;
}
static int probe_finish_trace(void) {
    char path[PATH_MAX]; const char *compiled_source = __FILE__;
    const char *slash = strrchr(compiled_source, '/');
    const char suffix[] = "/native-trace";
    if (!slash || (size_t)(slash - compiled_source) + sizeof suffix > sizeof path) return 0;
    size_t length = (size_t)(slash - compiled_source);
    memcpy(path, compiled_source, length); memcpy(path + length, suffix, sizeof suffix);
    // Open only after settlement; this FD never enters the protocol or child.
    int fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (fd < 0) return 0;
    int okay = !probe_fault;
    for (size_t i = 0; i < probe_event_count; i++) {
        const char *event = probe_events[i]; size_t left = strlen(event);
        while (left) {
            ssize_t wrote = write(fd, event, left);
            if (wrote > 0) { event += wrote; left -= (size_t)wrote; }
            else if (wrote < 0 && errno == EINTR) continue;
            else { okay = 0; break; }
        }
        if (left || write(fd, "\n", 1) != 1) { okay = 0; break; }
    }
    // Exactly one original close attempt, including write failures.
    if (close(fd) != 0) okay = 0;
    return okay;
}
#define pipe probe_pipe
#define close probe_close
#define posix_spawn probe_spawn
#define waitpid probe_wait
#define kill probe_kill
#define task_name_for_pid probe_name_for_pid
#define mach_port_type probe_type
#define pid_for_task probe_pid
#define task_info probe_info
#define mach_port_deallocate probe_dispose
`;

const IO_CONTROLS = ['fragmented', 'partial-ready', 'malformed-end', 'excess-output', 'nonzero-exit', 'cleanup-escalation'];

function instrumentSource(original, control) {
  assert.ok(['none', 'baseline', 'post-reap-kill', 'post-reap-audit',
    'pid-mismatch', 'first-audit-count', 'second-audit-count', 'audit-drift',
    'dispose-response', 'audit-drift-no-compare', 'cleanup-late-reap', ...IO_CONTROLS].includes(control));
  if (control === 'none') return original;
  let source = original.toString();
  const header = '/* Ordinary NAME diagnostic only; never a protected origin or CONTROL owner. */';
  assert.equal(source.split(header).length, 2);
  source = source.replace(header, TRACE_PREFIX + '\n' + header);
  const replaceOnce = (before, after) => {
    assert.equal(source.split(before).length, 2, 'unique owned result-fault anchor');
    source = source.replace(before, after);
  };
  if (IO_CONTROLS.includes(control)) {
    replaceOnce(header, String.raw`
static size_t probe_io_output, probe_io_input, probe_io_reads, probe_io_writes;
static int probe_io_stdout_eof, probe_io_stderr_eof;
static char probe_io_counts[128];
static ssize_t probe_io_read(int fd, void *bytes, size_t length) {
    if (fd != probe_fds[2] && fd != probe_fds[4]) {
        probe_bad(); errno = EBADF; return -1;
    }
    if (PROBE_FRAGMENTED && fd == probe_fds[2] && length > 1) length = 1;
    ssize_t result = read(fd, bytes, length); int saved = errno;
    if (fd == probe_fds[2]) {
        if (result > 0) {
            probe_io_output += (size_t)result; probe_io_reads++;
            if (PROBE_FRAGMENTED && result != 1) probe_bad();
        } else if (result == 0) {
            if (probe_io_stdout_eof++) probe_bad(); else probe_event("stdout-eof");
        }
    } else if (result == 0) {
        if (probe_io_stderr_eof++) probe_bad(); else probe_event("stderr-eof");
    }
    errno = saved; return result;
}
static ssize_t probe_io_write(int fd, const void *bytes, size_t length) {
    if (fd != probe_fds[1]) { probe_bad(); errno = EBADF; return -1; }
    if (PROBE_FRAGMENTED && length > 1) length = 1;
    ssize_t result = write(fd, bytes, length); int saved = errno;
    if (result > 0) {
        probe_io_input += (size_t)result; probe_io_writes++;
        if (PROBE_FRAGMENTED && result != 1) probe_bad();
    }
    errno = saved; return result;
}
#define read probe_io_read
#define write probe_io_write
`.replaceAll('PROBE_FRAGMENTED', control === 'fragmented' ? '1' : '0') + '\n' + header);
    if (control === 'nonzero-exit' || control === 'cleanup-escalation') {
      const statusCheck = control === 'nonzero-exit' ? 'WIFEXITED(*status) && WEXITSTATUS(*status) == 7' :
        'WIFSIGNALED(*status) && WTERMSIG(*status) == SIGKILL';
      const tag = control === 'nonzero-exit' ? 'exit7' : 'sigkill-reap';
      replaceOnce('    if (result == probe_child) { probe_reaped = 1; probe_event("reap"); }',
        '    if (result == probe_child) {\n        probe_reaped = 1; probe_event("reap");\n' +
        `        if (${statusCheck}) probe_event("${tag}"); else probe_bad();\n    }`);
    }
    if (control === 'cleanup-escalation') {
      replaceOnce('    probe_event("signal"); errno = saved; return rc;',
        '    if (rc) probe_bad();\n' +
        '    else probe_event(signal == SIGTERM ? "signal-term" : "signal-kill");\n' +
        '    errno = saved; return rc;');
    }
  }
  if (control === 'cleanup-late-reap') {
    replaceOnce('static const char *probe_events[64];', String.raw`
static int probe_inside_settle, probe_delay_done;
static uint64_t probe_cleanup_start, probe_cleanup_final, probe_protocol_deadline;
static uint64_t probe_tick(void) {
    struct timespec tick;
    if (clock_gettime(CLOCK_MONOTONIC, &tick) != 0) return 0;
    return (uint64_t)tick.tv_sec * UINT64_C(1000000000) + (uint64_t)tick.tv_nsec;
}
static const char *probe_events[64];`);
    replaceOnce('    if (result == probe_child) { probe_reaped = 1; probe_event("reap"); }', String.raw`
    if (result == probe_child) {
        // Genuine reap is latched BEFORE delaying its return to the source.
        probe_reaped = 1; probe_event("reap");
        if (probe_inside_settle && !probe_delay_done) {
            probe_delay_done = 1;
            struct timespec pause = {.tv_sec = 1, .tv_nsec = 500000000};
            int rc;
            do { rc = nanosleep(&pause, &pause); } while (rc < 0 && errno == EINTR);
            uint64_t now = probe_tick();
            if (!rc && probe_cleanup_start && now > probe_cleanup_final &&
                now < probe_protocol_deadline) probe_event("cleanup-late-reap");
            else probe_bad();
        } else probe_bad();
    }`);
    replaceOnce('static void settle(struct owner *o) {',
      'static void settle(struct owner *o) {\n' +
      '    probe_inside_settle = 1;');
    replaceOnce('    uint64_t final = term + UINT64_C(1000000000);',
      '    uint64_t final = term + UINT64_C(1000000000);\n' +
      '    probe_cleanup_start = start; probe_cleanup_final = final;');
    replaceOnce('    o.deadline = start + UINT64_C(3000000000);',
      '    o.deadline = start + UINT64_C(3000000000);\n' +
      '    probe_protocol_deadline = o.deadline;');
    replaceOnce(header, String.raw`
static size_t probe_quiet_output;
static int probe_stdout_eof, probe_stderr_eof;
static ssize_t probe_quiet_read(int fd, void *bytes, size_t length) {
    ssize_t result = read(fd, bytes, length); int saved = errno;
    if (fd == probe_fds[2]) {
        if (result > 0) {
            probe_quiet_output += (size_t)result;
            if (probe_inside_settle) probe_bad();
        } else if (result == 0) { probe_stdout_eof = 1; probe_event("stdout-eof"); }
    } else if (fd == probe_fds[4]) {
        if (result > 0) probe_bad();
        else if (result == 0) { probe_stderr_eof = 1; probe_event("stderr-eof"); }
    } else probe_bad();
    errno = saved; return result;
}
#define read probe_quiet_read
` + '\n' + header);
  }
  if (control === 'pid-mismatch') {
    replaceOnce('    probe_event("pid"); errno = saved; return rc;',
      '    probe_event("pid");\n' +
      '    if (rc == KERN_SUCCESS && *pid == probe_child) {\n' +
      '        *pid = -1; probe_event("synthetic-pid-mismatch");\n' +
      '    } else probe_bad();\n    errno = saved; return rc;');
  }
  if (['first-audit-count', 'second-audit-count', 'audit-drift', 'audit-drift-no-compare'].includes(control)) {
    replaceOnce('static size_t probe_event_count;',
      'static size_t probe_event_count;\nstatic unsigned probe_audit_calls;');
    const fault = control === 'audit-drift-no-compare' ? 'audit-drift' : control;
    const call = control === 'first-audit-count' ? 1 : 2;
    const change = fault === 'audit-drift' ? '((unsigned char *)info)[0] ^= 1;' : '(*count)--;';
    replaceOnce('    probe_event("audit"); errno = saved; return rc;',
      '    probe_event("audit");\n' +
      '    if (rc != KERN_SUCCESS || *count != TASK_AUDIT_TOKEN_COUNT) probe_bad();\n' +
      `    else if (++probe_audit_calls == ${call}) {\n` +
      `        ${change} probe_event("synthetic-${fault}");\n` +
      '    }\n    errno = saved; return rc;');
  }
  if (control === 'dispose-response') {
    replaceOnce('    if (rc == KERN_SUCCESS) probe_event("dispose"); else probe_bad();',
      '    if (rc == KERN_SUCCESS) {\n' +
      '        probe_event("dispose"); rc = KERN_FAILURE;\n' +
      '        probe_event("synthetic-dispose-response");\n' +
      '    } else probe_bad();');
  }
  if (control === 'audit-drift-no-compare') {
    replaceOnce('            else if (memcmp(&first, &second, sizeof first) != 0) fail(&o, "audit-drift", 0);',
      '            /* owned semantic mutant omits the audit comparison only */');
  }
  const settle = '    settle(&o);\n';
  assert.equal(source.split(settle).length, 2);
  let injection = control === 'cleanup-late-reap' ?
    '    if (probe_quiet_output != 6 || !probe_stdout_eof || !probe_stderr_eof) probe_bad();\n' :
    control === 'post-reap-kill' ? '    (void)kill(o.child, SIGTERM);\n' :
    control === 'post-reap-audit' ? '    mach_msg_type_number_t mutant_count = TASK_AUDIT_TOKEN_COUNT;\n' +
      '    (void)task_info(o.name, TASK_AUDIT_TOKEN, (task_info_t)&second, &mutant_count);\n' : '';
  if (IO_CONTROLS.includes(control)) {
    const bytes = {'fragmented': 220, 'partial-ready': 4, 'malformed-end': 220,
      'excess-output': 221, 'nonzero-exit': 220, 'cleanup-escalation': 216}[control];
    const input = control === 'partial-ready' ? 0 : 229;
    injection += `    if (probe_io_output != ${bytes} || probe_io_input != ${input} ||\n` +
      '        probe_io_stdout_eof != 1 || probe_io_stderr_eof != 1) probe_bad();\n';
    if (control === 'fragmented') injection +=
      '    if (probe_io_reads != 220 || probe_io_writes != 229) probe_bad();\n';
    injection += '    int trace_count = snprintf(probe_io_counts, sizeof probe_io_counts,\n' +
      '        "io reads=%zu writes=%zu output=%zu input=%zu",\n' +
      '        probe_io_reads, probe_io_writes, probe_io_output, probe_io_input);\n' +
      '    if (trace_count < 0 || (size_t)trace_count >= sizeof probe_io_counts) probe_bad();\n' +
      '    else probe_event(probe_io_counts);\n';
    injection += `    probe_event("${control}-io");\n`;
  }
  return Buffer.from(source.replace(settle, settle + injection +
    '    if (!probe_finish_trace()) { (void)fputs("TASK6A_TEST_TRACE_FAILED\\n", stderr); return 2; }\n'));
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

// Drain all streams and require natural exit AND close. Never auto-kill a PID
// or treat a timer/output limit as proof of compiler or child settlement.
function settled(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TMPDIR: cwd},
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    const stdout = [], stderr = [];
    let total = 0, overflow = false, missingStream = false, exit = null;
    const failures = [];
    let stdoutEnded = false, stderrEnded = false;
    // Install settlement listeners even if spawn failed and streams are absent.
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
    for (const [stream, chunks] of [[child.stdout, stdout], [child.stderr, stderr]]) {
      if (!stream) { missingStream = true; continue; }
      stream.on('data', bytes => {
        total += bytes.length;
        if (total <= 1_048_576) chunks.push(bytes);
        else overflow = true;
      });
      stream.on('error', error => { failures.push(error); });
    }
    if (child.stdout) child.stdout.on('end', () => { stdoutEnded = true; });
    if (child.stderr) child.stderr.on('end', () => { stderrEnded = true; });
  });
}

// Test support only: ordinary compiled bytes, not protected compiler authority.
async function invokeOwnedProbe(args, stage = 'execute', fixture = 'delivered', control = 'none') {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === 'unexpected'));
  assert.ok(stage === 'execute' || stage === 'compile');
  if (args.length) assert.equal(fixture, 'delivered');
  if (control !== 'none') {
    assert.equal(args.length, 0); assert.equal(stage, 'execute');
    const expectedFixture = control === 'cleanup-late-reap' ? 'quiet-wrong-ready' :
      IO_CONTROLS.includes(control) && control !== 'fragmented' ? control : 'delivered';
    assert.equal(fixture, expectedFixture);
  }
  const held = [];
  let directory, rootStat, primary = null;
  try {
    held.push(holdRegular(fileURLToPath(SOURCE), null, 501));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      availability: 'source-unavailable',
      code: null,
      stdout: '',
      stderr: '',
      entryStarted: null,
    };
  }
  try {
    assert.equal(process.platform, 'darwin');
    assert.equal(process.getuid(), 501);
    assert.equal(process.geteuid(), 501);
    held.push(holdRegular(CLANG, 'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d', 0));
    held.push(holdRegular(LD, '28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d', 0));
    held.push(holdRegular(NODE, '59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553', 501));
    checkSystemDirectory('/Library/Developer/CommandLineTools/usr/bin');
    checkSystemDirectory(SDK, 14162438);
    checkSystemDirectory(RESOURCE, 6714331);
    for (const systemDirectory of [SDK + '/usr/include', RESOURCE + '/include', SDK + '/usr/lib'])
      checkSystemDirectory(systemDirectory);
    const settings = holdRegular(SDK + '/SDKSettings.json',
      'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe', 0);
    held.push(settings);
    assert.equal(JSON.parse(settings.bytes).CanonicalName, 'macosx26.5');
    assert.equal(JSON.parse(settings.bytes).MinimalDisplayName, '26.5');
    held.push(holdRegular(SDK + '/usr/lib/libSystem.B.tbd',
      '20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57', 0));
    let deliveredEntry = null;
    if (args.length === 0) {
      deliveredEntry = holdRegular(fileURLToPath(DELIVERED_ENTRY),
        'bbcf752ef274b04c2b8bb99434d0a738de0b3aa9ce8c85aa0476eec4351560b7', 501);
      held.push(deliveredEntry);
    }
    directory = fs.mkdtempSync('/private/tmp/setfarm-native-name-test.');
    fs.chmodSync(directory, 0o700);
    rootStat = fs.lstatSync(directory, {bigint: true});
    assert.ok(rootStat.isDirectory());
    assert.equal(rootStat.uid, 501n);
    assert.equal(rootStat.gid, 0n);
    assert.equal(rootStat.mode & 0o777n, 0o700n);
    const source = directory + '/task6a-origin-native-name-v2.c';
    const object = directory + '/probe.o';
    const binary = directory + '/probe';
    const compiledBytes = instrumentSource(held[0].bytes, control);
    fs.writeFileSync(source, compiledBytes, {flag: 'wx', mode: 0o600});
    // Source placement is a private fixture, never a production caller selector.
    const fixtureEntry = directory + '/task6a-protected-origin-entry-v2.mjs';
    const entryBytes = deliveredEntry ? fixtureBytes(deliveredEntry.bytes, fixture) : Buffer.from(ENTRY);
    fs.writeFileSync(fixtureEntry, entryBytes, {flag: 'wx', mode: 0o600});
    held.push(holdRegular(fixtureEntry, sha256(entryBytes), 501));
    held.push(holdRegular(source, sha256(compiledBytes), 501));
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
    if (stage === 'compile') {
      return {
        ...compile, availability: 'compiled-object-only',
        evidence: {
          directory, sourceHash: sha256(held[0].bytes), objectHash: sha256(objectInput.bytes),
          compilerExit: compile.code, definiteExitCloseAndBothEof: true,
          linked: false, nativeProgramExecuted: false,
          productionAuthority: false, completeNativeClosure: false, protectedOrigin: false,
        },
      };
    }
    // Calibrate startup-witness bytes separately; delivered bytes are hash-bound.
    const calibration = fs.mkdtempSync('/private/tmp/setfarm-native-name-witness.');
    fs.chmodSync(calibration, 0o700);
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
      assert.ok(traceInput.bytes.length <= 1024);
      trace = traceInput.bytes.toString();
    }
    return {
      ...actual,
      trace,
      availability: 'executed-ordinary',
      entryStarted: args.length ? entryStarted(directory, held) : null,
      evidence: {
        directory, calibration, sourceHash: sha256(held[0].bytes),
        compiledSourceHash: sha256(compiledBytes), instrumented: control !== 'none', control,
        objectHash: sha256(objectInput.bytes), binaryHash: sha256(binaryInput.bytes),
        compilerExit: compile.code, linkerExit: link.code,
        witnessExit: observed.code, definiteExitCloseAndBothEof: true,
        entryKind: deliveredEntry ? (fixture === 'delivered' ?
          'exact-delivered-builtin' : 'owned-delivered-entry-mutation') : 'startup-witness',
        fixture,
        entryHash: sha256(entryBytes),
        ...(trace === null ? {} : {traceHash: sha256(trace), trace}),
        // Raw settled C-parent channels, not child-Node or authority claims.
        ...(control === 'none' ? {} : {
          targetExit: actual.code, targetStdout: actual.stdout, targetStderr: actual.stderr,
        }),
        productionAuthority: false, completeNativeClosure: false, protectedOrigin: false,
      },
    };
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    // Retain fresh fixture artifacts, including all failures; no recursive cleanup.
    const errors = [];
    if (directory && rootStat) {
      try {
        const finalRoot = fs.lstatSync(directory, {bigint: true});
        assert.ok(finalRoot.isDirectory());
        assert.equal(finalRoot.dev, rootStat.dev);
        assert.equal(finalRoot.ino, rootStat.ino);
        assert.equal(finalRoot.uid, 501n);
        assert.equal(finalRoot.gid, 0n);
        assert.equal(finalRoot.mode & 0o777n, 0o700n);
      } catch (error) { errors.push(error); }
    }
    for (const [systemDirectory, inode] of [[SDK, 14162438], [RESOURCE, 6714331]]) {
      try { checkSystemDirectory(systemDirectory, inode); } catch (error) { errors.push(error); }
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

// Catches accepting a public selector or spawning the entry before argc refusal.
// First run is explicitly test-support RED, not a kernel/identity witness.
test('ordinary native NAME parent refuses an extra argument before entry start',
  {skip: !NATIVE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedProbe(['unexpected']);
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 2, `actual support: ${actual.availability}`);
  assert.equal(actual.stdout, '');
  assert.equal(actual.stderr, 'TASK6A_NATIVE_NAME_PROBE_REFUSED\n');
  assert.equal(actual.entryStarted, false);
});

for (const [fixture, reason] of [
  ['wrong-ready', 'protocol-frame'],
  ['wrong-pong', 'protocol-frame'],
  ['stderr', 'child-stderr'],
  ['deadline', 'protocol-deadline'],
]) {
  test('ordinary native NAME parent rejects owned ' + fixture + ' fixture',
    {skip: !NATIVE_TEST_ENABLED}, async t => {
    const actual = await invokeOwnedProbe([], 'execute', fixture);
    if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
    assert.equal(actual.code, 2);
    assert.equal(actual.stdout, '', 'failed fixture must not emit success');
    const causes = actual.stderr.split('\n').filter(Boolean);
    assert.ok(causes.some(line => line.startsWith('TASK6A_NATIVE_NAME_PROBE_FAILED ' + reason + ' ')),
      'missing independently nominated cause: ' + actual.stderr);
    assert.equal(actual.evidence.definiteExitCloseAndBothEof, true);
  });
}

test('ordinary native NAME source compiles without linking or executing a target',
  {skip: !COMPILE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedProbe([], 'compile');
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assert.equal(actual.code, 0);
  assert.equal(actual.stdout, '');
  assert.equal(actual.stderr, '');
  assert.equal(actual.availability, 'compiled-object-only');
});

// Demands the nominal contract from the exact reviewed compiled source.
// This JSON oracle alone does not prove native calls or their ordering; explicit
// protocol/lifecycle mutation controls remain required before qualification.
function assertNominal(actual) {
  assert.equal(actual.code, 0, 'nominal support must really succeed: ' + actual.stderr);
  assert.equal(actual.stderr, '');
  assert.ok(Buffer.byteLength(actual.stdout) <= 2048);
  assert.equal(actual.stdout.split('\n').length, 2, 'exactly one diagnostic line');
  assert.ok(actual.stdout.endsWith('\n'));
  const expected = {
    schema: 'setfarm.task6a-native-name-diagnostic.v2',
    outcome: 'supportedNAME/unqualified',
    nameBound: true,
    auditStable: true,
    challengesCompleted: 3,
    childReaped: true,
    childExitCode: 0,
    childSignal: null,
    stdoutEof: true,
    stderrEof: true,
    nameDisposed: true,
    productionAuthority: false,
    completeNativeClosure: false,
    protectedOrigin: false,
  };
  assert.deepEqual(JSON.parse(actual.stdout), expected);
  assert.equal(actual.stdout, JSON.stringify(expected) + '\n',
    'fixed diagnostic line must not contain duplicate or contradictory fields');
}

function assertTrace(trace, control) {
  assert.ok(trace.endsWith('\n'));
  const events = trace.trimEnd().split('\n');
  assert.equal(events.filter(event => event === 'pipe').length, 3);
  assert.equal(events.filter(event => event === 'close').length, 6);
  const native = events.filter(event => event !== 'pipe' && event !== 'close');
  const expected = ['spawn', 'name', 'type', 'pid', 'audit', 'audit', 'reap', 'dispose'];
  if (control === 'post-reap-kill') expected.push('blocked-kill');
  if (control === 'post-reap-audit') expected.push('blocked-audit');
  assert.deepEqual(native, expected, 'forbidden native attempt or missing genuine lifecycle');
  assert.equal(events.slice(events.indexOf('reap') + 1).includes('signal'), false);
}

test('ordinary native NAME parent completes the delivered entry without granting authority',
  {skip: !NATIVE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedProbe([]);
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assertNominal(actual);
});

// Break caught: any target operation after actual reap, omitted native work,
// duplicate original close/disposal, or a stub success without real lifecycle.
for (const control of ['baseline', 'post-reap-kill', 'post-reap-audit']) {
  test('ordinary native NAME test-copy verifies ' + control + ' native boundary',
    {skip: !NATIVE_TEST_ENABLED}, async t => {
    const actual = await invokeOwnedProbe([], 'execute', 'delivered', control);
    if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
    assertNominal(actual);
    assert.equal(actual.evidence.instrumented, true);
    assert.notEqual(actual.evidence.sourceHash, actual.evidence.compiledSourceHash);
    if (control !== 'baseline') {
      assert.throws(() => assertTrace(actual.trace, 'baseline'),
        /forbidden native attempt or missing genuine lifecycle/,
        'the independent nominal oracle must kill the attempt-injected copy');
    }
    assertTrace(actual.trace, control);
  });
}

const FAULT_CASES = [
  ['pid-mismatch', 'name-pid-mismatch', ['spawn', 'name', 'type', 'pid', 'synthetic-pid-mismatch', 'reap', 'dispose']],
  ['first-audit-count', 'audit-count-mismatch', ['spawn', 'name', 'type', 'pid', 'audit', 'synthetic-first-audit-count', 'reap', 'dispose']],
  ['second-audit-count', 'audit-count-mismatch', ['spawn', 'name', 'type', 'pid', 'audit', 'audit', 'synthetic-second-audit-count', 'reap', 'dispose']],
  ['audit-drift', 'audit-drift', ['spawn', 'name', 'type', 'pid', 'audit', 'audit', 'synthetic-audit-drift', 'reap', 'dispose']],
  ['dispose-response', 'name-dispose', ['spawn', 'name', 'type', 'pid', 'audit', 'audit', 'reap', 'dispose', 'synthetic-dispose-response']],
];

function assertRefusal(actual, reason) {
  assert.equal(actual.code, 2, 'nominated result fault must refuse');
  assert.equal(actual.stdout, '', 'result fault must never emit success');
  assert.ok(actual.stderr.split('\n').some(line =>
    line.startsWith('TASK6A_NATIVE_NAME_PROBE_FAILED ' + reason + ' ')), actual.stderr);
  assert.equal(actual.evidence.definiteExitCloseAndBothEof, true);
}

function assertFaultTrace(trace, expected) {
  assert.ok(trace.endsWith('\n'));
  const events = trace.trimEnd().split('\n');
  assert.equal(events.filter(event => event === 'pipe').length, 3);
  assert.equal(events.filter(event => event === 'close').length, 6);
  assert.deepEqual(events.filter(event => !['pipe', 'close', 'signal'].includes(event)), expected);
  assert.ok(!events.slice(events.indexOf('reap') + 1).includes('signal'));
}

// Breaks caught: trusting a mismatched native PID/count/token or hiding disposal
// failure. Faults alter real returned outputs only, not actual kernel custody.
for (const [control, reason, expected] of FAULT_CASES) {
  test('ordinary native NAME test-copy refuses ' + control + ' returned-result fault',
    {skip: !NATIVE_TEST_ENABLED}, async t => {
    const actual = await invokeOwnedProbe([], 'execute', 'delivered', control);
    if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
    assertRefusal(actual, reason);
    assertFaultTrace(actual.trace, expected);
  });
}

test('ordinary native NAME test-copy negative oracle kills omitted audit comparison',
  {skip: !NATIVE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedProbe([], 'execute', 'delivered', 'audit-drift-no-compare');
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  assertNominal(actual);
  assertFaultTrace(actual.trace,
    ['spawn', 'name', 'type', 'pid', 'audit', 'audit', 'synthetic-audit-drift', 'reap', 'dispose']);
  assert.throws(() => assertRefusal(actual, 'audit-drift'), /nominated result fault must refuse/);
});

// Break caught: completed reap+EOF bypassing the cleanup-expiry attribution.
// Delay occurs only AFTER actual reap, inside settlement, below protocol3s.
test('ordinary native NAME test-copy retains cleanup expiry after genuine late reap',
  {skip: !NATIVE_TEST_ENABLED}, async t => {
  const actual = await invokeOwnedProbe([], 'execute', 'quiet-wrong-ready', 'cleanup-late-reap');
  if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
  const events = actual.trace.trimEnd().split('\n');
  assert.equal(events.filter(event => event === 'stdout-eof').length, 1);
  assert.equal(events.filter(event => event === 'stderr-eof').length, 1);
  const nativeTrace = events.filter(event => !['stdout-eof', 'stderr-eof'].includes(event)).join('\n') + '\n';
  assertFaultTrace(nativeTrace, ['spawn', 'reap', 'cleanup-late-reap']);
  assert.ok(!actual.stderr.includes('TASK6A_NATIVE_NAME_PROBE_UNSETTLED'),
    'completed late closure must not be labelled unsettled');
  assertRefusal(actual, 'cleanup-deadline-unqualified');
});

const IO_CASES = [
  ['fragmented', [], 220, 229],
  ['partial-ready', ['early-stdout-eof'], 4, 0],
  ['malformed-end', ['protocol-frame'], 220, 229],
  ['excess-output', ['protocol-frame', 'extra-stdout'], 221, 229],
  ['nonzero-exit', ['child-lifecycle'], 220, 229],
  ['cleanup-escalation', ['protocol-deadline'], 216, 229],
];

// Breaks caught: treating short IO as complete, accepting truncated/excess
// frames or nonzero exit, or claiming escalation without actual signal/reap.
for (const [control, reasons, output, input] of IO_CASES) {
  test('ordinary native NAME test-copy verifies ' + control + ' IO lifecycle',
    {skip: !NATIVE_TEST_ENABLED}, async t => {
    const fixture = control === 'fragmented' ? 'delivered' : control;
    const actual = await invokeOwnedProbe([], 'execute', fixture, control);
    if (actual.evidence) t.diagnostic(JSON.stringify(actual.evidence));
    const events = actual.trace.trimEnd().split('\n');
    const countLines = events.filter(event => event.startsWith('io '));
    assert.equal(countLines.length, 1);
    const match = /^io reads=(\d+) writes=(\d+) output=(\d+) input=(\d+)$/.exec(countLines[0]);
    assert.ok(match);
    assert.equal(BigInt(match[3]), BigInt(output));
    assert.equal(BigInt(match[4]), BigInt(input));
    if (control === 'fragmented') {
      assert.equal(BigInt(match[1]), 220n); assert.equal(BigInt(match[2]), 229n);
      assertNominal(actual);
    } else {
      const nominated = reasons.find(reason => actual.stderr.split('\n').some(line =>
        line.startsWith('TASK6A_NATIVE_NAME_PROBE_FAILED ' + reason + ' ')));
      assert.ok(nominated, 'expected source refusal: ' + actual.stderr);
      assertRefusal(actual, nominated);
    }
    assert.equal(events.filter(event => event === 'stdout-eof').length, 1);
    assert.equal(events.filter(event => event === 'stderr-eof').length, 1);
    const expected = control === 'partial-ready' ? ['spawn', 'reap'] :
      ['spawn', 'name', 'type', 'pid', 'audit', 'audit'];
    if (control !== 'partial-ready') {
      if (control === 'cleanup-escalation') expected.push('signal-term', 'signal-kill');
      expected.push('reap');
      if (control === 'nonzero-exit') expected.push('exit7');
      if (control === 'cleanup-escalation') expected.push('sigkill-reap');
      expected.push('dispose');
    }
    expected.push(control + '-io');
    const nativeTrace = events.filter(event => !['stdout-eof', 'stderr-eof'].includes(event) &&
      !event.startsWith('io ')).join('\n') + '\n';
    assertFaultTrace(nativeTrace, expected);
    if (control === 'partial-ready') assert.ok(events.indexOf('stdout-eof') < events.indexOf('reap'));
  });
}
