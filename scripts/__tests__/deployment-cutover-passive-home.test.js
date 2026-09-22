import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";

const helper = new URL("../deployment-cutover-passive-home.py", import.meta.url);
const nativeOptions = { skip: process.platform === "darwin" ? false : "Darwin native process APIs required" };
const expected = { executable: "/fixture/node", argv: ["node", "", "/fixture/cli.js"],
  environment: { HOME: "/fixture/account", PATH: "/usr/bin:/bin", SECRET: "PRIVATE_SENTINEL" } };
function packed({ argv = expected.argv, environment = Object.entries(expected.environment).map(([k, v]) => `${k}=${v}`),
  padding = 3, suffix = ["pfz=0x123", "ptr_munge=0x456"], trailing = 2 } = {}) {
  const argc = Buffer.alloc(4); argc.writeInt32LE(argv.length);
  return Buffer.concat([argc, Buffer.from(expected.executable + "\0\0\0"),
    Buffer.from(argv.join("\0") + "\0"), Buffer.from(environment.join("\0") + "\0"),
    Buffer.alloc(padding), Buffer.from(suffix.length ? suffix.join("\0") + "\0" : ""), Buffer.alloc(trailing)]);
}
function qualify(bytes, profile = expected) {
  assert.ok(fs.existsSync(helper), "fixed passive HOME helper must exist");
  const source = fs.readFileSync(helper, "utf8");
  const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import base64, json, sys
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
request = json.load(sys.stdin)
buffer = bytearray(base64.b64decode(request["bytes"]))
try:
    scope["qualify_buffer"](buffer, len(buffer), request["expected"])
    print("QUALIFIED")
except Exception:
    print("REFUSED")
finally:
    buffer[:] = b"\\0" * len(buffer)
`], { input: JSON.stringify({ bytes: bytes.toString("base64"), expected: profile }), encoding: "utf8",
    cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, timeout: 5000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /PRIVATE_SENTINEL|ptr_munge|\/fixture\/account/);
  return result.stdout.trim();
}

test("fixed helper entry refuses malformed private input without traceback or echo", () => {
  const source = fs.readFileSync(helper, "utf8");
  for (const input of ["{PRIVATE_SENTINEL", '{"pid":2,"pid":3}', JSON.stringify({ secret: "PRIVATE_SENTINEL" })]) {
    const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", source], {
      input, encoding: "utf8", cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 65536,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED\n");
  }
});

test("native buffer qualifies exact private profile and preserves empty argv", () => {
  assert.equal(qualify(packed()), "QUALIFIED");
});

test("native buffer tolerates bounded erased Apple strings after exact environment", () => {
  assert.equal(qualify(packed({ padding: 107 })), "QUALIFIED");
  assert.equal(qualify(packed({ suffix: ["pfz=0x123", "", "", "ptr_munge=0x456"] })), "QUALIFIED");
  assert.equal(qualify(packed({ trailing: 128 })), "QUALIFIED");
});

test("finite optional environment family accepts only exact declared system fields", () => {
  const profile = { ...expected, optionalEnvironment: { USER: "fixture", XPC_FLAGS: "0x0" } };
  const mandatory = Object.entries(expected.environment).map(([key, value]) => `${key}=${value}`);
  assert.equal(qualify(packed(), profile), "QUALIFIED");
  assert.equal(qualify(packed({ environment: [...mandatory, "USER=fixture", "XPC_FLAGS=0x0"] }), profile), "QUALIFIED");
  assert.equal(qualify(packed({ environment: [...mandatory, "USER=foreign"] }), profile), "REFUSED");
  assert.equal(qualify(packed({ environment: [...mandatory, "NODE_OPTIONS=--require=foreign"] }), profile), "REFUSED");
  assert.equal(qualify(packed(), { ...profile, optionalEnvironment: { HOME: expected.environment.HOME } }), "REFUSED");
  assert.equal(qualify(packed(), { ...profile, optionalEnvironment: { NODE_OPTIONS: "" } }), "REFUSED");
});

for (const [name, options] of [
  ["duplicate HOME", { environment: ["HOME=/fixture/account", "HOME=/fixture/account", "PATH=/usr/bin:/bin", "SECRET=PRIVATE_SENTINEL"] }],
  ["HOME moved into Apple suffix", { environment: ["PATH=/usr/bin:/bin", "SECRET=PRIVATE_SENTINEL"], suffix: ["HOME=/fixture/account"] }],
  ["duplicate suffix HOME", { suffix: ["pfz=0x123", "HOME=/fixture/account"] }],
  ["ambiguous zero-padding boundary", { padding: 0 }],
  ["missing suffix", { suffix: [] }],
  ["hidden HOME after erased suffix", { suffix: ["pfz=0x123", "", "HOME=/fixture/account"] }],
  ["malformed suffix", { suffix: ["not-a-key-value"] }],
  ["malformed suffix after erasure", { suffix: ["pfz=0x123", "", "not-a-key-value"] }],
  ["empty environment entry", { environment: ["HOME=/fixture/account", "", "PATH=/usr/bin:/bin", "SECRET=PRIVATE_SENTINEL"] }],
  ["wrong argv", { argv: ["node", "/foreign/cli.js"] }],
]) test(`native buffer refuses ${name}`, () => assert.equal(qualify(packed(options)), "REFUSED"));

test("native buffer refuses changed private values without echoing them", () => {
  assert.equal(qualify(packed(), { ...expected, environment: { ...expected.environment, SECRET: "OTHER_SENTINEL" } }), "REFUSED");
});

test("native buffer refuses truncated suffix and redaction after argv", () => {
  const full = packed({ trailing: 0 });
  assert.equal(qualify(full.subarray(0, full.length - 1)), "REFUSED");
  const envStart = full.indexOf(Buffer.from("HOME="));
  assert.equal(qualify(full.subarray(0, envStart)), "REFUSED");
});

for (const [fault, accepted, allocations] of [
  ["identity-only", true, 0], ["stale-generation", false, 0],
  ["optional-presence-drift", false, 2],
  ["none", true, 2], ["short-info", false, 0], ["unterminated-path", false, 0],
  ["length-disagreement", false, 1], ["second-read-failure", false, 2],
  ["start-drift", false, 1], ["credential-drift", false, 1], ["buffer-drift", false, 2],
]) test(`native bridge ${fault} drains and zeros every sensitive allocation`, nativeOptions, () => {
  const source = fs.readFileSync(helper, "utf8");
  const request = { pid: 12345, uid: process.getuid(), gid: process.getgid(), launchExecutable: expected.executable,
    expectedStartSeconds: fault === "stale-generation" ? 1233 : 1234, expectedStartMicroseconds: 5678, ...expected };
  if (fault === "optional-presence-drift") request.optionalEnvironment = { USER: "fixture" };
  const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import base64, ctypes, json, sys
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
request = json.load(sys.stdin)
data = bytearray(base64.b64decode(request["bytes"]))
alternate = bytearray(base64.b64decode(request["alternate"]))
fault = request["fault"]
saved = []
counts = {"identities": 0, "reads": 0}
class Call:
    def __init__(self, fn): self.fn = fn
    def __call__(self, *args): return self.fn(*args)
class Library: pass
library = Library()
def info(pid, flavor, arg, pointer, size):
    counts["identities"] += 1
    if fault == "short-info": return 135
    value = ctypes.cast(pointer, ctypes.POINTER(scope["BsdInfo"])).contents
    value.pid, value.ppid, value.status = pid, 1, 2
    for key in ("uid", "ruid", "svuid"): setattr(value, key, request["expected"]["uid"])
    for key in ("gid", "rgid", "svgid"): setattr(value, key, request["expected"]["gid"])
    value.start_seconds, value.start_microseconds = 1234, 5678
    if fault == "start-drift" and counts["identities"] == 2: value.start_seconds += 1
    if fault == "credential-drift" and counts["identities"] == 2: value.uid += 1
    return 136
def path(pid, target, size):
    raw = request["expected"]["executable"].encode()
    ctypes.memmove(target, raw, len(raw))
    if fault == "unterminated-path": target[len(raw)] = 1
    return len(raw)
def sysctl(mib, count, target, size_pointer, new, new_size):
    if fault in ("identity-only", "stale-generation"): raise AssertionError("IDENTITY_MUST_PRECEDE_ENV_READ")
    size = ctypes.cast(size_pointer, ctypes.POINTER(ctypes.c_size_t))
    if mib[1] == 8:
        ctypes.cast(target, ctypes.POINTER(ctypes.c_int))[0] = 1048576
        size[0] = 4
        return 0
    current = alternate if fault == "optional-presence-drift" and counts["reads"] >= 1 else data
    if target is None:
        size[0] = len(current)
        return 0
    counts["reads"] += 1
    saved.append(target)
    ctypes.memmove(target, (ctypes.c_ubyte * len(current)).from_buffer(current), len(current))
    size[0] = len(current)
    if fault == "length-disagreement": size[0] -= 1
    if fault == "second-read-failure" and counts["reads"] == 2: return -1
    if fault == "buffer-drift" and counts["reads"] == 2: target[len(data) - 4] ^= 1
    return 0
library.proc_pidinfo, library.proc_pidpath, library.sysctl = Call(info), Call(path), Call(sysctl)
ctypes.CDLL = lambda *args, **kwargs: library
accepted = False
try:
    if fault == "identity-only":
        identity = scope["identify_process"]({key: request["expected"][key] for key in ("pid", "uid", "gid", "executable")})
        assert identity == {"schema": "setfarm.internal-production-passive-process-identity.v1", "pid": 12345, "ppid": 1,
                            "uid": request["expected"]["uid"], "gid": request["expected"]["gid"], "startSeconds": 1234, "startMicroseconds": 5678}
    else:
        scope["measure_process"](request["expected"])
    accepted = True
except ValueError:
    pass
print(json.dumps({"accepted": accepted, "allocations": len(saved), "allZero": all(all(byte == 0 for byte in buffer) for buffer in saved)}))
`], { input: JSON.stringify({ expected: request, bytes: packed(fault === "optional-presence-drift" ? {
      environment: [...Object.entries(expected.environment).map(([key, value]) => `${key}=${value}`), "USER=fixture"],
    } : {}).toString("base64"), alternate: packed().toString("base64"), fault }), encoding: "utf8",
    cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { accepted, allocations, allZero: true });
});

