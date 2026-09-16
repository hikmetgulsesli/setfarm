"""Private read-only cutover measurement; never a process-control interface.

Parsing is conditional on qualified launcher provenance, no empty environment
entries and reviewed cooperative startup without saved argv/environment stack
string rewriting. Live getenv replacements are distinct from saved stack bytes.
KERN_PROCARGS2 is mutable stack evidence, not an immutable exec record.
"""

import ctypes
import struct
import sys


MAX_BYTES = 1024 * 1024 + 4  # Darwin ARG_MAX plus the procargs2 argc word.
OPTIONAL_NAMES = {"USER", "LOGNAME", "SHELL", "TMPDIR", "XPC_FLAGS", "__CF_USER_TEXT_ENCODING"}


def refuse():
    raise ValueError("DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED")


def qualify_buffer(buffer, length, expected):
    """Compare in place; return no environment values or secret-derived hashes.

    An explicit extra NUL must follow the exact environment. Trusted startup may
    erase Apple strings, but not argv/environment entries. Every surviving suffix
    string is consumed across bounded zero runs; Apple semantics are not
    authenticated. Caller owns and clears the mutable native buffer.
"""
    view = memoryview(buffer).cast("B")
    if view.readonly or type(length) is not int or not 8 <= length <= min(len(view), MAX_BYTES):
        refuse()
    required_keys = {"executable", "argv", "environment"}
    if type(expected) is not dict or set(expected) not in (required_keys, required_keys | {"optionalEnvironment"}):
        refuse()

    def encoded(value):
        if type(value) is not str or "\0" in value or len(value) > MAX_BYTES:
            refuse()
        return value.encode("utf8", "strict")

    executable = encoded(expected["executable"])
    if not executable.startswith(b"/") or type(expected["argv"]) is not list:
        refuse()
    argv = [encoded(value) for value in expected["argv"]]
    if not 1 <= len(argv) <= 64 or not argv[0]:
        refuse()
    environment = expected["environment"]
    if type(environment) is not dict or not 1 <= len(environment) <= 128:
        refuse()
    wanted = {}
    for key, value in environment.items():
        raw_key = encoded(key)
        if not valid_key(raw_key):
            refuse()
        wanted[raw_key] = encoded(value)
    if not wanted.get(b"HOME", b"").startswith(b"/"):
        refuse()
    optional = expected.get("optionalEnvironment", {})
    if (type(optional) is not dict or not set(optional).issubset(OPTIONAL_NAMES)
            or set(optional).intersection(environment) or len(optional) + len(environment) > 128):
        refuse()
    allowed = {**wanted, **{encoded(key): encoded(value) for key, value in optional.items()}}
    if struct.unpack_from("=i", view, 0)[0] != len(argv):
        refuse()

    def string_end(start):
        end = start
        while end < length and view[end] != 0:
            end += 1
        if end == length:
            refuse()
        return end

    def matches(start, end, value):
        return end - start == len(value) and all(view[start + i] == byte for i, byte in enumerate(value))

    end = string_end(4)
    if not matches(4, end, executable):
        refuse()
    position = end + 1
    padding = 0
    while position < length and view[position] == 0:
        position += 1
        padding += 1
    if padding > 7:
        refuse()
    for value in argv:
        end = string_end(position)
        if not matches(position, end, value):
            refuse()
        position = end + 1

    def key_value(start, end):
        split = start
        while split < end and view[split] != 61:
            split += 1
        if split == end or not 1 <= split - start <= 256:
            refuse()
        # Only variable names are copied; never raw values or whole buffers.
        key = bytes(view[start:split])
        if not valid_key(key):
            refuse()
        return key, split + 1

    seen = set()
    while position < length and view[position] != 0:
        end = string_end(position)
        key, value_start = key_value(position, end)
        if key in seen or key not in allowed or not matches(value_start, end, allowed[key]):
            refuse()
        seen.add(key)
        position = end + 1
    if not set(wanted).issubset(seen):
        refuse()
    padding = 0
    while position < length and view[position] == 0:
        position += 1
        padding += 1
    if padding < 1 or position >= length:
        refuse()
    suffix_count = 0
    while position < length:
        if view[position] == 0:
            position += 1
            continue
        end = string_end(position)
        key, unused_value_start = key_value(position, end)
        if key == b"HOME":
            refuse()
        suffix_count += 1
        if suffix_count > 64:
            refuse()
        position = end + 1
    if not suffix_count:
        refuse()


