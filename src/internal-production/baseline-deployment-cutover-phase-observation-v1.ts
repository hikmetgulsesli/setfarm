import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeDeploymentCutoverCliLinkV1 } from "./baseline-deployment-cutover-cli-observation-v1.js";

// Same closed-phase inventory as the receipt; this leaf does not import/evaluate
// receipt, future producer code, runtime configuration, or database clients.
const PRODUCERS = Object.freeze([
  ["internal-production-service-restart-startup-v1", "reserveInternalProductionOrdinaryServiceStartOwnerV1"],
  ["internal-production-service-restart-authority-v1", "reserveInternalProductionServiceRestartDispatchOwnerV1"],
  ["internal-production-service-restart-authority-v1", "reserveInternalProductionServiceRestartOperationOwnerV1"],
  ["golden-run-phase-store", "reserveGoldenLaunchPreparationOwnerV1"],
  ["golden-run-phase-store", "reserveGoldenPreparedLaunchOwnerV1"],
  ["golden-run-phase-store", "reserveGoldenLaunchOutboxOwnerV1"],
  ["golden-matrix-runner", "reserveGoldenStagedCaseOwnerV1"],
  ["golden-run-harness", "reserveGoldenFixtureAttemptOwnerV1"],
  ["existing-repository-fixture-catalog", "reserveGoldenExistingRepositoryFixtureAttemptOwnerV1"],
  ["golden-run-report", "reserveGoldenDocsSessionOwnerV1"],
  ["golden-run-report", "reserveGoldenDocsLeaseOwnerV1"],
  ["golden-fleet-scheduler", "reserveGoldenFleetStageOwnerV1"],
  ["golden-fleet-status-store", "reserveGoldenFleetInflightOwnerV1"],
  ["golden-fleet-scheduler", "reserveGoldenFleetReviewOwnerV1"],
  ["golden-matrix-inflight-status-v1", "reserveGoldenMatrixInflightOwnerV1"],
  ["cold-rehearsal-v1", "reserveColdRehearsalOwnerV1"],
  ["golden-verifier-runtime", "reserveGoldenCompilationLeaseOwnerV1"],
  ["golden-verifier-runtime", "reserveGoldenExecutionLeaseOwnerV1"],
].map(([module, producer]) => Object.freeze({ module: module!, producer: producer! })));
const DIRECTORY_KEYS = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "nlink", "size", "mtimeNs", "ctimeNs"] as const;
const same = (a: BigIntStats, b: BigIntStats, keys: readonly (keyof BigIntStats)[]) => keys.every(k => a[k] === b[k]);
const physical = (value: string) => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
const fail = (): never => { throw Error("DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID"); };
let cleanupUncertain: true | null | undefined;
const cleanupFailure = (): never => { throw Object.assign(Error("DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID"), { cutoverCleanupFailed: cleanupUncertain }); };

