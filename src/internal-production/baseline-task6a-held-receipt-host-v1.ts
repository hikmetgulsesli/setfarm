type Setfarm = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
type Mission = ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>;

// Read-only diagnostic. Held launcher inputs are acquired here, not supplied
// by the caller; the single locator does not grant receipt/owner authority.
function fail(): never {
  throw Error("INTERNAL_PRODUCTION_TASK6A_HELD_RECEIPT_HOST_INVALID");
}

export async function observeCodeOwnedTask6aHeldReceiptCandidateV1(worktreeRoot: string) {
  if (arguments.length !== 1 || typeof worktreeRoot !== "string") fail();
  let setfarm: Setfarm | undefined;
  let mc: Mission | undefined;
  let result: Awaited<ReturnType<Setfarm["observeTask6aHeldReceiptCandidateV1"]>> | undefined;
  let failed = false;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    const { holdTask6aMissionControlLauncherV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
    setfarm = holdDeploymentCutoverDefaultLauncherV1();
    mc = holdTask6aMissionControlLauncherV2();
    const labels = setfarm.observation.launchers.map((entry) => entry.label);
    if (labels.length !== 2 || labels[0] !== "com.setrox.setfarm-spawner"
      || labels[1] !== "com.setrox.setfarm-dashboard") fail();
    await setfarm.qualifyPassiveHome();
    setfarm.recheck(); mc.recheck();
    result = await setfarm.observeTask6aHeldReceiptCandidateV1(mc, worktreeRoot);
    setfarm.recheck(); mc.recheck();
    if (result.authority !== "diagnostic-only" || result.receiptStatus !== "required-unpublished"
      || result.physicalIdentityProvenance !== "unverified"
      || result.producerAuthentication !== "unverified") fail();
  } catch { failed = true; }
  try { mc?.close(); } catch { failed = true; }
  try { setfarm?.close(); } catch { failed = true; }
  if (failed || !result) fail();
  return result;
}
