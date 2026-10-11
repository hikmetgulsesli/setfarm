"""Sampled effective-UID metadata, not a complete roster or effect capability."""

import importlib.util
import os
from pathlib import Path
import sys


REQUEST = b'{"schema":"setfarm.dashboard-cutover-account-cohort-request.v2"}\n'
IDENTITY = ("pid", "ppid", "uid", "gid", "ruid", "rgid", "savedUid", "savedGid",
            "pgid", "startSeconds", "startMicroseconds")


def load_provider():
    filename = Path(__file__).with_name("deployment-dashboard-cutover-root-fds-v2.py")
    spec = importlib.util.spec_from_file_location("setfarm_root_fd_diagnostic_abi", filename)
    if spec is None or spec.loader is None:
        raise RuntimeError()
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def cohort(abi, lib, uid, parent, observer):
    buffer = (abi.c.c_int32 * 1025)()
    count = abi.query(lib.proc_listpids, (4, uid), buffer)
    abi.require(count % 4 == 0 and 0 < count <= 1024 * 4)
    pids = [buffer[i] for i in range(count // 4)]
    abi.require(all(0 < pid <= 2**31 - 1 for pid in pids))
    abi.require(len(set(pids)) == len(pids) and parent in pids and observer in pids)
    return sorted(pids)


def metadata(abi, lib, pid, uid):
    bsd = abi.BSD()
    abi.require(abi.query(lib.proc_pidinfo, (pid, 3, 0), bsd) == 136)
    abi.require(bsd.pid == pid and bsd.uid == uid and bsd.status in (2, 3, 4, 5))
    abi.require(0 < bsd.startSeconds <= 2**53 - 1 and bsd.startMicroseconds < 1000000)
    abi.require(bsd.status == 5 or (bsd.ppid > 0 and bsd.pgid > 0))
    result = {key: getattr(bsd, key) for key in IDENTITY if key not in ("savedUid", "savedGid")}
    result.update(savedUid=bsd.svuid, savedGid=bsd.svgid, status=bsd.status,
                  inExit=bool(bsd.flags & 4), exitStatus=bsd.xstatus)
    return result


def diagnostic(abi):
    uid, gid, parent, observer = os.getuid(), os.getgid(), os.getppid(), os.getpid()
    abi.require(os.geteuid() == uid and os.getegid() == gid)
    lib = abi.native_provider()
    lib.proc_listpids.argtypes = [abi.c.c_uint32, abi.c.c_uint32, abi.c.c_void_p, abi.c.c_int]
    lib.proc_listpids.restype = abi.c.c_int
    first_pids = cohort(abi, lib, uid, parent, observer)
    first = [metadata(abi, lib, pid, uid) for pid in first_pids]
    abi.require(cohort(abi, lib, uid, parent, observer) == first_pids)
    last = [metadata(abi, lib, pid, uid) for pid in first_pids]
    for before, after in zip(first, last):
        abi.require(all(before[key] == after[key] for key in IDENTITY))
    abi.require((os.getuid(), os.geteuid(), os.getgid(), os.getegid(), os.getppid()) ==
                (uid, uid, gid, gid, parent))
    return {"schema": "setfarm.dashboard-cutover-account-cohort-diagnostic.v2",
            "authority": "diagnostic-only", "coverage": "sampled-effective-uid-process-metadata",
            "uid": uid, "gid": gid, "observerPid": observer, "parentPid": parent,
            "processes": [{"first": before, "last": after} for before, after in zip(first, last)]}


def main():
    try:
        # Exact bounded schema-only wire and EOF before dependency import/query.
        if sys.stdin.buffer.read(65537) != REQUEST:
            raise RuntimeError()
        abi = load_provider()
        packet = abi.canonical(diagnostic(abi))
        abi.require(len(packet) <= 1048576)
        abi.require(sys.stdout.buffer.write(packet) == len(packet))
        sys.stdout.buffer.flush()
        return 0
    except Exception:
        # Query/validation refuses before publication. Partial transport bytes
        # are never accepted under the parent's natural status/full-EOF contract.
        try:
            sys.stderr.write("DASHBOARD_ACCOUNT_COHORT_DIAGNOSTIC_REFUSED\n")
            sys.stderr.flush()
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
