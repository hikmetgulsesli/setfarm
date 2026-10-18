import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import {
  readContractSpineMigrationAttestation,
  verifyContractSpineMigrations,
} from "../db/contract-spine-migrations.js";
import {
  assertFreshInstallationSelectionUnchangedV1,
  freshInstallationSelectionV1,
} from "./fresh-installation-selection-v1.js";

/** Verification only on the supplied real client. No caller authority inputs. */
export async function readV3AdmissionMigrationStateV1(sql: postgres.Sql): Promise<Readonly<{
  status: "verified";
  versions: number[];
  verifiedReleaseSha: string | null;
}>> {
  assertFreshInstallationSelectionUnchangedV1();
  const selected = freshInstallationSelectionV1;
  if (!selected) {
    // Preserve the ordinary verifier, attestation, order and error semantics.
    const verified = await verifyContractSpineMigrations(sql);
    const attestation = await readContractSpineMigrationAttestation(sql);
    return {
      status: "verified",
      versions: verified.migrations.map(migration => migration.version),
      verifiedReleaseSha: attestation.status === "attested" ? attestation.verifiedReleaseSha : null,
    };
  }
  try {
    if (!fileURLToPath(import.meta.url).endsWith(".js")) throw new Error();
    const activation = selected.activation;
    if (!activation?.acknowledged || !activation.activatedPin) throw new Error();
    const unchanged = (): void => {
      assertFreshInstallationSelectionUnchangedV1();
      selected.assertUnchanged();
    };
    unchanged();
    const [{ verifyFreshInstallationRuntimeConnectionV1 }, {
      verifyFreshInstallationActivatedDatabaseOnTransactionV1,
    }] = await Promise.all([
      import("./fresh-installation-runtime-v1.js"),
      import("./fresh-installation-activation-verifier-v1.js"),
    ]);
    unchanged();
    await verifyFreshInstallationRuntimeConnectionV1(sql, selected.state.origin,
      selected.catalogHash, selected.state.ownerOid, selected.state.runtimeOid, unchanged);
    unchanged();
    await sql.begin("isolation level repeatable read read only", async transaction => {
      await transaction.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','30000ms',true),set_config('search_path','public',true)");
      await verifyFreshInstallationActivatedDatabaseOnTransactionV1(transaction, activation, selected.state, "runtime");
      unchanged();
    });
    unchanged();
    // The existing compiled activation verifier checks all33 current-source
    // checksums, applied state, release_sha, verified_release_sha and verified_at.
    return Object.freeze({ status: "verified" as const,
      versions: selected.state.origin.migrations.map(migration => migration.version),
      verifiedReleaseSha: selected.state.origin.sourceSha });
  } catch {
    throw new Error("FRESH_V3_MIGRATION_ATTESTATION_REFUSED");
  }
}
