"""Absent-only filesystem leaf; never owner, exclusion or startup authority.

FD3 is a child-local inherited duplicate, not the parent's original occurrence.
The consuming owner must retain its originals, authenticate namespace monotonicity
and await this child's complete settlement. No retry, repair, rollback or unlink.
"""

import ctypes as c
import fcntl
import hashlib
import json
import os
import re
import stat
import sys


ROOT = "restart-authority-retirement-v1"
LOCK = "physical-service-restart-authority.transition.lock"
SCHEMA = "setfarm.internal-production-dashboard-cutover-serialization-lock.v2"
STAGE = re.compile(r"\.dashboard-cutover-root\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.stage\Z")
UUID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\Z")
HASH = re.compile(r"[a-f0-9]{64}\Z")
CORE = ("st_dev", "st_ino", "st_mode", "st_uid", "st_gid", "st_birthtime")
FULL = CORE + ("st_nlink", "st_size", "st_mtime_ns", "st_ctime_ns")
state = "idle"


class Refused(Exception):
    pass


def require(condition):
    if not condition:
        raise Refused()


def same(left, right, fields=CORE):
    return all(getattr(left, field) == getattr(right, field) for field in fields)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False).encode("ascii")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def reject_constant(_):
    raise Refused()


def reservation_wire(wire):
    require(0 < len(wire) <= 65536)
    value = json.loads(wire.decode("ascii"), object_pairs_hook=unique_object,
                       parse_constant=reject_constant)
    require(type(value) is dict and set(value) == {
        "schema", "purpose", "cutoverIntentHash", "ownerClaimHash", "owner", "lockHash"})
    require(value["schema"] == SCHEMA and value["purpose"] == "preserved-dashboard-cutover")
    require(all(type(value[key]) is str and HASH.fullmatch(value[key])
                for key in ("cutoverIntentHash", "ownerClaimHash", "lockHash")))
    owner = value["owner"]
    require(type(owner) is dict and set(owner) == {
        "uid", "pid", "processGroupId", "processLstart", "bootSessionHash", "reservationNonce"})
    require(type(owner["uid"]) is int and owner["uid"] == os.getuid())
    require(type(owner["pid"]) is int and 0 < owner["pid"] <= 2**31 - 1
            and owner["pid"] == os.getppid())
    require(type(owner["processGroupId"]) is int and 0 < owner["processGroupId"] <= 2**31 - 1)
    require(type(owner["processLstart"]) is str and re.fullmatch(
        r"[A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}",
        owner["processLstart"]) is not None)
    require(type(owner["bootSessionHash"]) is str and HASH.fullmatch(owner["bootSessionHash"]))
    require(type(owner["reservationNonce"]) is str and UUID.fullmatch(owner["reservationNonce"]))
    body = {key: entry for key, entry in value.items() if key != "lockHash"}
    require(value["lockHash"] == hashlib.sha256(canonical(body)).hexdigest())
    require(wire == canonical(value) + b"\n")


