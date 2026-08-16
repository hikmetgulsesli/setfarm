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
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[8],
      "e5262ada2f854b5897d19b203e7db360f54f9f17686e4d33bbf86b4316f4dcd4",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[11],
      "1de0344e33f33f0241b694b3c96a36b31c9282fa7cd35697ad300dc3279ebf3f",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[12],
      "7a82f7e50421410dc5aded4fd2b61ce9d6c7b9be7db9f46920edbed7ad330b84",
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
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[27],
      "6c88521537665a21e0167373b12f35215aac3cd74eb06978b162a04ab7f4fb89",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[28],
      "cb6b68777f143c1b55ad38e66d42254745241b82e95a8e06e4898bb047ddfdcd",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[29],
      "b0a2cb9163bc87a6e9e45f8ba230c55821c85d14458697b72b2a6e17d7dcb305",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[30],
      "95c2f97df36fc274a03dd546a262436d003c822b2698ef4410d0da1933193c4c",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31],
      "f052eff1b45df0f00ffb844fe0d23b542eafa4789da5e90a329a8d756dfcdc3a",
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

  it("binds v27 durable release-store record integrity without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const helperMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/platform-release-store-record-ledger-v3-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "release-store record ledger exact columns mismatch",
        "mutated release-store record ledger column diagnostic",
      ),
    ));
    assert.notEqual(helperMutation[27], baseline[27]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26] as const) {
      assert.equal(helperMutation[historical], baseline[historical]);
    }

    const durableContractMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/execution/schemas/platform-release-content-store-durable-record-test-v3.ts",
        (source) => `${source}\n// simulated durable-record contract mutation\n`,
      ),
    );
    assert.notEqual(durableContractMutation[27], baseline[27]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26] as const) {
      assert.equal(durableContractMutation[historical], baseline[historical]);
    }

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 27 rollback refuses to erase platform release-store record provenance; roll forward instead",
        "Mutated migration 27 rollback provenance diagnostic",
      ),
    ));
    assert.notEqual(rollbackMutation[27], baseline[27]);
    assert.equal(rollbackMutation[26], baseline[26]);

    const auditMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "current platform release-store record ledger journal differs from source",
        "mutated current release-store record audit diagnostic",
      ),
    ));
    assert.notEqual(auditMutation[27], baseline[27]);
    assert.equal(auditMutation[26], baseline[26]);

    const compositeAuditMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "Current contract-spine authority-ledgers audit exceeded its bounded timeout",
          "Mutated composite authority-ledgers audit timeout diagnostic",
        ),
      ),
    );
    assert.notEqual(compositeAuditMutation[27], baseline[27]);
    assert.equal(compositeAuditMutation[26], baseline[26]);

    const fencedAdoptionMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "await migration.adopt(transaction);",
          "await migration.verify(transaction); // simulated unfenced adoption",
        ),
      ),
    );
    assert.notEqual(fencedAdoptionMutation[27], baseline[27]);
    assert.equal(fencedAdoptionMutation[26], baseline[26]);

    for (const mutableOperationalFile of [
      "package.json",
      "scripts/contract-spine-migrate.ts",
    ]) {
      const operationalMutation = computeContractSpineSemanticMigrationDigests(
        replacingReader(
          mutableOperationalFile,
          (source) => `${source}\n// simulated mutable v27 operational wiring change\n`,
        ),
      );
      assert.deepEqual(operationalMutation, baseline);
    }

    const migration = {
      version: 27,
      name: "027_platform_release_store_record_ledger_v3",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[27],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: helperMutation[27],
      }),
    );
  });

  it("binds v28 runtime-completion manifest authority without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const helperMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/runtime-completion-manifest-authority-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "RUNTIME_COMPLETION_PLAN_IMMUTABLE",
        "RUNTIME_COMPLETION_PLAN_MUTATED",
      ),
    ));
    assert.notEqual(helperMutation[28], baseline[28]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26, 27] as const) {
      assert.equal(helperMutation[historical], baseline[historical]);
    }

    const liveAuthorityMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/execution/runtime-completion-manifest-authority-v1.ts",
      (source) => `${source}\n// simulated live manifest authority mutation\n`,
    ));
    assert.notEqual(liveAuthorityMutation[28], baseline[28]);
    assert.equal(liveAuthorityMutation[27], baseline[27]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 28 rollback refuses to remove runtime completion manifest authority after provenance exists; roll forward instead",
        "Mutated migration 28 rollback provenance diagnostic",
      ),
    ));
    assert.notEqual(rollbackMutation[28], baseline[28]);
    assert.equal(rollbackMutation[27], baseline[27]);

    const migration = {
      version: 28,
      name: "028_runtime_completion_manifest_authority",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[28],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: helperMutation[28],
      }),
    );
  });

  it("binds v29 story claim/runtime topology without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const topologyMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/v3-story-claim-runtime-binding-v1-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_INVALID",
        "V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_MUTATED",
      ),
    ));
    assert.notEqual(topologyMutation[29], baseline[29]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26, 27, 28] as const) {
      assert.equal(topologyMutation[historical], baseline[historical]);
    }

    const registrationMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          'name: "029_v3_story_claim_runtime_binding_v1",',
          'name: "029_v3_story_claim_runtime_binding_v1_mutated",',
        ),
      ),
    );
    assert.notEqual(registrationMutation[29], baseline[29]);
    assert.equal(registrationMutation[28], baseline[28]);

    const currentAuditMutation = computeContractSpineSemanticMigrationDigests(
      replacingReader(
        "src/db/contract-spine-migrations.ts",
        (source) => replaceExactlyOnce(
          source,
          "migration-29 current authority audit requires the exact 26, 27, 28, 29 head",
          "mutated migration-29 current authority head diagnostic",
        ),
      ),
    );
    assert.notEqual(currentAuditMutation[29], baseline[29]);
    assert.equal(currentAuditMutation[28], baseline[28]);

    const rollbackMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/contract-spine-migrations.ts",
      (source) => replaceExactlyOnce(
        source,
        "Migration 29 rollback refuses to remove v3 story claim/runtime binding provenance; roll forward instead",
        "Mutated migration 29 rollback provenance diagnostic",
      ),
    ));
    assert.notEqual(rollbackMutation[29], baseline[29]);
    assert.equal(rollbackMutation[28], baseline[28]);

    const migration = {
      version: 29,
      name: "029_v3_story_claim_runtime_binding_v1",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[29],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: topologyMutation[29],
      }),
    );
  });

  it("binds v30 failure-cause authority without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(
      sourceReader,
    ) as Readonly<Record<number, string>>;
    const authorityMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/execution/operational-failure-cause-authority-v2.ts",
      (source) => replaceExactlyOnce(
        source,
        "DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED",
        "DESIGN_SOURCE_SEMANTIC_CLOSURE_MUTATED",
      ),
    )) as Readonly<Record<number, string>>;
    assert.notEqual(authorityMutation[30], baseline[30]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26, 27, 28, 29] as const) {
      assert.equal(authorityMutation[historical], baseline[historical]);
    }

    const migrationMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/operational-failure-cause-authority-v2-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "operational failure cause authority v2 constraint mismatch",
        "operational failure cause authority v2 constraint mutated",
      ),
    )) as Readonly<Record<number, string>>;
    assert.notEqual(migrationMutation[30], baseline[30]);
    assert.equal(migrationMutation[29], baseline[29]);

    const migration = {
      version: 30,
      name: "030_operational_failure_cause_authority_v2",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[30],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: authorityMutation[30],
      }),
    );
  });

  it("binds v31 failure-cause authority and migration without rewriting historical digests", () => {
    const baseline = computeContractSpineSemanticMigrationDigests(sourceReader);
    const authorityMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/execution/operational-failure-cause-authority-v3.ts",
      (source) => replaceExactlyOnce(
        source,
        "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
        "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_MUTATED",
      ),
    ));
    assert.notEqual(authorityMutation[31], baseline[31]);
    for (const historical of [8, 11, 12, 23, 24, 25, 26, 27, 28, 29, 30] as const) {
      assert.equal(authorityMutation[historical], baseline[historical]);
    }

    const migrationMutation = computeContractSpineSemanticMigrationDigests(replacingReader(
      "src/db/operational-failure-cause-authority-v3-migration.ts",
      (source) => replaceExactlyOnce(
        source,
        "operational failure cause authority v3 constraint mismatch",
        "operational failure cause authority v3 constraint mutated",
      ),
    ));
    assert.notEqual(migrationMutation[31], baseline[31]);
    assert.equal(migrationMutation[30], baseline[30]);

    const migration = {
      version: 31,
      name: "031_operational_failure_cause_authority_v3",
      statements: ["SELECT 1"],
    } as const;
    assert.notEqual(
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: baseline[31],
      }),
      computeContractSpineMigrationChecksumV1({
        ...migration,
        implementationDigest: authorityMutation[31],
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
