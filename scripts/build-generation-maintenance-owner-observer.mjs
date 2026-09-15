import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import { normalizeMaintenanceOwnerV1 } from "./build-generation-maintenance-journal.mjs";

const ENV = Object.freeze({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" });
const DATE = "[A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}";
const BOOT = new RegExp(`^\\{ sec = ([1-9][0-9]*), usec = (0|[1-9][0-9]{0,5}) \\} ${DATE}\\n$`);
const ROW = new RegExp(`^ *([0-9]+) +(${DATE}) +([1-9][0-9]*) +([A-Za-z+<>]{1,16}) *\\n$`);
const hash = value => createHash("sha256").update(value).digest("hex");

function run(file, args) {
  try {
    const result = childProcess.spawnSync(file, args, { shell: false, env: ENV,
      timeout: 5000, maxBuffer: 65536, stdio: ["ignore", "pipe", "pipe"] });
    if (result.error || result.signal !== null || ![0, 1].includes(result.status)) return null;
    if ((!Buffer.isBuffer(result.stdout) && typeof result.stdout !== "string")
      || (!Buffer.isBuffer(result.stderr) && typeof result.stderr !== "string")) return null;
    const out = Buffer.from(result.stdout), err = Buffer.from(result.stderr);
    if (out.length > 65536 || err.length !== 0) return null;
    return { status: result.status, out: out.toString("utf8") };
  } catch { return null; }
}

function parseBoot(result) {
  if (result?.status !== 0) return null;
  const match = BOOT.exec(result.out);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return hash(`${match[1]}\n${match[2]}\n`);
}

function parseProcess(result) {
  if (result?.status === 1 && result.out === "") return { state: "dead" };
  if (result?.status !== 0) return null;
  const match = ROW.exec(result.out);
  if (!match || /[ZE]/.test(match[4])) return null;
  const uid = Number(match[1]), processGroupId = Number(match[3]);
  if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(processGroupId) || processGroupId < 1) return null;
  return { state: "alive", uid, processLstart: match[2], processGroupId };
}

function bracket(pid) {
  const args = ["-p", String(pid), "-o", "uid=", "-o", "lstart=", "-o", "pgid=", "-o", "stat="];
  const bootBefore = run("/usr/sbin/sysctl", ["-n", "kern.boottime"]);
  const first = run("/bin/ps", args), second = run("/bin/ps", args);
  const bootAfter = run("/usr/sbin/sysctl", ["-n", "kern.boottime"]);
  const bootSessionHash = parseBoot(bootBefore), finalBoot = parseBoot(bootAfter);
  const before = parseProcess(first), after = parseProcess(second);
  if (bootSessionHash === null || bootSessionHash !== finalBoot || before === null || after === null
    || JSON.stringify(before) !== JSON.stringify(after)) return null;
  return { bootSessionHash, process: before,
    observationHash: hash(JSON.stringify([pid, bootBefore, first, second, bootAfter])) };
}

export function observeCurrentMaintenanceOwnerV1(reservationNonce) {
  const observed = bracket(process.pid);
  if (observed === null || observed.process.state !== "alive" || observed.process.uid !== process.getuid()) {
    throw Error("MAINTENANCE_OWNER_OBSERVATION_AMBIGUOUS");
  }
  const { state, ...identity } = observed.process;
  const owner = normalizeMaintenanceOwnerV1({ ...identity, pid: process.pid,
    bootSessionHash: observed.bootSessionHash, reservationNonce });
  return Object.freeze({ owner, observationHash: observed.observationHash });
}

export function observeMaintenanceOwnerProcessV1(owner) {
  const expected = normalizeMaintenanceOwnerV1(owner);
  const observed = bracket(expected.pid);
  if (observed === null) return Object.freeze({ state: "ambiguous", observationHash: null, bootSessionHash: null });
  const matches = observed.bootSessionHash === expected.bootSessionHash
    && ["uid", "processLstart", "processGroupId"].every(key => observed.process[key] === expected[key]);
  const state = observed.process.state === "dead" ? "definitely_dead" : matches ? "live_match" : "live_pid_reused";
  return Object.freeze({ state, observationHash: observed.observationHash, bootSessionHash: observed.bootSessionHash });
}
