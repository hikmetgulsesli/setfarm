import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1 } from "./baseline-positive-worktree-receipt-database-v1.js";
import type { derivePositiveWorktreeBindingReceiptCandidateV1 } from "./baseline-positive-worktree-binding-contract-v1.js";

// This joins real held physical/source observations to the existing read-only
// DB adapter. The URL and scope are supplied, not producer-authenticated;
// no candidate leaves this function before the catalog's final pass closes.
function fail(): never {
  throw Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_HOST_COMPOSER_INVALID");
}

export async function observeScopedHeldDiagnosticPositiveWorktreeReceiptCandidateV1(
  scope: Readonly<{ ownerHomeRoot: string; workspaceRoot: string }>,
  databaseUrl: string | undefined,
  worktreeRoot: string,
) {
  type Candidate = ReturnType<typeof derivePositiveWorktreeBindingReceiptCandidateV1>;
  const outcomes: Candidate[] = [];
  let adapterCalls = 0;
  try {
    const catalog = await observeHeldPositiveWorktreePhysicalCatalogV2(scope, async (entries, withHeld) => {
      if (typeof worktreeRoot !== "string" || entries.filter((entry) => entry.root === worktreeRoot
        && entry.zone === "runtime-zone" && entry.kind === "linked-git" && entry.gitPrimaryRoot !== null).length !== 1) fail();
      await withHeld(worktreeRoot, async (physical, recheckPhysical, observeSource) => {
        outcomes.push(await observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
          databaseUrl, worktreeRoot, {
            holdPhysical: async <T>(withinHold: (heldPhysical: unknown,
              heldRecheck: () => Promise<unknown>) => Promise<T>): Promise<T> => {
              adapterCalls += 1;
              if (adapterCalls !== 1) fail();
              return withinHold(physical, recheckPhysical);
            },
            observeSource,
          }));
      });
    });
    const candidate = outcomes[0];
    if (catalog.status !== "complete" || adapterCalls !== 1 || outcomes.length !== 1 || !candidate
      || candidate.authority !== "diagnostic-only"
      || candidate.receiptStatus !== "required-unpublished"
      || candidate.physicalIdentityProvenance !== "unverified"
      || candidate.producerAuthentication !== "unverified") fail();
    return candidate;
  } catch { fail(); }
}
