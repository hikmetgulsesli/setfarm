import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const MAX_BYTES = 8 * 1024 * 1024;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_PROCESS_OBSERVATION_INVALID"); }
function command(executable: string, args: string[], absent = false): string {
  const result = spawnSync(executable, args, { encoding: "buffer", timeout: 5000, maxBuffer: MAX_BYTES,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" } });
  if (result.error || result.signal || !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr)
    || result.stderr.length || result.stdout.length > MAX_BYTES || !Buffer.from(result.stdout.toString("utf8")).equals(result.stdout)) fail();
  if (absent && result.status === 1 && result.stdout.length === 0) return "";
  if (result.status !== 0 || result.stdout.length === 0) fail();
  return result.stdout.toString("utf8");
}
type Row = { uid: number; pid: number; ppid: number; pgid: number; stat: string; lstart: string; command: string };
function rows(): Row[] {
  const text = command("/bin/ps", ["-ww", "-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]);
  if (!text.endsWith("\n") || text.includes("\r") || text.includes("\0")) fail();
  const lines = text.slice(0, -1).split("\n"), pids = new Set<number>();
  if (!lines.length || lines.length > 32768) fail();
  return lines.map(line => {
    const match = /^\s*(-2|[0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(\S+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[ 0-9][0-9]\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\s+[0-9]{4})\s+(.+)$/.exec(line);
    if (!match) fail();
    const [uid, pid, ppid, pgid] = match.slice(1, 5).map(Number) as [number, number, number, number];
    if (![uid, pid, ppid, pgid].every(Number.isSafeInteger) || (uid < 0 && uid !== -2) || pid < 1 || ppid < 0 || pgid < 0 || pids.has(pid)) fail();
    pids.add(pid); return { uid, pid, ppid, pgid, stat: match[5]!, lstart: match[6]!, command: match[7]! };
  }).sort((a, b) => a.pid - b.pid);
}
function classify(row: Row, uid: number) {
  const tokens = row.command.split(/\s+/).map(token => token.replace(/^["']|["']$/g, ""));
  const spawner = tokens.some(token => /(?:^|\/)spawner\.(?:js|ts|mjs|cjs)$/.test(token));
  const dashboard = tokens.some(token => /(?:^|\/)server\/daemon\.(?:js|ts|mjs|cjs)$/.test(token));
  const cli = tokens.some(token => /(?:^|\/)(?:setfarm(?:\.(?:js|mjs|cjs))?|cli\.(?:js|ts|mjs|cjs))$/.test(token));
  const spawnerCli = cli && tokens.includes("spawner"), dashboardCli = cli && tokens.includes("dashboard");
  if (!spawner && !dashboard && !spawnerCli && !dashboardCli) return null;
  if (!/^[A-Za-z+<>]{1,16}$/.test(row.stat) || /[ZE]/.test(row.stat)) fail();
  let classification = "ambiguous-contender", entrypoint: string | null = null, checkoutPath: string | null = null, executable: string | null = null;
  if (Number(spawner) + Number(dashboard) + Number(spawnerCli) + Number(dashboardCli) === 1) {
    classification = spawner ? "spawner-daemon" : dashboard ? "dashboard-daemon" : spawnerCli ? "spawner-cli-starter" : "dashboard-cli-starter";
    if (spawner || dashboard) {
      const suffix = spawner ? "/dist/spawner.js" : "/dist/server/daemon.js", entry = tokens[1], node = tokens[0];
      if (!node || !path.isAbsolute(node) || path.normalize(node) !== node || path.basename(node) !== "node") fail();
      if (!entry || !path.isAbsolute(entry) || path.normalize(entry) !== entry || !entry.endsWith(suffix)
        || row.command !== `${node} ${entry}${dashboard ? " 3333" : ""}` || row.uid !== uid || row.ppid !== 1 || row.pgid !== row.pid) fail();
      executable = node; entrypoint = entry; checkoutPath = entry.slice(0, -suffix.length);
      if (!checkoutPath || path.normalize(checkoutPath) !== checkoutPath) fail();
    }
  }
  return Object.freeze({ uid: row.uid, pid: row.pid, ppid: row.ppid, pgid: row.pgid, lstart: row.lstart,
    processIdentityHash: sha(`${row.pid}\n${row.lstart}\n`), commandHash: sha(row.command), classification,
    executable, entrypoint, checkoutPath });
}
function listener() {
  const text = command("/usr/sbin/lsof", ["-nP", "-iTCP:3333", "-sTCP:LISTEN", "-F0pcfn"], true);
  if (!text) return null;
  const match = /^p([1-9][0-9]*)\0c([^\0\n]+)\0\nf(0|[1-9][0-9]*)\0n127\.0\.0\.1:3333\0\n$/.exec(text);
  if (!match) fail();
  const pid = Number(match[1]), descriptor = Number(match[3]);
  if (!Number.isSafeInteger(pid) || !Number.isSafeInteger(descriptor)) fail();
  return Object.freeze({ pid, descriptor, host: "127.0.0.1" as const, port: 3333 as const, listenerHash: sha(text) });
}

// Read-only diagnostic, never a signal capability, source/build authentication
// or sufficient zero-owner proof. Unknown contenders cannot be silently omitted.
export function observeDeploymentCutoverProcessFamiliesV1() {
  try {
    const uid = process.getuid?.();
    if (uid === undefined) fail();
    const snapshot = () => {
      const inventory = rows(), observer = inventory.find(row => row.pid === process.pid);
      if (!observer || observer.uid !== uid || !/^[A-Za-z+<>]{1,16}$/.test(observer.stat) || /[ZE]/.test(observer.stat)) fail();
      return { observerHash: sha(`${observer.uid}\n${observer.pid}\n${observer.ppid}\n${observer.pgid}\n${observer.lstart}\n${observer.command}`),
        families: inventory.map(row => classify(row, uid)).filter(entry => entry !== null) };
    };
    const before = snapshot();
    const executableCheck = (families: typeof before.families) => {
      for (const entry of families) if (entry.executable && command("/bin/ps", ["-ww", "-p", String(entry.pid), "-o", "comm="]) !== `${entry.executable}\n`) fail();
    };
    executableCheck(before.families); const firstListener = listener();
    const after = snapshot(); executableCheck(after.families); const lastListener = listener();
    if (hashCanonicalJson(before) !== hashCanonicalJson(after) || hashCanonicalJson(firstListener) !== hashCanonicalJson(lastListener)) fail();
    if (firstListener && !before.families.some(entry => entry.pid === firstListener.pid && entry.classification === "dashboard-daemon")) fail();
    const body = { schema: "setfarm.internal-production-deployment-cutover-process-observation.v1", families: Object.freeze(before.families), listener: firstListener };
    return Object.freeze({ ...body, processObservationHash: hashCanonicalJson(body) });
  } catch { fail(); }
}
