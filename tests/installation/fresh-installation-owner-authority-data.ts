import { getContractSpineCurrentHeadJournalIdentitiesV1 } from "../../src/db/contract-spine-migrations.js";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
} from "../../src/internal-production/owner-admission-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

// Synthetic DATA only. Parsing this value must never qualify a real release or
// register an administrative activation transaction.
export function freshOwnerAuthorityDataV1() {
  const origin = {
    schema: "setfarm.fresh-installation-origin.v1",
    installationId: "848c891f-8379-4d45-bb5a-687f7678db83",
    operationId: "94658131-486f-451e-b5b6-262b2c1763a1",
    systemIdentifier: "7580170739674923521", databaseOid: 16389,
    databaseName: "setfarm_install_848c891f83794d45bb5a687f7678db83",
    ownerRole: "sf_owner_848c891f83794d45bb5a687f7678db83",
    runtimeRole: "sf_runtime_848c891f83794d45bb5a687f7678db83",
    sourceSha: "1234567890abcdef1234567890abcdef12345678",
    migrations: getContractSpineCurrentHeadJournalIdentitiesV1(),
  };
  const body = {
    schema: "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1",
    plan: "A", manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    origin,
    setfarmSource: { branch: "main", clean: true, sha: origin.sourceSha,
      treeHash: "a".repeat(40), buildHash: "b".repeat(64), originMainSha: origin.sourceSha },
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  };
  return rehashFreshOwnerAuthorityDataV1(body);
}

export function rehashFreshOwnerAuthorityDataV1<T extends Record<string, unknown>>(body: T) {
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  return { ...body, sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`, sourceBuildAuthorityHash };
}
