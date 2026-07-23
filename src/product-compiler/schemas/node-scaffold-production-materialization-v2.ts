import { hashCanonicalJson } from "../canonical-json.js";

export const NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_V2 =
  Object.freeze({
    schema: "setfarm.node-scaffold-production-materialization-contract.v2" as const,
    contractVersion: "2.0.0" as const,
    sourceAuthority: "fresh_code_owned_production_closure_v2" as const,
    hiddenLockAuthority: "exact_canonical_lock_entry_equality_v2" as const,
    packageRootAuthority: "every_and_only_production_package_roots_v2" as const,
    generatedNpmMetadata: "verified_then_removed_v2" as const,
    dependencyTreeAuthority: "readonly_canonical_runtime_tree_v2" as const,
    packageRuntimeTreeHashDomain:
      "setfarm.production-package-runtime-tree-hash.v2" as const,
    callerPackageSelection: "forbidden" as const,
  });

export const NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_HASH_V2 =
  hashCanonicalJson(NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_CONTRACT_V2);
