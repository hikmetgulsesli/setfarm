import { createHash } from "node:crypto";

export type ContractSpineMigrationChecksumIdentityV1 = Readonly<{
  version: number;
  name: string;
  statements: readonly string[];
  implementationDigest?: string;
}>;

export function computeContractSpineMigrationChecksumV1(
  migration: ContractSpineMigrationChecksumIdentityV1,
): string {
  if (
    migration.implementationDigest !== undefined
    && !/^[a-f0-9]{64}$/.test(migration.implementationDigest)
  ) {
    throw new Error(
      `CONTRACT_SPINE_MIGRATION_IMPLEMENTATION_DIGEST_INVALID:v${migration.version}`,
    );
  }
  return createHash("sha256")
    .update(JSON.stringify({
      version: migration.version,
      name: migration.name,
      statements: migration.statements,
      ...(migration.implementationDigest
        ? { implementationDigest: migration.implementationDigest }
        : {}),
    }))
    .digest("hex");
}
