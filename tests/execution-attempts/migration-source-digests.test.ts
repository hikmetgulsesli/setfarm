import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { computeContractSpineMigrationChecksumV1 } from "../../src/db/contract-spine-migration-checksum.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "../../src/db/contract-spine-migration-digests.generated.js";
import {
  assertContractSpineSemanticMigrationSourceIntegrity,
  computeContractSpineSemanticMigrationDigests,
  createContractSpineMigrationSourceReader,
  type ContractSpineMigrationSourceReader,
} from "../../src/db/contract-spine-migration-source-integrity.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceReader = createContractSpineMigrationSourceReader(repoRoot);

function replacingReader(
  relativePath: string,
  mutate: (source: string) => string,
): ContractSpineMigrationSourceReader {
  return (candidate) => {
    const source = sourceReader(candidate);
    return candidate === relativePath ? mutate(source) : source;
  };
}

function replaceExactlyOnce(source: string, before: string, after: string): string {
  assert.equal(source.split(before).length - 1, 1, `fixture must match once: ${before}`);
  return source.replace(before, after);
}

describe("contract-spine semantic migration source digests", () => {
  it("matches the checked-in generated digest manifest", () => {
    assert.deepEqual(
      assertContractSpineSemanticMigrationSourceIntegrity(sourceReader),
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS,
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[23],
      "dfeac8a3e38de094192e21d0281ff28330ae75d1227c994920f9a35c1b48e7fe",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[24],
      "62fd9d92eaceffee527aa734b1ae91b17594e4898750b0468bbe9d6acd9b75b4",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[25],
      "bd2aaf747f7937bddd8ccad9d6dfce9dad2eb467f3910aa01e8346cc82ce301f",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[26],
      "ad37c7710fae8f8eb9f1ff518368e67e20599ac7c316781261eef328738a67d9",
    );
  });

  it("changes v8 journal identity when the semantic apply body changes", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const mutated = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        'source: "legacy-effects-committed-receipt",',
        'source: "mutated-legacy-effects-committed-receipt",',
      ),
    ));

    assert.notEqual(mutated[8], baseline[8]);
    assert.equal(mutated[11], baseline[11]);
    assert.equal(mutated[12], baseline[12]);
    const migration = {
      version: 8,
      name: "008_runtime_completion_effect_ledger",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[8],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: mutated[8],
      }),
    );
  });

  it("changes v11 when a declared helper dependency changes and fails source verification", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const mutatedReader = replacingReader(
      "src/recovery/recovery-delivery.ts",
      (source) => `${source}\n// simulated semantic helper dependency mutation\n`,
    );
    const mutated = computeContractSpineSemanticMigrationDigests(mutatedReader);

    assert.equal(mutated[8], baseline[8]);
    assert.notEqual(mutated[11], baseline[11]);
    assert.equal(mutated[12], baseline[12]);
    assert.throws(
      () => assertContractSpineSemanticMigrationSourceIntegrity(mutatedReader),
      /CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGEST_STALE:v11/,
    );
  });

  it("binds v23 to exact batch identity and SQL semantics but not unrelated source", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const identityMutationReader = replacingReader(
      "src/product-compiler/artifact-publication-batch-identity.ts",
      (source) => replaceExactlyOnce(
        source,
        '"setfarm.artifact-publication-batch-child.v1" as const;',
        '"setfarm.artifact-publication-batch-child.v1-mutated" as const;',
      ),
    );
    const identityMutation = computeContractSpineSemanticMigrationDigests(
      identityMutationReader,
    );
    assert.notEqual(identityMutation[23], baseline[23]);
    assert.equal(identityMutation[8], baseline[8]);
    assert.equal(identityMutation[11], baseline[11]);
    assert.equal(identityMutation[12], baseline[12]);
    assert.throws(
      () => assertContractSpineSemanticMigrationSourceIntegrity(identityMutationReader),
      /CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGEST_STALE:v23/,
    );

    const sharedOwnershipMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "actualConstraints.size !== expectedConstraints.size",
          "false && actualConstraints.size !== expectedConstraints.size",
        ),
      ),
    );
    assert.notEqual(sharedOwnershipMutation[23], baseline[23]);
    assert.equal(sharedOwnershipMutation[8], baseline[8]);
    assert.equal(sharedOwnershipMutation[11], baseline[11]);
    assert.equal(sharedOwnershipMutation[12], baseline[12]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 23 rollback refuses to erase artifact publication batch evidence; roll forward instead",
        "Mutation 23 rollback refuses to erase artifact publication batch evidence; roll forward instead",
      ),
    ));
    assert.notEqual(rollbackMutation[23], baseline[23]);

    const registrationMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "verify: verifyArtifactPublicationBatchLedger,",
        "verify: verifyProductCompilationAttemptLedger,",
      ),
    ));
    assert.notEqual(registrationMutation[23], baseline[23]);
    assert.equal(registrationMutation[8], baseline[8]);
    assert.equal(registrationMutation[11], baseline[11]);
    assert.equal(registrationMutation[12], baseline[12]);

    const canonicalDependencyMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/product-compiler/canonical-json.ts",
        (source) => `${source}\n// simulated v23 rollback identity dependency mutation\n`,
      ),
    );
    assert.notEqual(canonicalDependencyMutation[23], baseline[23]);
    assert.notEqual(canonicalDependencyMutation[24], baseline[24]);

    const unrelatedMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/product-compiler/artifact-publication-batch-identity.ts",
      (source) => `${source}\n// unrelated export-area mutation outside the bound v1 region\n`,
    ));
    assert.deepEqual(unrelatedMutation, baseline);

    const migration = {
      version: 23,
      name: "023_artifact_publication_batch_ledger",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[23],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: identityMutation[23],
      }),
    );
  });

  it("binds v24 DB authority semantics without coupling mutable CLI or package files", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const authorityMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "artifact store authority relation is not one permanent ordinary authority table",
        "mutated artifact store authority relation diagnostic",
      ),
    ));
    assert.notEqual(authorityMutation[24], baseline[24]);
    assert.equal(authorityMutation[23], baseline[23]);

    const journalTopologyMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "migration journal is not one permanent unrewritten public authority table",
          "mutated migration journal operational authority diagnostic",
        ),
      ),
    );
    assert.notEqual(journalTopologyMutation[24], baseline[24]);
    assert.equal(journalTopologyMutation[23], baseline[23]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration source chain through version ${throughVersion} differs from source",
        "Mutated source chain through version ${throughVersion} differs from source",
      ),
    ));
    assert.notEqual(rollbackMutation[24], baseline[24]);
    assert.equal(rollbackMutation[23], baseline[23]);

    const registrationMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "verify: verifyArtifactStoreAuthorityLedger,",
          "verify: verifyArtifactPublicationBatchLedger,",
        ),
      ),
    );
    assert.notEqual(registrationMutation[24], baseline[24]);
    assert.equal(registrationMutation[23], baseline[23]);

    for (const mutableOperationalFile of [
      "package.json",
      "scripts/contract-spine-migrate.ts",
    ]) {
      const operationalMutation = computeContractSpineSemanticMigrationDigests(
        replacingReader(
          mutableOperationalFile,
          (source) => `${source}\n// simulated mutable operational wiring change\n`,
        ),
      );
      assert.deepEqual(operationalMutation, baseline);
    }

    const migration = {
      version: 24,
      name: "024_artifact_store_authority_ledger",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[24],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: authorityMutation[24],
      }),
    );
  });

  it("binds v25 preparation authority semantics without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const ledgerMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/preparation-authority-v2-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "preparation authority v2 exact function authority mismatch",
        "mutated preparation authority function diagnostic",
      ),
    ));
    assert.notEqual(ledgerMutation[25], baseline[25]);
    assert.equal(ledgerMutation[23], baseline[23]);
    assert.equal(ledgerMutation[24], baseline[24]);

    const contractMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/execution/v3-preparation-claim-authority-v2.ts",
      (source) => `${source}\n// simulated preparation authority contract mutation\n`,
    ));
    assert.notEqual(contractMutation[25], baseline[25]);
    assert.equal(contractMutation[23], baseline[23]);
    assert.equal(contractMutation[24], baseline[24]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 25 rollback refuses to erase preparation authority provenance; roll forward instead",
        "Mutated migration 25 rollback provenance diagnostic",
      ),
    ));
    assert.notEqual(rollbackMutation[25], baseline[25]);
    assert.equal(rollbackMutation[23], baseline[23]);
    assert.equal(rollbackMutation[24], baseline[24]);

    const currentAuditMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "current artifact store or preparation authority journal differs from source",
          "mutated current authority audit diagnostic",
        ),
      ),
    );
    assert.notEqual(currentAuditMutation[25], baseline[25]);
    assert.equal(currentAuditMutation[23], baseline[23]);
    assert.equal(currentAuditMutation[24], baseline[24]);

    for (const mutableOperationalFile of [
      "package.json",
      "scripts/contract-spine-migrate.ts",
    ]) {
      const operationalMutation = computeContractSpineSemanticMigrationDigests(
        replacingReader(
          mutableOperationalFile,
          (source) => `${source}\n// simulated mutable operational wiring change\n`,
        ),
      );
      assert.deepEqual(operationalMutation, baseline);
    }

    const migration = {
      version: 25,
      name: "025_v3_preparation_authority_v2_ledger",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[25],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: ledgerMutation[25],
      }),
    );
  });

  it("binds v26 durable batch-plan recovery without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const ledgerMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/artifact-publication-batch-plan-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "artifact publication batch plan exact function authority mismatch",
        "mutated artifact publication batch plan function diagnostic",
      ),
    ));
    assert.notEqual(ledgerMutation[26], baseline[26]);
    assert.equal(ledgerMutation[23], baseline[23]);
    assert.equal(ledgerMutation[24], baseline[24]);
    assert.equal(ledgerMutation[25], baseline[25]);

    const bindingMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/product-compiler/artifact-publication-batch-plan-binding.ts",
      (source) => replaceExactlyOnce(
        source,
        "Artifact publication batch plan binding hash does not match its exact items",
        "Mutated artifact publication batch plan hash diagnostic",
      ),
    ));
    assert.notEqual(bindingMutation[26], baseline[26]);
    assert.equal(bindingMutation[23], baseline[23]);
    assert.equal(bindingMutation[24], baseline[24]);
    assert.equal(bindingMutation[25], baseline[25]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 26 rollback refuses to erase batch recovery-plan provenance; roll forward instead",
        "Mutated migration 26 rollback provenance diagnostic",
      ),
    ));
    assert.notEqual(rollbackMutation[26], baseline[26]);
    assert.equal(rollbackMutation[23], baseline[23]);
    assert.equal(rollbackMutation[24], baseline[24]);
    assert.equal(rollbackMutation[25], baseline[25]);

    for (const mutableOperationalFile of [
      "package.json",
      "scripts/contract-spine-migrate.ts",
    ]) {
      const operationalMutation = computeContractSpineSemanticMigrationDigests(
        replacingReader(
          mutableOperationalFile,
          (source) => `${source}\n// simulated mutable v26 operational wiring change\n`,
        ),
      );
      assert.deepEqual(operationalMutation, baseline);
    }

    const migration = {
      version: 26,
      name: "026_artifact_publication_batch_plan_ledger",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[26],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: ledgerMutation[26],
      }),
    );
  });

  it("rejects a malformed implementation digest before deriving a checksum", () => {
    assert.throws(
      () => computeContractSpineMigrationChecksumV1({
        version: 12,
        name: "012_canonical_operational_event_projection",
        statements: [],
        implementationDigest: "manual-label",
      }),
      /CONTRACT_SPINE_MIGRATION_IMPLEMENTATION_DIGEST_INVALID:v12/,
    );
  });
});
