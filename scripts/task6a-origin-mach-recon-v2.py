"""Ordinary owned-child raw Mach diagnostics. Never privileged/native authority."""
import hashlib
import json
import os
import select
import signal
import stat
import struct
import subprocess
import sys
import time

REFUSAL = "TASK6A_ORIGIN_MACH_RECON_REFUSED"
CAP = 281474976710656
ROOT = "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9"
PYTHON = ROOT + "/Resources/Python.app/Contents/MacOS/Python"
ENV = {"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"}
PERL_HASH = "abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0"
PERL_ENTRY = (
    'BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level",'
    '"/System/Library/Perl/5.34"); } use strict; use warnings; $|=1;'
    '$SIG{ALRM}=sub {exit 2}; alarm 20; print "READY\\n";'
    'while(defined(my $line=<STDIN>)) {exit 2;} exit 0;'
)


STAGES = {"unclassified", "ordinary-host", "tool-pin", "spawn", "ready",
          "read-port-acquire", "acquire-return", "walk", "read-port-close",
          "target-settle", "cancelled", "empty-result"}


class DiagnosticRefusal(ValueError):
    def __init__(self, stage="unclassified", details=None):
        super().__init__(REFUSAL)
        self.stage = stage if stage in STAGES else "unclassified"
        self.details = {}
        if (type(details) is dict and set(details) == {"nativeResult", "nativeErrno"}
                and type(details["nativeResult"]) is int and -1 <= details["nativeResult"] <= 65535
                and type(details["nativeErrno"]) is int and 0 <= details["nativeErrno"] <= 4096):
            self.details = details.copy()


def refuse(stage="unclassified", details=None):
    raise DiagnosticRefusal(stage, details)


def decode_region(raw, address, size, query, requested_depth, depth, count):
    if type(raw) is not bytes or len(raw) != 76 or count != 19:
        refuse()
    if any(type(v) is not int for v in (address, size, query, requested_depth, depth, count)):
        refuse()
    if not (0 <= query < CAP and query <= address < CAP and 0 < size <= CAP
            and address + size <= CAP and 0 <= depth <= requested_depth <= 64):
        refuse()
    values = struct.unpack("<iiiQIIIIIIHBBiiIHHIQ", raw)
    protection, maximum, inheritance, offset = values[:4]
    if not (0 <= protection <= 7 and 0 <= maximum <= 7
            and protection & maximum == protection and 0 <= inheritance <= 2
            and values[4] != 4294967295 and values[11] in (0, 1)
            and 1 <= values[12] <= 8 and values[13] in (0, 1)
            and 0 <= values[17] <= 3):
        refuse()
    names = ("userTag", "pagesResident", "pagesSharedNowPrivate", "pagesSwappedOut",
             "pagesDirtied", "referenceCount", "shadowDepth", "externalPager",
             "shareMode", "submap", "behavior", "objectId", "userWiredCount",
             "flags", "pagesReusable")
    result = dict(zip(names, values[4:19]))
    result.update(address=address, size=size, end=address + size, depth=depth,
                  protection=protection, maximumProtection=maximum,
                  inheritance=inheritance, offsetHex=format(offset, "016x"),
                  objectIdFullHex=format(values[19], "016x"),
                  currentExecutable=bool(protection & 4),
                  potentialExecutable=bool((protection | maximum) & 4))
    result["externalPager"] = bool(result["externalPager"])
    result["submap"] = bool(result["submap"])
    return result


def walk_regions(query, alive, clock, deadline=None):
    if deadline is None:
        deadline = clock() + 10
    address, depth, leaves, submaps, current, potential = 0, 0, 0, 0, 0, 0
    regions = []
    for _ in range(4096):
        if not alive() or clock() >= deadline:
            refuse()
        reply = query(address, depth)
        if not alive() or clock() >= deadline:
            refuse()
        if type(reply) is not tuple or len(reply) != 6 or type(reply[0]) is not int:
            refuse()
        kr, start, size, returned_depth, count, raw = reply
        if kr == 1:
            if not leaves:
                refuse()
            result = dict(scope="ordinary-owned-child-raw-mach-diagnostic-only",
                          productionAuthority=False, completeNativeClosure=False,
                          sampled=True, terminalCandidate=1, leafCount=leaves,
                          submapCount=submaps, currentExecutableCount=current,
                          potentialExecutableCount=potential, regions=regions)
            if len(json.dumps(result).encode("ascii")) > 1048576:
                refuse()
            return result
        if kr != 0:
            refuse()
        region = decode_region(raw, start, size, address, depth, returned_depth, count)
        regions.append(region)
        if region["submap"]:
            submaps += 1
            if returned_depth >= 64:
                refuse()
            address, depth = start, returned_depth + 1
        else:
            leaves += 1
            current += int(region["currentExecutable"])
            potential += int(region["potentialExecutable"])
            address, depth = region["end"], returned_depth
        if address >= CAP:
            refuse()  # No invented terminal query outside the admitted range.
    refuse()