def valid_key(value):
    return (1 <= len(value) <= 256 and (65 <= value[0] <= 90 or 97 <= value[0] <= 122 or value[0] == 95)
            and all(65 <= byte <= 90 or 97 <= byte <= 122 or 48 <= byte <= 57 or byte == 95 for byte in value))


class BsdInfo(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in (
        "flags", "status", "xstatus", "pid", "ppid", "uid", "gid", "ruid", "rgid", "svuid", "svgid", "reserved")]
    _fields_ += [("comm", ctypes.c_char * 16), ("name", ctypes.c_char * 32)]
    _fields_ += [(name, ctypes.c_uint32) for name in ("nfiles", "pgid", "pjobc", "tdev", "tpgid")]
    _fields_ += [("nice", ctypes.c_int32), ("start_seconds", ctypes.c_uint64), ("start_microseconds", ctypes.c_uint64)]


def native_context(expected):
    if sys.platform != "darwin" or type(expected) is not dict or set(expected) != {
            "pid", "uid", "gid", "executable"}:
        refuse()
    if any(type(expected[key]) is not int or not 0 <= expected[key] < 2147483647 for key in ("pid", "uid", "gid")) or expected["pid"] <= 1:
        refuse()
    if type(expected["executable"]) is not str or not expected["executable"].startswith("/") or "\0" in expected["executable"]:
        refuse()
    if (ctypes.sizeof(ctypes.c_void_p) != 8 or ctypes.sizeof(ctypes.c_size_t) != 8
            or ctypes.sizeof(BsdInfo) != 136 or ctypes.alignment(BsdInfo) != 8):
        refuse()
    offsets = {"pid": 12, "ppid": 16, "uid": 20, "gid": 24, "ruid": 28, "rgid": 32,
               "svuid": 36, "svgid": 40, "comm": 48, "name": 64, "nfiles": 96,
               "nice": 116, "start_seconds": 120, "start_microseconds": 128}
    if any(getattr(BsdInfo, key).offset != offset for key, offset in offsets.items()):
        refuse()
    libc = ctypes.CDLL(None, use_errno=True)
    libc.sysctl.argtypes = [ctypes.POINTER(ctypes.c_int), ctypes.c_uint, ctypes.c_void_p,
                           ctypes.POINTER(ctypes.c_size_t), ctypes.c_void_p, ctypes.c_size_t]
    libc.sysctl.restype = ctypes.c_int
    libc.proc_pidinfo.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint64, ctypes.c_void_p, ctypes.c_int]
    libc.proc_pidinfo.restype = ctypes.c_int
    libc.proc_pidpath.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
    libc.proc_pidpath.restype = ctypes.c_int
    pid = expected["pid"]

    def identity():
        info = BsdInfo()
        if libc.proc_pidinfo(pid, 3, 0, ctypes.byref(info), ctypes.sizeof(info)) != ctypes.sizeof(info):
            refuse()
        if (info.pid != pid or info.status not in (2, 3) or info.start_seconds == 0
                or info.start_microseconds >= 1000000
                or any(getattr(info, key) != expected["uid"] for key in ("uid", "ruid", "svuid"))
                or any(getattr(info, key) != expected["gid"] for key in ("gid", "rgid", "svgid"))):
            refuse()
        target = (ctypes.c_ubyte * 4096)()
        size = libc.proc_pidpath(pid, target, len(target))
        executable = expected["executable"].encode("utf8", "strict")
        if not 0 < size < len(target) or size != len(executable) or target[size] != 0 or any(
                target[index] != value for index, value in enumerate(executable)):
            refuse()
        return {"pid": pid, "ppid": info.ppid, "uid": info.uid, "gid": info.gid,
                "startSeconds": info.start_seconds, "startMicroseconds": info.start_microseconds}

    return libc, identity


