import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { parseDeploymentCutoverIntentV1, type DeploymentCutoverIntentV1 } from "./baseline-deployment-cutover-records-v1.js";

type Observation = Readonly<{ state: "absent" }> | Readonly<{ state: "open"; intent: DeploymentCutoverIntentV1 }>;
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]): boolean => keys.every(key => a[key] === b[key]);
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_OBSERVATION_INVALID"); }
function missing(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "ENOENT"; }

// Refusal only: neither historical intent nor caller input grants admission.
export function assertOrdinarySpawnerDeploymentCutoverAdmissionV1(): void {
  if (observeDeploymentCutoverIntentV1().state !== "absent") {
    throw Error("DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
  }
}

// Read-only fixed-root observation. Open/partial records never authorize startup.
// A completed admission protocol is deliberately not interpreted by this slice.
export function observeDeploymentCutoverIntentV1(): Observation {
  if (cleanupUncertain) fail();
  const descriptors: number[] = [];
  const pins: Array<{ target: string; fd: number; stat: BigIntStats }> = [];
  let result: Observation | undefined;
  const failures: unknown[] = [];
  const assertPins = (): void => {
    for (const pin of pins) {
      const atPath = fs.lstatSync(pin.target, { bigint: true }), held = fs.fstatSync(pin.fd, { bigint: true });
      if (!atPath.isDirectory() || atPath.isSymbolicLink() || !same(pin.stat, atPath, DIRECTORY_KEYS)
        || !same(pin.stat, held, DIRECTORY_KEYS)) fail();
    }
  };
  try {
    const lexical = resolveInternalProductionBaselineWorkspaceRootV1();
    const workspace = process.platform === "darwin" && lexical.startsWith("/var/") ? `/private${lexical}` : lexical;
    const filesystemRoot = path.parse(workspace).root;
    const segments = path.relative(filesystemRoot, workspace).split(path.sep);
    const ancestors = [filesystemRoot, ...segments.map((_, index) => path.join(filesystemRoot, ...segments.slice(0, index + 1)))];
    // Own the entire acquisition so consumed descriptors are never retried by
    // another helper after a failed open/validation/close sequence.
    for (const target of ancestors) {
      const before = fs.lstatSync(target, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink()) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pins.push({ target, fd, stat: before }); assertPins();
    }
    const uid = process.getuid?.();
    if (uid === undefined || pins.at(-1)!.stat.uid !== BigInt(uid)) fail();
    const device = pins.at(-1)!.stat.dev;
    const baseline = path.join(workspace, "data", "internal-production-baseline");
    const root = path.join(baseline, "deployment-cutover-v1");
    for (const target of [path.join(workspace, "data"), baseline, root]) {
      assertPins();
      let before: BigIntStats;
      try { before = fs.lstatSync(target, { bigint: true }); }
      catch (error) {
        if (!missing(error)) throw error;
        assertPins();
        let absent = false;
        try { fs.lstatSync(target, { bigint: true }); } catch (recheck) { if (!missing(recheck)) throw recheck; absent = true; }
        if (!absent) fail();
        assertPins();
        result = Object.freeze({ state: "absent" });
        break;
      }
      if (!before.isDirectory() || before.isSymbolicLink() || before.uid !== BigInt(uid) || before.dev !== device
        || (before.mode & 0o022n) !== 0n || (target === root && (before.mode & 0o7777n) !== 0o700n)) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pins.push({ target, fd, stat: before }); assertPins();
    }
    if (result === undefined) {
      const inventory = (): void => {
        const names = fs.readdirSync(root);
        if (names.length !== 1 || names[0] !== "intent.json") fail();
      };
      inventory(); assertPins();
      const target = path.join(root, "intent.json");
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(fd);
      const before = fs.fstatSync(fd, { bigint: true });
      if (!before.isFile() || before.uid !== BigInt(uid) || before.dev !== device || before.nlink !== 1n
        || (before.mode & 0o7777n) !== 0o600n || before.size === 0n || before.size > 65536n) fail();
      const buffer = Buffer.alloc(65537), length = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (BigInt(length) !== before.size || !same(before, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
        || !same(before, fs.lstatSync(target, { bigint: true }), FILE_KEYS)) fail();
      const intent = parseDeploymentCutoverIntentV1(buffer.subarray(0, length));
      inventory(); assertPins();
      if (!same(before, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
        || !same(before, fs.lstatSync(target, { bigint: true }), FILE_KEYS)) fail();
      result = Object.freeze({ state: "open", intent });
    }
    assertPins();
  } catch (error) { failures.push(error); }
  // Consume once before close; uncertain close must not retry a reused fd.
  while (descriptors.length) {
    const fd = descriptors.pop()!;
    try { fs.closeSync(fd); } catch (error) { cleanupUncertain = true; failures.push(error); }
  }
  if (failures.length > 0) throw new AggregateError(failures, "DEPLOYMENT_CUTOVER_OBSERVATION_INVALID");
  if (result === undefined) fail();
  return result;
}