def checked_read_port(result, fresh_errno, port):
    if result != 0 or fresh_errno != 0 or type(port) is not int or not 0 < port < 4294967295:
        refuse()
    return port


def bind_functions(lib, c):
    lib.task_read_for_pid.argtypes = [c.c_uint32, c.c_int32, c.POINTER(c.c_uint32)]
    lib.task_read_for_pid.restype = c.c_int32
    lib.mach_vm_region_recurse.argtypes = [
        c.c_uint32, c.POINTER(c.c_uint64), c.POINTER(c.c_uint64),
        c.POINTER(c.c_uint32), c.POINTER(c.c_int32), c.POINTER(c.c_uint32)]
    lib.mach_vm_region_recurse.restype = c.c_int32
    lib.mach_port_deallocate.argtypes = [c.c_uint32, c.c_uint32]
    lib.mach_port_deallocate.restype = c.c_int32


class NativeReadPort:
    def __init__(self, captured_pid):
        # Lazy: ordinary entry/target readiness precede native loading/acquisition.
        import ctypes as c
        if type(captured_pid) is not int or not 1 < captured_pid <= 2147483647:
            refuse()
        if c.sizeof(c.c_void_p) != 8 or sys.byteorder != "little":
            refuse()
        self.c = c
        self.lib = c.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        bind_functions(self.lib, c)
        self.self_port = c.c_uint32.in_dll(self.lib, "mach_task_self_").value
        self.port = 0
        output = c.c_uint32(0)
        c.set_errno(0)
        result = self.lib.task_read_for_pid(self.self_port, captured_pid, c.byref(output))
        fresh_errno = c.get_errno()
        # If a failed/uncertain call nevertheless returned a right, release it.
        if 0 < output.value < 4294967295:
            self.port = output.value
        try:
            checked_read_port(result, fresh_errno, output.value)
        except BaseException:
            self.close()
            refuse("read-port-acquire", {"nativeResult": result, "nativeErrno": fresh_errno})

    def query(self, address, depth):
        if not self.port:
            refuse()
        c = self.c
        start, size, nesting, count = c.c_uint64(address), c.c_uint64(0), c.c_uint32(depth), c.c_uint32(19)
        info = (c.c_int32 * 19)()
        kr = self.lib.mach_vm_region_recurse(self.port, c.byref(start), c.byref(size),
                                            c.byref(nesting), info, c.byref(count))
        raw = bytes(info)
        return (int(kr), start.value, size.value, nesting.value, count.value, raw)

    def close(self):
        if self.port:
            port, self.port = self.port, 0  # One irreversible release attempt.
            if self.lib.mach_port_deallocate(self.self_port, port) != 0:
                refuse("read-port-close")


def pin_perl():
    before = os.lstat("/usr/bin/perl")
    if (not stat.S_ISREG(before.st_mode) or before.st_uid != 0 or before.st_gid != 0
            or stat.S_IMODE(before.st_mode) != 0o755 or before.st_nlink != 1
            or before.st_size > 1048576):
        refuse()
    fd = os.open("/usr/bin/perl", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        opened = os.fstat(fd)
        data = os.read(fd, 1048577)
        after = os.fstat(fd)
        again = os.lstat("/usr/bin/perl")
        keys = ("st_dev", "st_ino", "st_mode", "st_uid", "st_gid", "st_nlink",
                "st_size", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, key) != getattr(value, key)
               for value in (opened, after, again) for key in keys):
            refuse()
        if hashlib.sha256(data).hexdigest() != PERL_HASH:
            refuse()
    finally:
        os.close(fd)


