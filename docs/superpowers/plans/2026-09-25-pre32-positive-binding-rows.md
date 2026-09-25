# Pre-32 Positive Binding Rows Plan

Status: implementation in progress; this plan grants no live cutover authority.

## Causal correction

The approved preserved deployment cutover needs physical worktree ownership tied
to real PostgreSQL execution rows while retaining all historical worktrees.
The existing V5 host pair is diagnostic-only: its active-row snapshot lacks the
attempt generation, fence commitment, and source revision needed by the existing
pure binding candidate. The global owner-admission head cannot fence this phase:
the pre-32 census requires migration-32 tables and journal rows to be absent.
Migration-32 SQL also enumerates its four existing fence purposes. Do not extend
that historical migration or reuse another purpose. The phase's cooperative
refusal still depends on owner-held cutover intent and exact process exclusion;
later post-32 admission fencing is a separate task.

## File Map

- `src/internal-production/baseline-positive-worktree-binding-rows-v1.ts`:
  a read-only, transaction-port observer for all active attempt and session rows
  with real generation/fence/source fields. It hashes fence tokens and does not
  authenticate physical identity or grant cutover authority. Count/row mismatch,
  malformed rows and over-limit results fail closed.
- `tests/internal-production/baseline-positive-worktree-binding-rows-v1.test.ts`:
  RED/GREEN query-shape, complete-count, malformed/crossed, ordering and secret-
  redaction tests. No production DB mutation.
- `package.json`: include the new tests in the existing pure internal-production
  suite so later changes cannot silently lose the coverage.
- This plan records the sequencing correction and test/delivery evidence.

## Next dependent steps

1. Wire this observation into a separately versioned V6 *same transaction*
   pre-32 snapshot, then pair it with the held physical catalog. Do not combine
   independently timed observations. Normalize each real postgres.js Result
   using the existing strict V2 adapter. Cross-check row identities as well as
   counts against the legacy active-row snapshot. Since the pre-32 census already
   rejects active rows, this V6 path can only produce empty binding rows; it is
   not the eventual positive live-owner producer.
2. Resolve each physical candidate to bound execution, proven nonowner, or
   unresolved hazard using code-owned Git/physical facts and these real DB rows.
   Self-consistent caller receipts remain diagnostic only. The existing V1 pure
   binder expects a raw fence token, while this observer emits its commitment;
   a future trusted binder must consume the hash directly, never reacquire a
   token from caller input.
3. Prove complete cooperative-writer/process exclusion and held recheck, then
   create a separately versioned receipt/guard/downstream chain. Preserve V1
   zero-owner semantics. A live cutover remains forbidden until every gate passes.

## Verification

RED failed on the missing observer module. GREEN focused tests passed 6/6;
the internal-production pure suite passed 129/129 and `tsc --noEmit` passed.
Independent read-only review found no immediate SQL/schema or parser blocker
and identified the Result-adapter/hash-aware-binder requirements above. PR
delivery, clean-main build and authenticated host recheck remain pending. No
dirty build or guard bypass.
