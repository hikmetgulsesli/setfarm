import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeDeploymentCutoverCliLinkV1 } from "./baseline-deployment-cutover-cli-observation-v1.js";

const DIRECTORY_KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
const ABSENCE_KEYS = [...DIRECTORY_KEYS, "mtimeNs", "ctimeNs"] as const;
const same = (left: BigIntStats, right: BigIntStats, keys: readonly (keyof BigIntStats)[]) => keys.every(key => left[key] === right[key]);
const physical = (value: string) => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
const identity = (stat: BigIntStats, keys: readonly (keyof BigIntStats)[]) => Object.freeze(Object.fromEntries(keys.map(key => [key, String(stat[key])])));
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID"); }
function absent(target: string): boolean {
  try { fs.lstatSync(target, { bigint: true }); return false; }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return true; throw error; }
}

// Candidate-only filesystem evidence. Does not establish the retained loader's
// semantics, loaded process environment, database target, or rollout authority.
export function observeDeploymentCutoverDefaultEnvAbsenceV1() {
  const held = holdDeploymentCutoverDefaultEnvAbsenceV1();
  try { return held.observation; } finally { held.close(); }
}

// Held candidate evidence only; no effective-environment or rollout authority.
export function holdDeploymentCutoverDefaultEnvAbsenceV1() {
  if (arguments.length || cleanupUncertain) fail();
  const descriptors: number[] = [], pins = new Map<string, { fd: number; stat: BigIntStats }>();
  const candidates: Array<Readonly<{ path: string; missingAt: string; ancestorPath: string; ancestorIdentity: Readonly<Record<string, string>> }>> = [];
  let invalid = false, closed = false;
  let recheck: () => void = fail;
  const close = () => {
    if (closed) return;
    closed = true;
    while (descriptors.length) {
      const fd = descriptors.pop()!;
      try { fs.closeSync(fd); } catch { cleanupUncertain = true; invalid = true; }
    }
    if (invalid) fail();
  };
  let result: Readonly<{
    schema: string; scope: string; selectedCheckoutPath: string; currentCheckoutPath: string; cliObservationHash: string;
    candidates: readonly (typeof candidates)[number][]; ancestors: readonly Readonly<{ path: string; identity: Readonly<Record<string, string>> }>[];
    blockers: readonly string[]; observationHash: string;
  }> | undefined;
  try {
    const uid = process.getuid?.(), home = physical(userInfo().homedir), modulePath = fileURLToPath(import.meta.url);
    if (uid === undefined || !path.isAbsolute(home) || path.normalize(home) !== home
      || path.basename(path.dirname(modulePath)) !== "internal-production"
      || !["src", "dist"].includes(path.basename(path.dirname(path.dirname(modulePath))))) fail();
    const workspace = path.join(home, "ai", "setrox"), current = physical(path.dirname(path.dirname(path.dirname(modulePath))));
    const relative = path.relative(workspace, current);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail();
    const cli = observeDeploymentCutoverCliLinkV1();
    const checkPins = () => {
      for (const [target, pin] of pins) {
        if (!same(pin.stat, fs.lstatSync(target, { bigint: true }), DIRECTORY_KEYS)
          || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
      }
    };
    const checkAbsences = () => {
      checkPins();
      for (const entry of candidates) {
        const parent = pins.get(entry.ancestorPath); if (!parent) fail();
        if (!same(parent.stat, fs.fstatSync(parent.fd, { bigint: true }), ABSENCE_KEYS)
          || !same(parent.stat, fs.lstatSync(entry.ancestorPath, { bigint: true }), ABSENCE_KEYS)
          || !absent(entry.missingAt)) fail();
      }
      checkPins();
    };
    const hold = (target: string, stat: BigIntStats) => {
      checkAbsences();
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
      if (target === home || target.startsWith(`${home}${path.sep}`)) {
        if (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n) fail();
        const ownerRoot = pins.get(home); if (ownerRoot && stat.dev !== ownerRoot.stat.dev) fail();
      }
      if (pins.has(target)) { if (!same(pins.get(target)!.stat, stat, DIRECTORY_KEYS)) fail(); return; }
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pins.set(target, { fd, stat }); checkAbsences();
    };
    const roots = [...new Set([cli.checkoutPath, current, path.join(home, ".openclaw", "setfarm")])];
    for (const candidate of roots.flatMap(root => [path.join(root, ".env"), path.join(root, ".env.local")])) {
      const root = path.parse(candidate).root, parts = path.relative(root, candidate).split(path.sep);
      if (parts.length > 128) fail();
      hold(root, fs.lstatSync(root, { bigint: true }));
      let found = false;
      for (let index = 0; index < parts.length; index++) {
        const target = path.join(root, ...parts.slice(0, index + 1)); checkAbsences();
        let stat: BigIntStats;
        try { stat = fs.lstatSync(target, { bigint: true }); }
        catch (error) {
          if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
          const ancestorPath = path.dirname(target), parent = pins.get(ancestorPath); if (!parent) fail();
          candidates.push(Object.freeze({ path: candidate, missingAt: target, ancestorPath, ancestorIdentity: identity(parent.stat, ABSENCE_KEYS) }));
          checkAbsences(); found = true; break;
        }
        if (index === parts.length - 1) fail();
        hold(target, stat);
      }
      if (!found) fail();
    }
    checkAbsences();
    if (hashCanonicalJson(observeDeploymentCutoverCliLinkV1()) !== hashCanonicalJson(cli)) fail();
    checkAbsences();
    const body = Object.freeze({
      schema: "setfarm.internal-production-deployment-cutover-default-env-absence.v1", scope: "default-candidate-absence-only",
      selectedCheckoutPath: cli.checkoutPath, currentCheckoutPath: current, cliObservationHash: cli.cliLinkObservationHash,
      candidates: Object.freeze(candidates),
      ancestors: Object.freeze([...pins].map(([target, pin]) => Object.freeze({ path: target, identity: identity(pin.stat, DIRECTORY_KEYS) }))),
      blockers: Object.freeze(["runtime-effective-environment-not-authenticated", "controller-ownership-not-acquired"]),
    });
    result = Object.freeze({ ...body, observationHash: hashCanonicalJson(body) });
    recheck = () => {
      if (closed || invalid || cleanupUncertain) fail();
      try {
        checkAbsences();
        if (hashCanonicalJson(observeDeploymentCutoverCliLinkV1()) !== hashCanonicalJson(cli)) fail();
        checkAbsences();
      } catch { invalid = true; cleanupUncertain = true; fail(); }
    };
  } catch { invalid = true; }
  if (invalid || !result) { close(); fail(); }
  return Object.freeze({ observation: result, recheck, close });
}
