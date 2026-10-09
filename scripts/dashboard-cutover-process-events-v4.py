"""Fixed conditional candidate-event DATA, never ownership/family/admission.

Private flavor17 and installed-kernel semantics are explicit trust assumptions.
No select wrapper, queue destructor, signal, retry, adoption or replacement FD.
"""
import ctypes
import json
import os
import select
import sys
import time

KERNEL = "Darwin Kernel Version 25.5.0: Tue Jun  9 22:26:22 PDT 2026; root:xnu-12377.121.10~1/RELEASE_ARM64_T8132"
LIMITS = dict(authority="conditional-target-data-only", familyClosure="not-proven",
              futureEntryExclusion="not-proven", cutoverAdmission="not-granted")
FRAME = "setfarm.dashboard-cutover-process-candidates-frame.v4"


def refuse():
    raise ValueError("DASHBOARD_CUTOVER_PROCESS_EVENTS_REFUSED")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class Unique(ctypes.Structure):
    _fields_ = [("uuid", ctypes.c_ubyte * 16), ("unique", ctypes.c_uint64),
                ("parent_unique", ctypes.c_uint64), ("version", ctypes.c_int32),
                ("parent_version", ctypes.c_int32), ("reserved1", ctypes.c_uint64),
                ("reserved2", ctypes.c_uint64)]


class Bsd(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in
                ("flags", "status", "xstatus", "pid", "ppid", "uid", "gid",
                 "ruid", "rgid", "svuid", "svgid", "rfu")]
    _fields_ += [("comm", ctypes.c_char * 16), ("name", ctypes.c_char * 32)]
    _fields_ += [(name, ctypes.c_uint32) for name in
                ("nfiles", "pgid", "pjobc", "e_tdev", "e_tpgid")]
    _fields_ += [("nice", ctypes.c_int32), ("start_seconds", ctypes.c_uint64),
                ("start_microseconds", ctypes.c_uint64)]


class Kevent(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("ident", ctypes.c_uint64), ("filter", ctypes.c_int16),
                ("flags", ctypes.c_uint16), ("fflags", ctypes.c_uint32),
                ("data", ctypes.c_int64), ("udata", ctypes.c_void_p)]


class Timespec(ctypes.Structure):
    _fields_ = [("seconds", ctypes.c_int64), ("nanoseconds", ctypes.c_int64)]


def profile():
    uname = os.uname()
    if (sys.version_info[:3] != (3, 9, 6) or sys.platform != "darwin"
            or uname.sysname != "Darwin" or uname.release != "25.5.0"
            or uname.machine != "arm64" or uname.version != KERNEL
            or ctypes.sizeof(ctypes.c_void_p) != 8 or ctypes.sizeof(ctypes.c_size_t) != 8):
        refuse()
    layouts = [(Unique, 56, 8, [0, 16, 24, 32, 36, 40, 48]),
               (Bsd, 136, 8, list(range(0, 48, 4)) + [48, 64] + list(range(96, 120, 4)) + [120, 128]),
               (Kevent, 32, 4, [0, 8, 10, 12, 16, 24]), (Timespec, 16, 8, [0, 8])]
    for kind, size, alignment, offsets in layouts:
        if (ctypes.sizeof(kind) != size or ctypes.alignment(kind) != alignment
                or [getattr(kind, name).offset for name, _ in kind._fields_] != offsets):
            refuse()
    uid, gid = os.getuid(), os.getgid()
    if uid <= 0 or gid <= 0 or os.geteuid() != uid or os.getegid() != gid:
        refuse()
    return uid, gid


def parse_input(deadline):
    # Bounded original intake also terminates naturally if Node loses its input
    # driver before sending EOF; it must not need a signal/guessed disposal.
    chunks = []
    length = 0
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            refuse()
        ready, _, _ = select.select([0], [], [], remaining)
        if not ready:
            refuse()
        chunk = os.read(0, 4097 - length)
        if not chunk:
            break
        chunks.append(chunk)
        length += len(chunk)
        if length > 4096:
            refuse()
    raw = b"".join(chunks)
    if not 1 <= len(raw) <= 4096:
        refuse()
    text = raw.decode("utf8", "strict")
    value = json.loads(text)
    if (type(value) is not dict or set(value) != {"schema", "candidates"}
            or value["schema"] != "setfarm.dashboard-cutover-process-candidates-request.v4"
            or text != canonical(value) + "\n" or type(value["candidates"]) is not list
            or not 1 <= len(value["candidates"]) <= 32):
        refuse()
    pids = []
    for candidate in value["candidates"]:
        if type(candidate) is not dict or set(candidate) != {"pid"}:
            refuse()
        pid = candidate["pid"]
        if type(pid) is not int or not 2 <= pid <= 2147483647 or (pids and pid <= pids[-1]):
            refuse()
        pids.append(pid)
    return pids


