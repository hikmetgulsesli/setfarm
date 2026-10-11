# Retained Task6a catalog/access baseline

## Bounded objective and decision

Extend the existing zero-input protected backend probe on its single genuine
reservation. Reuse the existing ordinary base catalog, runtime/journal effective
access, and expected public-object-owner producers inside one literal repeatable
read READ ONLY transaction. Compare both lifetime tuples outside that transaction.
Do not duplicate grant policy or pretend ReservedSql has a runtime `begin` method.

This is a restricted baseline, NOT current-head33 journal verification, guarded32
admission, readiness, grants, migration, a fixed-anchor installation or cutover.
The full journal owner retains all33 identities and guarded32 `applied` checks.
Source31 is valid only as private test setup for these narrower catalog/access
producers. Existing empty-database tuple receipts remain historical, not current
positive evidence. The ordinary no-opt-in fixture stays unchanged.

## File Map and contracts

- `src/db/read-only-catalog-transaction-v1.ts`: structural query-only PromiseLike
  port; no invented PendingQuery modifiers or authority.
- `src/db/base-schema-readonly-verifier-v1.ts`: coherent existing body extraction;
  ordinary begin wrapper, bounds and fixed mismatch error remain.
- `src/db/contract-spine-readonly-verifier-v1.ts`: extract ONLY role/access block;
  unchanged full33 wrapper calls it in its original position.
- `src/db/public-object-owner-readonly-verifier-v1.ts`, `src/db-pg.ts`: inert shared
  owner body, original wrapper retains ordinary begin semantics and owner input.
- `src/internal-production/task6a-protected-postgres-backend-probe-v1.ts`: own
  BEGIN/ROLLBACK, capture each native original before await, custody rechecks,
  fixed descriptor owner, no new public input/output/callback/readiness grant.
- Focused verifier/probe tests: leaf failures, unchanged wrappers, finite pending
  BEGIN/catalog/ROLLBACK controls, thrown-undefined failures and cleanup ordering.
- New private fixed-owner source31 setup sibling; existing52-source DDL extractor.
  Actual migrations then base DDL under isolated NOLOGIN `setfarm_owner`; runtime
  gets CONNECT/public USAGE/journal SELECT only. Preserve old owner-class fixture.
- Native entry/private PG fixture: exact RowDescription lifetime selection,
  BEGIN/ROLLBACK/ReadyForQuery witness, actual write/membership/catalog/owner
  perturbations and restoration, five actual FDs until genuine socket close.

## Original lifetime and failure handling

Mark transaction attempted BEFORE literal BEGIN dispatch. Even rejected BEGIN or
custody drift must join one genuine ROLLBACK attempt on that same reservation.
Do not retry unknown originals or release while any retained query is pending.
Normal success rolls back before the final own-backend tuple; transaction snapshot
caching cannot supply the second tuple. Rollback rejection remains failure.
Independent revoke/release/client close/holder close discipline and sticky unknown
construction/close custody remain. Native extinction, not a timer, ends FD custody.

## Verification and remaining gates

First witness RED refusal controls against current tuple-only composition. Then
focused producer/wrapper/composition tests, strict noEmit and native canonical
healthy plus real negative controls before/after restart, with pinned source/tools,
natural child close and8GiB disk floor. Model tests prove wiring only. Private
native success does not authenticate the absent fixed production namespace.
Reviewed PR delivery, stock clean-main build, actual protected endpoint/cutover,
qualified OpenClaw rollback and live3333 end-to-end run remain separate gates.
