/** @deprecated Use claim-mutation-authority for new code. */
export {
  ClaimMutationAuthorityError as ClaimOrphanRecoveryAuthorityError,
  acquireClaimMutationAuthorityInTransaction as acquireClaimFailureAuthorityInTransaction,
  isClaimMutationAuthorityError as isClaimOrphanRecoveryAuthorityError,
} from "./claim-mutation-authority.js";
export type {
  ClaimMutationAuthorityMode as ClaimFailureAuthorityMode,
  ClaimMutationIdentity as OrphanClaimRecoveryIdentity,
  DurableClaimOwnerType as DurableClaimRecoveryOwnerType,
} from "./claim-mutation-authority.js";

import type postgres from "postgres";
import {
  acquireClaimMutationAuthorityInTransaction,
  type ClaimMutationIdentity,
} from "./claim-mutation-authority.js";

export function acquireOrphanClaimRecoveryAuthorityInTransaction(
  transaction: postgres.TransactionSql,
  input: ClaimMutationIdentity,
): Promise<void> {
  return acquireClaimMutationAuthorityInTransaction(transaction, input, "orphan_recovery");
}
