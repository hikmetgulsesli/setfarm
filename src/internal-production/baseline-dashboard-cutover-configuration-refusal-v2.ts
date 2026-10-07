import { observeDeploymentCutoverIntentV1 } from "./baseline-deployment-cutover-v1.js";

let active = false;
let refused = false;
function fail(): never { throw Error("DASHBOARD_CUTOVER_ORDINARY_CONFIGURATION_REFUSED"); }

// Ordinary refusal only: an absent sample is not ownership or retained exclusion.
// Earlier loaded/entered writers still require original invocation settlement.
export function assertOrdinaryConfigurationDeploymentCutoverAdmissionV2(): void {
  if (active) { refused = true; fail(); }
  if (refused || arguments.length !== 0) fail();
  active = true;
  try {
    if (observeDeploymentCutoverIntentV1().state !== "absent") refused = true;
  } catch { refused = true; }
  finally { active = false; }
  if (refused) fail();
}
