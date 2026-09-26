# Held pre-32 journal identity diagnostic

The fixed-table pre-32 SHARE-lock diagnostic currently proves only that journal ordinals 26–31 are `applied` and no later ordinal appears. It does not bind the held read to the source names and checksums of migrations 1–31, or verify the state of ordinals 1–25. A misleading pre-32 snapshot could therefore pass this diagnostic despite a changed predecessor journal. The held transaction already locks `setfarm_schema_migrations` before its census reads.

Add a separate V2 diagnostic entry that, after acquiring the existing 36 SHARE locks and within the same read-only transaction, checks all 31 ordered journal rows against the canonical source migration registry: exact ordinal, name, checksum, and state `applied` or `adopted`. Retain the existing post-31 tail check and cold catalog/zero-owner checks. A missing, duplicate, malformed, reordered, changed, or extra predecessor row must fail closed before census reads. Query/driver errors must remain sanitized at the V2 boundary. The legacy V1 entry and all non-held callers retain their behavior and shape.

The V2 result is frozen and explicitly `diagnostic-only`, reports `journalIdentity: "source-ordinal-name-checksum-state-1-through-31"`, and states that locks are released at return. This does not establish process/service exclusion, full auxiliary writer coverage, a durable admission fence, a positive physical+DB execution owner, or cutover authority. It performs no migration, DB write, service change, guard bypass, or filesystem cleanup.

## File Map

- `src/db/contract-spine-migrations.ts`: source-registry-derived exact 1–31 identity verifier on a caller-owned connection; no transaction or mutation.
- `src/internal-production/baseline-legacy-database-census-v1.ts`: separate held V2 diagnostic using the verifier on the same locked transaction; retain V1.
- `tests/execution-attempts/pre32-journal-identity.test.ts`: exact identity verifier acceptance and refusal cases.
- `tests/internal-production/baseline-legacy-database-census-v1.test.ts`: V2 lock-before-journal ordering, distinct schema/label, fail-closed and sanitized boundary.
- `docs/superpowers/plans/2026-09-26-pre32-held-journal-identity.md`: TDD and verification record.
