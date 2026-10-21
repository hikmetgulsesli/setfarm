/** Fixed read-only dual-Source preparation; never an effect capability. */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { holdManualOrphanBootstrapPinsV1 } from "./manual-orphan-bootstrap-pins-v1.js";

type SourceApi = typeof import("../internal-production/baseline-post-handoff-receipt-v1.js");
type Source = ReturnType<SourceApi["observeCurrentInternalProductionCleanSetfarmSourceBuildV1"]>;
type DatabaseApi = typeof import("../db-pg.js");
type EntryApi = typeof import("./fresh-installation-entry-v1.js");
type SelectionApi = typeof import("./fresh-installation-selection-v1.js");
type PublicIdentity = Readonly<{ sourceSha: string; sourceTreeHash: string; buildHash: string }>;
export type ManualOrphanBootstrapObservationV1 = Readonly<{
  schema: "setfarm.manual-orphan-bootstrap-observation.v1";
  state: "verified";
  maintenance: PublicIdentity;
  target: PublicIdentity & Readonly<{ dependencyProfileHash: string }>;
  installationId: "fdd9fe74-ccee-4673-a727-64fe57f68ad0";
  jobId: "d756f305-338b-4613-a055-36773303628c";
  readOnly: true;
}>;
const TARGET_SHA = "161297ffca6adf2851918a93d492e1c9a77ce59d";
const TARGET_TREE = "a3cc0791c5e64b2e82e81aff56f01d8f116bf524";
const INSTALLATION = "fdd9fe74-ccee-4673-a727-64fe57f68ad0";
const CODES = new Set(["BOOTSTRAP_CONTEXT_REFUSED", "BOOTSTRAP_M_REFUSED", "BOOTSTRAP_TARGET_REFUSED",
  "BOOTSTRAP_DEPENDENCY_REFUSED", "BOOTSTRAP_ENTRY_REFUSED", "BOOTSTRAP_CLEANUP_UNKNOWN"]);
let entered = false, refused = false, cleanupUncertain = false;
function fail(code: string): never { throw new Error(code); }
const equalSource = (a: { sha: string; treeHash: string; buildHash: string }, b: { sha: string; treeHash: string; buildHash: string }): boolean =>
  a.sha === b.sha && a.treeHash === b.treeHash && a.buildHash === b.buildHash;
const validSource = (value: Source): boolean => value.branch === "main" && value.clean === true && value.sha === value.originMainSha
  && /^[a-f0-9]{40}$/.test(value.sha) && /^[a-f0-9]{40}$/.test(value.treeHash) && /^[a-f0-9]{64}$/.test(value.buildHash);
const project = (value: Source): PublicIdentity => Object.freeze({ sourceSha: value.sha, sourceTreeHash: value.treeHash, buildHash: value.buildHash });

