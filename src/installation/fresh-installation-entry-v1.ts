/** Actual selected operational admission; no caller-supplied authority ports. */
import { fileURLToPath } from "node:url";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { freshInstallationSelectionV1 } from "./fresh-installation-selection-v1.js";

type DatabaseApiV1 = typeof import("../db-pg.js");
type SourceApiV1 = typeof import("../internal-production/baseline-post-handoff-receipt-v1.js");
type RuntimeGuardApiV1 = typeof import("../cli/runtime-guard.js");
let databaseV1: DatabaseApiV1 | null = null;
let runtimeGuardV1: RuntimeGuardApiV1 | null = null;
let pendingV1: Promise<void> | null = null;
let refusedV1 = false;
let closingV1: Promise<void> | null = null;

function refuse(): never { throw new Error("FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED"); }
// One captured cleanup attempt, shared by synchronous and asynchronous refusal.
// Calling actual pgClose immediately fences its selected epoch before awaiting.
function closeCapturedDatabaseV1(database: DatabaseApiV1 | null): Promise<void> {
  if (closingV1) return closingV1;
  if (!database) return Promise.resolve();
  closingV1 = database.pgClose();
  return closingV1;
}
function requireCompiledV1(): void {
  if (!fileURLToPath(import.meta.url).endsWith(".js")) refuse();
}
function selectedV1() {
  const selected = freshInstallationSelectionV1;
  const activation = selected?.activation;
  if (!selected || !activation?.acknowledged || !activation.activatedPin) refuse();
  selected.assertUnchanged();
  return { selected, activation };
}
function assertSourceV1(source: SourceApiV1): void {
  const { selected, activation } = selectedV1();
  const current = source.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (canonicalJsonStringify(current) !== canonicalJsonStringify(activation.prepared.sourceAuthority.setfarmSource)
    || current.sha !== selected.state.origin.sourceSha) refuse();
  selected.assertUnchanged();
}
function assertRuntimeSourceV1(guard: RuntimeGuardApiV1): void {
  const { selected } = selectedV1();
  // Call the fixed verifier directly: its CLI skip flags are not consulted.
  // This checks current tracked source/HEAD/build stamp, not every ignored
  // artifact byte. Full source/build verification stays in asynchronous prepare
  // and the existing transactional source-authority/claim checks.
  const current = guard.verifyRuntimeIntegrity();
  const build = current.buildInfo;
  if (!current.ok || current.branch !== "main" || current.headSha !== selected.state.origin.sourceSha
    || !build || build.sha !== selected.state.origin.sourceSha || build.branch !== "main"
    || build.dirty !== false) refuse();
  selected.assertUnchanged();
}

/** Only an actually prepared selected client and current source can pass. */
export function assertFreshInstallationOperationalEntryV1(): void {
  requireCompiledV1();
  if (refusedV1 || !databaseV1 || !runtimeGuardV1) refuse();
  try {
    databaseV1.assertSelectedFreshInstallationOperationalDatabaseV1();
    assertRuntimeSourceV1(runtimeGuardV1);
    databaseV1.assertSelectedFreshInstallationOperationalDatabaseV1();
  } catch {
    refusedV1 = true;
    const database = databaseV1;
    databaseV1 = null;
    runtimeGuardV1 = null;
    // pgClose fences the selected epoch synchronously before its first await.
    void closeCapturedDatabaseV1(database).catch(() => {});
    refuse();
  }
}

/** Reverification uses the same privately owned client; never migrates or reconciles. */
export async function prepareFreshInstallationOperationalEntryV1(): Promise<void> {
  requireCompiledV1(); // Before loading database/source modules or opening SQL.
  try { selectedV1(); } // Every invocation observes drift, including pending joins.
  catch {
    refusedV1 = true;
    const owner = databaseV1;
    databaseV1 = null;
    runtimeGuardV1 = null;
    try { await closeCapturedDatabaseV1(owner); } catch { /* Remains refused. */ }
    // A pending first prepare may still be importing its fixed database module.
    // Its own guarded continuation must finish captured cleanup before rejection.
    if (pendingV1) try { await pendingV1; } catch { /* Join its cleanup. */ }
    try { await closeCapturedDatabaseV1(null); } catch { /* Remains refused. */ }
    refuse();
  }
  if (pendingV1) return pendingV1; // Join any already-started refusal cleanup too.
  if (refusedV1) {
    try { await closeCapturedDatabaseV1(null); } catch { /* Remains refused. */ }
    refuse();
  }
  const original = (async () => {
    let database: DatabaseApiV1 | null = null;
    try {
      const [db, source, verifier, runtimeGuard] = await Promise.all([
        import("../db-pg.js"),
        import("../internal-production/baseline-post-handoff-receipt-v1.js"),
        import("./fresh-installation-activation-verifier-v1.js"),
        import("../cli/runtime-guard.js"),
      ]);
      database = db;
      assertSourceV1(source); // Unqualified compiled source refuses before SQL.
      await db.prepareSelectedFreshInstallationDatabaseV1();
      db.assertSelectedFreshInstallationOperationalDatabaseV1();
      const { selected, activation } = selectedV1();
      await db.getSql().begin("isolation level repeatable read read only", async tx => {
        await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','30000ms',true),set_config('search_path','public',true)");
        await verifier.verifyFreshInstallationActivatedDatabaseOnTransactionV1(tx, activation, selected.state, "runtime");
      });
      db.assertSelectedFreshInstallationOperationalDatabaseV1();
      assertSourceV1(source);
      assertRuntimeSourceV1(runtimeGuard);
      databaseV1 = db;
      runtimeGuardV1 = runtimeGuard;
    } catch {
      refusedV1 = true;
      const owner = database ?? databaseV1;
      databaseV1 = null;
      runtimeGuardV1 = null;
      try { await closeCapturedDatabaseV1(owner); } catch { /* Remains refused. */ }
      refuse();
    }
  })();
  pendingV1 = original;
  try { await original; }
  finally { if (pendingV1 === original) pendingV1 = null; }
}
