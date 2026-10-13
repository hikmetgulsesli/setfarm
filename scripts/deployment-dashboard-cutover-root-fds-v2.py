"""Direct requested-process vnode-FD diagnostic, never an effect capability.

Private/version-sensitive Darwin ABI. Direct errors are fatal, not nonmatches.
Two bracketed samples do not establish continuity or an exhaustive reference
census: fileports, cwd, mappings and unrequested processes are outside coverage.
"""

import ctypes as c
import json
import os
import re
import stat
import sys


class Refused(Exception):
    pass


def require(condition):
    if not condition:
        raise Refused()


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True, allow_nan=False) + "\n").encode("ascii")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def reject_constant(_):
    raise Refused()


def request():
    wire = sys.stdin.buffer.read(65537)
    require(0 < len(wire) <= 65536)
    value = json.loads(wire.decode("utf-8"), object_pairs_hook=unique_object,
                       parse_constant=reject_constant)
    require(type(value) is dict and set(value) == {"schema", "rootDev", "rootIno", "pids"})
    require(value["schema"] == "setfarm.dashboard-cutover-root-fd-request.v2")
    for key, limit in (("rootDev", 2**32 - 1), ("rootIno", 2**64 - 1)):
        text = value[key]
        require(type(text) is str and re.fullmatch(r"[1-9][0-9]{0,19}", text) is not None)
        require(int(text) <= limit)
    pids = value["pids"]
    require(type(pids) is list and 1 <= len(pids) <= 64)
    require(all(type(pid) is int and 0 < pid <= 2**31 - 1 for pid in pids))
    require(pids == sorted(set(pids)) and os.getppid() in pids)
    require(wire == canonical(value))
    return value


U32, I32, U64, I64 = c.c_uint32, c.c_int32, c.c_uint64, c.c_int64


class BSD(c.Structure):
    _fields_ = [(name, U32) for name in (
        "flags", "status", "xstatus", "pid", "ppid", "uid", "gid", "ruid", "rgid",
        "svuid", "svgid", "reserved")] + [
        ("comm", c.c_char * 16), ("name", c.c_char * 32), ("nfiles", U32),
        ("pgid", U32), ("pjobc", U32), ("tdev", U32), ("tpgid", U32),
        ("nice", I32), ("startSeconds", U64), ("startMicroseconds", U64)]


class FD(c.Structure):
    _fields_ = [("fd", I32), ("type", U32)]


class FileInfo(c.Structure):
    _fields_ = [("openflags", U32), ("status", U32), ("offset", I64),
                ("type", I32), ("guardflags", U32)]


class VStat(c.Structure):
    _fields_ = [("dev", U32), ("mode", c.c_uint16), ("nlink", c.c_uint16),
                ("ino", U64), ("uid", U32), ("gid", U32)] + [
        (name, I64) for name in ("atime", "atimensec", "mtime", "mtimensec", "ctime",
                                 "ctimensec", "birthtime", "birthtimensec", "size", "blocks")
    ] + [("blksize", I32), ("flags", U32), ("gen", U32), ("rdev", U32), ("spare", I64 * 2)]


class VNode(c.Structure):
    _fields_ = [("info", VStat), ("type", I32), ("pad", I32), ("fsid", I32 * 2)]


class VNodeFD(c.Structure):
    _fields_ = [("file", FileInfo), ("vnode", VNode)]


def native_provider():
    require(sys.platform == "darwin" and c.sizeof(c.c_void_p) == 8)
    layouts = (
        (BSD, 136, 8, {"uid": 20, "gid": 24, "pgid": 100, "startSeconds": 120}),
        (FD, 8, 4, {"type": 4}), (FileInfo, 24, 8, {"offset": 8, "type": 16}),
        (VStat, 136, 8, {"dev": 0, "mode": 4, "nlink": 6, "ino": 8, "uid": 16, "gid": 20}),
        (VNode, 152, 8, {"info": 0, "type": 136, "fsid": 144}),
        (VNodeFD, 176, 8, {"file": 0, "vnode": 24}),
    )
    for cls, size, alignment, offsets in layouts:
        require(c.sizeof(cls) == size and c.alignment(cls) == alignment)
        require(all(getattr(cls, key).offset == offset for key, offset in offsets.items()))
    lib = c.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
    lib.proc_pidinfo.argtypes = [c.c_int, c.c_int, c.c_uint64, c.c_void_p, c.c_int]
    lib.proc_pidinfo.restype = c.c_int
    lib.proc_pidfdinfo.argtypes = [c.c_int, c.c_int, c.c_int, c.c_void_p, c.c_int]
    lib.proc_pidfdinfo.restype = c.c_int
    return lib


