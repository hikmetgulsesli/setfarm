import { spawnSync } from "node:child_process";
import source from "./deployment-cutover-passive-home.py";

const fail = () => { throw Error("DEPLOYMENT_CUTOVER_PASSIVE_HOME_REFUSED"); };
const keys = ["schema", "pid", "ppid", "uid", "gid", "startSeconds", "startMicroseconds", "homeContext", "completeEnvironmentValidated", "stableDoubleRead"];
const integer = value => Number.isSafeInteger(value) && value >= 0;

// Internal transport, not launcher authority. The zero-input owner must derive
// the PID privately and bind returned start identity to its launcher observation.
// Outside the authenticated bootstrap, the Python data import fails closed.
export function measureDeploymentCutoverPassiveHomeV1(request) {
  let input;
  try {
    if (arguments.length !== 1 || typeof source !== "string" || !source.length || Buffer.byteLength(source) > 131072
      || !request || typeof request !== "object" || Array.isArray(request)) fail();
    input = Buffer.from(JSON.stringify(request));
    if (!input.length || input.length > 65536) fail();
    const result = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", source], {
      input, encoding: "buffer", cwd: "/", shell: false, timeout: 2000, maxBuffer: 4096,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
    });
    if (result.error || result.signal || result.status !== 0 || !Buffer.isBuffer(result.stdout)
      || !Buffer.isBuffer(result.stderr) || result.stderr.length || result.stdout.length > 4096) fail();
    const raw = result.stdout.toString("utf8"), value = JSON.parse(raw);
    if (!Buffer.from(raw).equals(result.stdout) || !value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
      || value.schema !== "setfarm.internal-production-passive-home-measurement.v1"
      || value.homeContext !== "account" || value.completeEnvironmentValidated !== true || value.stableDoubleRead !== true
      || ["pid", "ppid", "uid", "gid", "startSeconds", "startMicroseconds"].some(key => !integer(value[key]))
      || value.pid <= 1 || value.startSeconds === 0 || value.startMicroseconds >= 1000000
      || ["pid", "uid", "gid"].some(key => value[key] !== request[key])) fail();
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)));
    if (raw !== `${canonical}\n`) fail();
    return Object.freeze(value);
  } catch { fail(); }
  finally { input?.fill(0); }
}
