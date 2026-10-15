import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { types } from "node:util";
import { holdDeploymentCutoverNodePathV1 } from "./baseline-deployment-cutover-node-path-v1.js";
import { observeDeploymentCutoverProcessFamiliesV1 } from "./baseline-deployment-cutover-process-observation-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { assertDashboardCutoverJointDefinitionTokenV4, assertDashboardCutoverJointDefinitionSettlementTokenV4,
  assertDashboardCutoverJointDefinitionReleaseTokenV4, revokeDashboardCutoverJointTokenV4,
  executeDashboardCutoverJointPre32AssertionsV4 } from "../../scripts/deployment-dashboard-cutover-adapter-v2.mjs";

const LABELS = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"] as const;
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;
const MAX_BYTES = 1024 * 1024;
let cleanupUncertain = false;
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID"); }
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) => keys.every(key => a[key] === b[key]);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const equal = (left: unknown, right: unknown) => hashCanonicalJson(left) === hashCanonicalJson(right);
type ApprovedDefinitionAttemptV4 = { descriptors: number[]; closed: boolean };
type ApprovedDefinitionLeaseV4 = { check(): void; close(): void };
function approvedDefinitionFailureV4(): never { throw Error("DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED"); }
function approvedDefinitionXmlV4(value: unknown): Buffer {
  const escape = (input: string): string => {
    for (const character of input) {
      const code = character.codePointAt(0)!;
      if (!(code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff)
        || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff))) approvedDefinitionFailureV4();
    }
    return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\r/g, "&#13;");
  };
  const encode = (item: unknown): string => {
    if (typeof item === "string") return `<string>${escape(item)}</string>`;
    if (item === true) return "<true/>";
    if (item === 60) return "<integer>60</integer>";
    if (Array.isArray(item)) return `<array>${item.map(encode).join("")}</array>`;
    if (item && typeof item === "object") return `<dict>${Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => `<key>${escape(key)}</key>${encode(entry)}`).join("")}</dict>`;
    return approvedDefinitionFailureV4();
  };
  const bytes = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0">${encode(value)}</plist>\n`);
  if (bytes.length === 0 || bytes.length > MAX_BYTES) approvedDefinitionFailureV4();
  return bytes;
}
function prepareApprovedDefinitionV4(attempt: ApprovedDefinitionAttemptV4, parsed: unknown,
  home: string, uid: number, checkOriginal: () => void): ApprovedDefinitionLeaseV4 {
  const refuse = approvedDefinitionFailureV4;
  const pins: Array<{ target: string; fd: number; stat: BigIntStats }> = [];
  let file: { target: string; fd: number; stat: BigIntStats; bytes: Buffer } | undefined;
  const port = <T>(body: () => T): T => {
    checkOriginal();
    const result = body(); // FD-returning bodies register custody before return.
    checkOriginal();
    return result;
  };
  const check = () => {
    if (attempt.closed) refuse();
    checkOriginal();
    for (const pin of pins) {
      if (!same(pin.stat, port(() => fs.fstatSync(pin.fd, { bigint: true })), DIRECTORY_KEYS)
        || !same(pin.stat, port(() => fs.lstatSync(pin.target, { bigint: true })), DIRECTORY_KEYS)) refuse();
    }
    checkOriginal();
    if (file) {
      const original = file;
      if (!same(original.stat, port(() => fs.fstatSync(original.fd, { bigint: true })), FILE_KEYS)
        || !same(original.stat, port(() => fs.lstatSync(original.target, { bigint: true })), FILE_KEYS)) refuse();
      const bytes = Buffer.alloc(file.bytes.length + 1);
      let count = 0;
      while (count < bytes.length) {
        const read = port(() => fs.readSync(original.fd, bytes, count, bytes.length - count, count));
        if (!Number.isInteger(read) || read < 0 || read > bytes.length - count) refuse();
        if (read === 0) break;
        count += read;
      }
      if (count !== file.bytes.length || !bytes.subarray(0, count).equals(file.bytes)
        || !same(original.stat, port(() => fs.fstatSync(original.fd, { bigint: true })), FILE_KEYS)
        || !same(original.stat, port(() => fs.lstatSync(original.target, { bigint: true })), FILE_KEYS)) refuse();
    }
    checkOriginal();
  };
  checkOriginal();
  if (!exact(parsed, ["EnvironmentVariables", "Label", "ProgramArguments", "RunAtLoad", "StandardErrorPath", "StandardOutPath", "StartInterval"])) return refuse();
  const bytes = approvedDefinitionXmlV4({ ...parsed,
    MachServices: { "com.setrox.setfarm.dashboard-cutover.job.v4": { ResetAtClose: true } } });
  checkOriginal();
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  const segments = path.relative(path.parse(baseline).root, baseline).split(path.sep);
  if (segments.length > 128) refuse();
  let device: bigint | undefined;
  const pinDirectory = (target: string, privateMode = false) => {
    check();
    const stat = port(() => fs.lstatSync(target, { bigint: true }));
    if (!stat.isDirectory() || stat.isSymbolicLink() || ((target === home || target.startsWith(home + path.sep))
      && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n || (device !== undefined && stat.dev !== device)))
      || (privateMode && (stat.mode & 0o7777n) !== 0o700n)) refuse();
    if (target === home) device = stat.dev;
    check();
    const fd = port(() => {
      const returned = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      attempt.descriptors.push(returned); return returned;
    });
    pins.push({ target, fd, stat });
    check();
  };
  for (const target of [path.parse(baseline).root, ...segments.map((_, i) => path.join(path.parse(baseline).root, ...segments.slice(0, i + 1)))]) pinDirectory(target);
  const baselineFd = pins.at(-1)!.fd;
  const collection = path.join(baseline, "dashboard-cutover-approved-definitions-v4");
  check();
  let missing = false;
  try { port(() => fs.lstatSync(collection, { bigint: true })); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") refuse(); missing = true; }
  check();
  if (missing) { port(() => fs.mkdirSync(collection, { mode: 0o700 })); check(); }
  pinDirectory(collection, true);
  const collectionFd = pins.at(-1)!.fd;
  check();
  const nonce = port(() => randomUUID());
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonce)) refuse();
  const directory = path.join(collection, nonce);
  check(); port(() => fs.mkdirSync(directory, { mode: 0o700 })); check(); pinDirectory(directory, true);
  const directoryFd = pins.at(-1)!.fd, target = path.join(directory, "com.setrox.setfarm-dashboard.plist");
  check();
  const fd = port(() => {
    const returned = fs.openSync(target, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    attempt.descriptors.push(returned); return returned;
  });
  check();
  const initial = port(() => fs.fstatSync(fd, { bigint: true }));
  let staged = initial;
  const checkWriting = (size: number) => {
    check();
    const current = port(() => fs.fstatSync(fd, { bigint: true }));
    if (!same(staged, current, FILE_KEYS)) refuse();
    const lexical = port(() => fs.lstatSync(target, { bigint: true }));
    if (!initial.isFile() || initial.uid !== BigInt(uid) || initial.dev !== device || initial.nlink !== 1n
      || (initial.mode & 0o7777n) !== 0o600n || !same(initial, current, DIRECTORY_KEYS)
      || !same(staged, lexical, FILE_KEYS) || current.nlink !== 1n || lexical.nlink !== 1n
      || current.size !== BigInt(size) || lexical.size !== BigInt(size)) refuse();
    const prefix = Buffer.alloc(size + 1);
    let read = 0;
    while (read < prefix.length) {
      const count = port(() => fs.readSync(fd, prefix, read, prefix.length - read, read));
      if (!Number.isInteger(count) || count < 0 || count > prefix.length - read) refuse();
      if (count === 0) break;
      read += count;
    }
    if (read !== size || !prefix.subarray(0, read).equals(bytes.subarray(0, size))
      || !same(staged, port(() => fs.fstatSync(fd, { bigint: true })), FILE_KEYS)
      || !same(staged, port(() => fs.lstatSync(target, { bigint: true })), FILE_KEYS)) refuse();
    check();
  };
  let written = 0;
  checkWriting(written);
  while (written < bytes.length) {
    const count = port(() => fs.writeSync(fd, bytes, written, bytes.length - written, written));
    if (!Number.isInteger(count) || count <= 0 || count > bytes.length - written) refuse();
    written += count;
    // Only the admitted own write may advance staged size/timestamps. Preserve
    // this original post-write observation through all later read/sync ports.
    staged = port(() => fs.fstatSync(fd, { bigint: true }));
    checkWriting(written);
  }
  checkWriting(written); port(() => fs.fsyncSync(fd)); checkWriting(written);
  const sealed = staged; checkWriting(written);
  file = { target, fd, stat: sealed, bytes };
  check();
  for (const parent of [directoryFd, collectionFd, baselineFd]) { check(); port(() => fs.fsyncSync(parent)); check(); }
  return { check, close() {
    if (attempt.closed) return;
    attempt.closed = true;
    let uncertain = false;
    while (attempt.descriptors.length) {
      const original = attempt.descriptors.pop()!;
      try { fs.closeSync(original); } catch { uncertain = true; cleanupUncertain = true; }
    }
    if (uncertain) refuse();
  } };
}
type LauncherPre32ContinuationV2<T> = (scope: object, census: Awaited<ReturnType<
  typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusV1>>) => Promise<T>;
