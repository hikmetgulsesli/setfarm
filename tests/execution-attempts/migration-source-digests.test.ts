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