for (const [fault, outcome] of [["present", "present"], ["absent-first", "absent"], ["absent-second", "absent"],
  ["denied", "refused"], ["stale-errno", "refused"], ["short-esrch", "refused"], ["negative-esrch", "refused"],
  ["zero-noerrno", "refused"], ["generation-then-absent", "refused"], ["parent-then-absent", "refused"],
  ["credential-then-absent", "refused"], ["path-esrch", "refused"], ["identify-absent", "refused"], ["measure-absent", "refused"]]) {
  test(`sampled native monitor ${fault} distinguishes lookup absence without environment reads`, nativeOptions, () => {
    const source = fs.readFileSync(helper, "utf8");
    const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import ctypes, errno, json
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
fault = ${JSON.stringify(fault)}
expected = {"pid":12345,"uid":501,"gid":20,"executable":"/fixture/node","expectedParentPid":1,"expectedStartSeconds":1234,"expectedStartMicroseconds":5678}
counts = {"info":0,"path":0,"env":0}
class Call:
    def __init__(self, fn): self.fn = fn
    def __call__(self, *args): return self.fn(*args)
class Library: pass
library = Library()
def info(pid, flavor, arg, pointer, size):
    counts["info"] += 1
    assert flavor == 3 and arg == 0 and size == 136
    if fault in ("absent-first", "identify-absent", "measure-absent") or (fault.endswith("then-absent") and counts["info"] == 2) or (fault == "absent-second" and counts["info"] == 2):
        ctypes.set_errno(errno.ESRCH); return 0
    if fault == "denied": ctypes.set_errno(errno.EPERM); return 0
    if fault in ("stale-errno", "zero-noerrno"): return 0
    if fault == "short-esrch": ctypes.set_errno(errno.ESRCH); return 135
    if fault == "negative-esrch": ctypes.set_errno(errno.ESRCH); return -1
    value = ctypes.cast(pointer, ctypes.POINTER(scope["BsdInfo"])).contents
    value.pid, value.ppid, value.status = pid, 1, 2
    for key in ("uid", "ruid", "svuid"): setattr(value, key, 501)
    for key in ("gid", "rgid", "svgid"): setattr(value, key, 20)
    value.start_seconds, value.start_microseconds = 1234, 5678
    if fault == "generation-then-absent": value.start_seconds += 1
    if fault == "parent-then-absent": value.ppid += 1
    if fault == "credential-then-absent": value.uid += 1
    return 136
def executable(pid, target, size):
    counts["path"] += 1
    if fault == "path-esrch": ctypes.set_errno(errno.ESRCH); return 0
    raw = expected["executable"].encode(); ctypes.memmove(target, raw, len(raw)); return len(raw)
def forbidden(*args): counts["env"] += 1; raise ValueError("ENV_MUST_NOT_BE_READ")
library.proc_pidinfo, library.proc_pidpath, library.sysctl = Call(info), Call(executable), Call(forbidden)
ctypes.CDLL = lambda *args, **kwargs: library
if fault == "stale-errno": ctypes.set_errno(errno.ESRCH)
value = None
try:
    if fault == "identify-absent": value = scope["identify_process"]({key:expected[key] for key in ("pid","uid","gid","executable")})
    elif fault == "measure-absent":
        request = {key:expected[key] for key in expected if key != "expectedParentPid"}
        request.update({"launchExecutable":"/fixture/node","argv":["node"],"environment":{"HOME":"/fixture"}})
        value = scope["measure_process"](request)
    else:
        monitor = scope.get("monitor_process")
        if monitor is not None: value = monitor(expected)
except ValueError: pass
print(json.dumps({"value":value,"counts":counts}))
`], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, cwd: "/", timeout: 5000, maxBuffer: 4096 });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.counts.env, 0);
    const want = outcome === "absent" ? { schema: "setfarm.internal-production-passive-process-absence.v1", pid: 12345, evidence: "proc-pidinfo-esrch" }
      : outcome === "present" ? { schema: "setfarm.internal-production-passive-process-identity.v1", pid: 12345, ppid: 1, uid: 501, gid: 20, startSeconds: 1234, startMicroseconds: 5678 } : null;
    assert.deepEqual(observed.value, want);
    if (fault.endsWith("then-absent")) assert.deepEqual(observed.counts, { info: 1, path: 0, env: 0 });
    if (outcome === "absent") assert.equal(observed.counts.info, fault === "absent-first" ? 1 : 2);
  });
}

test("sampled native entry distinguishes an owned child after its observed exit", nativeOptions, async () => {
  const source = fs.readFileSync(helper, "utf8"), executable = fs.realpathSync.native(process.execPath);
  const child = spawn(executable, ["-e", 'process.stdout.write("ready\\n");setTimeout(()=>{},10000)'], { env: {}, stdio: ["ignore", "pipe", "pipe"] });
  const invoke = request => spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", source], {
    input: JSON.stringify(request), encoding: "utf8", cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 2000, maxBuffer: 4096,
  });
  let exited = false;
  try {
    await once(child.stdout, "data");
    const request = { pid: child.pid, uid: process.getuid(), gid: process.getgid(), executable };
    const first = invoke({ ...request, operation: "identify" }); assert.equal(first.status, 0, first.stderr);
    const identity = JSON.parse(first.stdout), monitor = { ...request, operation: "monitor", expectedParentPid: identity.ppid,
      expectedStartSeconds: identity.startSeconds, expectedStartMicroseconds: identity.startMicroseconds };
    const live = invoke(monitor); assert.equal(live.status, 0, live.stderr); assert.deepEqual(JSON.parse(live.stdout), identity);
    const exit = once(child, "exit"); child.kill("SIGTERM"); await exit; exited = true;
    const gone = invoke(monitor); assert.equal(gone.status, 0, gone.stderr); assert.equal(gone.stderr, "");
    assert.deepEqual(JSON.parse(gone.stdout), { schema: "setfarm.internal-production-passive-process-absence.v1", pid: child.pid, evidence: "proc-pidinfo-esrch" });
    assert.equal(invoke({ ...request, operation: "identify" }).status, 1);
  } finally {
    if (!exited) { const exit = once(child, "exit"); child.kill("SIGTERM"); await exit; }
  }
});

for (const kind of ["physical", "symlink", "mutated-live-environment"]) test(`native bridge measures identity-bound owned ${kind} child`, nativeOptions, async () => {
  const linked = kind === "symlink";
  const executable = fs.realpathSync.native(process.execPath);
  const directory = linked ? fs.mkdtempSync(path.join(os.tmpdir(), "cutover-passive-native-")) : null;
  const launched = directory ? path.join(directory, "node") : executable;
  if (directory) fs.symlinkSync(executable, launched);
  const mutation = kind === "mutated-live-environment" ? 'process.env.PATH="x";process.env.PATH="/different/longer/fixture/path";process.env.DEBUG="fixture";delete process.env.DEBUG;' : "";
  const argv = [launched, "-e", mutation + 'process.stdout.write("READY");setTimeout(()=>{},10000)'];
  const environment = { HOME: "/fixture/account", SECRET: "NATIVE_PRIVATE_SENTINEL", PATH: "/original/fixture", PAD: "" };
  const byteLength = () => argv.reduce((n, value) => n + Buffer.byteLength(value) + 1, 0)
    + Object.entries(environment).reduce((n, [key, value]) => n + Buffer.byteLength(`${key}=${value}`) + 1, 0);
  while (byteLength() % 8 !== 1) environment.PAD += "x";
  const child = spawn(launched, argv.slice(1), { env: environment, stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit");
  try {
    const [ready] = await once(child.stdout, "data");
    assert.equal(ready.toString(), "READY");
    const source = fs.readFileSync(helper, "utf8");
    const identityRequest = { pid: child.pid, uid: process.getuid(), gid: process.getgid(), executable };
    const identified = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import json, sys
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
print(json.dumps(scope["identify_process"](json.load(sys.stdin))))
`], { input: JSON.stringify(identityRequest), encoding: "utf8", cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 4096 });
    assert.equal(identified.status, 0, identified.stderr);
    const generation = JSON.parse(identified.stdout);
    const identityEntry = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", source], {
      input: JSON.stringify({ ...identityRequest, operation: "identify" }), encoding: "utf8", cwd: "/",
      env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 4096,
    });
    assert.equal(identityEntry.status, 0, identityEntry.stderr);
    assert.deepEqual(JSON.parse(identityEntry.stdout), generation);
    const request = { ...identityRequest, launchExecutable: launched, argv, environment,
      expectedStartSeconds: generation.startSeconds, expectedStartMicroseconds: generation.startMicroseconds };
    const measure = profile => spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import json, sys
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
try:
    result = scope["measure_process"](json.load(sys.stdin))
    print(json.dumps(result, sort_keys=True))