/** No arguments, selections, handles, clients, callbacks, paths or URLs escape. */
export async function observeSelectedManualOrphanBootstrapV1(): Promise<ManualOrphanBootstrapObservationV1> {
  if (arguments.length !== 0 || entered || refused || cleanupUncertain) {
    refused = true;
    throw new Error(cleanupUncertain ? "BOOTSTRAP_CLEANUP_UNKNOWN" : "BOOTSTRAP_CONTEXT_REFUSED");
  }
  entered = true;
  let pins: ReturnType<typeof holdManualOrphanBootstrapPinsV1> | undefined;
  let database: DatabaseApi | undefined;
  let observation: ManualOrphanBootstrapObservationV1 | undefined;
  let phase = "BOOTSTRAP_CONTEXT_REFUSED", failure: string | undefined;
  try {
    const acquiredPins = holdManualOrphanBootstrapPinsV1();
    pins = acquiredPins; // Retain the same owner for finally, across every await.
    const stable = (): void => { if (refused) fail(phase); acquiredPins.recheck(); };
    phase = "BOOTSTRAP_M_REFUSED";
    const heldMaintenance = await acquiredPins.admitMaintenance(); stable();
    const maintenanceObserver = await import(pathToFileURL(path.join(acquiredPins.maintenanceRoot,
      "dist/internal-production/baseline-post-handoff-receipt-v1.js")).href) as SourceApi;
    stable();
    const maintenance = maintenanceObserver.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    if (!validSource(maintenance) || !equalSource(maintenance, heldMaintenance) || maintenance.sha === TARGET_SHA
      || path.basename(acquiredPins.maintenanceRoot) !== `setfarm-${maintenance.sha.slice(0, 8)}`) fail(phase);
    stable();
    phase = "BOOTSTRAP_TARGET_REFUSED";
    const heldTarget = await acquiredPins.admitTarget(); stable();
    await acquiredPins.selectTarget(); stable();
    // The first selected import is always under the independently admitted old T.
    // No ordinary M selected-entry/DB singleton is evaluated by this adapter.
    const selection = await import(pathToFileURL(path.join(acquiredPins.targetRoot,
      "dist/installation/fresh-installation-selection-v1.js")).href) as SelectionApi;
    stable();
    const selected = selection.freshInstallationSelectionV1;
    if (!selected) fail("BOOTSTRAP_TARGET_REFUSED");
    const activation = selected.activation;
    if (!activation?.acknowledged || !activation.activatedPin) fail("BOOTSTRAP_TARGET_REFUSED");
    const assertTarget = (): void => {
      if (selection.freshInstallationSelectionV1 !== selected || selected.directory !== acquiredPins.installationDirectory
        || selected.paths.repository !== acquiredPins.targetRoot || selected.state.origin.installationId !== INSTALLATION
        || selected.state.origin.sourceSha !== TARGET_SHA || !selected.state.committed
        || selected.activation !== activation || !activation.acknowledged || !activation.activatedPin
        || activation.prepared.origin.installationId !== INSTALLATION
        || activation.prepared.origin.sourceSha !== TARGET_SHA) fail("BOOTSTRAP_TARGET_REFUSED");
      selection.assertFreshInstallationSelectionUnchangedV1(); selected.assertUnchanged();
    };
    assertTarget(); stable();
    const targetObserver = await import(pathToFileURL(path.join(acquiredPins.targetRoot,
      "dist/internal-production/baseline-post-handoff-receipt-v1.js")).href) as SourceApi;
    stable(); assertTarget();
    const target = targetObserver.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    if (!validSource(target) || target.sha !== TARGET_SHA || target.treeHash !== TARGET_TREE
      || !equalSource(target, heldTarget) || !equalSource(target, activation.prepared.sourceAuthority.setfarmSource)) fail(phase);
    stable(); assertTarget();
    phase = "BOOTSTRAP_ENTRY_REFUSED";
    // Capture the actual DB module before prepare can acquire its private owner.
    // Finally always awaits that same module's pgClose, including entry failures.
    const activeDatabase = await import(pathToFileURL(path.join(acquiredPins.targetRoot, "dist/db-pg.js")).href) as DatabaseApi;
    database = activeDatabase;
    stable(); assertTarget();
    const entry = await import(pathToFileURL(path.join(acquiredPins.targetRoot,
      "dist/installation/fresh-installation-entry-v1.js")).href) as EntryApi;
    stable(); assertTarget();
    await entry.prepareFreshInstallationOperationalEntryV1();
    stable(); assertTarget();
    entry.assertFreshInstallationOperationalEntryV1();
    activeDatabase.assertSelectedFreshInstallationOperationalDatabaseV1();
    const client = activeDatabase.getSql();
    activeDatabase.assertSelectedFreshInstallationOperationalDatabaseV1();
    const assertClient = (): void => {
      entry.assertFreshInstallationOperationalEntryV1();
      activeDatabase.assertSelectedFreshInstallationOperationalDatabaseV1();
      if (activeDatabase.getSql() !== client) fail("BOOTSTRAP_ENTRY_REFUSED");
      activeDatabase.assertSelectedFreshInstallationOperationalDatabaseV1();
    };
    assertClient(); stable(); assertTarget();
    phase = "BOOTSTRAP_M_REFUSED";
    const maintenanceAgain = maintenanceObserver.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    if (!validSource(maintenanceAgain) || !equalSource(maintenanceAgain, maintenance)) fail(phase);
    stable(); assertTarget(); assertClient();
    phase = "BOOTSTRAP_TARGET_REFUSED";
    const targetAgain = targetObserver.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    if (!validSource(targetAgain) || !equalSource(targetAgain, target)) fail(phase);
    stable(); assertTarget();
    phase = "BOOTSTRAP_ENTRY_REFUSED"; assertClient(); stable();
    observation = Object.freeze({ schema: "setfarm.manual-orphan-bootstrap-observation.v1", state: "verified",
      maintenance: project(maintenance), target: Object.freeze({ ...project(target), dependencyProfileHash: acquiredPins.dependencyProfileHash }),
      installationId: INSTALLATION, jobId: "d756f305-338b-4613-a055-36773303628c", readOnly: true });
  } catch (error) {
    refused = true;
    failure = error instanceof Error && CODES.has(error.message) ? error.message : phase;
    if (failure === "BOOTSTRAP_CLEANUP_UNKNOWN") cleanupUncertain = true;
  } finally {
    if (database) {
      try { await database.pgClose(); }
      catch { cleanupUncertain = true; }
      // pgClose fences the selected epoch synchronously; the old selected getter
      // must refuse without reopening. Keep any unexpected return private.
      try { database.getSql(); cleanupUncertain = true; } catch { /* Expected closed epoch. */ }
    }
    if (pins) {
      try { pins.recheck(); } catch (error) {
        refused = true;
        failure ??= error instanceof Error && CODES.has(error.message) ? error.message : phase;
      }
      try { pins.close(); } catch { cleanupUncertain = true; }
    }
  }
  if (cleanupUncertain) { refused = true; throw new Error("BOOTSTRAP_CLEANUP_UNKNOWN"); }
  if (failure || refused || !observation) { refused = true; throw new Error(failure ?? phase); }
  return observation;
}
