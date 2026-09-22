import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { closeSync, constants, fstatSync, lstatSync, openSync, type BigIntStats } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { resolveInternalProductionBaselineAuthorityPathV1 } from "./baseline-workspace-authority-path-v1.js";

function fail(): never { throw Error("DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID"); }

let helperCleanupUncertain: true | null | undefined;
function cleanupFailure(): never {
  throw Object.assign(Error("DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID"), { cutoverCleanupFailed: helperCleanupUncertain });
}

// This deliberately supports only absent history. Settled history needs a
// different held graph; a snapshot of settled history is not that capability.
export async function holdDeploymentCutoverAbsentHelperHistoryV1() {
  if (arguments.length !== 0) fail();
  if (helperCleanupUncertain !== undefined) cleanupFailure();
  const account = userInfo();
  const physical = (value: string) => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
  const home = physical(account.homedir);
  const target = physical(resolveInternalProductionBaselineAuthorityPathV1("data/internal-production-baseline/restart-authority-retirement-v1"));
  const segments = target.split(path.sep).filter(Boolean);
  if (!path.isAbsolute(home) || segments.length > 48 || !target.startsWith(`${home}/`)) fail();
  const held: Array<{ path: string; fd: number; stat: BigIntStats }> = [];
  let missing = "", closed = false, invalid = false;
  const same = (a: BigIntStats, b: BigIntStats) => b.isDirectory() && !b.isSymbolicLink()
    && a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.gid === b.gid
    && a.mode === b.mode && a.birthtimeNs === b.birthtimeNs;
  const absent = (value: string) => {
    try { lstatSync(value); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    }
    fail();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    let failed = false;
    while (held.length) {
      const entry = held.pop()!;
      // Consume before close: a lost close response must never close a reused fd.
      try { closeSync(entry.fd); } catch { failed = true; helperCleanupUncertain = true; }
    }
    if (failed) cleanupFailure();
  };
  const recheck = () => {
    try {
      if (closed || invalid || !missing || !held.length) fail();
      for (const entry of held) {
        const descriptor = fstatSync(entry.fd, { bigint: true }), named = lstatSync(entry.path, { bigint: true });
        if (!same(entry.stat, descriptor) || !same(entry.stat, named)) fail();
        if ((entry.path === home || entry.path.startsWith(`${home}/`)) && (entry.stat.mtimeNs !== named.mtimeNs || entry.stat.ctimeNs !== named.ctimeNs
          || entry.stat.mtimeNs !== descriptor.mtimeNs || entry.stat.ctimeNs !== descriptor.ctimeNs)) fail();
      }
      absent(missing);
    } catch { invalid = true; fail(); }
  };
  try {
    const paths = [path.sep, ...segments.map((_, i) => path.join(path.sep, ...segments.slice(0, i + 1)))];
    for (const current of paths) {
      let stat: BigIntStats;
      try { stat = lstatSync(current, { bigint: true }); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !current.startsWith(`${home}/`)) fail();
        missing = current; break;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink() || current === target) fail();
      if ((current === home || current.startsWith(`${home}/`))
        && (stat.uid !== BigInt(account.uid) || (stat.mode & 0o022n) !== 0n)) fail();
      const fd = openSync(current, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      held.push({ path: current, fd, stat });
      if (!same(stat, fstatSync(fd, { bigint: true }))) fail();
    }
    recheck();
    let snapshot: Awaited<ReturnType<typeof observeDeploymentCutoverHelperHistoryV1>>;
    try { snapshot = await observeDeploymentCutoverHelperHistoryV1(); }
    catch {
      // Legacy census failures cannot certify nested cleanup. Never invent a
      // successful drain or retry those opaque resources in a fresh epoch.
      helperCleanupUncertain = null;
      cleanupFailure();
    }
    recheck();
    if (snapshot.coldState !== "absent" || snapshot.preSchemaHelperState !== "absent"
      || snapshot.registeredHelperCount !== 0 || snapshot.terminalHelperCount !== 0) fail();
    const { observationHash: snapshotObservationHash, ...snapshotBody } = snapshot;
    const body = { ...snapshotBody, snapshotObservationHash, accountHome: account.homedir, accountUid: account.uid, accountGid: account.gid };
    const observation = Object.freeze({ ...body, observationHash: hashCanonicalJson(body) });
    return Object.freeze({ observation, recheck, close });
  } catch {
    close();
    if (helperCleanupUncertain !== undefined) cleanupFailure();
    return fail();
  }
}

// Read-only journal evidence only. Does not grant a helper, controller, process,
// database or phase capability, and never returns retained secret-bearing data.
export async function observeDeploymentCutoverHelperHistoryV1() {
  try {
    const retirement = await import("./baseline-restart-authority-retirement-v1.js");
    const coldBefore = retirement.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    const helperBefore = await retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    const helperAfter = await retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
    const coldAfter = retirement.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
    if (hashCanonicalJson(coldBefore) !== hashCanonicalJson(coldAfter)
      || hashCanonicalJson(helperBefore) !== hashCanonicalJson(helperAfter)
      || !["absent", "settled"].includes(coldBefore.state) || coldBefore.incompleteOwnerCount !== 0
      || !["absent", "terminal"].includes(helperBefore.preSchemaHelperState)
      || helperBefore.registeredBaselineHelperJournalCount !== helperBefore.terminalBaselineHelperJournalCount
      || helperBefore.liveBaselineHelperJournalCount !== 0 || helperBefore.ambiguousBaselineHelperJournalCount !== 0) fail();
    const body = Object.freeze({
      schema: "setfarm.internal-production-deployment-cutover-helper-observation.v1", scope: "helper-history-only",
      coldState: coldBefore.state, preSchemaHelperState: helperBefore.preSchemaHelperState,
      registeredHelperCount: helperBefore.registeredBaselineHelperJournalCount,
      terminalHelperCount: helperBefore.terminalBaselineHelperJournalCount,
      coldCensusHash: coldBefore.censusHash, helperCensusHash: helperBefore.censusHash,
      blockers: Object.freeze(["filesystem-phase-zero-owner-not-observed", "runtime-effective-environment-not-authenticated",
        "database-zero-owner-not-observed", "controller-ownership-not-acquired"]),
    });
    return Object.freeze({ ...body, observationHash: hashCanonicalJson(body) });
  } catch { return fail(); }
}