def ready(child):
    deadline, data = time.monotonic() + 5, b""
    while data != b"READY\n":
        remaining = deadline - time.monotonic()
        if remaining <= 0 or child.poll() is not None:
            refuse()
        readable, _, _ = select.select([child.stdout], [], [], remaining)
        if not readable:
            refuse()
        chunk = os.read(child.stdout.fileno(), 7 - len(data))
        if not chunk:
            refuse()
        data += chunk
        if not b"READY\n".startswith(data):
            refuse()
    if child.poll() is not None:
        refuse()


def settle(child):
    failed = False
    try:
        try:
            child.stdin.close()
        except BaseException:
            failed = True
        unknown = object()
        for sig, seconds in ((None, 5), (signal.SIGTERM, 2), (signal.SIGKILL, 2)):
            try:
                state = child.poll()
            except BaseException:
                state, failed = unknown, True
            if state is not None and state is not unknown:
                break
            # Unknown poll never authorizes a signal; exact-child wait is safe.
            if sig is not None and state is None:
                try:
                    child.send_signal(sig)
                except BaseException:
                    failed = True
            try:
                child.wait(timeout=seconds)
            except subprocess.TimeoutExpired:
                continue
            except BaseException:
                failed = True
        try:
            reaped = child.poll() is not None
        except BaseException:
            reaped, failed = False, True
        if not reaped or child.returncode != 0:
            failed = True
        if reaped:
            # Fixed no-fork child: after definite wait, no inherited writer.
            for stream in (child.stdout, child.stderr):
                try:
                    if stream.read(1) != b"":
                        failed = True
                except BaseException:
                    failed = True
    finally:
        for stream in (child.stdin, child.stdout, child.stderr):
            try:
                stream.close()
            except BaseException:
                failed = True
    if failed:
        refuse()


def run():
    if (sys.platform != "darwin" or os.getuid() == 0 or os.geteuid() == 0
            or os.getuid() != os.geteuid() or len(sys.argv) != 1
            or not sys.flags.isolated or not sys.flags.no_site
            or not sys.flags.ignore_environment or not sys.dont_write_bytecode
            or sys.executable != PYTHON or sys.prefix != ROOT or sys.exec_prefix != ROOT):
        refuse("ordinary-host")
    try:
        pin_perl()
    except BaseException:
        refuse("tool-pin")
    child, native, result, failed, cancelled = None, None, None, None, [False]
    stage, details = "spawn", {}
    old_handlers = {}

    def cancel(signum, frame):
        cancelled[0] = True

    try:
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            old_handlers[sig] = signal.signal(sig, cancel)
        child = subprocess.Popen(["/usr/bin/perl", "-f", "-e", PERL_ENTRY],
                                 cwd="/", env=ENV, close_fds=True,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, bufsize=0)
        stage = "ready"
        ready(child)
        if cancelled[0] or child.poll() is not None:
            refuse()
        deadline = time.monotonic() + 10
        stage = "read-port-acquire"
        native = NativeReadPort(child.pid)
        stage = "acquire-return"
        if cancelled[0] or child.poll() is not None or time.monotonic() >= deadline:
            refuse()
        stage = "walk"
        result = walk_regions(native.query,
                              lambda: not cancelled[0] and child.poll() is None,
                              time.monotonic, deadline)
    except BaseException as error:
        failed = error.stage if isinstance(error, DiagnosticRefusal) and error.stage != "unclassified" else stage
        if isinstance(error, DiagnosticRefusal):
            details = error.details
    finally:
        if native is not None:
            try:
                native.close()
            except BaseException:
                failed = failed or "read-port-close"
        if child is not None:
            try:
                settle(child)
            except BaseException:
                failed = failed or "target-settle"
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
    if failed or cancelled[0] or result is None or child is None:
        refuse("cancelled" if cancelled[0] else failed or "empty-result", details)
    return dict(result, targetPid=child.pid, targetDefinitelyReaped=True,
                streamsDefinitelyClosed=True, readPortDefinitelyClosed=True)


if __name__ == "__main__":
    try:
        print(json.dumps(run(), separators=(",", ":")))
    except BaseException as error:
        diagnostic = error if isinstance(error, DiagnosticRefusal) else DiagnosticRefusal()
        sys.stderr.write(json.dumps(dict(error=REFUSAL, stage=diagnostic.stage,
                                        productionAuthority=False, completeNativeClosure=False,
                                        **diagnostic.details), separators=(",", ":")) + "\n")
        sys.exit(2)
