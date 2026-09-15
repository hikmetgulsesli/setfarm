import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { createHash } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "nlink", "size", "mtimeNs", "ctimeNs"] as const;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]): boolean => keys.every(key => a[key] === b[key]);
const physicalAlias = (value: string): string => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
const directoryIdentity = (stat: BigIntStats) => Object.freeze({ dev: String(stat.dev), ino: String(stat.ino), mode: Number(stat.mode),
  uid: Number(stat.uid), gid: Number(stat.gid), birthtimeNs: String(stat.birthtimeNs) });
const fileIdentity = (stat: BigIntStats) => Object.freeze({ ...directoryIdentity(stat), nlink: String(stat.nlink), size: String(stat.size),
  mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) });
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID"); }

// Fixed-target physical diagnostic only. Layout and bytes are not authenticated
// source/build, controller ownership, exclusion or permission to replace a link.
export function observeDeploymentCutoverCliLinkV1() {
  if (cleanupUncertain) fail();
  const descriptors: number[] = [];
  const pins = new Map<string, { fd: number; stat: BigIntStats }>();
  const failures: unknown[] = [];
  let result: Readonly<{
    schema: "setfarm.internal-production-deployment-cutover-cli-observation.v1";
    cliLinkPath: string; rawLinkTarget: string; targetPath: string; checkoutPath: string;
    linkIdentity: ReturnType<typeof fileIdentity>; targetIdentity: ReturnType<typeof fileIdentity>;
    targetBytesHash: string; ancestors: readonly Readonly<{ path: string; identity: ReturnType<typeof directoryIdentity> }>[];
    cliLinkObservationHash: string;
  }> | undefined;
  const assertPins = (): void => {
    for (const [target, pin] of pins) {
      const current = fs.lstatSync(target, { bigint: true });
      if (!current.isDirectory() || current.isSymbolicLink() || !same(pin.stat, current, DIRECTORY_KEYS)
        || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
    }
  };
  try {
    const uid = process.getuid?.(), home = physicalAlias(userInfo().homedir);
    const workspace = physicalAlias(resolveInternalProductionBaselineWorkspaceRootV1());
    if (uid === undefined || !path.isAbsolute(home) || path.normalize(home) !== home) fail();
    const holdAncestors = (directory: string): void => {
      const root = path.parse(directory).root, segments = path.relative(root, directory).split(path.sep).filter(Boolean);
      if (segments.length > 128) fail();
      for (const target of [root, ...segments.map((_, index) => path.join(root, ...segments.slice(0, index + 1)))]) {
        assertPins();
        if (pins.has(target)) continue;
        const stat = fs.lstatSync(target, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
        if ((target === home || target.startsWith(`${home}${path.sep}`))
          && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n)) fail();
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        descriptors.push(fd); pins.set(target, { fd, stat }); assertPins();
      }
    };
    const cliLinkPath = path.join(home, ".local", "bin", "setfarm");
    holdAncestors(path.dirname(cliLinkPath));
    const link = fs.lstatSync(cliLinkPath, { bigint: true });
    if (!link.isSymbolicLink() || link.uid !== BigInt(uid) || link.nlink !== 1n || link.size < 1n || link.size > 4096n) fail();
    const raw = fs.readlinkSync(cliLinkPath, { encoding: "buffer" });
    const rawLinkTarget = raw.toString("utf8");
    if (!Buffer.from(rawLinkTarget, "utf8").equals(raw) || BigInt(raw.length) !== link.size) fail();
    const targetPath = physicalAlias(path.resolve(path.dirname(cliLinkPath), rawLinkTarget));
    if (!targetPath.endsWith(`${path.sep}dist${path.sep}cli${path.sep}cli.js`)) fail();
    const checkoutPath = path.dirname(path.dirname(path.dirname(targetPath)));
    const relative = path.relative(workspace, checkoutPath);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail();
    holdAncestors(path.dirname(targetPath));
    const workspacePin = pins.get(workspace);
    if (!workspacePin) fail();
    const assertLink = (): void => {
      assertPins();
      const current = fs.lstatSync(cliLinkPath, { bigint: true });
      if (!current.isSymbolicLink() || !same(link, current, FILE_KEYS)
        || !fs.readlinkSync(cliLinkPath, { encoding: "buffer" }).equals(raw)
        || fs.realpathSync(cliLinkPath) !== targetPath) fail();
    };
    assertLink();
    const before = fs.lstatSync(targetPath, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.uid !== BigInt(uid) || before.dev !== workspacePin.stat.dev
      || before.nlink !== 1n || (before.mode & 0o022n) !== 0n || before.size < 1n || before.size > BigInt(MAX_ENTRY_BYTES)) fail();
    const fd = fs.openSync(targetPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    descriptors.push(fd);
    if (!same(before, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)) fail();
    assertLink();
    const buffer = Buffer.alloc(MAX_ENTRY_BYTES + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (BigInt(length) !== before.size || !same(before, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
      || !same(before, fs.lstatSync(targetPath, { bigint: true }), FILE_KEYS)) fail();
    assertLink();
    const body = { schema: "setfarm.internal-production-deployment-cutover-cli-observation.v1" as const,
      cliLinkPath, rawLinkTarget, targetPath, checkoutPath, linkIdentity: fileIdentity(link), targetIdentity: fileIdentity(before),
      targetBytesHash: createHash("sha256").update(buffer.subarray(0, length)).digest("hex"),
      ancestors: Object.freeze([...pins].map(([target, pin]) => Object.freeze({ path: target, identity: directoryIdentity(pin.stat) }))) };
    result = Object.freeze({ ...body, cliLinkObservationHash: hashCanonicalJson(body) });
  } catch (error) { failures.push(error); }
  while (descriptors.length) {
    const fd = descriptors.pop()!;
    try { fs.closeSync(fd); } catch (error) { cleanupUncertain = true; failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "DEPLOYMENT_CUTOVER_CLI_OBSERVATION_INVALID");
  if (!result) fail();
  return result;
}
