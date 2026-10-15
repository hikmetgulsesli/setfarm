import { spawn } from "node:child_process";
import { types } from "node:util";
import source from "./dashboard-cutover-process-events-v4.py";

// Authenticated internal DATA only. No owner, family or admission authority.
const message = "DASHBOARD_CUTOVER_PROCESS_EVENTS_REFUSED";
const fail = () => { throw Error(message); };
const originals = new WeakMap();
let attempted = false, active = null, occurrence = null, quarantined = false;
const schema = "setfarm.dashboard-cutover-process-candidates-frame.v4";
const limits = { authority: "conditional-target-data-only", familyClosure: "not-proven", futureEntryExclusion: "not-proven", cutoverAdmission: "not-granted" };
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
function deferred(o, name) {
  const slot = { promise: null, resolve: null, reject: null, rejectionObserver: null };
  o[name] = slot;
  slot.promise = new Promise((yes, no) => { slot.resolve = yes; slot.reject = no; });
  alive(o); // The actual returned original is already retained before observers.
  slot.rejectionObserver = slot.promise.catch(() => {}); alive(o);
}
function record(value, keys) {
  if (!value || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(fields);
  if (own.length !== keys.length || keys.some(key => !Object.hasOwn(fields, key) || !Object.hasOwn(fields[key], "value"))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function requestPids(request) {
  const fields = record(request, ["schema", "candidates"]), array = fields.candidates;
  if (fields.schema !== "setfarm.dashboard-cutover-process-candidates-request.v4" || !Array.isArray(array) || types.isProxy(array)) fail();
  const descriptors = Object.getOwnPropertyDescriptors(array), keys = Reflect.ownKeys(descriptors);
  const length = descriptors.length?.value;
  if (!Number.isInteger(length) || length < 1 || length > 32 || keys.length !== length + 1) fail();
  const pids = [];
  for (let index = 0; index < length; index++) {
    const slot = descriptors[index]; if (!slot || !Object.hasOwn(slot, "value")) fail();
    const pid = record(slot.value, ["pid"]).pid;
    if (!Number.isInteger(pid) || pid < 2 || pid > 2147483647 || (index && pid <= pids[index - 1])) fail();
    pids.push(pid);
  }
  return pids;
}
function burn(o) {
  if (!o) return;
  o.unknown = true; o.readyDriver?.reject?.(Error(message)); o.lifeDriver?.reject?.(Error(message));
  clearTimeout(o.readyTimer); clearTimeout(o.lifeTimer);
}
function enter() { if (active) { quarantined = true; burn(active); fail(); } if (quarantined) fail(); }
const alive = o => { if (o.unknown) fail(); };
function authenticate(original) {
  if (!original || typeof original !== "object" || types.isProxy(original)) fail();
  const o = originals.get(original); if (!o || o !== occurrence) fail(); return o;
}
const freeze = value => { if (value && typeof value === "object") { for (const member of Object.values(value)) freeze(member); Object.freeze(value); } return value; };
function candidates(value, pids) {
  if (!Array.isArray(value) || value.length !== pids.length) fail();
  const fields = ["pid", "ordinal", "uniqueId", "parentUniqueId", "idVersion", "originalParentVersion", "executableUuid", "executablePath"];
  value.forEach((item, index) => {
    const row = record(item, fields);
    if (["uniqueId", "parentUniqueId", "idVersion", "originalParentVersion", "executableUuid"].some(key => typeof row[key] !== "string")
      || row.pid !== pids[index] || row.ordinal !== index + 1 || !/^[a-f0-9]{16}$/.test(row.uniqueId) || row.uniqueId === "0".repeat(16)
      || !/^[a-f0-9]{16}$/.test(row.parentUniqueId) || !/^[a-f0-9]{8}$/.test(row.idVersion)
      || !/^[a-f0-9]{8}$/.test(row.originalParentVersion) || !/^[a-f0-9]{32}$/.test(row.executableUuid)
      || typeof row.executablePath !== "string" || !row.executablePath.startsWith("/") || row.executablePath.includes("\0") || Buffer.byteLength(row.executablePath) > 4096) fail();
  });
}
function rawEvent(hex, pid, ordinal, flags, fflags) {
  if (typeof hex !== "string" || !/^[a-f0-9]{64}$/.test(hex)) fail();
  const bytes = Buffer.from(hex, "hex");
  if (bytes.readBigUInt64LE(0) !== BigInt(pid) || bytes.readInt16LE(8) !== -5 || bytes.readUInt16LE(10) !== flags
    || bytes.readUInt32LE(12) !== fflags || bytes.readBigInt64LE(16) !== 0n || bytes.readBigUInt64LE(24) !== BigInt(ordinal)) fail();
}
function frame(o, raw) {
  const text = raw.toString("utf8"); if (!Buffer.from(text).equals(raw)) fail();
  const data = JSON.parse(text), sequence = o.frames.length;
  record(data, sequence === 0 ? ["schema", ...Object.keys(limits), "sequence", "state", "candidates", "registrations"]
    : ["schema", ...Object.keys(limits), "sequence", "state", "candidates", "events", "queueClose"]);
  if (text !== canonical(data) || data.schema !== schema || data.sequence !== sequence || sequence > 1
    || Object.entries(limits).some(([key, value]) => data[key] !== value)) fail();
  candidates(data.candidates, o.pids);
  if (sequence === 0) {
    if (data.state !== "READY" || !Array.isArray(data.registrations) || data.registrations.length !== o.pids.length) fail();
    data.registrations.forEach((item, index) => {
      const row = record(item, ["intentHex", "returned", "result", "errno", "receiptHex"]);
      if (row.returned !== true || row.result !== 1 || row.errno !== 0) fail();
      rawEvent(row.intentHex, o.pids[index], index + 1, 65, 3758096384);
      rawEvent(row.receiptHex, o.pids[index], index + 1, 16449, 3758096384);
    });
  }
  else {
    if (data.state !== "EXITED" || canonical(data.candidates) !== canonical(o.frames[0].candidates)
      || !Array.isArray(data.events) || data.events.length !== o.pids.length) fail();
    data.events.forEach((event, index) => {
      const row = record(event, ["pid", "ordinal", "filter", "flags", "fflags", "data", "rawHex"]);
      if (row.pid !== o.pids[index] || row.ordinal !== index + 1 || row.filter !== -5 || row.flags !== 32881 || row.fflags !== 2147483648 || row.data !== 0) fail();
      rawEvent(row.rawHex, row.pid, row.ordinal, 32881, 2147483648);
    });
    const close = record(data.queueClose, ["attempted", "returned", "result", "errno"]);
    if (close.attempted !== true || close.returned !== true || close.result !== 0 || close.errno !== 0) fail();
  }
  o.frames.push(freeze(data));
  if (sequence === 0) {
    o.cached = data; o.readyOriginal.resolve(data);
    if (!o.unknown) { clearTimeout(o.readyTimer); o.readyDriver.resolve(data); }
  }
}
function collect(o, bytes) {
  try {
    if (!Buffer.isBuffer(bytes)) fail();
    o.outputBytes += bytes.length;
    if (o.outputBytes > 32768) { burn(o); o.pending = Buffer.alloc(0); return; }
    if (o.unknown) return; // Listeners continue draining, storage remains bounded.
    o.pending = Buffer.concat([o.pending, bytes]);
    for (;;) {
      const end = o.pending.indexOf(10); if (end < 0) break;
      if (end + 1 > 16384) fail();
      const raw = o.pending.subarray(0, end); o.rawFrames.push(Buffer.from(o.pending.subarray(0, end + 1)));
      o.pending = o.pending.subarray(end + 1); frame(o, raw);
    }
    if (o.pending.length >= 16384) fail();
  } catch { burn(o); }
}
function natural(o) {
  // Original settlement is actual custody, never a driver timeout or burn.
  if (!o.exit || !o.close || !o.stdinClose || !o.stdoutClose || !o.stderrClose
    || !o.stdinFinish || !o.stdinAck || !o.stdoutEnd || !o.stderrEnd || o.naturalSettled) return;
  if (o.close.code !== o.exit.code || o.close.signal !== o.exit.signal) { burn(o); return; }
  o.naturalSettled = true; o.lifeOriginal.resolve(o);
  try {
    alive(o);
    if (o.exit.code !== 0 || o.exit.signal !== null || o.close.code !== o.exit.code || o.close.signal !== o.exit.signal
      || !o.stdinFinish || !o.stdinAck || !o.stdoutEnd || !o.stderrEnd || o.pending.length || o.frames.length !== 2) fail();
    o.cached = o.frames[1]; clearTimeout(o.lifeTimer); o.lifeDriver.resolve(o.cached);
  } catch { burn(o); }
}
export async function holdDashboardCutoverProcessCandidateEventsV4(request) {
  enter();
  const o = { pids: null, unknown: false, child: null, stdin: null, stdout: null, stderr: null, spawnReturned: false,
    readyOriginal: null, lifeOriginal: null, readyDriver: null, lifeDriver: null,
    frames: [], rawFrames: [], pending: null, outputBytes: 0, cached: null, waited: false,
    stdinFinish: false, stdinClose: false, stdinAck: false, stdoutEnd: false, stdoutClose: false, stderrEnd: false, stderrClose: false, exit: null, close: null, naturalSettled: false };
  active = o;
  try {
    o.pending = Buffer.alloc(0); alive(o);
    if (arguments.length !== 1) fail();
    o.pids = requestPids(request); alive(o);
    if (attempted || typeof source !== "string" || !source.length || Buffer.byteLength(source) > 131072) fail();
    attempted = true; occurrence = o;
    for (const name of ["readyOriginal", "lifeOriginal", "readyDriver", "lifeDriver"]) deferred(o, name);
    const input = Buffer.from(canonical({ schema: "setfarm.dashboard-cutover-process-candidates-request.v4", candidates: o.pids.map(pid => ({ pid })) }) + "\n");
    o.input = input; alive(o);
    if (input.length > 4096) fail();
    o.readyTimer = setTimeout(() => burn(o), 5000); alive(o);
    o.lifeTimer = setTimeout(() => burn(o), 35000); alive(o);
    const child = spawn("/usr/bin/python3", ["-I", "-S", "-B", "-u", "-c", source], {
      cwd: "/", shell: false, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"],
    });
    o.child = child; o.spawnReturned = true;
    o.stdin = child.stdin; o.stdout = child.stdout; o.stderr = child.stderr;
    child.on("error", () => burn(o));
    child.on("exit", (code, signal) => { if (o.exit) burn(o); o.exit = { code, signal }; natural(o); });
    child.on("close", (code, signal) => { if (o.close) burn(o); o.close = { code, signal }; natural(o); });
    for (const name of ["stdin", "stdout", "stderr"]) {
      const stream = o[name]; stream.on("error", () => burn(o));
      stream.on("close", () => { o[`${name}Close`] = true; natural(o); });
    }
    o.stdin.on("finish", () => { o.stdinFinish = true; natural(o); });
    o.stdout.on("end", () => { o.stdoutEnd = true; natural(o); });
    o.stderr.on("end", () => { o.stderrEnd = true; natural(o); });
    o.stdout.on("data", bytes => collect(o, bytes));
    o.stderr.on("data", bytes => { if (bytes.length) burn(o); });
    // Even reentry at spawn cannot orphan a returned child: custody precedes checks.
    alive(o);
    o.stdin.end(input, error => { if (error) burn(o); else o.stdinAck = true; natural(o); });
    alive(o); await o.readyDriver.promise; alive(o);
    const original = Object.freeze(Object.create(null)); originals.set(original, o); alive(o);
    return original;
  } catch { burn(o); fail(); }
  finally { if (active === o) active = null; }
}
export function observeHeldDashboardCutoverProcessCandidateEventsV4(original) {
  enter(); if (arguments.length !== 1) fail();
  const o = authenticate(original); alive(o); if (!o.cached) fail(); return o.cached;
}
export async function waitHeldDashboardCutoverProcessCandidateEventsV4(original) {
  enter(); if (arguments.length !== 1) fail();
  const o = authenticate(original); alive(o); if (o.waited) fail(); o.waited = true; active = o;
  try { const data = await o.lifeDriver.promise; alive(o); return data; }
  catch { burn(o); fail(); } finally { if (active === o) active = null; }
}