def identify_process(expected):
    """Private pre-measurement generation observation; never reads environment."""
    unused_libc, identity = native_context(expected)
    before, after = identity(), identity()
    if before != after:
        refuse()
    return {"schema": "setfarm.internal-production-passive-process-identity.v1", **before}


def measure_process(expected):
    """Internal measurement only; caller separately authenticates label provenance.

    No process-control calls. The expected profile is private comparison input,
    not a capability or returned proof of launcher ownership.
    """
    required_keys = {
            "pid", "uid", "gid", "executable", "launchExecutable", "argv", "environment",
            "expectedStartSeconds", "expectedStartMicroseconds"}
    if type(expected) is not dict or set(expected) not in (required_keys, required_keys | {"optionalEnvironment"}):
        refuse()
    if (type(expected["expectedStartSeconds"]) is not int or not 0 < expected["expectedStartSeconds"] <= 9007199254740991
            or type(expected["expectedStartMicroseconds"]) is not int or not 0 <= expected["expectedStartMicroseconds"] < 1000000):
        refuse()
    libc, read_identity = native_context({key: expected[key] for key in ("pid", "uid", "gid", "executable")})
    buffers = []
    pid = expected["pid"]
    # proc_pidpath reports physical executable; saved exec strings preserve the
    # invoked path. The owner binds both through held PATH and generation proof.
    profile = {"executable": expected["launchExecutable"], "argv": expected["argv"], "environment": expected["environment"],
               "optionalEnvironment": expected.get("optionalEnvironment", {})}

    def identity():
        value = read_identity()
        if (value["startSeconds"] != expected["expectedStartSeconds"]
                or value["startMicroseconds"] != expected["expectedStartMicroseconds"]):
            refuse()
        return value

    def read_arguments(capacity):
        mib = (ctypes.c_int * 3)(1, 49, pid)
        required = ctypes.c_size_t(0)
        if libc.sysctl(mib, 3, None, ctypes.byref(required), None, 0) != 0 or not 8 <= required.value < capacity:
            refuse()
        buffer = (ctypes.c_ubyte * capacity)()
        buffers.append(buffer)
        length = ctypes.c_size_t(capacity)
        if (libc.sysctl(mib, 3, buffer, ctypes.byref(length), None, 0) != 0
                or length.value != required.value or not 8 <= length.value < capacity):
            refuse()
        qualify_buffer(buffer, length.value, profile)
        return buffer, length.value

    try:
        before = identity()
        argmax = ctypes.c_int(0)
        size = ctypes.c_size_t(ctypes.sizeof(argmax))
        mib = (ctypes.c_int * 2)(1, 8)
        if (libc.sysctl(mib, 2, ctypes.byref(argmax), ctypes.byref(size), None, 0) != 0
                or size.value != 4 or not 4096 <= argmax.value <= MAX_BYTES - 4):
            refuse()
        first, first_length = read_arguments(argmax.value + 4)
        middle = identity()
        second, second_length = read_arguments(argmax.value + 4)
        after = identity()
        if before != middle or before != after or first_length != second_length or any(
                first[index] != second[index] for index in range(first_length)):
            refuse()
        return {"schema": "setfarm.internal-production-passive-home-measurement.v1", **before,
                "homeContext": "account", "completeEnvironmentValidated": True, "stableDoubleRead": True}
    finally:
        for buffer in buffers:
            ctypes.memset(ctypes.addressof(buffer), 0, ctypes.sizeof(buffer))


def main():
    import json

    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                refuse()
            result[key] = value
        return result

    try:
        raw = sys.stdin.buffer.read(65537)
        if not 1 <= len(raw) <= 65536:
            refuse()
        request = json.loads(raw, object_pairs_hook=unique_object)
        if type(request) is not dict:
            refuse()
        operation = request.pop("operation", "measure")
        if operation == "identify":
            result = identify_process(request)
        elif operation == "measure":
            result = measure_process(request)
        else:
            refuse()
        sys.stdout.write(json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n")
        return 0
    except Exception:
        sys.stderr.write("DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