function command(executable: string, args: string[], input?: Buffer): string {
  const result = spawnSync(executable, args, { input, encoding: "buffer", timeout: 5000, maxBuffer: MAX_BYTES,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" } });
  if (result.error || result.signal || result.status !== 0 || !Buffer.isBuffer(result.stdout)
    || !Buffer.isBuffer(result.stderr) || result.stderr.length !== 0
    || result.stdout.length > MAX_BYTES || !Buffer.from(result.stdout.toString("utf8")).equals(result.stdout)) fail();
  return result.stdout.toString("utf8");
}
function scalar(text: string, name: string): string {
  const matches = [...text.matchAll(new RegExp(`^\\t${name} = (.*)$`, "gm"))];
  if (matches.length !== 1 || !matches[0]![1]) fail(); return matches[0]![1]!;
}
function block(text: string, name: string): string[] {
  const matches = [...text.matchAll(new RegExp(`^\\t${name} = \\{\\n([\\s\\S]*?)^\\t\\}$`, "gm"))];
  if (matches.length !== 1) fail();
  const lines = matches[0]![1]!.split("\n").filter(Boolean);
  if (lines.some(line => !line.startsWith("\t\t"))) fail();
  return lines.map(line => line.slice(2));
}
function environment(text: string, name: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const line of block(text, name)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*) => (.+)$/.exec(line);
    if (!match || Object.hasOwn(result, match[1]!)) fail(); result[match[1]!] = match[2]!;
  }
  return result;
}

