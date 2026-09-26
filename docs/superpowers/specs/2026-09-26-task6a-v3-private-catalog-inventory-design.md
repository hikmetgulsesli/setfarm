# Task6A V3 private catalog inventory design

## Decision

The clean-main V2 writer catalog is a source-authenticated, read-only count and
hash diagnostic. It does not enumerate the object owners, explicit/default ACL
entries, `PUBLIC` grants, or transitive role graph needed to review a
least-privilege writer transition. The live launchers still share the `setrox`
superuser/database-owner role and the same OS uid. More sampled spawner checks
or a transition-intent grammar would not make a continuous writer fence.

Add a *separately versioned* V3 inventory of selected PostgreSQL catalog
classes. Keep exact names, ACL entries, and role edges inside the database
observer's private process memory. Return only category counts, a
domain-separated hash of the exact normalized rows, and an explicit scope
label. This is planning/drift evidence, not a permission calculation, a denied
write, a controller identity, an OS fence, physical ownership, or admission.
V1/V2 results, migration 32/33, launchers, credentials, roles and grants are
unchanged.

## Scope and failure policy

The fixed read-only SQL enumerates non-system schemas, relations (including
sequences), routines, types, the current database, their recorded owners and
non-null explicit ACL arrays; default-ACL catalog rows; and all direct
`pg_auth_members` edges with inherit/set/admin options. It preserves `PUBLIC`
grantees as data. Implicit defaults, transitive membership, row security,
security-definer call paths, extension-owned objects, OS identity and external
writers are *not* inferred from this inventory. A future transition planner
must still analyze those separately.

One repeatable-read/read-only transaction obtains a fixed-order row stream and
validates database/session role, PostgreSQL version, exact shape, bytewise-C
ordering, uniqueness, and bounded client transport before hashing. SQL still
evaluates ACL expressions server-side under a five-second statement timeout;
this is not a strict PostgreSQL backend-memory cap. No arbitrary
SQL, caller-provided identifier, URL, password, object name, ACL text, or SQL
error may appear in the public result. A missing required database row,
duplicate/reordered rows, dangling catalog references,
unsafe counts, malformed membership options, timeout, holder drift, or cleanup
failure refuse closed. The public projection is frozen, canonically hashed,
and always says `diagnostic-only/not-granted/unverified`.

## Delivery sequence and File Map

1. First PR: the new import-inert database projector/adapter, focused RED/GREEN
   tests, pure-suite registration, and this plan. The adapter accepts only a
   strict local URL supplied by a later authenticated holder. It is not a live
   host result; no operator verb or selected service changes in this PR.
2. Second PR: a private qualified method on the three-launcher holder, a
   separate held-host V3 composer, an additive exact-build bootstrap verb, and
   held-drift/cleanup/redaction tests. V2 output remains unchanged.
3. Only after an independently reviewed, explicitly authorized isolated
   PostgreSQL/OS rehearsal may a transition executor or durable effect journal
   be designed from the exact inventory. A private fixture alone cannot prove
   same-uid OS exclusion. The live role/grant/credential/LaunchAgent transition
   and Task6A admission remain outside standing authorization.

For PR 1, change only
`src/internal-production/baseline-task6a-private-catalog-inventory-v3.ts`,
`tests/internal-production/baseline-task6a-private-catalog-inventory-v3.test.ts`,
`package.json`, and this spec/plan. Verify focused and pure suites,
TypeScript/source contracts, frozen migration digests, and independent review.
