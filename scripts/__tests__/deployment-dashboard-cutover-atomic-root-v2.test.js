import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { test as nodeTest } from "node:test";

const test = (name, body) => nodeTest(name, { skip: process.platform !== "darwin" }, body);

const provider = new URL("../deployment-dashboard-cutover-atomic-root-v2.py", import.meta.url).pathname;
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const rootLeaf = "restart-authority-retirement-v1";
const lockLeaf = "physical-service-restart-authority.transition.lock";
async function fixture(body) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-atomic-root-v2-")));
  fs.chmodSync(parent, 0o700);
  const stageLeaf = `.dashboard-cutover-root.${randomUUID()}.stage`;
  const stage = path.join(parent, stageLeaf), root = path.join(parent, rootLeaf);
  fs.mkdirSync(stage, { mode: 0o700 });
  // Deliberately hand-written independent wire, not a production builder oracle.
  const record = { schema: "setfarm.internal-production-dashboard-cutover-serialization-lock.v2",
    purpose: "preserved-dashboard-cutover", cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
    owner: { uid: process.getuid(), pid: process.pid, processGroupId: process.pid,
      processLstart: "Wed Oct  7 00:00:00 2026", bootSessionHash: "c".repeat(64),
      reservationNonce: "01234567-89ab-4cde-8f01-23456789abcd" } };
  const wire = Buffer.from(canonical({ ...record, lockHash: createHash("sha256").update(canonical(record)).digest("hex") }) + "\n");
  const lock = path.join(stage, lockLeaf);
  fs.writeFileSync(lock, wire, { mode: 0o600, flag: "wx" });
  const f = { parent, stageLeaf, stage, root, lock, wire, custodyUnknown: false }, slots = [];
  const open = (target, flags) => {
    const fd = fs.openSync(target, flags), slot = { fd, state: "unsealed", identity: null };
    slots.push(slot);
    slot.identity = fs.fstatSync(fd, { bigint: true }); slot.state = "sealed";
    return fd;
  };
  try {
    f.parentFd = open(parent, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    f.stageFd = open(stage, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    f.lockFd = open(lock, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    return await body(f);
  } finally {
    // Unknown child settlement retains originals; never close them on a timeout,
    // capture overflow, signal or failed spawn observation.
    if (!f.custodyUnknown) {
      const errors = [];
      for (const slot of [...slots].reverse()) {
        if (slot.state !== "sealed") { errors.push(Error("UNSEALED_FIXTURE_FD_RETAINED")); continue; }
        try {
          const current = fs.fstatSync(slot.fd, { bigint: true });
          const expectedMode = slot.fd === f.stageFd && f.ownedStageMode !== undefined
            ? (slot.identity.mode & ~0o7777n) | BigInt(f.ownedStageMode) : slot.identity.mode;
          assert.equal(current.mode, expectedMode);
          assert.ok(["dev", "ino", "uid", "gid", "birthtimeNs"].every(k => current[k] === slot.identity[k]));
          slot.state = "close-attempted";
          fs.closeSync(slot.fd); slot.state = "close-settled";
          assert.throws(() => fs.fstatSync(slot.fd), { code: "EBADF" });
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "FIXTURE_ORIGINAL_CLOSE_UNCERTAIN");
    }
  }
  // Retain every owned fixture and publication; no recursive cleanup/deletion.
}
async function run(f, args = [f.stageLeaf], wrapper = null) {
  const pythonArgs = wrapper === null ? [provider, ...args] : ["-c", wrapper, provider, ...args];
  const child = spawn("/usr/bin/python3", ["-I", "-S", "-B", ...pythonArgs], {
    cwd: "/", env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" },
    stdio: ["ignore", "pipe", "pipe", f.parentFd],
  });
  f.signalCalls ??= [];
  child.kill = (...args) => { f.signalCalls.push(args); throw Error("SIGNAL_FORBIDDEN"); };
  let error, bytes = 0, stdout = "", stderr = "";
  const eof = { stdout: false, stderr: false };
  const captureError = value => { error ??= value; f.custodyUnknown = true; };
  child.on("error", captureError);
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
    stream.setEncoding("utf8");
    stream.on("data", data => {
      bytes += Buffer.byteLength(data);
      if (bytes > 16384) { captureError(Error("BOUNDED_CAPTURE_UNKNOWN")); return; }
      if (name === "stdout") stdout += data; else stderr += data;
    });
    stream.on("error", captureError); stream.on("end", () => { eof[name] = true; });
  }
  const settlement = new Promise(resolve => child.on("close", (status, signal) => resolve({ status, signal })));
  if (f.captureFault === "stream-error") child.stdout.emit("error", Error("OWNED_STREAM_ERROR"));
  const result = await settlement;
  Object.assign(result, { error, stdout, stderr });
  if (!eof.stdout || !eof.stderr) { result.error ??= Error("CAPTURE_EOF_UNKNOWN"); f.custodyUnknown = true; }
  f.lastCapture = { bytes, eof, status: result.status, signal: result.signal, error: !!result.error };
  if (result.error || result.signal !== null || !Number.isInteger(result.status)) f.custodyUnknown = true;
  assert.equal(result.error, undefined); assert.equal(result.signal, null);
  return result;
}
function refused(result) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DASHBOARD_ATOMIC_ROOT_PUBLICATION_REFUSED\n");
}
function original(f, canonicalRoot) {
  assert.equal(fs.fstatSync(f.parentFd).ino, fs.lstatSync(f.parent).ino);
  assert.equal(fs.fstatSync(f.stageFd).ino, fs.lstatSync(canonicalRoot).ino);
  assert.equal(fs.fstatSync(f.lockFd).ino, fs.lstatSync(path.join(canonicalRoot, lockLeaf)).ino);
  assert.deepEqual(readLockOriginal(f), f.wire);
}
function readLockOriginal(f) {
  const bytes = Buffer.alloc(f.wire.length + 1);
  const count = fs.readSync(f.lockFd, bytes, 0, bytes.length, 0);
  return bytes.subarray(0, count);
}

test("actual Darwin publication preserves exact original root, lock and independent parent FDs", () => fixture(async f => {
  const result = await run(f);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  assert.equal(result.stdout, "DASHBOARD_ATOMIC_ROOT_PUBLISHED\n");
  assert.equal(fs.existsSync(f.stage), false); original(f, f.root);
  assert.deepEqual(fs.readdirSync(f.root), [lockLeaf]);
  assert.equal(fs.lstatSync(f.root).mode & 0o7777, 0o700);
  assert.equal(fs.lstatSync(path.join(f.root, lockLeaf)).mode & 0o7777, 0o600);
}));
for (const kind of ["empty-directory", "populated-directory", "file", "symlink"]) {
  test(`existing ${kind} destination refuses unchanged, never normal-rename fallback`, () => fixture(async f => {
    if (kind.includes("directory")) { fs.mkdirSync(f.root); if (kind.startsWith("populated")) fs.writeFileSync(path.join(f.root, "sentinel"), "old"); }
    else if (kind === "file") fs.writeFileSync(f.root, "old");
    else fs.symlinkSync(f.stage, f.root);
    const before = fs.lstatSync(f.root, { bigint: true });
    refused(await run(f));
    const after = fs.lstatSync(f.root, { bigint: true });
    assert.equal(after.ino, before.ino); assert.equal(after.ctimeNs, before.ctimeNs);
    original(f, f.stage);
  }));
}
for (const kind of ["extra-member", "malformed-wire", "hardlinked-lock", "symlink-lock", "unsafe-stage", "symlink-stage"]) {
  test(`${kind} refuses before exposing canonical ROOT`, () => fixture(async f => {
    if (kind === "extra-member") fs.writeFileSync(path.join(f.stage, "extra"), "no");
    if (kind === "malformed-wire") fs.appendFileSync(f.lock, " ");
    if (kind === "hardlinked-lock") fs.linkSync(f.lock, path.join(f.parent, "alias"));
    if (kind === "symlink-lock") { fs.renameSync(f.lock, path.join(f.parent, "original-lock")); fs.symlinkSync(path.join(f.parent, "original-lock"), f.lock); }
    if (kind === "unsafe-stage") { fs.fchmodSync(f.stageFd, 0o777); f.ownedStageMode = 0o777; }
    if (kind === "symlink-stage") { fs.renameSync(f.stage, path.join(f.parent, "original-stage")); fs.symlinkSync(path.join(f.parent, "original-stage"), f.stage); }
    refused(await run(f)); assert.equal(fs.existsSync(f.root), false);
    assert.ok(fs.fstatSync(f.parentFd).isDirectory()); assert.ok(fs.fstatSync(f.stageFd).isDirectory());
    assert.ok(fs.fstatSync(f.lockFd).isFile());
  }));
}
test("hostile argv has zero FD/native ports, including missing, traversal and extra args", () => fixture(async f => {
  const shim = `import importlib.util,sys,os,ctypes
spec=importlib.util.spec_from_file_location('atomic',sys.argv[1]); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
calls=0
def trap(*args,**kwargs):
 global calls
 calls+=1;raise AssertionError('UNQUALIFIED_PORT')
os.fstat=trap; os.open=trap; ctypes.CDLL=trap
sys.argv=sys.argv[1:]; result=m.main()
if calls:sys.exit(73)
sys.exit(result)`;
  for (const args of [[], ["../escape"], [f.stageLeaf.toUpperCase()], [f.stageLeaf, "extra"]]) refused(await run(f, args, shim));
  assert.equal(fs.existsSync(f.root), false); original(f, f.stage);
}));
test("zero-port oracle rejects an actual premature-fstat source variant even when main swallows its exception", () => fixture(async f => {
  const shim = `import sys,os,ctypes,types
with open(sys.argv[1],encoding='utf8') as source: code=source.read()
marker='        require(len(sys.argv) == 2)'
assert code.count(marker)==1
code=code.replace(marker,'        os.fstat(3)\\n'+marker)
m=types.ModuleType('atomic');exec(compile(code,sys.argv[1],'exec'),m.__dict__)
calls=0
def trap(*args,**kwargs):
 global calls
 calls+=1;raise AssertionError('UNQUALIFIED_PORT')
os.fstat=trap;os.open=trap;ctypes.CDLL=trap
sys.argv=sys.argv[1:];result=m.main()
sys.exit(73 if calls else result)`;
  const result = await run(f, [], shim);
  assert.equal(result.status, 73); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DASHBOARD_ATOMIC_ROOT_PUBLICATION_REFUSED\n");
  assert.equal(fs.existsSync(f.root), false); original(f, f.stage);
}));
test("owned FIFO lock refuses promptly with no publication or deletion", () => fixture(async f => {
  fs.renameSync(f.lock, path.join(f.parent, "original-lock"));
  const made = await run(f, [f.lock], "import os,sys;os.mkfifo(sys.argv[2],0o600);os.close(3)");
  assert.equal(made.error, undefined); assert.equal(made.signal, null); assert.equal(made.status, 0, made.stderr);
  assert.equal(made.stdout, ""); assert.equal(made.stderr, "");
  refused(await run(f)); assert.equal(fs.existsSync(f.root), false);
  assert.ok(fs.lstatSync(f.lock).isFIFO()); assert.deepEqual(readLockOriginal(f), f.wire);
}));
test("inherited non-directory FD3 refuses without adopting it as parent authority", () => fixture(async f => {
  const parentFd = f.parentFd;
  try { f.parentFd = f.lockFd; refused(await run(f)); }
  finally { f.parentFd = parentFd; }
  assert.equal(fs.existsSync(f.root), false); original(f, f.stage);
}));
for (const fault of ["overflow", "stream-error"]) {
  test(`test-parent ${fault} drains natural child, signals zero, and retains all originals`, async () => {
    let retained;
    await fixture(async f => {
      retained = f; f.captureFault = fault;
      const shim = fault === "overflow"
        ? "import os,sys;sys.stdout.write('x'*20000);sys.stdout.flush();os.close(3)"
        : "import os;os.close(3)";
      await assert.rejects(run(f, [], shim));
      assert.equal(f.custodyUnknown, true); assert.deepEqual(f.signalCalls, []);
      assert.deepEqual(f.lastCapture.eof, { stdout: true, stderr: true });
      assert.equal(f.lastCapture.status, 0); assert.equal(f.lastCapture.signal, null);
      assert.equal(fs.existsSync(f.root), false); original(f, f.stage);
    });
    // Negative custody deliberately retained beyond fixture return, not closed
    // after a receipt/capture error. Natural Node exit is not explicit disposal.
    original(retained, retained.stage);
  });
}
test("publication-first order exposes complete V2 wire before any legacy mkdir", () => fixture(async f => {
  const result = await run(f); assert.equal(result.status, 0, result.stderr);
  assert.throws(() => fs.mkdirSync(f.root), { code: "EEXIST" });
  assert.throws(() => fs.openSync(path.join(f.root, lockLeaf), "wx"), { code: "EEXIST" });
  // V1's strict schema gate is independently asserted, not a permissive JSON fallback.
  assert.notEqual(JSON.parse(fs.readFileSync(path.join(f.root, lockLeaf), "utf8")).schema,
    "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1");
  original(f, f.root);
}));
test("legacy-mkdir-first order retains complete stage and adds no lock to legacy ROOT", () => fixture(async f => {
  fs.mkdirSync(f.root, { mode: 0o700 }); const old = fs.lstatSync(f.root).ino;
  refused(await run(f)); assert.equal(fs.lstatSync(f.root).ino, old);
  assert.deepEqual(fs.readdirSync(f.root), []); original(f, f.stage);
}));

// Fault fixtures evaluate the actual helper, using only filesystem/native/output
// boundary faults. They are not installed-provider success qualifications.
async function audited(f, fault) {
  const shim = `import importlib.util,sys,os,ctypes,io,json,types,errno
spec=importlib.util.spec_from_file_location('atomic',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fault=${JSON.stringify(fault)}; opened=[]; flags=[]; closes=[]; syncs=[]; native=[]; final_lock_checks=0
original_open=os.open; original_close=os.close; original_stat=os.fstat; original_sync=os.fsync; original_lib=ctypes.CDLL
def tracked_open(*args,**kwargs):
 fd=original_open(*args,**kwargs);opened.append(fd);flags.append(bool(args[1]&os.O_NONBLOCK));return fd
def tracked_stat(fd):
 global final_lock_checks
 if fault=='unsealed-root' and opened and fd==opened[0]: raise OSError(errno.EIO,'fixture')
 if fault in ('preclose-observation-error','preclose-observation-mismatch') and len(opened)==2 and fd==opened[1] and len(syncs)==3:
  final_lock_checks+=1
  if final_lock_checks==2:
   if fault=='preclose-observation-error': raise OSError(errno.EIO,'fixture')
   result=original_stat(fd);bad=types.SimpleNamespace(**{k:getattr(result,k) for k in m.FULL});bad.st_mode^=1;return bad
 return original_stat(fd)
def tracked_close(fd):
 closes.append(fd)
 close_at=2 if fault.endswith('-root') else 3 if fault.endswith('-parent') else 1
 if fault.startswith('close-error') and len(closes)==close_at: raise OSError(errno.EIO,'fixture')
 original_close(fd)
 if fault.startswith('close-response-loss') and len(closes)==close_at: raise OSError(errno.EIO,'fixture')
def tracked_sync(fd):
 syncs.append(fd)
 if fault in ('file-sync','root-sync','parent-sync') and len(syncs)=={'file-sync':1,'root-sync':2,'parent-sync':3}[fault]: raise OSError(errno.EIO,'fixture')
 original_sync(fd)
def tracked_library(*args,**kwargs):
 lib=original_lib(*args,**kwargs); original=lib.renameatx_np
 original.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint];original.restype=ctypes.c_int
 def rename(*args):
  native.append({'fromFd':args[0],'toFd':args[2],'flags':args[4]})
  if fault in ('native-error','native-unsupported'): ctypes.set_errno(errno.EBUSY if fault=='native-error' else errno.ENOTSUP);return -1
  result=original(*args)
  if fault=='native-response-loss': raise OSError(errno.EIO,'fixture')
  if fault=='postpublication-drift' and result==0: os.fchmod(opened[0],0o777)
  return result
 return types.SimpleNamespace(renameatx_np=rename)
os.open=tracked_open;os.close=tracked_close;os.fstat=tracked_stat;os.fsync=tracked_sync;ctypes.CDLL=tracked_library
real_out=sys.stdout;real_err=sys.stderr;out=io.BytesIO();err=io.StringIO()
sys.stdout=io.TextIOWrapper(out,encoding='utf8');sys.stderr=err
capture_out=sys.stdout # Keep the original wrapper alive while substituting writer.
if fault.startswith('output-'):
 class Writer:
  def write(self,wire):
   if fault=='output-response-loss':out.write(wire);raise OSError(errno.EIO,'fixture')
   return 0
  def flush(self):pass
 sys.stdout=types.SimpleNamespace(buffer=Writer(),flush=lambda:None)
sys.argv=sys.argv[1:]
result=m.main(); sys.stdout.flush(); captured=out.getvalue().decode('ascii');sys.stdout=real_out;sys.stderr=real_err
before=(len(opened),len(closes),len(native),len(syncs))
try:m.publish(sys.argv[1]);second='accepted'
except m.Refused:second='refused'
after=(len(opened),len(closes),len(native),len(syncs))
states=[]
for fd in [3]+opened:
 try:original_stat(fd);states.append('live')
 except OSError as e:states.append('EBADF' if e.errno==errno.EBADF else 'unknown')
sys.stdout.write(json.dumps({'result':result,'wire':captured,'error':err.getvalue(),'opened':opened,'nonblock':flags,'closes':closes,'native':native,'syncs':syncs,'states':states,'second':second,'before':before,'after':after,'finalLockChecks':final_lock_checks}))`;
  const result = await run(f, [f.stageLeaf], shim);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  const out = JSON.parse(result.stdout);
  assert.equal(out.second, "refused"); assert.deepEqual(out.after, out.before);
  assert.equal(new Set(out.closes).size, out.closes.length, "no repeated child close");
  for (const call of out.native) assert.deepEqual(call, { fromFd: 3, toFd: 3, flags: 0x34 });
  return out;
}
test("actual helper closes own lock/root and inherited FD3 once in reverse order, then permanently refuses", () => fixture(async f => {
  const out = await audited(f, "none");
  assert.equal(out.result, 0); assert.equal(out.wire, "DASHBOARD_ATOMIC_ROOT_PUBLISHED\n"); assert.equal(out.error, "");
  assert.equal(out.opened.length, 2); assert.equal(out.native.length, 1);
  assert.equal(out.nonblock[1], true, "nonblocking lock inspection must not hang on FIFO");
  assert.deepEqual(out.closes, [...out.opened].reverse().concat(3));
  assert.deepEqual(out.states, ["EBADF", "EBADF", "EBADF"]);
  original(f, f.root);
}));
for (const fault of ["file-sync", "root-sync", "native-error", "native-unsupported", "native-response-loss", "parent-sync",
  "close-error", "close-response-loss", "unsealed-root", "postpublication-drift",
  "preclose-observation-error", "preclose-observation-mismatch", "close-error-root", "close-response-loss-root",
  "close-error-parent", "close-response-loss-parent", "output-rejected", "output-response-loss"]) {
  test(`${fault} preserves paths and unknown custody without retry or rollback`, () => fixture(async f => {
    const out = await audited(f, fault);
    assert.equal(out.result, 1);
    assert.equal(out.wire, fault === "output-response-loss" ? "DASHBOARD_ATOMIC_ROOT_PUBLISHED\n" : "");
    assert.equal(out.error, "DASHBOARD_ATOMIC_ROOT_PUBLICATION_REFUSED\n");
    const published = ["native-response-loss", "parent-sync", "close-error", "close-response-loss", "postpublication-drift",
      "preclose-observation-error", "preclose-observation-mismatch"].includes(fault)
      || fault.startsWith("close-") || fault.startsWith("output-");
    assert.equal(fs.existsSync(f.root), published); assert.equal(fs.existsSync(f.stage), !published);
    const expected = fault === "unsealed-root" ? [0, 0, 0]
      : fault === "file-sync" ? [0, 1, 3]
      : fault === "root-sync" ? [0, 2, 3]
      : ["native-error", "native-unsupported", "native-response-loss"].includes(fault) ? [1, 2, 3]
      : fault === "postpublication-drift" ? [1, 2, 1]
      : fault.startsWith("preclose-") ? [1, 3, 0]
      : fault.startsWith("close-") ? [1, 3, fault.endsWith("-root") ? 2 : fault.endsWith("-parent") ? 3 : 1]
      : [1, 3, 3];
    assert.deepEqual([out.native.length, out.syncs.length, out.closes.length], expected, "fault reached exact nominated boundary");
    if (fault === "unsealed-root") { assert.deepEqual(out.closes, []); assert.deepEqual(out.states, ["live", "live"]); }
    if (fault === "close-error") { assert.equal(out.closes.length, 1); assert.deepEqual(out.states, ["live", "live", "live"]); }
    if (fault === "close-response-loss") { assert.equal(out.closes.length, 1); assert.deepEqual(out.states, ["live", "live", "EBADF"]); }
    if (fault === "close-error-root") { assert.equal(out.closes.length, 2); assert.deepEqual(out.states, ["live", "live", "EBADF"]); }
    if (fault === "close-response-loss-root") { assert.equal(out.closes.length, 2); assert.deepEqual(out.states, ["live", "EBADF", "EBADF"]); }
    if (fault === "close-error-parent") { assert.equal(out.closes.length, 3); assert.deepEqual(out.states, ["live", "EBADF", "EBADF"]); }
    if (fault === "close-response-loss-parent" || fault.startsWith("output-")) assert.deepEqual(out.states, ["EBADF", "EBADF", "EBADF"]);
    if (fault.startsWith("preclose-observation")) {
      assert.deepEqual(out.closes, []); assert.deepEqual(out.states, ["live", "live", "live"]);
      assert.equal(out.finalLockChecks, 2, "uncertain original must not be observed again");
    }
    if (fault === "postpublication-drift") { f.ownedStageMode = 0o777; assert.deepEqual(out.states, ["live", "live", "EBADF"]); }
    assert.equal(fs.fstatSync(f.lockFd).ino, fs.lstatSync(path.join(published ? f.root : f.stage, lockLeaf)).ino);
    assert.deepEqual(readLockOriginal(f), f.wire);
  }));
}
