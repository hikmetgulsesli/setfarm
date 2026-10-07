import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { holdDeploymentCutoverNodePathV1 } from "./baseline-deployment-cutover-node-path-v1.js";
import { observeDeploymentCutoverProcessFamiliesV1 } from "./baseline-deployment-cutover-process-observation-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

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
  let assertMaterialDatabase: () => void = fail;
  let withPre32Database: <T>(continuation: LauncherPre32ContinuationV2<T>, check: () => void) => Promise<T> = async () => fail();
  let qualifyCoreReader: (check: () => void) => Promise<HeldCoreReaderDiagnosticV2> = async () => fail();
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
      const project = () => {
        const text = command("/bin/launchctl", ["print", `gui/${uid}/${label}`]);
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
      return { label, plistPath, stat, args, parsed, bytes, read, project };
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
  return { observation: output, recheck, recheckMaterial, assertMaterialDatabase, withPre32Database, qualifyCoreReader, census, censusAndActiveRows, censusAndActiveRowsWithQuarantine,
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
function launcherMaterialAccountV2() {
  const account = userInfo();
  return { uid: account.uid, gid: account.gid, homedir: account.homedir, username: account.username, shell: account.shell };
}
function burnLauncherMaterialV2(state: LauncherMaterialStateV2 | null): never {
  if (state) state.valid = false;
  launcherMaterialBurnedV2 = true;
  launcherMaterialBurnSequenceV2 += 1;
  fail();
}
function assertLauncherMaterialIdleV2() {
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
    coreReaderSelected: false, coreReaderCustodyUnknown: false };
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
