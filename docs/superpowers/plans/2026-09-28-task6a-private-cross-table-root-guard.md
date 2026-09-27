# Task6A private cross-table root guard

## Causal boundary

PR #231 reads both pending reservation tables and refuses an exact root
collision, but the two private appenders currently enforce `UNIQUE(root)`
only inside their own table. They can still produce the very collision the
census reports. Add a small fail-closed guard to both existing private
appenders. This does not authenticate the physical creator, prevent direct
SQL, settle a reservation, register live schema, or grant owner/admission.

## Contract

- Both private tables must exist. Inside each appender's existing owned
  `SERIALIZABLE` transaction, after its normal authority checks and before
  first insert or identical retry, query the other table for the exact root.
  Any match or query failure refuses. Keep the read in the transaction so
  PostgreSQL SSI can abort concurrent cross-table write skew; do not rely on
  sampled filesystem absence or a pre-transaction query as the fence.
- Same logical story may reserve a different root for recovery. Preserve the
  ordinary and recovery rows as separate unresolved pending records. Do not
  use prefix matching as physical identity. The independent census must still
  refuse direct SQL collisions in the two tables.
- Do not modify live database, selected CLI, service, runtime writer, role,
  credential, physical worktree, owner or admission path.

## RED/GREEN and delivery

Private PostgreSQL 17 tests must first show recovery appender refusal after
an ordinary same-root reservation and ordinary appender refusal after a
recovery same-root reservation, while a different-root recovery and exact
identical retries continue to work. Use independent connections and distinct
run/story locks to hold both appenders at their `INSERT` after the reciprocal
absent-key reads; release the table locks and require exactly one committed
same-root row and one fixed refusal. Keep an explicit direct-SQL cross-table
collision fixture proving that the read-only census independently refuses
non-appender rows. Run the two private appender fixtures, the census/link
fixtures, TypeScript, pure/cutover/manifest and migration digests; obtain
independent read-only and exact-head GitHub review. Build only on clean main
after reviewed PR merge, then repeat focused PostgreSQL and host HTTP checks.

The sequential RED showed that the recovery appender accepted the ordinary
root. The held-INSERT concurrent fixture also passed with both guards and,
with only those two guards temporarily removed, failed with **two** committed
same-root reservations; the guards were restored by scoped patches. This
mutation check makes the SSI test sensitive to the actual transaction reads.
The five related private PostgreSQL 17 files passed 19/19 with both guards
restored; TypeScript, pure 372/372, cutover 441/441, manifest 18/18 and
migration digests passed. Independent read-only review found no Medium+
defect; exact-head GitHub review and clean-main build remain delivery gates.

## File Map

- `src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.ts`:
  refuse an ordinary appender root already reserved in recovery.
- `src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.ts`:
  refuse a recovery appender root already reserved in ordinary.
- `tests/execution-attempts/task6a-private-precreate-reservation.integration.test.ts`
  and `task6a-private-recovery-precreate-reservation.integration.test.ts`:
  install both private tables in their disposable databases, retaining
  exact-retry and producer-contract coverage.
- `tests/execution-attempts/task6a-private-pending-reservation-census.integration.test.ts`:
  sequential cross-table appender negatives, different-root positive,
  direct-SQL collision detection by the independent census.
- This plan records the scoped causal root fix and evidence.