def query(fn, args, buffer):
    c.set_errno(0)
    count = fn(*args, c.byref(buffer), c.sizeof(buffer))
    error = c.get_errno()
    require(count > 0 and error == 0)
    return count


def identity(lib, pid, uid, gid):
    bsd = BSD()
    require(query(lib.proc_pidinfo, (pid, 3, 0), bsd) == c.sizeof(bsd))
    require(bsd.pid == pid and bsd.status in (2, 3, 4) and bsd.flags & 4 == 0)
    require(bsd.xstatus == 0 and bsd.ppid > 0 and bsd.pgid > 0)
    require((bsd.uid, bsd.ruid, bsd.svuid) == (uid, uid, uid))
    require((bsd.gid, bsd.rgid, bsd.svgid) == (gid, gid, gid))
    require(bsd.startSeconds > 0 and bsd.startMicroseconds < 1000000)
    return {key: getattr(bsd, key) for key in (
        "pid", "ppid", "uid", "gid", "pgid", "startSeconds", "startMicroseconds")}


def descriptors(lib, pid):
    buffer = (FD * 4096)()
    count = query(lib.proc_pidinfo, (pid, 1, 0), buffer)
    require(count < c.sizeof(buffer) and count % c.sizeof(FD) == 0)
    entries = [{"fd": buffer[i].fd, "type": buffer[i].type} for i in range(count // c.sizeof(FD))]
    require(all(entry["fd"] >= 0 and entry["type"] in (0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11)
                for entry in entries))
    require(len(set(entry["fd"] for entry in entries)) == len(entries))
    return sorted(entries, key=lambda entry: entry["fd"])


def vnode(lib, pid, fd):
    buffer = VNodeFD()
    require(query(lib.proc_pidfdinfo, (pid, fd, 1), buffer) == c.sizeof(buffer))
    s = buffer.vnode.info
    kinds = {1: stat.S_IFREG, 2: stat.S_IFDIR, 3: stat.S_IFBLK, 4: stat.S_IFCHR,
             5: stat.S_IFLNK, 6: stat.S_IFSOCK, 7: stat.S_IFIFO}
    require(s.dev > 0 and s.ino > 0)
    require(buffer.vnode.type in kinds and stat.S_IFMT(s.mode) == kinds[buffer.vnode.type])
    return {"fd": fd, "dev": str(s.dev), "ino": str(s.ino), "mode": s.mode,
            "uid": s.uid, "gid": s.gid, "nlink": s.nlink}


def diagnostic(value):
    lib = native_provider()
    uid, gid, parent = os.getuid(), os.getgid(), os.getppid()
    require(os.geteuid() == uid and os.getegid() == gid and parent in value["pids"])
    processes = []
    total = 0
    for pid in value["pids"]:
        before = identity(lib, pid, uid, gid)
        fds = descriptors(lib, pid)
        total += len(fds)
        require(total <= 16384)
        matches = []
        for entry in fds:
            if entry["type"] != 1:
                continue  # Explicitly excluded types, NOT dropped query failures.
            observed = vnode(lib, pid, entry["fd"])
            if (observed["dev"], observed["ino"]) == (value["rootDev"], value["rootIno"]):
                require(stat.S_ISDIR(observed["mode"]) and observed["uid"] == uid)
                matches.append(observed)
        for match in matches:
            require(vnode(lib, pid, match["fd"]) == match)
        require(descriptors(lib, pid) == fds)
        require(identity(lib, pid, uid, gid) == before)
        processes.append(dict(before, fds=fds, rootFds=matches))
    require(any(p["pid"] == parent and p["rootFds"] for p in processes))
    require(os.getppid() == parent)
    return {"schema": "setfarm.dashboard-cutover-root-fd-diagnostic.v2",
            "authority": "diagnostic-only", "coverage": "requested-process-vnode-fds",
            "uid": uid, "gid": gid, "observerPid": os.getpid(), "parentPid": parent,
            "rootDev": value["rootDev"], "rootIno": value["rootIno"], "processes": processes}


def main():
    try:
        value = request()  # Bounded EOF/canonical validation before ANY native query.
        packet = canonical(diagnostic(value))
        require(len(packet) <= 1048576)
        require(sys.stdout.buffer.write(packet) == len(packet))
        sys.stdout.buffer.flush()
        return 0
    except Exception:
        # Never publish query errors as partial usable diagnostic reports. A
        # transport failure after publication may leave bytes; nonzero exit and
        # the parent's full EOF/status contract prevent their acceptance.
        try:
            sys.stderr.write("DASHBOARD_ROOT_FD_DIAGNOSTIC_REFUSED\n")
            sys.stderr.flush()
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