// Diagnostic only: loaded-idle launchers are not a process/zero-owner census.
// Secret-bearing parser values stay local and are never attached to errors.
function holdLauncherConfigurationV1(defaultMode = false) {
  if (cleanupUncertain) fail();
  const descriptors: number[] = [], pins = new Map<string, { fd: number; stat: BigIntStats }>();
  let invalid = false;
  type Entry = Readonly<{ label: string; plistPath: string; launchArguments: readonly string[];
    plistIdentity: Readonly<Record<string, string>>; plistBytesHash: string; configurationHash: string;
    state: string; activeCount: 0; loadedStateHash: string }>;
  let output: Readonly<{ schema: string; launchers: readonly Entry[]; launcherObservationHash: string }> | undefined;
  let recheck: () => void = fail;
  let recheckMaterial: () => void = fail;
  let observeQuietPhase: (phase: 0 | 1 | 2, execute: (index: 0 | 1) => Promise<QuietCommandResultV4>,
    checkOriginal: () => void) => Promise<QuietPhaseDataV4> = async () => fail();
  let assertMaterialDatabase: () => void = fail;
  let withPre32Database: <T>(continuation: LauncherPre32ContinuationV2<T>, check: () => void) => Promise<T> = async () => fail();
  let qualifyCoreReader: (check: () => void) => Promise<HeldCoreReaderDiagnosticV2> = async () => fail();
  let approvedAttemptV4: ApprovedDefinitionAttemptV4 | undefined;
  let createApprovedDefinitionV4: (check: () => void) => ApprovedDefinitionLeaseV4 = () => approvedDefinitionFailureV4();
  const coreReaderOriginals: {
    imported?: Promise<typeof import("../db/dashboard-core-readonly-reader-v2.js")>;
    owner?: ReturnType<typeof import("../db/dashboard-core-readonly-reader-v2.js").createDashboardCoreReadonlyReaderV2>;
    preparation?: Promise<void>; read?: Promise<unknown>; refusalConsumed: boolean;
  } = { refusalConsumed: false };
  let census: () => ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusV1> = async () => fail();
  let censusAndActiveRows: () => ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4> = async () => fail();
  let censusAndActiveRowsWithQuarantine: () => ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndActiveRowsWithQuarantineV5> = async () => fail();
  let censusAndBindingRows: () => ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndBindingRowsV6> = async () => fail();
  let censusAndBindingRowsV7: () => ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndBindingRowsV7> = async () => fail();
  let activeBindingSnapshot: () => ReturnType<typeof import("./baseline-positive-worktree-active-binding-cutover-database-v1.js").observePositiveWorktreeActiveBindingCutoverDatabaseV1> = async () => fail();
  let closed = false;
  let defaultInputs: undefined | {
    entries: { label: string; args: string[]; environment: Record<string, string> }[];
    snapshot: (index: number) => { state: string; activeCount: number; pid?: number };
  };
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    while (descriptors.length) {
      const fd = descriptors.pop()!;
      try { fs.closeSync(fd); } catch { cleanupUncertain = true; uncertain = true; }
    }
    if (uncertain) fail();
  };
  try {
    const uid = process.getuid?.(), rawHome = userInfo().homedir;
    const home = process.platform === "darwin" && rawHome.startsWith("/var/") ? `/private${rawHome}` : rawHome;
    if (uid === undefined || !path.isAbsolute(home) || path.normalize(home) !== home) fail();
    const checkPins = () => {
      for (const [target, pin] of pins) {
        const current = fs.lstatSync(target, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() || !same(pin.stat, current, DIRECTORY_KEYS)
          || !same(pin.stat, fs.fstatSync(pin.fd, { bigint: true }), DIRECTORY_KEYS)) fail();
      }
    };
    const directory = path.join(home, "Library", "LaunchAgents"), root = path.parse(directory).root;
    const segments = path.relative(root, directory).split(path.sep).filter(Boolean);
    if (segments.length > 128) fail();
    for (const target of [root, ...segments.map((_, index) => path.join(root, ...segments.slice(0, index + 1)))]) {
      checkPins();
      const stat = fs.lstatSync(target, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || ((target === home || target.startsWith(`${home}${path.sep}`))
        && (stat.uid !== BigInt(uid) || (stat.mode & 0o022n) !== 0n))) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); pins.set(target, { fd, stat }); checkPins();
    }
    const held = LABELS.map((label, index) => {
      checkPins(); const plistPath = path.join(directory, `${label}.plist`), stat = fs.lstatSync(plistPath, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== BigInt(uid) || stat.dev !== pins.get(directory)!.stat.dev
        || stat.nlink !== 1n || (stat.mode & 0o022n) !== 0n || stat.size < 1n || stat.size > BigInt(MAX_BYTES)) fail();
      const fd = fs.openSync(plistPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(fd);
      const read = () => {
        checkPins();
        if (!same(stat, fs.fstatSync(fd, { bigint: true }), FILE_KEYS) || !same(stat, fs.lstatSync(plistPath, { bigint: true }), FILE_KEYS)) fail();
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        let count = 0;
        while (count < buffer.length) {
          const size = fs.readSync(fd, buffer, count, buffer.length - count, count);
          if (size === 0) break;
          count += size;
        }
        if (BigInt(count) !== stat.size || !same(stat, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
          || !same(stat, fs.lstatSync(plistPath, { bigint: true }), FILE_KEYS)) fail();
        checkPins(); return buffer.subarray(0, count);
      };
      const bytes = read();
      const program = path.join(home, ".local", "bin", "setfarm");
      const args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
      const parsed: unknown = JSON.parse(command("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], bytes));
      if (!exact(parsed, ["EnvironmentVariables", "Label", "ProgramArguments", "RunAtLoad", "StandardErrorPath", "StandardOutPath", "StartInterval"])
        || parsed.Label !== label || parsed.RunAtLoad !== true || parsed.StartInterval !== 60 || !equal(parsed.ProgramArguments, args)) fail();
      const keys = index ? ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"] : ["PATH", "SETFARM_PG_URL"];
      const env = parsed.EnvironmentVariables;
      if (!exact(env, keys) || keys.some(key => typeof env[key] !== "string" || !(env[key] as string).length)) fail();
      const log = path.join(home, ".openclaw", "logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
      if (parsed.StandardOutPath !== `${log}.log` || parsed.StandardErrorPath !== `${log}.err.log`) fail();
      const projectText = (text: string) => {
        if (!text.startsWith(`gui/${uid}/${label} = {\n`) || !text.endsWith("}\n")) fail();
        const state = scalar(text, "state");
        // xpcproxy is occupied startup, not idle and never a Node sample target.
        // Only the separate default observer tolerates this natural transition.
        const occupied = defaultMode && (state === "running" || state === "xpcproxy");
        let pid: number | undefined;
        if (occupied) {
          const rawPid = scalar(text, "pid");
          if (!/^[1-9][0-9]*$/.test(rawPid)) fail();
          pid = Number(rawPid);
          if (!Number.isSafeInteger(pid) || pid <= 1) fail();
        }
        if ((!occupied && state !== "not running" && state !== "spawn scheduled") || scalar(text, "active count") !== (occupied ? "1" : "0")
          || (!occupied && /^\tpid = /m.test(text)) || scalar(text, "type") !== "LaunchAgent" || scalar(text, "path") !== plistPath
          || scalar(text, "program") !== program || !equal(block(text, "arguments"), args)
          || scalar(text, "run interval") !== "60 seconds" || !scalar(text, "properties").split(" | ").includes("runatload")) fail();
        const loaded = environment(text, "environment"), inherited = environment(text, "inherited environment"), defaults = environment(text, "default environment");
        if (!exact(loaded, [...keys, "OSLogRateLimit", "XPC_SERVICE_NAME"]) || loaded.OSLogRateLimit !== "64" || loaded.XPC_SERVICE_NAME !== label
          || keys.some(key => loaded[key] !== env[key]) || !exact(inherited, defaultMode ? ["SSH_AUTH_SOCK"] : ["SETFARM_ENV_DIR", "SSH_AUTH_SOCK"])
          || (!defaultMode && inherited.SETFARM_ENV_DIR !== path.join(home, "ai", "setrox", "setfarm", "scripts"))
          || !/^\/var\/run\/com\.apple\.launchd\.[A-Za-z0-9]+\/Listeners$/.test(inherited.SSH_AUTH_SOCK ?? "")
          || !exact(defaults, ["PATH"]) || defaults.PATH !== "/usr/bin:/bin:/usr/sbin:/sbin") fail();
        return { state, activeCount: occupied ? 1 : 0, ...(pid === undefined ? {} : { pid }), loaded, inherited, defaults };
      };
      const project = () => projectText(command("/bin/launchctl", ["print", `gui/${uid}/${label}`]));
      return { label, plistPath, stat, args, parsed, bytes, read, project, projectText };
    });
    const before = held.map(item => item.project());
    if (defaultMode && before.some(item => item.activeCount !== 0 || item.pid !== undefined)) fail();
    for (const item of held) if (!item.read().equals(item.bytes)) fail();
    const after = held.map(item => item.project());
    if (defaultMode && after.some(item => item.activeCount !== 0 || item.pid !== undefined)) fail();
    const configuration = (value: typeof before[number]) => ({ loaded: value.loaded, inherited: value.inherited, defaults: value.defaults });
    const stable = (a: typeof before[number], b: typeof before[number]) => equal(defaultMode ? configuration(a) : a, defaultMode ? configuration(b) : b);
    const launchers = held.map((item, index): Entry => {
      if (!stable(before[index]!, after[index]!) || !item.read().equals(item.bytes)) fail();
      const plistIdentity = Object.freeze(Object.fromEntries(FILE_KEYS.map(key => [key, String(item.stat[key])])));
      return Object.freeze({ label: item.label, plistPath: item.plistPath, launchArguments: Object.freeze(item.args), plistIdentity,
        plistBytesHash: digest(item.bytes), configurationHash: hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-launcher-configuration.v1", plistPath: item.plistPath, plist: item.parsed }),
        state: before[index]!.state, activeCount: 0, loadedStateHash: hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-launcher-loaded-state.v1", label: item.label, projection: before[index] }) });
    });
    checkPins();
    const body = { schema: "setfarm.internal-production-deployment-cutover-launcher-observation.v1", launchers: Object.freeze(launchers) };
    output = Object.freeze({ ...body, launcherObservationHash: hashCanonicalJson(body) });
    // V2's material lifetime is independent of deliberate loaded-job phases.
    // V1 callers below keep their original loaded-state comparisons unchanged.
    recheckMaterial = () => {
      if (closed || cleanupUncertain) fail();
      checkPins();
      for (const item of held) if (!item.read().equals(item.bytes)) fail();
      checkPins();
    };
    observeQuietPhase = async (phase, execute, checkOriginal) => {
      const checkMaterial = () => { checkOriginal(); recheckMaterial(); checkOriginal(); };
      checkMaterial();
      const states: string[] = [];
      for (const index of [0, 1] as const) {
        checkMaterial();
        const observed = await execute(index);
        // The fixed command's return check precedes another microtask seam.
        // Reauthenticate the SAME original before admitting any material FS.
        checkMaterial();
        if (index < phase) {
          const absent = Buffer.from(`Bad request.\nCould not find service "${LABELS[index]}" in domain for user gui: ${uid}\n`);
          if (observed.status !== 113 || observed.signal !== null || observed.stdout.length !== 0
            || !observed.stderr.equals(absent)) fail();
          states.push("unloaded");
        } else {
          if (observed.status !== 0 || observed.signal !== null || observed.stderr.length !== 0
            || !Buffer.from(observed.stdout.toString("utf8")).equals(observed.stdout)) fail();
          const projection = held[index]!.projectText(observed.stdout.toString("utf8"));
          if (projection.activeCount !== 0 || projection.pid !== undefined || !stable(projection, before[index]!)) fail();
          states.push(projection.state);
        }
      }
      checkMaterial();
      const spawnerLauncherConfigurationHash = output!.launchers[0]!.configurationHash;
      const dashboardLauncherConfigurationHash = output!.launchers[1]!.configurationHash;
      return Object.freeze({ observationHash: hashCanonicalJson({
        schema: "setfarm.internal-production-dashboard-cutover-launcher-quiet-phase.v4", phase,
        states, materialObservationHash: output!.launcherObservationHash,
        spawnerLauncherConfigurationHash, dashboardLauncherConfigurationHash,
      }), spawnerLauncherConfigurationHash, dashboardLauncherConfigurationHash });
    };
    createApprovedDefinitionV4 = check => {
      if (approvedAttemptV4) approvedDefinitionFailureV4();
      approvedAttemptV4 = { descriptors: [], closed: false };
      return prepareApprovedDefinitionV4(approvedAttemptV4, held[1]!.parsed, home, uid, check);
    };
    recheck = () => {
      if (closed || cleanupUncertain) fail();
      checkPins();
      for (const [index, item] of held.entries()) {
        if (!item.read().equals(item.bytes) || !stable(item.project(), before[index]!) || !item.read().equals(item.bytes)) fail();
      }
      checkPins();
    };
    if (defaultMode) defaultInputs = {
      entries: held.map((item, index) => {
        const projection = before[index]!;
        const environment: Record<string, string> = Object.create(null);
        // The only permitted collision is configured PATH overriding default PATH.
        for (const map of [projection.defaults, projection.inherited, projection.loaded]) {
          for (const [key, value] of Object.entries(map)) {
            if (Object.hasOwn(environment, key) && !(map === projection.loaded && key === "PATH")) fail();
            environment[key] = value;
          }
        }
        return { label: item.label, args: item.args, environment };
      }),
      snapshot: index => {
        recheck();
        const item = held[index];
        if (!item) fail();
        const current = item.project();
        if (!stable(current, before[index]!) || !item.read().equals(item.bytes)) fail();
        return { state: current.state, activeCount: current.activeCount, pid: current.pid };
      },
    };
    const agreedDatabaseUrl = (check: () => void = recheck) => {
      check();
      const urls = held.map(item => (item.parsed.EnvironmentVariables as Record<string, string>).SETFARM_PG_URL);
      const raw = urls[0];
      if (!raw || urls[1] !== raw || Object.keys(process.env).some(key => key.startsWith("PG"))
        || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(raw)) fail();
      const parsed = new URL(raw);
      if (!["postgres:", "postgresql:"].includes(parsed.protocol)
        || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
        || (parsed.port !== "" && parsed.port !== "5432") || parsed.pathname !== "/setfarm"
        || parsed.search !== "" || parsed.hash !== "") fail();
      return raw;
    };
    assertMaterialDatabase = () => { agreedDatabaseUrl(recheckMaterial); };
    qualifyCoreReader = async check => {
      const refuseOnce = () => {
        if (coreReaderOriginals.owner && !coreReaderOriginals.refusalConsumed) {
          coreReaderOriginals.refusalConsumed = true;
          coreReaderOriginals.owner.refuse();
        }
      };
      try {
        const raw = agreedDatabaseUrl(check);
        coreReaderOriginals.imported = import("../db/dashboard-core-readonly-reader-v2.js");
        const module = await coreReaderOriginals.imported;
        check();
        coreReaderOriginals.owner = module.createDashboardCoreReadonlyReaderV2(raw);
        check();
        coreReaderOriginals.preparation = coreReaderOriginals.owner.prepare();
        await coreReaderOriginals.preparation;
        check();
        coreReaderOriginals.read = coreReaderOriginals.owner.read({ kind: "rules" });
        const rows = await coreReaderOriginals.read;
        check();
        if (types.isProxy(rows) || !Array.isArray(rows)) fail();
        const count = Object.getOwnPropertyDescriptor(rows, "length")?.value;
        if (!Number.isSafeInteger(count) || count < 0 || count > 4096) fail();
        refuseOnce();
        check();
        return Object.freeze({ schema: "setfarm.dashboard-core-held-launcher-qualification.v2",
          authority: "diagnostic-only", target: "held-launcher", plannedApplicationStatements: 49,
          preparationTransactions: 1, readTransactions: 1, ruleCount: count });
      } catch {
        try { refuseOnce(); } catch { /* Unknown custody stays held by caller. */ }
        fail();
      }
    };
    const observeDatabase = async <T>(observe: (module: typeof import("./baseline-legacy-database-census-v1.js"),
      raw: string) => Promise<T>, check: () => void = recheck): Promise<T> => {
      const raw = agreedDatabaseUrl(check);
      const module = await import("./baseline-legacy-database-census-v1.js");
      check();
      const result = await observe(module, raw);
      check();
      return result;
    };
    withPre32Database = (continuation, check) => observeDatabase(
      (module, raw) => module.withHeldDashboardCutoverPre32DatabaseV2(raw, continuation), check);
    census = () => observeDatabase((module, raw) => module.observeLegacyDatabaseCensusV1(raw, true, "cutover-local"));
    censusAndActiveRows = () => observeDatabase((module, raw) =>
      module.observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(raw));
    censusAndActiveRowsWithQuarantine = () => observeDatabase((module, raw) =>
      module.observeLegacyDatabaseCensusAndActiveRowsWithQuarantineV5(raw));
    censusAndBindingRows = () => observeDatabase((module, raw) =>
      module.observeLegacyDatabaseCensusAndBindingRowsV6(raw));
    censusAndBindingRowsV7 = () => observeDatabase((module, raw) =>
      module.observeLegacyDatabaseCensusAndBindingRowsV7(raw));
    activeBindingSnapshot = async () => {
      const raw = agreedDatabaseUrl();
      const module = await import("./baseline-positive-worktree-active-binding-cutover-database-v1.js");
      recheck();
      const result = await module.observePositiveWorktreeActiveBindingCutoverDatabaseV1(raw);
      recheck();
      return result;
    };
  } catch { invalid = true; }
  if (invalid || !output) { close(); fail(); }
  return { observation: output, recheck, recheckMaterial, observeQuietPhase, assertMaterialDatabase, withPre32Database, qualifyCoreReader, createApprovedDefinitionV4, census, censusAndActiveRows, censusAndActiveRowsWithQuarantine,
    censusAndBindingRows, censusAndBindingRowsV7, activeBindingSnapshot, close, defaultInputs };
}

type LauncherMaterialStateV2 = {
  configuration?: ReturnType<typeof holdLauncherConfigurationV1>;
  account?: ReturnType<typeof launcherMaterialAccountV2>;
  valid: boolean;
  closed: boolean;
  outerSettled: boolean;
  callbackSettled: boolean;
  callback?: Promise<unknown>;
  coreReaderSelected: boolean;
  coreReaderCustodyUnknown: boolean;
  approvedDefinitionSelectedV4: boolean;
};
type HeldCoreReaderDiagnosticV2 = Readonly<{
  schema: "setfarm.dashboard-core-held-launcher-qualification.v2";
  authority: "diagnostic-only"; target: "held-launcher";
  plannedApplicationStatements: 49; preparationTransactions: 1; readTransactions: 1; ruleCount: number;
}>;
const launcherMaterialHandlesV2 = new WeakMap<object, LauncherMaterialStateV2>();
let launcherMaterialOccupiedV2 = false, launcherMaterialBurnedV2 = false;
let launcherMaterialBurnSequenceV2 = 0;
let launcherMaterialActiveV2: LauncherMaterialStateV2 | null = null;
// Retain the original state even on failed acquisition/cleanup; no replacement.
let launcherMaterialOriginalV2: LauncherMaterialStateV2 | null = null;
type DefinitionPre32OccurrenceV4 = { intent: boolean; unknown: boolean;
  outer: Promise<void> | null; outerSettled: boolean;
  callback: Promise<void> | null; callbackIntent: boolean; callbackSettled: boolean };
type ApprovedDefinitionOperationV4 = { original: object; token: object; definition: ApprovedDefinitionStateV4;
  handle: object | null; published: boolean; checking: boolean; settled: boolean; released: boolean; settlementIntent: boolean;
  pre32: DefinitionPre32OccurrenceV4 | null; quiet?: DefinitionQuietOccurrenceV4 };
const approvedDefinitionOperationScopesV4 = new WeakMap<object, ApprovedDefinitionOperationV4>();
let jointDefinitionOperationV4: ApprovedDefinitionOperationV4 | null = null;
function launcherMaterialAccountV2() {
  const account = userInfo();
  return { uid: account.uid, gid: account.gid, homedir: account.homedir, username: account.username, shell: account.shell };
}
function burnLauncherMaterialV2(state: LauncherMaterialStateV2 | null): never {
  if (jointDefinitionOperationV4 && state === jointDefinitionOperationV4.definition.material)
    revokeDashboardCutoverJointTokenV4(jointDefinitionOperationV4.token);
  if (state) state.valid = false;
  launcherMaterialBurnedV2 = true;
  launcherMaterialBurnSequenceV2 += 1;
  fail();
}
function assertLauncherMaterialIdleV2() {
  const joint = jointDefinitionOperationV4;
  if (joint?.settled) {
    try { assertDashboardCutoverJointDefinitionReleaseTokenV4(joint.token, joint.original); }
    catch { burnLauncherMaterialV2(joint.definition.material); }
    joint.released = true; jointDefinitionOperationV4 = null;
    joint.definition.material.outerSettled = true;
    settleLauncherMaterialActivityV2(joint.definition.material);
  }
  if (launcherMaterialActiveV2) burnLauncherMaterialV2(launcherMaterialActiveV2);
}
function launcherMaterialStateV2(handle: object, allowInvalid = false) {
  const state = launcherMaterialHandlesV2.get(handle);
  if (!state || (!allowInvalid && (!state.valid || state.closed || launcherMaterialBurnedV2 || cleanupUncertain))) fail();
  return state;
}
function checkLauncherMaterialStateV2(state: LauncherMaterialStateV2) {
  if (launcherMaterialActiveV2 !== state || state !== launcherMaterialOriginalV2
    || !state.valid || state.closed || launcherMaterialBurnedV2 || cleanupUncertain) fail();
  if (jointDefinitionOperationV4) {
    const quiet = jointDefinitionOperationV4.quiet;
    if (quiet) {
      if (!quiet.owner || quiet.unknown) fail();
      quiet.owner.assertDeploymentCutoverQuietMetadataV4(jointDefinitionOperationV4.token, jointDefinitionOperationV4.handle!);
    } else assertDashboardCutoverJointDefinitionTokenV4(jointDefinitionOperationV4.token, jointDefinitionOperationV4.original);
  }
}
function checkLauncherMaterialV2(state: LauncherMaterialStateV2) {
  const check = () => {
    checkLauncherMaterialStateV2(state);
    if (!state.account || !state.configuration) fail();
    const current = launcherMaterialAccountV2();
    if (!equal(current, state.account) || process.getuid?.() !== current.uid || process.geteuid?.() !== current.uid
      || process.getgid?.() !== current.gid || process.getegid?.() !== current.gid) fail();
    checkLauncherMaterialStateV2(state);
  };
  check(); state.configuration!.assertMaterialDatabase(); check();
}
function settleLauncherMaterialActivityV2(state: LauncherMaterialStateV2) {
  if (state.outerSettled && state.callbackSettled && !state.coreReaderCustodyUnknown
    && launcherMaterialActiveV2 === state) launcherMaterialActiveV2 = null;
}

/** Original plist material only. Never loaded-phase, Node-path or effect authority. */
export function holdDashboardCutoverLauncherMaterialV2(): object {
  assertLauncherMaterialIdleV2();
  if (arguments.length !== 0) fail();
  if (launcherMaterialOccupiedV2 || launcherMaterialBurnedV2 || cleanupUncertain) fail();
  launcherMaterialOccupiedV2 = true;
  const state: LauncherMaterialStateV2 = { valid: true, closed: false, outerSettled: false, callbackSettled: true,
    coreReaderSelected: false, coreReaderCustodyUnknown: false, approvedDefinitionSelectedV4: false };
  launcherMaterialOriginalV2 = launcherMaterialActiveV2 = state;
  try {
    state.account = launcherMaterialAccountV2();
    checkLauncherMaterialStateV2(state);
    state.configuration = holdLauncherConfigurationV1(true);
    checkLauncherMaterialV2(state);
    const handle = Object.freeze(Object.create(null)) as object;
    launcherMaterialHandlesV2.set(handle, state);
    return handle;
  } catch {
    state.valid = false; launcherMaterialBurnedV2 = true; state.closed = true;
    try { state.configuration?.close(); } catch { cleanupUncertain = true; }
    fail();
  } finally {
    state.outerSettled = true; settleLauncherMaterialActivityV2(state);
  }
}

export function assertHeldDashboardCutoverLauncherMaterialV2(handle: object): void {
  assertLauncherMaterialIdleV2();
  const state = launcherMaterialStateV2(handle);
  launcherMaterialActiveV2 = state; state.outerSettled = false;
  try { checkLauncherMaterialV2(state); }
  catch { burnLauncherMaterialV2(state); }
  finally { state.outerSettled = true; settleLauncherMaterialActivityV2(state); }
}

export async function withHeldDashboardCutoverLauncherPre32V2<T>(
  handle: object, continuation: LauncherPre32ContinuationV2<T>,
): Promise<T> {
  assertLauncherMaterialIdleV2();
  const state = launcherMaterialStateV2(handle);
  if (typeof continuation !== "function" || types.isProxy(continuation)) fail();
  launcherMaterialActiveV2 = state; state.outerSettled = false;
  try {
    checkLauncherMaterialV2(state);
    const result = await state.configuration!.withPre32Database((scope, census) => {
      // Track this ORIGINAL callback before invoking trusted caller work.
      if (state.callback && !state.callbackSettled) burnLauncherMaterialV2(state);
      state.callbackSettled = false;
      const work = Promise.resolve().then(async () => {
        checkLauncherMaterialV2(state);
        const answer = await continuation(scope, census);
        checkLauncherMaterialV2(state);
        return answer;
      });
      state.callback = work;
      void work.then(() => {
        state.callbackSettled = true; settleLauncherMaterialActivityV2(state);
      }, () => {
        state.valid = false; launcherMaterialBurnedV2 = true;
        state.callbackSettled = true; settleLauncherMaterialActivityV2(state);
      });
      return work;
    }, () => checkLauncherMaterialV2(state));
    checkLauncherMaterialV2(state);
    return result;
  } catch { burnLauncherMaterialV2(state); }
  finally {
    state.outerSettled = true;
    // Outer driver failure is not settlement of the retained original callback.
    settleLauncherMaterialActivityV2(state);
  }
}

/** Fixed actual private-reader diagnostic, not a facade or startup capability. */
export async function qualifyHeldDashboardCutoverCoreReaderV2(handle: object): Promise<HeldCoreReaderDiagnosticV2> {
  assertLauncherMaterialIdleV2();
  if (arguments.length !== 1) fail();
  const state = launcherMaterialStateV2(handle);
  if (state.coreReaderSelected) fail();
  state.coreReaderSelected = true;
  state.coreReaderCustodyUnknown = true; // A rejected API cannot certify private originals.
  launcherMaterialActiveV2 = state; state.outerSettled = false; state.callbackSettled = false;
  const work = Promise.resolve().then(async () => {
    checkLauncherMaterialV2(state);
    const answer = await state.configuration!.qualifyCoreReader(() => checkLauncherMaterialV2(state));
    checkLauncherMaterialV2(state);
    return answer;
  });
  state.callback = work; // Original registered before deferred imports/provider work.
  void work.then(() => { state.callbackSettled = true; settleLauncherMaterialActivityV2(state); }, () => {
    state.callbackSettled = true; settleLauncherMaterialActivityV2(state);
  });
  try {
    const result = await work;
    checkLauncherMaterialV2(state);
    state.coreReaderCustodyUnknown = false; // Only real lifecycle success proves its originals.
    return result;
  } catch { burnLauncherMaterialV2(state); }
  finally { state.outerSettled = true; settleLauncherMaterialActivityV2(state); }
}

export function closeHeldDashboardCutoverLauncherMaterialV2(handle: object): void {
  assertLauncherMaterialIdleV2();
  const state = launcherMaterialStateV2(handle, true);
  if (state.closed) return;
  launcherMaterialActiveV2 = state; state.outerSettled = false;
  state.closed = true; state.valid = false;
  const before = launcherMaterialBurnSequenceV2;
  try { state.configuration!.close(); if (launcherMaterialBurnSequenceV2 !== before || cleanupUncertain) fail(); }
  catch { launcherMaterialBurnedV2 = true; fail(); }
  finally { state.outerSettled = true; settleLauncherMaterialActivityV2(state); }
}

declare const approvedDefinitionBrandV4: unique symbol;
export type HeldDashboardCutoverApprovedDefinitionV4 = object & { readonly [approvedDefinitionBrandV4]: never };
type ApprovedDefinitionStateV4 = { material: LauncherMaterialStateV2; lease?: ApprovedDefinitionLeaseV4; valid: boolean; closed: boolean };
const approvedDefinitionHandlesV4 = new WeakMap<object, ApprovedDefinitionStateV4>();
let approvedDefinitionOriginalV4: ApprovedDefinitionStateV4 | undefined;
function approvedDefinitionIdleV4(): void {
  try { assertLauncherMaterialIdleV2(); } catch { approvedDefinitionFailureV4(); }
}
function burnApprovedDefinitionV4(state: ApprovedDefinitionStateV4): never {
  state.valid = false;
  try { burnLauncherMaterialV2(state.material); } catch { approvedDefinitionFailureV4(); }
}
export function holdDashboardCutoverApprovedDefinitionV4(originalMaterial: object): HeldDashboardCutoverApprovedDefinitionV4 {
  approvedDefinitionIdleV4();
  if (arguments.length !== 1) approvedDefinitionFailureV4();
  let material: LauncherMaterialStateV2;
  try { material = launcherMaterialStateV2(originalMaterial); } catch { approvedDefinitionFailureV4(); }
  if (material.approvedDefinitionSelectedV4) approvedDefinitionFailureV4();
  material.approvedDefinitionSelectedV4 = true;
  const state: ApprovedDefinitionStateV4 = { material, valid: true, closed: false };
  approvedDefinitionOriginalV4 = state;
  launcherMaterialActiveV2 = material; material.outerSettled = false;
  try {
    const check = () => { if (!state.valid || state.closed || approvedDefinitionOriginalV4 !== state) approvedDefinitionFailureV4(); checkLauncherMaterialV2(material); };
    check(); state.lease = material.configuration!.createApprovedDefinitionV4(check); check(); state.lease.check(); check();
    const handle = Object.freeze(Object.create(null)) as HeldDashboardCutoverApprovedDefinitionV4;
    approvedDefinitionHandlesV4.set(handle, state);
    return handle;
  } catch { burnApprovedDefinitionV4(state); }
  finally { material.outerSettled = true; settleLauncherMaterialActivityV2(material); }
}
export function assertHeldDashboardCutoverApprovedDefinitionV4(handle: HeldDashboardCutoverApprovedDefinitionV4): void {
  approvedDefinitionIdleV4();
  if (arguments.length !== 1) approvedDefinitionFailureV4();
  const state = approvedDefinitionHandlesV4.get(handle);
  if (!state || state !== approvedDefinitionOriginalV4 || !state.valid || state.closed) approvedDefinitionFailureV4();
  const material = state.material;
  launcherMaterialActiveV2 = material; material.outerSettled = false;
  try { checkLauncherMaterialV2(material); state.lease!.check(); checkLauncherMaterialV2(material); }
  catch { burnApprovedDefinitionV4(state); }
  finally { material.outerSettled = true; settleLauncherMaterialActivityV2(material); }
}
export function closeHeldDashboardCutoverApprovedDefinitionV4(handle: HeldDashboardCutoverApprovedDefinitionV4): void {
  approvedDefinitionIdleV4();
  if (arguments.length !== 1) approvedDefinitionFailureV4();
  const state = approvedDefinitionHandlesV4.get(handle);
  if (!state || state !== approvedDefinitionOriginalV4) approvedDefinitionFailureV4();
  if (state.closed) return;
  state.closed = true; state.valid = false;
  const material = state.material, sequence = launcherMaterialBurnSequenceV2;
  launcherMaterialActiveV2 = material; material.outerSettled = false;
  try { state.lease!.close(); if (sequence !== launcherMaterialBurnSequenceV2 || cleanupUncertain) approvedDefinitionFailureV4(); }
  catch { burnApprovedDefinitionV4(state); }
  finally { material.outerSettled = true; settleLauncherMaterialActivityV2(material); }
}

function checkApprovedDefinitionOperationV4(record: ApprovedDefinitionOperationV4): void {
  const state = record.definition;
  if (record !== jointDefinitionOperationV4 || !state.valid || state.closed || state !== approvedDefinitionOriginalV4)
    approvedDefinitionFailureV4();
  checkLauncherMaterialV2(state.material); state.lease!.check(); checkLauncherMaterialV2(state.material);
}
export function beginHeldDashboardCutoverApprovedDefinitionOperationV4(original: object, token: object): object {
  approvedDefinitionIdleV4();
  if (arguments.length !== 2) approvedDefinitionFailureV4();
  const definition = approvedDefinitionHandlesV4.get(original);
  if (!definition || definition !== approvedDefinitionOriginalV4 || !definition.valid || definition.closed)
    approvedDefinitionFailureV4();
  assertDashboardCutoverJointDefinitionTokenV4(token, original);
  const record: ApprovedDefinitionOperationV4 = { original, token, definition, handle: null,
    published: false, checking: true, settled: false, released: false, settlementIntent: false, pre32: null };
  jointDefinitionOperationV4 = record;
  launcherMaterialActiveV2 = definition.material; definition.material.outerSettled = false;
  try {
    checkApprovedDefinitionOperationV4(record);
    const handle = Object.create(null) as object;
    record.handle = handle; approvedDefinitionOperationScopesV4.set(handle, record);
    checkLauncherMaterialStateV2(definition.material);
    Object.freeze(handle); checkLauncherMaterialStateV2(definition.material);
    checkApprovedDefinitionOperationV4(record);
    record.published = true; record.checking = false; return handle;
  } catch { record.checking = false; burnApprovedDefinitionV4(definition); }
}
function originalApprovedDefinitionOperationV4(handle: object, arity: number): ApprovedDefinitionOperationV4 {
  if (jointDefinitionOperationV4?.checking || jointDefinitionOperationV4?.quiet?.active
    || jointDefinitionOperationV4?.quiet?.unknown || (launcherMaterialActiveV2 && !jointDefinitionOperationV4)) {
    try { burnLauncherMaterialV2(launcherMaterialActiveV2); } catch { approvedDefinitionFailureV4(); }
  }
  if (arity !== 1) approvedDefinitionFailureV4();
  const record = approvedDefinitionOperationScopesV4.get(handle);
  if (!record || record !== jointDefinitionOperationV4 || record.handle !== handle || !record.published || record.released)
    approvedDefinitionFailureV4();
  return record;
}
export function assertHeldDashboardCutoverApprovedDefinitionOperationV4(handle: object): void {
  const record = originalApprovedDefinitionOperationV4(handle, arguments.length);
  if (record.settled) approvedDefinitionFailureV4(); record.checking = true;
  try { checkApprovedDefinitionOperationV4(record); }
  catch { burnApprovedDefinitionV4(record.definition); }
  finally { record.checking = false; }
}
export function settleHeldDashboardCutoverApprovedDefinitionOperationV4(handle: object): void {
  const record = originalApprovedDefinitionOperationV4(handle, arguments.length);
  if (record.settled) approvedDefinitionFailureV4(); record.checking = true;
  try {
    if (record.pre32 && (record.pre32.unknown || !record.pre32.outerSettled
      || !record.pre32.callbackIntent || !record.pre32.callbackSettled)) approvedDefinitionFailureV4();
    if (record.quiet && (record.quiet.unknown || record.quiet.active || record.quiet.phase !== 2
      || record.quiet.children.some(child => !child.naturalSettled || child.error))) approvedDefinitionFailureV4();
    assertDashboardCutoverJointDefinitionSettlementTokenV4(record.token, record.original);
    record.settlementIntent = true; record.settled = true;
  } catch { burnApprovedDefinitionV4(record.definition); }
  finally { record.checking = false; }
}

/** Fixed original transaction work only; no caller continuation or database URL. */
export async function runHeldDashboardCutoverApprovedDefinitionOperationPre32V4(handle: object): Promise<void> {
  const active = jointDefinitionOperationV4;
  if (active?.pre32 && (active.pre32.unknown || !active.pre32.outerSettled || !active.pre32.callbackSettled)) {
    burnApprovedDefinitionV4(active.definition);
  }
  const record = originalApprovedDefinitionOperationV4(handle, arguments.length);
  if (record.settled || record.pre32) approvedDefinitionFailureV4();
  const occurrence: DefinitionPre32OccurrenceV4 = { intent: true, unknown: true,
    outer: null, outerSettled: false, callback: null, callbackIntent: false, callbackSettled: true };
  record.pre32 = occurrence; // Retain long lifetime separately from synchronous checking.
  const notifyFailure = () => {
    occurrence.unknown = true;
    try { burnApprovedDefinitionV4(record.definition); } catch { /* Notification is resource-free; preserve original work. */ }
  };
  const shortCheck = (check: () => void) => {
    if (record.checking) { notifyFailure(); approvedDefinitionFailureV4(); }
    record.checking = true;
    try { check(); } finally { record.checking = false; }
  };
  try {
    shortCheck(() => checkApprovedDefinitionOperationV4(record));
    occurrence.outer = record.definition.material.configuration!.withPre32Database((scope) => {
      if (occurrence.callbackIntent) { notifyFailure(); approvedDefinitionFailureV4(); }
      occurrence.callbackIntent = true; occurrence.callbackSettled = false;
      // Native original retained before its asynchronous body runs.
      const work = Promise.resolve().then(() => executeDashboardCutoverJointPre32AssertionsV4(record.token, record.original, scope));
      occurrence.callback = work;
      if (!types.isPromise(work)) { notifyFailure(); approvedDefinitionFailureV4(); }
      void work.then(() => { occurrence.callbackSettled = true; }, () => {
        occurrence.callbackSettled = true; notifyFailure();
      });
      return work;
    }, () => shortCheck(() => checkLauncherMaterialV2(record.definition.material)));
    if (!types.isPromise(occurrence.outer)) { notifyFailure(); approvedDefinitionFailureV4(); }
    void occurrence.outer.then(() => { occurrence.outerSettled = true; }, () => {
      occurrence.outerSettled = true; notifyFailure();
    });
    await occurrence.outer;
    if (!occurrence.outerSettled || !occurrence.callbackIntent || !occurrence.callbackSettled) approvedDefinitionFailureV4();
    // Only recovered SUCCESS proves the trusted provider's hidden final query settled.
    shortCheck(() => checkApprovedDefinitionOperationV4(record)); occurrence.unknown = false;
  } catch { notifyFailure(); approvedDefinitionFailureV4(); }
}

type QuietCommandResultV4 = { status: number | null; signal: NodeJS.Signals | null; stdout: Buffer; stderr: Buffer };
type QuietPhaseDataV4 = Readonly<{ observationHash: string; spawnerLauncherConfigurationHash: string;
  dashboardLauncherConfigurationHash: string }>;
type QuietOwnerMetadataV4 = { assertDeploymentCutoverQuietMetadataV4(token: object, scope: object): void;
  assertDeploymentCutoverSpawnerQuietIntentV4(token: object, scope: object): void;
  assertDeploymentCutoverDashboardQuietIntentV4(token: object, scope: object): void };
type QuietChildV4 = { intent: boolean; child: ChildProcessWithoutNullStreams | null; promise: Promise<QuietCommandResultV4> | null;
  driver: Promise<QuietCommandResultV4> | null; timer: ReturnType<typeof setTimeout> | null; naturalSettled: boolean; error: boolean;
  stdinFinished: boolean; stdinClosed: boolean; stdoutEnded: boolean; stdoutClosed: boolean; stderrEnded: boolean; stderrClosed: boolean;
  exitSeen: boolean; closeSeen: boolean; status: number | null; signal: NodeJS.Signals | null;
  stdout: Buffer[]; stderr: Buffer[]; stdoutLength: number; stderrLength: number };
type DefinitionQuietOccurrenceV4 = { active: boolean; unknown: boolean; phase: 0 | 1 | 2;
  ownerImport: Promise<QuietOwnerMetadataV4> | null; owner: QuietOwnerMetadataV4 | null;
  children: QuietChildV4[]; work: { intent: boolean; promise: Promise<unknown> | null; settled: boolean }[];
  spawnerAttempted: boolean; dashboardAttempted: boolean };
function quietDefinitionBurnV4(record: ApprovedDefinitionOperationV4): never {
  if (record.quiet) record.quiet.unknown = true;
  return burnApprovedDefinitionV4(record.definition);
}
function quietDefinitionAdmissionV4(record: ApprovedDefinitionOperationV4): void {
  const quiet = record.quiet;
  if (!quiet || quiet.unknown || !quiet.active || record !== jointDefinitionOperationV4
    || !record.published || record.settled || record.released || !quiet.owner) approvedDefinitionFailureV4();
  quiet.owner.assertDeploymentCutoverQuietMetadataV4(record.token, record.handle!);
}
function quietDefinitionCheckV4(record: ApprovedDefinitionOperationV4): void {
  quietDefinitionAdmissionV4(record);
  checkApprovedDefinitionOperationV4(record);
  quietDefinitionAdmissionV4(record);
}
async function withQuietDefinitionV4<T>(scope: object, arity: number,
  body: (record: ApprovedDefinitionOperationV4) => Promise<T>): Promise<T> {
  const record = originalApprovedDefinitionOperationV4(scope, arity);
  if (record.settled || record.pre32) approvedDefinitionFailureV4();
  const quiet = record.quiet ??= { active: false, unknown: false, phase: 0, ownerImport: null, owner: null,
    children: [], work: [], spawnerAttempted: false, dashboardAttempted: false };
  quiet.active = true; record.checking = true;
  try {
    if (!quiet.ownerImport) {
      // Retain the original fixed import before await. No caller module/port.
      quiet.ownerImport = import(new URL("../../scripts/deployment-cutover-owner.mjs", import.meta.url).href);
      quiet.owner = await quiet.ownerImport;
    }
    quietDefinitionCheckV4(record);
    const occurrence = { intent: true, promise: null as Promise<unknown> | null, settled: false };
    quiet.work.push(occurrence); quietDefinitionAdmissionV4(record);
    const work = Promise.resolve().then(() => body(record)); occurrence.promise = work;
    void work.then(() => { occurrence.settled = true; }, () => { occurrence.settled = true; });
    quietDefinitionAdmissionV4(record);
    const answer = await work; quietDefinitionCheckV4(record); return answer;
  } catch { quietDefinitionBurnV4(record); }
  finally { quiet.active = false; record.checking = false; }
}

async function quietCommandV4(record: ApprovedDefinitionOperationV4, index: 0 | 1,
  action: "print" | "bootout"): Promise<QuietCommandResultV4> {
  const quiet = record.quiet!;
  const occurrence: QuietChildV4 = { intent: true, child: null, promise: null, driver: null, timer: null,
    naturalSettled: false, error: false, stdinFinished: false, stdinClosed: false, stdoutEnded: false, stdoutClosed: false,
    stderrEnded: false, stderrClosed: false, exitSeen: false, closeSeen: false, status: null, signal: null,
    stdout: [], stderr: [], stdoutLength: 0, stderrLength: 0 };
  quiet.children.push(occurrence); quietDefinitionCheckV4(record);
  let resolveOriginal!: (value: QuietCommandResultV4) => void, rejectOriginal!: (error: Error) => void;
  occurrence.promise = new Promise((resolve, reject) => { resolveOriginal = resolve; rejectOriginal = reject; });
  let rejectDriver: ((error: Error) => void) | null = null;
  const lose = () => {
    occurrence.error = true; quiet.unknown = true;
    try { quietDefinitionBurnV4(record); } catch { /* Retain passive original event observation. */ }
    // Driver loss never invents natural settlement of the original child.
    rejectDriver?.(Error("DASHBOARD_CUTOVER_LAUNCHER_QUIET_REFUSED"));
  };
  const completed = () => {
    if (!occurrence.exitSeen || !occurrence.closeSeen || !occurrence.stdinFinished || !occurrence.stdinClosed
      || !occurrence.stdoutEnded || !occurrence.stdoutClosed || !occurrence.stderrEnded || !occurrence.stderrClosed) return;
    occurrence.naturalSettled = true;
    if (occurrence.timer) { clearTimeout(occurrence.timer); occurrence.timer = null; }
    if (occurrence.error) { rejectOriginal(Error("DASHBOARD_CUTOVER_LAUNCHER_QUIET_REFUSED")); return; }
    resolveOriginal({ status: occurrence.status, signal: occurrence.signal,
      stdout: Buffer.concat(occurrence.stdout), stderr: Buffer.concat(occurrence.stderr) });
  };
  // Observe rejection even if a spawn/listener/stdin response is lost first.
  void occurrence.promise.catch(() => {});
  try {
    const account = record.definition.material.account!;
    quietDefinitionCheckV4(record);
    occurrence.child = spawn("/bin/launchctl", [action, `gui/${account.uid}/${LABELS[index]}`], {
      cwd: account.homedir, env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const child = occurrence.child;
    // Retain and attach passive observations to the original returned resources
    // before post-return liveness checks; they never dispatch a second effect.
    child.on("error", lose);
    child.on("exit", (status, signal) => {
      if (occurrence.exitSeen) { lose(); return; }
      occurrence.exitSeen = true; occurrence.status = status; occurrence.signal = signal; completed();
    });
    child.on("close", (status, signal) => {
      if (occurrence.closeSeen || !occurrence.exitSeen || status !== occurrence.status || signal !== occurrence.signal) { lose(); return; }
      occurrence.closeSeen = true; completed();
    });
    child.stdin.on("error", lose);
    child.stdin.on("finish", () => { occurrence.stdinFinished = true; completed(); });
    child.stdin.on("close", () => { occurrence.stdinClosed = true; completed(); });
    for (const [name, stream] of [["stdout", child.stdout], ["stderr", child.stderr]] as const) {
      stream.on("error", lose);
      stream.on("data", (bytes: Buffer) => {
        if (!Buffer.isBuffer(bytes)) { lose(); return; }
        if (name === "stdout") {
          occurrence.stdoutLength += bytes.length;
          if (occurrence.stdoutLength > MAX_BYTES) { lose(); return; }
          occurrence.stdout.push(Buffer.from(bytes));
        } else {
          occurrence.stderrLength += bytes.length;
          if (occurrence.stderrLength > MAX_BYTES) { lose(); return; }
          occurrence.stderr.push(Buffer.from(bytes));
        }
      });
      stream.on("end", () => { if (name === "stdout") occurrence.stdoutEnded = true; else occurrence.stderrEnded = true; completed(); });
      stream.on("close", () => { if (name === "stdout") occurrence.stdoutClosed = true; else occurrence.stderrClosed = true; completed(); });
    }
    quietDefinitionCheckV4(record);
    const deadline = new Promise<QuietCommandResultV4>((_, reject) => {
      rejectDriver = reject;
      occurrence.timer = setTimeout(lose, 5000);
    });
    occurrence.driver = Promise.race([occurrence.promise, deadline]);
    quietDefinitionCheckV4(record); child.stdin.end(); quietDefinitionCheckV4(record);
    const answer = await occurrence.driver;
    quietDefinitionCheckV4(record);
    if (!occurrence.naturalSettled || occurrence.error) approvedDefinitionFailureV4();
    return answer;
  } catch { lose(); quietDefinitionBurnV4(record); }
}

function observeQuietOriginalV4(record: ApprovedDefinitionOperationV4): Promise<QuietPhaseDataV4> {
  quietDefinitionCheckV4(record);
  return record.definition.material.configuration!.observeQuietPhase(record.quiet!.phase,
    index => quietCommandV4(record, index, "print"), () => quietDefinitionAdmissionV4(record));
}
export async function observeHeldDashboardCutoverApprovedDefinitionQuietV4(scope: object): Promise<QuietPhaseDataV4> {
  return withQuietDefinitionV4(scope, arguments.length, observeQuietOriginalV4);
}
async function bootoutQuietOriginalV4(record: ApprovedDefinitionOperationV4, index: 0 | 1): Promise<void> {
  const quiet = record.quiet!;
  if (quiet.phase !== index || (index === 0 ? quiet.spawnerAttempted : quiet.dashboardAttempted)) approvedDefinitionFailureV4();
  quietDefinitionCheckV4(record);
  if (index === 0) quiet.owner!.assertDeploymentCutoverSpawnerQuietIntentV4(record.token, record.handle!);
  else quiet.owner!.assertDeploymentCutoverDashboardQuietIntentV4(record.token, record.handle!);
  quietDefinitionCheckV4(record);
  // Fresh SAME original phase before the once-only command, not old hash DATA.
  await observeQuietOriginalV4(record); quietDefinitionCheckV4(record);
  if (index === 0) quiet.spawnerAttempted = true; else quiet.dashboardAttempted = true;
  const result = await quietCommandV4(record, index, "bootout");
  quietDefinitionCheckV4(record);
  if (result.status !== 0 || result.signal !== null || result.stdout.length !== 0 || result.stderr.length !== 0)
    approvedDefinitionFailureV4();
  quiet.phase = index === 0 ? 1 : 2;
  await observeQuietOriginalV4(record); quietDefinitionCheckV4(record);
}
export async function bootoutHeldDashboardCutoverApprovedDefinitionSpawnerV4(scope: object): Promise<void> {
  return withQuietDefinitionV4(scope, arguments.length, record => bootoutQuietOriginalV4(record, 0));
}
export async function bootoutHeldDashboardCutoverApprovedDefinitionDashboardV4(scope: object): Promise<void> {
  return withQuietDefinitionV4(scope, arguments.length, record => bootoutQuietOriginalV4(record, 1));
}

// Separate, zero-input default-mode holder. Secret-bearing configuration and
// comparisons stay private; strict diagnostic schemas above remain unchanged.
function defaultLauncherFailure(stage?: string): never {
  const error = Error("DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID");
  if (stage !== undefined) Object.defineProperty(error, "cutoverLauncherStage", { value: stage });
  if (cleanupUncertain) Object.defineProperty(error, "cutoverCleanupFailed", { value: true });
  throw error;
}

export function holdDeploymentCutoverDefaultLauncherV1() {
  if (arguments.length !== 0 || cleanupUncertain) defaultLauncherFailure();
  const resources: { close(): void }[] = [];
  let closed = false, invalid = false, qualifying = false, qualified = false, censusRunning = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let uncertain = false;
    while (resources.length) {
      try { resources.pop()!.close(); } catch { uncertain = true; cleanupUncertain = true; }
    }
    if (uncertain) defaultLauncherFailure();
  };
  try {
    const accountProjection = () => {
      const current = userInfo();
      return { uid: current.uid, gid: current.gid, homedir: current.homedir, username: current.username, shell: current.shell };
    };
    const account = accountProjection(), accountBefore = account;
    const checkAccount = () => {
      if (!equal(accountProjection(), accountBefore) || process.getuid?.() !== account.uid || process.geteuid?.() !== account.uid
        || process.getgid?.() !== account.gid || process.getegid?.() !== account.gid) fail();
    };
    if (!path.isAbsolute(account.homedir) || path.normalize(account.homedir) !== account.homedir
      || !account.username || !account.shell || !path.isAbsolute(account.shell)) fail();
    checkAccount();
    const temp = () => {
      const value = command("/usr/bin/getconf", ["DARWIN_USER_TEMP_DIR"]);
      if (!/^\/var\/folders\/[A-Za-z0-9_/-]+\/T\/\n$/.test(value) || value.length > 4096
        || path.normalize(value.slice(0, -1)) !== value.slice(0, -1)) fail();
      return value.slice(0, -1);
    };
    const tempBefore = temp();
    const configuration = holdLauncherConfigurationV1(true); resources.push(configuration);
    const inputs = configuration.defaultInputs;
    if (!inputs) fail();
    const nodes = inputs.entries.map(entry => {
      const node = holdDeploymentCutoverNodePathV1(entry.environment.PATH!); resources.push(node); return node;
    });
    const optionalEnvironment = { USER: account.username, LOGNAME: account.username, SHELL: account.shell,
      TMPDIR: tempBefore, XPC_FLAGS: "0x0", __CF_USER_TEXT_ENCODING: `0x${account.uid.toString(16).toUpperCase()}:0:0` };
    const check = () => {
      if (closed || invalid || cleanupUncertain) fail();
      checkAccount();
      if (temp() !== tempBefore) fail();
      configuration.recheck(); nodes.forEach(node => node.recheck());
      checkAccount();
    };
    const recheck = () => { try { check(); } catch { invalid = true; defaultLauncherFailure(); } };
    const idle = () => {
      check();
      for (let index = 0; index < inputs.entries.length; index++) {
        const current = inputs.snapshot(index);
        if (current.activeCount !== 0 || current.pid !== undefined) fail();
      }
      const processes = observeDeploymentCutoverProcessFamiliesV1();
      if (processes.families.length !== 0 || processes.listener !== null) fail();
      for (let index = 0; index < inputs.entries.length; index++) {
        const current = inputs.snapshot(index);
        if (current.activeCount !== 0 || current.pid !== undefined) fail();
      }
      check();
      return processes;
    };
    const observation = Object.freeze({ schema: "setfarm.internal-production-deployment-cutover-default-launcher.v1",
      accountHome: account.homedir, uid: account.uid, gid: account.gid,
      launchers: Object.freeze(configuration.observation.launchers.map((entry, index) => Object.freeze({
        label: entry.label, plistPath: entry.plistPath, plistIdentity: entry.plistIdentity,
        launchArguments: entry.launchArguments, node: nodes[index]!.observation,
      }))) });
    const qualifyPassiveHome = async () => {
      let stage = "precheck";
      try {
        check();
        if (qualifying || qualified || censusRunning) fail();
        qualifying = true;
        // The outer owner has now acquired absence AND resolved all modules.
        // Do not adopt a generation born before those held prerequisites: its
        // startup may already have consumed a since-removed env file or shadow.
        stage = "baseline";
        for (let index = 0; index < inputs.entries.length; index++) {
          const baseline = inputs.snapshot(index);
          if (baseline.activeCount !== 0 || baseline.pid !== undefined) fail();
        }
        stage = "transport";
        const nativeTransportUrl = new URL("../../scripts/deployment-cutover-passive-home.mjs", import.meta.url).href;
        const transport = await import(nativeTransportUrl);
        check();
        const deadline = performance.now() + 70_000;
        const samples = new Map<number, Readonly<Record<string, unknown>>>();
        const settled = new Set<number>();
        const checkSampled = () => {
          const priorStage = stage;
          for (const [index, sample] of samples) {
            stage = "sampled-snapshot";
            const current = inputs.snapshot(index);
            if (current.pid === undefined) { settled.add(index); continue; }
            stage = "sampled-generation";
            if (settled.has(index) || current.pid !== sample.pid || current.state !== "running") fail();
            stage = "sampled-native";
            const identity = transport.monitorDeploymentCutoverPassiveProcessV1({ pid: current.pid, uid: account.uid,
              gid: account.gid, executable: nodes[index]!.observation.executablePath,
              expectedParentPid: sample.ppid, expectedStartSeconds: sample.startSeconds,
              expectedStartMicroseconds: sample.startMicroseconds });
            stage = "sampled-bind";
            const absent = exact(identity, ["schema", "pid", "evidence"])
              && identity.schema === "setfarm.internal-production-passive-process-absence.v1"
              && identity.pid === sample.pid && identity.evidence === "proc-pidinfo-esrch";
            if (!absent && (!exact(identity, ["schema", "pid", "ppid", "uid", "gid", "startSeconds", "startMicroseconds"])
              || identity.schema !== "setfarm.internal-production-passive-process-identity.v1"
              || ["pid", "ppid", "uid", "gid", "startSeconds", "startMicroseconds"].some(key => identity[key] !== sample[key]))) fail();
            stage = "sampled-postcheck";
            const after = inputs.snapshot(index);
            if (absent) {
              if (after.state !== "not running" || after.activeCount !== 0 || after.pid !== undefined) fail();
              settled.add(index); continue;
            }
            // Successful matching identity may be followed by normal exit. The
            // authenticated idle transition is identical to the precheck above;
            // native failure is never reinterpreted as exit or retried.
            if (after.pid === undefined) { settled.add(index); continue; }
            if (after.pid !== current.pid || after.state !== "running") fail();
          }
          stage = priorStage;
        };
        while (samples.size !== inputs.entries.length) {
          stage = "waiting";
          check(); checkSampled();
          if (performance.now() >= deadline) fail();
          for (const [index, entry] of inputs.entries.entries()) {
            if (samples.has(index)) continue;
            stage = "waiting";
            const snapshot = inputs.snapshot(index);
            if (snapshot.pid === undefined || snapshot.state !== "running") continue;
            const node = nodes[index]!.observation;
            const request = { pid: snapshot.pid, uid: account.uid, gid: account.gid, executable: node.executablePath };
            stage = "identity";
            const identity = transport.identifyDeploymentCutoverPassiveProcessV1(request);
            const samePid = () => {
              stage = "pid-recheck";
              const current = inputs.snapshot(index);
              if (current.pid !== snapshot.pid || current.state !== "running" || current.activeCount !== 1) fail();
            };
            samePid(); check();
            if (Object.hasOwn(entry.environment, "HOME")) fail();
            stage = "measure";
            const measured = transport.measureDeploymentCutoverPassiveHomeV1({ ...request,
              expectedStartSeconds: identity.startSeconds, expectedStartMicroseconds: identity.startMicroseconds,
              launchExecutable: node.candidatePath, argv: ["node", ...entry.args],
              environment: { ...entry.environment, HOME: account.homedir }, optionalEnvironment });
            stage = "measurement-bind";
            if (["pid", "ppid", "uid", "gid", "startSeconds", "startMicroseconds"].some(key => measured[key] !== identity[key])) fail();
            samePid(); check();
            if (performance.now() >= deadline) fail();
            samples.set(index, measured);
          }
          checkSampled();
          if (samples.size !== inputs.entries.length) await new Promise(resolve => setTimeout(resolve, 80));
        }
        // A sampled retry may still be exiting. Only ordinary no-PID polling is
        // permitted here; native refusal or a selected PID change never retries.
        while (true) {
          stage = "settling";
          check(); checkSampled();
          if (performance.now() >= deadline) fail();
          if (inputs.entries.every((_, index) => inputs.snapshot(index).pid === undefined)) break;
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        stage = "idle";
        const processObservation = idle();
        qualified = true;
        return Object.freeze({ samples: Object.freeze(inputs.entries.map((entry, index) => Object.freeze({
          label: entry.label, node: nodes[index]!.observation, measurement: samples.get(index)!,
        }))), processObservation });
      } catch {
        invalid = true;
        defaultLauncherFailure(stage);
      }
      finally { qualifying = false; }
    };
    const observeQualifiedDatabase = async <T>(observe: () => Promise<T>): Promise<T> => {
      try {
        if (!qualified || qualifying || censusRunning) fail();
        censusRunning = true;
        idle();
        const result = await observe();
        idle();
        return result;
      } catch { invalid = true; defaultLauncherFailure(); }
      finally { censusRunning = false; }
    };
    const census = () => observeQualifiedDatabase(configuration.census);
    const censusAndActiveRows = () => observeQualifiedDatabase(configuration.censusAndActiveRows);
    const censusAndActiveRowsWithQuarantine = () => observeQualifiedDatabase(configuration.censusAndActiveRowsWithQuarantine);
    const censusAndBindingRows = () => observeQualifiedDatabase(configuration.censusAndBindingRows);
    const censusAndBindingRowsV7 = () => observeQualifiedDatabase(configuration.censusAndBindingRowsV7);
    const activeBindingSnapshot = () => observeQualifiedDatabase(configuration.activeBindingSnapshot);
    const observeTask6aWriterDatabaseSnapshotV2 = (missionControl: ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>) =>
      observeQualifiedDatabase(async () => {
        if (!missionControl || typeof missionControl !== "object" || inputs.entries.length !== 2) fail();
        const { assertHeldTask6aMissionControlSameDatabaseUrlV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
        const url = inputs.entries[0]?.environment.SETFARM_PG_URL;
        if (typeof url !== "string" || !url || inputs.entries[1]?.environment.SETFARM_PG_URL !== url) fail();
        const roleBefore = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (typeof roleBefore !== "string") fail();
        const { observeTask6aWriterDatabaseSnapshotV2 } = await import("./baseline-task6a-writer-database-snapshot-v2.js");
        const snapshot = await observeTask6aWriterDatabaseSnapshotV2(url);
        const roleAfter = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (roleAfter !== roleBefore || snapshot.database.sessionRole !== roleBefore) fail();
        return snapshot;
      });
    const observeTask6aWriterCatalogTopologyV2 = (missionControl: ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>) =>
      observeQualifiedDatabase(async () => {
        if (!missionControl || typeof missionControl !== "object" || inputs.entries.length !== 2) fail();
        const { assertHeldTask6aMissionControlSameDatabaseUrlV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
        const url = inputs.entries[0]?.environment.SETFARM_PG_URL;
        if (typeof url !== "string" || !url || inputs.entries[1]?.environment.SETFARM_PG_URL !== url) fail();
        const roleBefore = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (typeof roleBefore !== "string") fail();
        const { observeTask6aWriterCatalogTopologyV2 } = await import("./baseline-task6a-writer-catalog-topology-v2.js");
        const topology = await observeTask6aWriterCatalogTopologyV2(url);
        const roleAfter = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (roleAfter !== roleBefore || topology.sessionRole !== roleBefore) fail();
        return topology;
      });
    const observeTask6aPrivateCatalogInventoryV3 = (missionControl: ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>) =>
      observeQualifiedDatabase(async () => {
        if (!missionControl || typeof missionControl !== "object" || inputs.entries.length !== 2) fail();
        const { assertHeldTask6aMissionControlSameDatabaseUrlV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
        const url = inputs.entries[0]?.environment.SETFARM_PG_URL;
        if (typeof url !== "string" || !url || inputs.entries[1]?.environment.SETFARM_PG_URL !== url) fail();
        const roleBefore = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (typeof roleBefore !== "string" || decodeURIComponent(new URL(url).username) !== roleBefore) fail();
        const { observeTask6aPrivateCatalogInventoryV3: observePrivateV3 } = await import("./baseline-task6a-private-catalog-inventory-v3.js");
        const inventory = await observePrivateV3(url);
        const roleAfter = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
        if (roleAfter !== roleBefore) fail();
        return inventory;
      });
    const observeTask6aHeldReceiptCandidateV1 = (missionControl: ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>,
      worktreeRoot: string) => observeQualifiedDatabase(async () => {
      if (!missionControl || typeof missionControl !== "object" || typeof worktreeRoot !== "string"
        || inputs.entries.length !== 2) fail();
      const { assertHeldTask6aMissionControlSameDatabaseUrlV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
      const url = inputs.entries[0]?.environment.SETFARM_PG_URL;
      if (typeof url !== "string" || !url || inputs.entries[1]?.environment.SETFARM_PG_URL !== url) fail();
      const roleBefore = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
      if (typeof roleBefore !== "string" || decodeURIComponent(new URL(url).username) !== roleBefore) fail();
      const { resolveInternalProductionBaselineWorkspaceRootV1 } = await import("./baseline-workspace-authority-path-v1.js");
      const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
      if (workspaceRoot !== path.join(account.homedir, "ai", "setrox")) fail();
      const { observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1 } = await import("./baseline-positive-worktree-receipt-host-composer-v1.js");
      const candidate = await observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1(
        Object.freeze({ ownerHomeRoot: account.homedir, workspaceRoot }), url, worktreeRoot);
      const roleAfter = assertHeldTask6aMissionControlSameDatabaseUrlV2(missionControl, url);
      if (roleAfter !== roleBefore || candidate.authority !== "diagnostic-only"
        || candidate.receiptStatus !== "required-unpublished"
        || candidate.physicalIdentityProvenance !== "unverified"
        || candidate.producerAuthentication !== "unverified") fail();
      return candidate;
    });
    check();
    return Object.freeze({ observation, qualifyPassiveHome, recheck, census, censusAndActiveRows,
      censusAndActiveRowsWithQuarantine, censusAndBindingRows, censusAndBindingRowsV7,
      activeBindingSnapshot, observeTask6aWriterDatabaseSnapshotV2, observeTask6aWriterCatalogTopologyV2,
      observeTask6aPrivateCatalogInventoryV3, observeTask6aHeldReceiptCandidateV1, close });
  } catch { invalid = true; close(); defaultLauncherFailure(); }
}

export function observeDeploymentCutoverLauncherConfigurationV1() {
  const context = holdLauncherConfigurationV1();
  try { return context.observation; } finally { context.close(); }
}

// Credentials and held descriptors never leave this module. This read-only
// diagnostic does not establish ownership exclusion or permission for effects.
export async function observeDeploymentCutoverLauncherDatabaseV1() {
  const context = holdLauncherConfigurationV1();
  try {
    const databaseCensus = await context.census();
    context.recheck();
    const body = { schema: "setfarm.internal-production-deployment-cutover-launcher-database-observation.v1",
      launcherObservation: context.observation, databaseCensus };
    return Object.freeze({ ...body, observationHash: hashCanonicalJson(body) });
  } catch { fail(); }
  finally { context.close(); }
}