class Original:
    def __init__(self, deadline):
        self.calls = []
        self.buffers = []
        self.fd = None
        self.close_record = None
        self.deadline = deadline
        self.output_bytes = 0
        self.proc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
        self.lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        self.proc.proc_pidinfo.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint64, ctypes.c_void_p, ctypes.c_int]
        self.proc.proc_pidinfo.restype = ctypes.c_int
        self.proc.proc_pidpath.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
        self.proc.proc_pidpath.restype = ctypes.c_int
        self.lib.kqueue.argtypes = []
        self.lib.kqueue.restype = ctypes.c_int
        self.lib.kevent.argtypes = [ctypes.c_int, ctypes.POINTER(Kevent), ctypes.c_int, ctypes.POINTER(Kevent), ctypes.c_int, ctypes.POINTER(Timespec)]
        self.lib.kevent.restype = ctypes.c_int
        self.lib.close.argtypes = [ctypes.c_int]
        self.lib.close.restype = ctypes.c_int

    def call(self, name, function, args, intent):
        record = dict(name=name, intent=intent, returned=False, result=None, errno=None)
        self.calls.append(record)
        ctypes.set_errno(0)
        result = function(*args)  # One invocation, including EINTR; no retry.
        record["returned"] = True
        record["result"] = result
        record["errno"] = ctypes.get_errno()
        return record

    def check_deadline(self):
        if time.monotonic() >= self.deadline:
            refuse()

    def info(self, pid, flavor, kind):
        self.check_deadline()
        buffer = kind()
        self.buffers.append(buffer)
        call = self.call("proc_pidinfo", self.proc.proc_pidinfo,
                         (pid, flavor, 0, ctypes.byref(buffer), ctypes.sizeof(buffer)),
                         dict(pid=pid, flavor=flavor, size=ctypes.sizeof(buffer)))
        call["bytes"] = bytes(buffer).hex()
        if call["result"] != ctypes.sizeof(buffer) or call["errno"] != 0:
            refuse()
        return buffer

    def subject(self, pid, uid, gid):
        bsd = self.info(pid, 3, Bsd)
        if (bsd.pid != pid or bsd.status not in (2, 3) or bsd.flags & 6
                or any(getattr(bsd, name) != expected for name, expected in
                       (("uid", uid), ("ruid", uid), ("svuid", uid),
                        ("gid", gid), ("rgid", gid), ("svgid", gid)))):
            refuse()
        path = ctypes.create_string_buffer(4096)
        self.buffers.append(path)
        call = self.call("proc_pidpath", self.proc.proc_pidpath, (pid, path, 4096), dict(pid=pid, size=4096))
        call["bytes"] = bytes(path).hex()
        length = call["result"]
        if not 1 <= length < 4096 or call["errno"] != 0:
            refuse()
        raw = bytes(path)
        end = raw.find(b"\0")
        # proc_pidpath copies its whole workspace; vn_getpath's memmove need not
        # erase the old suffix. Only its exact returned NUL-terminated prefix
        # is path DATA. Unused capacity is neither a path nor an environment.
        if end <= 0 or length != end:
            refuse()
        executable = raw[:end].decode("utf8", "strict")
        if not executable.startswith("/"):
            refuse()
        return executable

    def kevent(self, change, capacity, timeout):
        self.check_deadline()
        output = (Kevent * capacity)()
        self.buffers.extend([output, timeout])
        if change is not None:
            self.buffers.append(change)
        call = self.call("kevent", self.lib.kevent,
                         (self.fd, ctypes.byref(change) if change is not None else None,
                          1 if change is not None else 0, output, capacity, ctypes.byref(timeout)),
                         dict(fd=self.fd, change=bytes(change).hex() if change is not None else None,
                              count=1 if change is not None else 0, capacity=capacity))
        call["bytes"] = bytes(output).hex()
        if call["errno"] != 0 or not 0 <= call["result"] <= capacity:
            refuse()
        return [output[index] for index in range(call["result"])]

    def close_once(self):
        if self.fd is None or self.close_record is not None:
            refuse()
        # Retain the attempted disposition BEFORE entering the syscall.
        self.close_record = dict(attempted=True, returned=False, result=None, errno=None)
        call = self.call("close", self.lib.close, (self.fd,), dict(fd=self.fd))
        self.close_record.update(returned=call["returned"], result=call["result"], errno=call["errno"])
        if call["result"] != 0 or call["errno"] != 0:
            refuse()
        return self.close_record

    def publish(self, sequence, state, candidates, **extra):
        data = dict(schema=FRAME, sequence=sequence, state=state, candidates=candidates, **LIMITS, **extra)
        raw = (canonical(data) + "\n").encode("utf8", "strict")
        self.output_bytes += len(raw)
        if len(raw) > 16384 or self.output_bytes > 32768:
            refuse()
        write = dict(name="stdout-write", sequence=sequence, intended=len(raw), returned=False, result=None)
        self.calls.append(write)
        result = sys.stdout.buffer.write(raw)
        write.update(returned=True, result=result)
        if result != len(raw):
            refuse()
        flush = dict(name="stdout-flush", sequence=sequence, returned=False)
        self.calls.append(flush)
        sys.stdout.buffer.flush()
        flush["returned"] = True


