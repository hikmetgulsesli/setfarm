import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

function fail(): never { throw Error("DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID"); }

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
