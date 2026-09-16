import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";

const helper = new URL("../deployment-cutover-passive-home.py", import.meta.url);
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
  ["none", true, 2], ["short-info", false, 0], ["unterminated-path", false, 0],
  ["length-disagreement", false, 1], ["second-read-failure", false, 2],
  ["start-drift", false, 2], ["credential-drift", false, 1], ["buffer-drift", false, 2],
]) test(`native bridge ${fault} drains and zeros every sensitive allocation`, () => {
  const source = fs.readFileSync(helper, "utf8");
  const request = { pid: 12345, uid: process.getuid(), gid: process.getgid(), launchExecutable: expected.executable, ...expected };
  const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", `
import base64, ctypes, json, sys
scope = {"__name__": "passive_home_test"}
exec(compile(${JSON.stringify(source)}, "authenticated-fixture-source", "exec"), scope)
request = json.load(sys.stdin)
data = bytearray(base64.b64decode(request["bytes"]))
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
    size = ctypes.cast(size_pointer, ctypes.POINTER(ctypes.c_size_t))
    if mib[1] == 8:
        ctypes.cast(target, ctypes.POINTER(ctypes.c_int))[0] = 1048576
        size[0] = 4
        return 0
    if target is None:
        size[0] = len(data)
        return 0
    counts["reads"] += 1
    saved.append(target)
    ctypes.memmove(target, (ctypes.c_ubyte * len(data)).from_buffer(data), len(data))
    size[0] = len(data)
    if fault == "length-disagreement": size[0] -= 1
    if fault == "second-read-failure" and counts["reads"] == 2: return -1
    if fault == "buffer-drift" and counts["reads"] == 2: target[len(data) - 4] ^= 1
    return 0
library.proc_pidinfo, library.proc_pidpath, library.sysctl = Call(info), Call(path), Call(sysctl)
ctypes.CDLL = lambda *args, **kwargs: library
accepted = False
try:
    scope["measure_process"](request["expected"])
    accepted = True
except ValueError:
    pass
print(json.dumps({"accepted": accepted, "allocations": len(saved), "allZero": all(all(byte == 0 for byte in buffer) for buffer in saved)}))
`], { input: JSON.stringify({ expected: request, bytes: packed().toString("base64"), fault }), encoding: "utf8",
    cwd: "/", env: { PATH: "/usr/bin:/bin" }, timeout: 5000, maxBuffer: 65536 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { accepted, allocations, allZero: true });
});

for (const linked of [false, true]) test(`native bridge measures identity-bound owned ${linked ? "symlink" : "physical"} child`, async () => {
  const executable = fs.realpathSync.native(process.execPath);
  const directory = linked ? fs.mkdtempSync(path.join(os.tmpdir(), "cutover-passive-native-")) : null;
  const launched = directory ? path.join(directory, "node") : executable;
  if (directory) fs.symlinkSync(executable, launched);
  const argv = [launched, "-e", 'process.stdout.write("READY");setTimeout(()=>{},10000)'];
  const environment = { HOME: "/fixture/account", SECRET: "NATIVE_PRIVATE_SENTINEL", PAD: "" };
  const byteLength = () => argv.reduce((n, value) => n + Buffer.byteLength(value) + 1, 0)
    + Object.entries(environment).reduce((n, [key, value]) => n + Buffer.byteLength(`${key}=${value}`) + 1, 0);
  while (byteLength() % 8 !== 1) environment.PAD += "x";
  const child = spawn(launched, argv.slice(1), { env: environment, stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit");
  try {
    const [ready] = await once(child.stdout, "data");
    assert.equal(ready.toString(), "READY");
    const source = fs.readFileSync(helper, "utf8");
    const request = { pid: child.pid, uid: process.getuid(), gid: process.getgid(), executable, launchExecutable: launched, argv, environment };
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