def event_data(event):
    return dict(pid=event.ident, ordinal=event.udata, filter=event.filter,
                flags=event.flags, fflags=event.fflags, data=event.data)


def execute(original, pids, uid, gid):
    original.check_deadline()
    queue = original.call("kqueue", original.lib.kqueue, (), {})
    if queue["result"] >= 0:
        original.fd = queue["result"]  # Retain every known returned FD before checks.
    if queue["result"] < 0 or queue["errno"] != 0:
        refuse()
    candidates = []
    registrations = []
    for ordinal, pid in enumerate(pids, 1):
        u0 = original.info(pid, 17, Unique)
        path0 = original.subject(pid, uid, gid)
        change = Kevent(pid, -5, 65, 3758096384, 0, ordinal)
        receipts = original.kevent(change, 1, Timespec(0, 0))
        expected = dict(pid=pid, ordinal=ordinal, filter=-5, flags=16449, fflags=3758096384, data=0)
        if len(receipts) != 1 or event_data(receipts[0]) != expected:
            refuse()
        call = original.calls[-1]
        registrations.append(dict(intentHex=call["intent"]["change"], returned=call["returned"],
                                  result=call["result"], errno=call["errno"], receiptHex=call["bytes"]))
        path1 = original.subject(pid, uid, gid)
        u1 = original.info(pid, 17, Unique)
        if (not u0.unique or u0.unique != u1.unique or u0.version != u1.version
                or bytes(u0.uuid) != bytes(u1.uuid) or path0 != path1):
            refuse()
        candidates.append(dict(pid=pid, ordinal=ordinal, uniqueId="%016x" % u0.unique,
                               parentUniqueId="%016x" % u0.parent_unique, idVersion="%08x" % (u0.version & 0xffffffff),
                               originalParentVersion="%08x" % (u0.parent_version & 0xffffffff),
                               executableUuid=bytes(u0.uuid).hex(), executablePath=path0))
    original.check_deadline()
    original.publish(0, "READY", candidates, registrations=registrations)
    exited = {}
    while len(exited) != len(pids):
        remaining = original.deadline - time.monotonic()
        if remaining <= 0:
            refuse()
        seconds = int(remaining)
        timeout = Timespec(seconds, int((remaining - seconds) * 1000000000))
        events = original.kevent(None, len(pids), timeout)
        for event in events:
            pid = event.ident
            if pid not in pids or pid in exited:
                refuse()
            expected = dict(pid=pid, ordinal=pids.index(pid) + 1, filter=-5, flags=32881, fflags=2147483648, data=0)
            if event_data(event) != expected:
                refuse()
            exited[pid] = dict(**expected, rawHex=bytes(event).hex())
    original.check_deadline()
    close = original.close_once()
    original.publish(1, "EXITED", candidates, events=[exited[pid] for pid in pids], queueClose=close)


def main():
    original = None
    try:
        deadline = time.monotonic() + 30
        uid, gid = profile()
        pids = parse_input(deadline)
        original = Original(deadline)
        execute(original, pids, uid, gid)
        return 0
    except BaseException:
        # Only a positively retained original FD gets one recorded disposition.
        # No finally guess and no retry after an uncertain close response.
        if original is not None and original.fd is not None and original.close_record is None:
            try:
                original.close_once()
            except BaseException:
                pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
