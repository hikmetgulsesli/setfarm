import { verifyContractSpineRuntimeAccessInTransactionReadOnlyV1 as actualAccess } from "../../src/db/contract-spine-runtime-access-readonly-verifier-v1.js";
import { verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1 as actualBase } from "../../src/db/base-schema-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 as actualOwner } from "../../src/db/public-object-owner-readonly-verifier-v1.js";
import { observeTask6aNativeBaselineOriginalV1 } from "./task6a-native-closed-probe-entry.js";

// Test-only, non-async bridges. Genuine callee/receiver/arguments/Promise remain
// unchanged; the entry dispatcher enrolls diagnostics without replacing results.
export function verifyContractSpineRuntimeAccessInTransactionReadOnlyV1(this: unknown, ...args: Parameters<typeof actualAccess>) {
  const original = Reflect.apply(actualAccess, this, args);
  observeTask6aNativeBaselineOriginalV1("ACCESS", original, args[0]);
  return original;
}
export function verifyOrdinaryBaseSchemaCatalogInTransactionReadOnlyV1(this: unknown, ...args: Parameters<typeof actualBase>) {
  const original = Reflect.apply(actualBase, this, args);
  observeTask6aNativeBaselineOriginalV1("BASE", original, args[0]);
  return original;
}
export function verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(this: unknown, ...args: Parameters<typeof actualOwner>) {
  const original = Reflect.apply(actualOwner, this, args);
  observeTask6aNativeBaselineOriginalV1("OWNER", original, args[0], args[1]);
  return original;
}
