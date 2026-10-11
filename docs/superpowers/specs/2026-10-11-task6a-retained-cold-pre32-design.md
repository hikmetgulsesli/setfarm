# Retained cold-pre32 phase verification

## Objective and intentional phase scope

Require the closed pre-cutover probe's retained backend to have actual canonical
source1-through31 journal identities and no32/33 journal/catalog remnants. The
current restricted access/base/owner baseline alone can accept checksum drift or
later phase remnants. This is phase authentication, NOT owner/admission authority.
The probe remains zero-input, void-returning, finite, and closes its custody. It
cannot be reused as a capability. A later full33 runtime needs its distinct genuine
current-head producer; this cold-pre32 operation intentionally refuses that state.

## Alternatives and chosen architecture

1. Retained lazy import of unchanged canonical journal owner after the three
   existing restricted checks, plus one inert cold-absence leaf (chosen). One
   manifest/checksum/error producer, no frozen semantic-region change.
2. New generated31 manifest: introduces another synchronization/provenance
   contract and is unnecessary for this bounded phase.
3. Eager import: reaches factory registrations and source scans before fixed
   acquisition and was already rejected by independent review.

The canonical migration module is NOT inert: it registers six error factories,
asserts semantic definitions, and in TypeScript-source mode reads source digests.
This newly reachable initialization graph must be nominated and reviewed. Capture
the genuine import Promise before await; retain custody and prohibit rollback,
release or FD close until that same import settles. Recheck before and after;
rejection or custody drift fails while independent rollback/native close still join.
No race, deadline-based release, retry, generated manifest or fake transaction.
Verify the actual emitted lazy boundary in addition to modeled import controls.

## File Map and exact interfaces

- New `src/internal-production/task6a-cold-pre32-catalog-readonly-v1.ts` owns ONLY
  existing census absence SQL and five-field guard/error. It consumes structural
  `ReadOnlyCatalogTransactionV1`; export
  `requireColdPre32CatalogAbsenceInTransactionV1(transaction):Promise<void>`.
  It returns no facts/authority, owns no client/transaction, has no value imports.
- `baseline-legacy-database-census-v1.ts` retains its ordinary helper/callers and
  delegates to this same body through genuine connection.unsafe. SQL/zero counts,
  exact keys, public scope,63-byte names and fixed error stay unchanged.
- `task6a-protected-postgres-backend-probe-v1.ts` composes the leaf and unchanged
  `verifyHeldPre32ContractSpineJournalIdentityV1` inside its existing transaction,
  AFTER access/base/public-owner checks. Its callback copies readonly numeric
  parameters into the bracket's native parameter array; no PendingQuery cast.
- `contract-spine-migrations.ts` remains byte-identical. Existing verifier queries
  versions<=31, so the absence producer is mandatory: it detects later journal
  rows and relation/function/type/trigger remnants independently.
- Existing probe/producer/census tests: exact cold row guard, lazy import lifetime,
  rejection/reentry/drift controls; preserve real ordinary callers and lock order.
  Copied census tests bind the new real leaf explicitly, not a fake census body.
- Native entry/private fixture: canonical31 healthy; exact checksum and32/33 row
  or owner-qualified catalog-remnant perturbations. RowDescription distinguishes
  real journal and five cold-count rows. Snapshot includes sampled rows/ACLs and
  targeted remnants; restore only under certain original child termination.
- `package.json`: include new focused coverage in ordinary test entry if needed.
  Paired plan and external evidence ledger nominate all changed/captured owners.

## Tests and limits

Witness RED against the current baseline by making phase-only perturbations while
the three baseline gates remain healthy. GREEN requires real healthy companion,
precise intended refusal rows, actual rollback/transaction/native close and five
FDs before/after restart. Source/control tests never authenticate fixed namespace.
Capture source/tools and natural child close, preserve8GiB disk reserve. Keep all
existing worktrees, live services, protected pair and historical failed receipts.
Do not change accounts/grants/security policy on live host, install fixed authority,
weaken full33/guarded32, claim stock build/noEmit equivalence or select live3333.
