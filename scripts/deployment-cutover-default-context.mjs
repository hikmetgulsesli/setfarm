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
const fail = diagnostic => {
  const error = Error("DEPLOYMENT_CUTOVER_DEFAULT_CONTEXT_REFUSED");
  if (diagnostic) Object.defineProperty(error, "cutoverRefusal", { value: Object.freeze(diagnostic) });
  throw error;
};
const launcherStages = ["precheck", "baseline", "transport", "waiting", "sampled-identity", "sampled-snapshot", "sampled-generation", "sampled-native", "sampled-bind", "sampled-postcheck", "identity", "pid-recheck", "measure", "measurement-bind", "settling", "idle"];
function launcherFailureStage(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "cutoverLauncherStage");
    return descriptor && Object.hasOwn(descriptor, "value") && launcherStages.includes(descriptor.value) ? descriptor.value : null;
  } catch { return null; }
}
function acquisitionCleanupFailure(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, "cutoverCleanupFailed");
    if (descriptor && Object.hasOwn(descriptor, "value") && descriptor.value === true) return true;
  } catch { /* An unreturned holder cannot certify cleanup through an accessor. */ }
  return null;
}
const counts = ["activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
  "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount"];
let occupied = false, uncertain = false;

// Authenticated bootstrap only. A historical passive sample is not exclusion,
// admission, a current getenv dump, or permission for any service/DB mutation.
// Reviewed retained startup may replace live PATH/DEBUG; the trusted Node/libc
// prerequisite preserves saved initial stack strings and HOME/PG/root selectors.
export async function observeDeploymentCutoverDefaultContextV1() {
  if (arguments.length || occupied || uncertain) fail({ scope: "default-owner", stage: "entry", ownerContext: null, launcherStage: null, cleanupFailed: uncertain });
  occupied = true;
  const contexts = [];
  let invalid = false, result, stage = "account", ownerContext = null, launcherStage = null, cleanupFailed = false;
  try {
    const account = userInfo();
    const hold = context => { contexts.push(context); return context; };
    stage = "acquire-selected"; const selected = hold(holdSelectedSetfarmDeploymentBuildV1());
    stage = "acquire-retained"; const retained = hold(holdDeploymentCutoverRetainedProfileV1());
    stage = "acquire-absence"; const absence = hold(holdDeploymentCutoverDefaultEnvAbsenceV1());
    stage = "acquire-launcher"; const launcher = hold(holdDeploymentCutoverDefaultLauncherV1());
    const check = () => {
      ownerContext = "account";
      const current = userInfo();
      if (["uid", "gid", "homedir", "username", "shell"].some(key => current[key] !== account[key])) fail();
      for (const [index, context] of contexts.entries()) {
        ownerContext = ["selected", "retained", "absence", "launcher"][index];
        context.recheck();
      }
      ownerContext = "bind";
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
      ownerContext = null;
    };
    stage = "crossbind"; check();
    stage = "resolve"; const resolution = retained.resolveModules();
    stage = "prequalify"; check();
    stage = "resolution-bind";
    if (resolution.profileHash !== retained.observation.profileHash
      || resolution.selectedDeploymentObservationHash !== selected.observation.selectedDeploymentObservationHash
      || resolution.contexts.length !== 2 || resolution.contexts.filter(context => context.home === "account").length !== 1
      || resolution.contexts.filter(context => context.home === "absent").length !== 1) fail();
    stage = "qualify"; const passiveQualification = await launcher.qualifyPassiveHome();
    stage = "postqualify"; check();
    stage = "census"; const databaseCensus = await launcher.census();
    stage = "postcensus"; check();
    stage = "census-shape";
    if (counts.some(key => !Number.isSafeInteger(databaseCensus[key]) || databaseCensus[key] < 0)) fail();
    const blockers = ["filesystem-helper-phase-zero-owner-not-observed", "controller-ownership-not-acquired", "journaled-transition-not-performed"];
    if (counts.some(key => databaseCensus[key] !== 0)) blockers.unshift("database-nonzero-owner-observed");
    result = freeze({ schema: "setfarm.internal-production-deployment-cutover-default-context.v1",
      scope: "passive-default-context-observation-only", newCheckoutPath: root,
      selectedDeployment: selected.observation, retainedProfile: retained.observation, resolution,
      defaultEnvAbsence: absence.observation, launcher: launcher.observation, passiveQualification, databaseCensus, blockers });
    stage = "final-recheck"; check();
  } catch (error) {
    invalid = true;
    if (stage === "qualify") launcherStage = launcherFailureStage(error);
    const nestedCleanup = acquisitionCleanupFailure(error);
    if (stage.startsWith("acquire-") || nestedCleanup === true) cleanupFailed = nestedCleanup;
    if (cleanupFailed === true) uncertain = true;
  }
  while (contexts.length) {
    try { contexts.pop().close(); } catch { if (!invalid) { stage = "cleanup"; ownerContext = null; } invalid = true; uncertain = true; cleanupFailed = true; }
  }
  occupied = false;
  if (invalid || !result) fail({ scope: "default-owner", stage, ownerContext, launcherStage, cleanupFailed });
  return result;
}
