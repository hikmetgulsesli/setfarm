import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { encodeDeploymentCutoverIntentV1, parseDeploymentCutoverIntentV1, type DeploymentCutoverIntentV1 } from "./baseline-deployment-cutover-records-v1.js";
import { observeDeploymentCutoverIntentV1 } from "./baseline-deployment-cutover-v1.js";

const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const CONTENT_KEYS = [...DIRECTORY_KEYS, "size", "mtimeNs"] as const;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]): boolean => keys.every(key => a[key] === b[key]);
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_PUBLICATION_INVALID"); }

// Internal storage only. Publication refuses ordinary startup; it does not
// authenticate controller ownership, authorize service effects or grant recovery.
// Partial roots are preserved, never adopted or repaired by this operation.
export function publishDeploymentCutoverIntentV1(input: unknown): DeploymentCutoverIntentV1 {
  if (cleanupUncertain) fail();
  const bytes = encodeDeploymentCutoverIntentV1(input);
  const intent = parseDeploymentCutoverIntentV1(bytes);
  const descriptors: number[] = [];
  const pins: Array<{ target: string; fd: number; stat: BigIntStats }> = [];
  const failures: unknown[] = [];
  const assertPins = (): void => {
    for (const pin of pins) {
      const current = fs.lstatSync(pin.target, { bigint: true });
      if (!current.isDirectory() || current.isSymbolicLink()
        || !same(pin.stat, current, DIRECTORY_KEYS)
        || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
    }
  };
  const hold = (target: string): BigIntStats => {
    assertPins();
    const stat = fs.lstatSync(target, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    descriptors.push(fd); pins.push({ target, fd, stat }); assertPins();
    return stat;
  };
  try {
    const lexical = resolveInternalProductionBaselineWorkspaceRootV1();
    const workspace = process.platform === "darwin" && lexical.startsWith("/var/") ? `/private${lexical}` : lexical;
    const filesystemRoot = path.parse(workspace).root;
    const segments = path.relative(filesystemRoot, workspace).split(path.sep);
    hold(filesystemRoot);
    for (let index = 0; index < segments.length; index++) hold(path.join(filesystemRoot, ...segments.slice(0, index + 1)));
    const uid = process.getuid?.(), workspaceStat = pins.at(-1)!.stat;
    if (uid === undefined || workspaceStat.uid !== BigInt(uid)) fail();
    const device = workspaceStat.dev;
    const baseline = path.join(workspace, "data", "internal-production-baseline");
    for (const target of [path.join(workspace, "data"), baseline]) {
      const stat = hold(target);
      if (stat.uid !== BigInt(uid) || stat.dev !== device || (stat.mode & 0o022n) !== 0n) fail();
    }
    const baselineFd = pins.at(-1)!.fd;
    const root = path.join(baseline, "deployment-cutover-v1");
    let created = false;
    assertPins();
    try { fs.mkdirSync(root, { mode: 0o700 }); created = true; }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
    const rootStat = hold(root);
    if (rootStat.uid !== BigInt(uid) || rootStat.dev !== device || (rootStat.mode & 0o7777n) !== 0o700n) fail();
    const rootFd = pins.at(-1)!.fd;
    if (!created) {
      const fixed = path.join(root, "intent.json");
      const file = fs.openSync(fixed, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(file);
      const retained = fs.fstatSync(file, { bigint: true });
      if (!retained.isFile() || retained.uid !== BigInt(uid) || retained.dev !== device || retained.nlink !== 1n
        || (retained.mode & 0o7777n) !== 0o600n || retained.size !== BigInt(bytes.length)) fail();
      const assertRetained = (): void => {
        assertPins();
        if (!same(retained, fs.fstatSync(file, { bigint: true }), FILE_KEYS)
          || !same(retained, fs.lstatSync(fixed, { bigint: true }), FILE_KEYS)) fail();
      };
      assertRetained();
      const observed = observeDeploymentCutoverIntentV1();
      if (observed.state !== "open" || !encodeDeploymentCutoverIntentV1(observed.intent).equals(bytes)) fail();
      assertRetained(); fs.fsyncSync(file); assertRetained();
      fs.fsyncSync(rootFd); assertRetained(); fs.fsyncSync(baselineFd); assertRetained();
    } else {
      fs.fsyncSync(baselineFd); assertPins();
      if (fs.readdirSync(root).length !== 0) fail();
      const stagingName = `.intent.${randomUUID()}.tmp`;
      const staging = path.join(root, stagingName), fixed = path.join(root, "intent.json");
      const file = fs.openSync(staging, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
      descriptors.push(file);
      const initial = fs.fstatSync(file, { bigint: true });
      if (!initial.isFile() || initial.uid !== BigInt(uid) || initial.dev !== device || initial.nlink !== 1n
        || (initial.mode & 0o7777n) !== 0o600n || initial.size !== 0n
        || !same(initial, fs.lstatSync(staging, { bigint: true }), FILE_KEYS)) fail();
      assertPins(); fs.writeFileSync(file, bytes); fs.fsyncSync(file); assertPins();
      const prepared = fs.fstatSync(file, { bigint: true });
      const read = (): void => {
        const buffer = Buffer.alloc(65537);
        const length = fs.readSync(file, buffer, 0, buffer.length, 0);
        if (!buffer.subarray(0, length).equals(bytes)) fail();
      };
      const inventory = (names: string[]): void => {
        if (JSON.stringify(fs.readdirSync(root).sort()) !== JSON.stringify([...names].sort())) fail();
      };
      if (!same(initial, prepared, DIRECTORY_KEYS) || prepared.nlink !== 1n || prepared.size !== BigInt(bytes.length)) fail();
      read();
      if (!same(prepared, fs.fstatSync(file, { bigint: true }), FILE_KEYS)
        || !same(prepared, fs.lstatSync(staging, { bigint: true }), FILE_KEYS)) fail();
      inventory([stagingName]); assertPins();
      fs.linkSync(staging, fixed);
      const linked = fs.fstatSync(file, { bigint: true });
      if (linked.nlink !== 2n || !same(prepared, linked, CONTENT_KEYS)) fail();
      read(); inventory([stagingName, "intent.json"]); assertPins();
      if (!same(linked, fs.fstatSync(file, { bigint: true }), FILE_KEYS)
        || !same(linked, fs.lstatSync(staging, { bigint: true }), FILE_KEYS)
        || !same(linked, fs.lstatSync(fixed, { bigint: true }), FILE_KEYS)) fail();
      fs.unlinkSync(staging);
      const final = fs.fstatSync(file, { bigint: true });
      if (final.nlink !== 1n || !same(prepared, final, CONTENT_KEYS)
        || !same(final, fs.lstatSync(fixed, { bigint: true }), FILE_KEYS)) fail();
      inventory(["intent.json"]); assertPins(); fs.fsyncSync(rootFd); assertPins();
    }
  } catch (error) { failures.push(error); }
  while (descriptors.length) {
    const fd = descriptors.pop()!;
    try { fs.closeSync(fd); } catch (error) { cleanupUncertain = true; failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "DEPLOYMENT_CUTOVER_PUBLICATION_INVALID");
  const observed = observeDeploymentCutoverIntentV1();
  if (observed.state !== "open" || !encodeDeploymentCutoverIntentV1(observed.intent).equals(bytes)) fail();
  return intent;
}