// Authenticated owner composition supplies source/build truth separately. This
// holder alone grants no zero-owner certificate, controller or rollout authority.
export function holdDeploymentCutoverPhaseClosedPreflightV1() {
  if (arguments.length) fail();
  if (cleanupUncertain !== undefined) cleanupFailure();
  const dirs = new Map<string, { fd: number; stat: BigIntStats }>();
  const files: Array<{ path: string; fd: number; stat: BigIntStats; hash: string }> = [];
  const descriptors: number[] = [], missing: string[] = [];
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    let failed = false;
    while (descriptors.length) {
      const fd = descriptors.pop()!;
      try { fs.closeSync(fd); } catch { cleanupUncertain = true; failed = true; }
    }
    if (failed) cleanupFailure();
  };
  try {
    const account = userInfo(), home = physical(account.homedir), workspace = path.join(home, "ai/setrox");
    const module = fileURLToPath(import.meta.url), current = physical(path.dirname(path.dirname(path.dirname(module))));
    if (!path.isAbsolute(home) || path.normalize(home) !== home || !current.startsWith(`${workspace}/`)
      || !["src", "dist"].includes(path.basename(path.dirname(path.dirname(module)))) || path.basename(path.dirname(module)) !== "internal-production") fail();
    const cli = (() => {
      try { return observeDeploymentCutoverCliLinkV1(); } catch { cleanupUncertain = null; return cleanupFailure(); }
    })();
    if (cli.checkoutPath === current) fail();
    const own = (target: string) => target === home || target.startsWith(`${home}/`);
    const assertAbsent = (target: string) => {
      try { fs.lstatSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; }
      fail();
    };
    const check = () => {
      if (closed || invalid) fail();
      const observedAccount = userInfo();
      if (["uid", "gid", "homedir", "username", "shell"].some(k => observedAccount[k as keyof typeof account] !== account[k as keyof typeof account])) fail();
      for (const [target, pin] of dirs) {
        for (const stat of [fs.fstatSync(pin.fd, { bigint: true }), fs.lstatSync(target, { bigint: true })]) {
          if (!stat.isDirectory() || stat.isSymbolicLink() || !same(pin.stat, stat, DIRECTORY_KEYS)
            || own(target) && (pin.stat.mtimeNs !== stat.mtimeNs || pin.stat.ctimeNs !== stat.ctimeNs)) fail();
        }
      }
      for (const pin of files) for (const stat of [fs.fstatSync(pin.fd, { bigint: true }), fs.lstatSync(pin.path, { bigint: true })]) {
        if (!stat.isFile() || stat.isSymbolicLink() || !same(pin.stat, stat, FILE_KEYS)) fail();
      }
      for (const target of missing) assertAbsent(target);
    };
    const holdDirectory = (target: string, stat: BigIntStats) => {
      if (!stat.isDirectory() || stat.isSymbolicLink() || own(target) && (stat.uid !== BigInt(account.uid) || (stat.mode & 0o022n) !== 0n)) fail();
      if (dirs.has(target)) { if (!same(dirs.get(target)!.stat, stat, DIRECTORY_KEYS)) fail(); return; }
      if (descriptors.length >= 128) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); dirs.set(target, { fd, stat }); check();
    };
    const walk = (target: string, requireMissing: boolean) => {
      const segments = target.split(path.sep).filter(Boolean);
      if (!target.startsWith(`${home}/`) || segments.length > 48) fail();
      const paths = [path.sep, ...segments.map((_, i) => path.join(path.sep, ...segments.slice(0, i + 1)))];
      for (const item of paths) {
        check(); let stat: BigIntStats;
        try { stat = fs.lstatSync(item, { bigint: true }); } catch (error) {
          if (!requireMissing || (error as NodeJS.ErrnoException).code !== "ENOENT" || !item.startsWith(`${home}/`)) fail();
          missing.push(item); check(); return;
        }
        if (item === target && requireMissing) fail();
        holdDirectory(item, stat);
      }
      if (requireMissing) fail();
    };
    const futurePaths: string[] = [];
    for (const root of [current, cli.checkoutPath]) for (const [directory, extension] of [["src", "ts"], ["dist", "js"]]) {
      const parent = path.join(root, directory!, "internal-production");
      walk(parent, false);
      for (const name of new Set(PRODUCERS.map(p => p.module))) {
        const target = path.join(parent, `${name}.${extension}`); walk(target, true); futurePaths.push(target);
      }
      const target = path.join(parent, `baseline-post-handoff-receipt-v1.${extension}`), stat = fs.lstatSync(target, { bigint: true });
      const limit = 4 * 1024 * 1024;
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== BigInt(account.uid) || stat.nlink !== 1n
        || (stat.mode & 0o022n) !== 0n || stat.size < 1n || stat.size > BigInt(limit) || descriptors.length >= 128) fail();
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      descriptors.push(fd);
      if (!same(stat, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)) fail();
      const bytes = Buffer.alloc(limit + 1); let length = 0;
      while (length < bytes.length) { const n = fs.readSync(fd, bytes, length, bytes.length - length, length); if (!n) break; length += n; }
      const content = bytes.subarray(0, length), text = content.toString("utf8");
      if (BigInt(length) !== stat.size || !Buffer.from(text).equals(content) || text.includes(["reserveRecovery", "SourceRunOwnerV1"].join(""))) fail();
      files.push({ path: target, fd, stat, hash: createHash("sha256").update(content).digest("hex") }); check();
    }
    const runtimeAuthorityRoot = path.join(home, ".openclaw/setfarm/internal-production");
    walk(runtimeAuthorityRoot, true); check();
    const recheck = () => {
      try { check(); } catch { invalid = true; fail(); }
    };
    const body = Object.freeze({ schema: "setfarm.internal-production-deployment-cutover-phase-observation.v1", scope: "phase-closure-only",
      accountHome: account.homedir, accountUid: account.uid, accountGid: account.gid,
      currentCheckoutPath: current, selectedCheckoutPath: cli.checkoutPath, cliObservationHash: cli.cliLinkObservationHash,
      runtimeAuthorityRoot, authorityChildren: Object.freeze(["golden-results", "fixtures", "recovery", "golden-fleet"]),
      futureProducers: PRODUCERS, futurePaths: Object.freeze(futurePaths),
      receipts: Object.freeze(files.map(p => Object.freeze({ path: p.path, hash: p.hash }))),
      blockers: Object.freeze(["source-build-authentication-not-granted", "physical-zero-owner-not-observed", "helper-history-not-observed",
        "database-zero-owner-not-observed", "controller-ownership-not-acquired", "journaled-transition-not-performed"]),
    });
    return Object.freeze({ observation: Object.freeze({ ...body, observationHash: hashCanonicalJson(body) }), recheck, close });
  } catch {
    close();
    if (cleanupUncertain !== undefined) cleanupFailure();
    return fail();
  }
}
