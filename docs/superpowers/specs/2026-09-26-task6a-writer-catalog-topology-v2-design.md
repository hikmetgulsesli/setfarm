# Task6A writer catalog topology V2 design

## Boundary

The current three LaunchAgents use the `setrox` PostgreSQL superuser and database owner. The existing held host diagnostic proves that configuration at a sample, but not which application objects, default privileges, or direct memberships a least-privilege transition must account for. Add a separate, source-authenticated read-only catalog inventory. It is planning evidence only: it never proves a denied write, a continuous writer fence, a physical owner, or cutover admission. Keep the existing V1/V7/V2 outputs and migrations 32/33 unchanged.

## Observation

Use the existing three-launcher holder and its private, exact shared local database URL. Within its qualified database callback, execute one fixed PostgreSQL query in a bounded repeatable-read/read-only transaction. The query observes PostgreSQL server version, the database/session/effective role, distinct directly granted role counts by membership option, and counts of non-system schemas, relations, sequences, routines, selected ACL-bearing catalog rows (database, schema, relation, column, routine and type) and default-ACL rows, including how many principal objects are owned by the current session role. It does not publish names, ACL arrays, credentials, SQL errors, or object definitions. It explicitly labels direct memberships as non-transitive and selected catalog-row counts as coarse topology, not an exhaustive authorization calculation. A version below PostgreSQL 16, missing or malformed row, role mismatch, unsafe count, query failure, timeout or holder drift refuses closed.

The new pure composer validates the existing held three-launcher diagnostic, obtains the inventory while all three holders remain alive, rechecks holders on both sides, and binds the catalog role to the existing writer snapshot and Mission Control role. It publishes a separately versioned canonical-hashed diagnostic with `authority:diagnostic-only`, `cutoverAdmission:not-granted`, `physicalIdentityProvenance:unverified`. The catalog transaction is sequential with the prior physical/DB observation, not atomic with it and not a lease. A new bootstrap verb authenticates exact clean-main source/build and independently validates public shape and hash before returning it. Every failure closes both holders and emits only a sanitized refusal.

## File map and verification

- `src/internal-production/baseline-task6a-writer-catalog-topology-v2.ts`: fixed SQL, strict projector and import-inert bounded adapter.
- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`: one private qualified catalog method using the held exact URL and Mission Control URL equality.
- `src/internal-production/baseline-task6a-writer-catalog-host-v2.ts`: pure held-host composer and zero-input adapter.
- `scripts/deployment-cutover.mjs`: additive authenticated inspect verb only.
- Adjacent focused tests and `package.json`: RED/GREEN fixed-query, parser, holder, composition, bootstrap refusal and no-secret regressions.

No live role/grant/credential/plist/service/CLI change, write, migration, cleanup or Task6A cutover is part of this slice. The next decision uses this inventory privately to design and separately review a mechanical DB/OS writer transition.