def publish(stage_leaf):
    global state
    # Shape validation precedes even inherited-FD inspection or native loading.
    require(type(stage_leaf) is str and STAGE.fullmatch(stage_leaf))
    require(state == "idle")
    state = "active"
    slots = []

    def seal(fd, directory, inherited=False):
        slot = {"fd": fd, "state": "unsealed", "identity": None,
                "directory": directory, "inherited": inherited}
        slots.append(slot)  # Register before first fstat; no lost returned FD.
        observed = os.fstat(fd)
        require(stat.S_ISDIR(observed.st_mode) if directory else stat.S_ISREG(observed.st_mode))
        slot["identity"] = observed
        slot["state"] = "sealed"
        return slot

    def close_once(slot):
        require(slot["state"] == "sealed")
        slot["state"] = "close-observing"
        try:
            require(same(slot["identity"], os.fstat(slot["fd"]), CORE if slot["directory"] else FULL))
        except Exception:
            slot["state"] = "identity-unknown"
            raise
        slot["state"] = "close-attempted"
        try:
            os.close(slot["fd"])
        except Exception:
            slot["state"] = "close-unknown"
            raise
        slot["state"] = "close-settled"

    try:
        require(sys.platform == "darwin" and c.sizeof(c.c_void_p) == 8)
        parent = seal(3, True, True)
        uid = os.getuid()
        require(uid == os.geteuid() and os.getgid() == os.getegid())
        require(parent["identity"].st_uid == uid and parent["identity"].st_mode & 0o022 == 0)
        raw_path = fcntl.fcntl(3, 50, b"\0" * 1024)  # Public F_GETPATH.
        require(type(raw_path) is bytes and len(raw_path) == 1024 and b"\0" in raw_path)
        parent_path = raw_path.split(b"\0", 1)[0]
        require(0 < len(parent_path) < 1024 and parent_path.startswith(b"/"))

        def parent_stable():
            held = os.fstat(3)
            named = os.stat(parent_path, follow_symlinks=False)
            require(stat.S_ISDIR(named.st_mode) and same(parent["identity"], held)
                    and same(parent["identity"], named))

        parent_stable()
        root = seal(os.open(stage_leaf, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=3), True)
        root_identity = root["identity"]
        require(root_identity.st_uid == uid and root_identity.st_dev == parent["identity"].st_dev
                and stat.S_IMODE(root_identity.st_mode) == 0o700)
        lock = seal(os.open(LOCK, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=root["fd"]), False)
        lock_identity = lock["identity"]
        require(lock_identity.st_uid == uid and lock_identity.st_dev == root_identity.st_dev
                and stat.S_IMODE(lock_identity.st_mode) == 0o600 and lock_identity.st_nlink == 1
                and 0 < lock_identity.st_size <= 65536)
        wire = os.pread(lock["fd"], 65537, 0)
        require(len(wire) == lock_identity.st_size)
        reservation_wire(wire)

        def original_named(leaf):
            parent_stable()
            require(same(root_identity, os.fstat(root["fd"]))
                    and same(root_identity, os.stat(leaf, dir_fd=3, follow_symlinks=False)))
            require(os.listdir(root["fd"]) == [LOCK])
            require(same(lock_identity, os.fstat(lock["fd"]), FULL)
                    and same(lock_identity, os.stat(LOCK, dir_fd=root["fd"], follow_symlinks=False), FULL)
                    and os.pread(lock["fd"], 65537, 0) == wire)
            parent_stable()

        original_named(stage_leaf)
        os.fsync(lock["fd"])
        original_named(stage_leaf)
        os.fsync(root["fd"])
        original_named(stage_leaf)
        library = c.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
        rename = library.renameatx_np
        rename.argtypes = [c.c_int, c.c_char_p, c.c_int, c.c_char_p, c.c_uint]
        rename.restype = c.c_int
        original_named(stage_leaf)
        # One syscall. No preflight existence check/ordinary-rename fallback.
        c.set_errno(0)
        result = rename(3, stage_leaf.encode("ascii"), 3, ROOT.encode("ascii"), 0x34)
        error = c.get_errno()  # Capture before any further port.
        require(result == 0 and error == 0)
        original_named(ROOT)
        try:
            os.stat(stage_leaf, dir_fd=3, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise Refused()
        os.fsync(3)
        original_named(ROOT)
        for slot in reversed(slots):
            close_once(slot)
        require(all(slot["state"] == "close-settled" for slot in slots) and len(slots) == 3)
        state = "settled"
    except Exception:
        state = "burned"
        # Only checked sealed originals; never retry a close or mutate a path.
        for slot in reversed(slots):
            if slot["state"] == "close-settled":
                continue
            if slot["state"] != "sealed":
                break
            try:
                close_once(slot)
            except Exception:
                break
        raise Refused() from None


def main():
    try:
        require(len(sys.argv) == 2)
        publish(sys.argv[1])
        wire = b"DASHBOARD_ATOMIC_ROOT_PUBLISHED\n"
        require(sys.stdout.buffer.write(wire) == len(wire))
        sys.stdout.buffer.flush()
        return 0
    except Exception:
        try:
            sys.stderr.write("DASHBOARD_ATOMIC_ROOT_PUBLICATION_REFUSED\n")
            sys.stderr.flush()
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
