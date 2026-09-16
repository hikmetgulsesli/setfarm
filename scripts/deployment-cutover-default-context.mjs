import path from "node:path";
import { fileURLToPath } from "node:url";
import { userInfo } from "node:os";
import { holdSelectedSetfarmDeploymentBuildV1 } from "./build-generation-retention.mjs";
import { holdDeploymentCutoverRetainedProfileV1 } from "./deployment-cutover-retained-profile.mjs";
import { holdDeploymentCutoverDefaultEnvAbsenceV1 } from "../dist/internal-production/baseline-deployment-cutover-env-absence-v1.js";
import { holdDeploymentCutoverDefaultLauncherV1 } from "../dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const physical = value => process.platform === "darwin" && value.startsWith("/var/") ? `/private${value}` : value;
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const fail = () => { throw Error("DEPLOYMENT_CUTOVER_DEFAULT_CONTEXT_REFUSED"); };
const counts = ["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
  "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount"];
let occupied = false, uncertain = false;

// Authenticated bootstrap only. A historical passive sample is not exclusion,
// admission, a current getenv dump, or permission for any service/DB mutation.
// Reviewed retained startup may replace live PATH/DEBUG; the trusted Node/libc
// prerequisite preserves saved initial stack strings and HOME/PG/root selectors.
export async function observeDeploymentCutoverDefaultContextV1() {
  if (arguments.length || occupied || uncertain) fail();
  occupied = true;
  const contexts = [];
  let invalid = false, result;
  try {
    const account = userInfo();
    const hold = context => { contexts.push(context); return context; };
    const selected = hold(holdSelectedSetfarmDeploymentBuildV1());
    const retained = hold(holdDeploymentCutoverRetainedProfileV1());
    const absence = hold(holdDeploymentCutoverDefaultEnvAbsenceV1());
    const launcher = hold(holdDeploymentCutoverDefaultLauncherV1());
    const check = () => {
      const current = userInfo();
      if (["uid", "gid", "homedir", "username", "shell"].some(key => current[key] !== account[key])) fail();
      for (const context of contexts) context.recheck();
      const build = selected.observation, env = absence.observation, profile = retained.observation, launch = launcher.observation;
      const cli = build.cli;
      if (profile.selectedDeploymentObservationHash !== build.selectedDeploymentObservationHash
        || profile.sourceSha !== build.buildSource.sha || env.cliObservationHash !== cli.cliLinkObservationHash
        || env.selectedCheckoutPath !== cli.checkoutPath || env.currentCheckoutPath !== root
        || cli.checkoutPath === root || launch.accountHome !== account.homedir
        || launch.uid !== account.uid || launch.gid !== account.gid
        || cli.cliLinkPath !== path.join(physical(account.homedir), ".local", "bin", "setfarm")
        || launch.launchers.length !== 2 || launch.launchers.some(entry => entry.launchArguments[0] !== cli.cliLinkPath)) fail();
      const candidates = [cli.checkoutPath, root, path.join(physical(account.homedir), ".openclaw", "setfarm")]
        .flatMap(base => [path.join(base, ".env"), path.join(base, ".env.local")]).sort();
      if (JSON.stringify(env.candidates.map(entry => entry.path).sort()) !== JSON.stringify(candidates)) fail();
    };
    check();
    const resolution = retained.resolveModules();
    check();
    if (resolution.profileHash !== retained.observation.profileHash
      || resolution.selectedDeploymentObservationHash !== selected.observation.selectedDeploymentObservationHash
      || resolution.contexts.length !== 2 || resolution.contexts.filter(context => context.home === "account").length !== 1
      || resolution.contexts.filter(context => context.home === "absent").length !== 1) fail();
    const passiveQualification = await launcher.qualifyPassiveHome();
    check();
    const databaseCensus = await launcher.census();
    check();
    if (counts.some(key => !Number.isSafeInteger(databaseCensus[key]) || databaseCensus[key] < 0)) fail();
    const blockers = ["filesystem-helper-phase-zero-owner-not-observed", "controller-ownership-not-acquired", "journaled-transition-not-performed"];
    if (counts.some(key => databaseCensus[key] !== 0)) blockers.unshift("database-nonzero-owner-observed");
    result = freeze({ schema: "setfarm.internal-production-deployment-cutover-default-context.v1",
      scope: "passive-default-context-observation-only", newCheckoutPath: root,
      selectedDeployment: selected.observation, retainedProfile: retained.observation, resolution,
      defaultEnvAbsence: absence.observation, launcher: launcher.observation, passiveQualification, databaseCensus, blockers });
    check();
  } catch { invalid = true; }
  while (contexts.length) {
    try { contexts.pop().close(); } catch { invalid = true; uncertain = true; }
  }
  occupied = false;
  if (invalid || !result) fail();
  return result;
}