except Exception as error:
    import traceback
    print(type(error).__name__ + ":REFUSED:" + str([item.lineno for item in traceback.extract_tb(error.__traceback__)]))
`], { input: JSON.stringify(profile), encoding: "utf8", cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 65536 });
    const result = measure(request);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /NATIVE_PRIVATE_SENTINEL|ptr_munge|\/fixture\/account/);
    assert.ok(result.stdout.startsWith("{"), `measurement must exist: ${result.stdout}`);
    const measured = JSON.parse(result.stdout);
    assert.equal(measured.pid, child.pid);
    assert.equal(measured.homeContext, "account");
    assert.equal(measured.stableDoubleRead, true);
    assert.ok(Number.isSafeInteger(measured.startSeconds) && measured.startSeconds > 0);
    assert.equal(measured.startSeconds, generation.startSeconds);
    assert.equal(measured.startMicroseconds, generation.startMicroseconds);
    const entry = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", source], {
      input: JSON.stringify(request), encoding: "utf8", cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 4096,
    });
    assert.equal(entry.status, 0, entry.stderr);
    assert.equal(entry.stderr, "");
    assert.deepEqual(JSON.parse(entry.stdout), measured);
    for (const crossed of [{ ...request, uid: request.uid + 1 }, { ...request, executable: "/foreign/node" },
      { ...request, launchExecutable: "/foreign/node" },
      { ...request, argv: [executable, "-e", "foreign"] }]) {
      const refused = measure(crossed);
      assert.equal(refused.status, 0);
      assert.match(refused.stdout.trim(), /^ValueError:REFUSED:\[[0-9, ]+\]$/);
      assert.equal(refused.stderr, "");
    }
    child.kill("SIGTERM");
    await exited;
    const vanished = measure(request);
    assert.equal(vanished.status, 0);
    assert.match(vanished.stdout.trim(), /^ValueError:REFUSED:\[[0-9, ]+\]$/);
    assert.equal(vanished.stderr, "");
  } finally {
    // Only this test-owned child is terminated; never a launcher-derived PID.
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
});
