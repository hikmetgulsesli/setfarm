# Pre-32 held journal identity implementation

## Causal scope

The cutover's pre-32 held diagnostic currently validates only ordinal/state tail 26–31. Exact predecessor source identity within that same held lock interval is necessary to trust the diagnostic input, but not sufficient to authorize cutover. Scope is a separate read-only V2 result; preserve V1 behavior and all safety boundaries.

## Steps

1. [x] Confirm clean isolated branch and seven-test baseline; record the exact V1 lock and journal order.
2. [x] Add RED tests for canonical 1–31 source identities, early-name and middle-checksum changes, missing/duplicate/reordered/nonterminal state, and V2 held lock ordering/refusal sanitization. The new verifier export failed to import; V2 separately failed as an absent function.
3. [x] Add the smallest source-derived verifier on a supplied connection and wire only V2 to call it inside the existing held transaction after every fixed-table lock, before cold catalog and owner counts. Kept the helper outside all semantic-digest regions. Independent review found and fixed a module-load-under-lock risk: load before `sql.begin`, query after the locks.
4. [x] Focused tests 16/16, TypeScript no-emit, migration digest, version, English, path, Mission Control contracts and diff checks passed. Internal-production cutover 423/423, pure 151/151, manifest 18/18 passed. Independent read-only re-review found no remaining issue. Do not claim a dirty-worktree build.
5. [ ] Deliver reviewed PR, synchronize a separate clean main checkout, build, and retry authenticated no-write host diagnosis once competing test activity is quiescent. Record failures and remaining gates without claiming cutover.

## File Map

See the design's five-file map. No changes to migrations, runtime admission, guard, deployment service, physical catalog, Mission Control, or live database are authorized by this slice.
