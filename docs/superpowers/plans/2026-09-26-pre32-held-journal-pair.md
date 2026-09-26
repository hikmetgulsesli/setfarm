# Held-journal pre32 pair implementation

## Causal scope

PR #176 proves full predecessor journal identity only within a separate diagnostic. The cutover needs that identity and the already-complete V6 binding rows observed within one held writer-exclusion interval; sequential V2+V6 calls cannot provide it. This is a diagnostic safety refinement, not positive owner or cutover authority.

## Steps

1. [x] Confirm clean isolated branch at reviewed main `b4ccc156` and record V6/launcher/bootstrap baselines (census 7/7, pair 20/20).
2. [x] RED tests failed on absent V7 DB, pair export, launcher callback and authenticated verb. V7 cases now cover journal label/hash, lock/query order and finite sanitized DB refusal; the reused held physical pair retains its existing incomplete-callback tests.
3. [x] Keep V6 source byte-for-byte; add separate V7 read body with preloaded helpers and existing held lock+journal flags. Wire private launcher, pair and bootstrap as separate V7 paths.
4. [x] Focused 138/138, cutover 424/424, pure 153/153, manifest 18/18, full script 815/815 plus genuine cutover integration 43/43, TypeScript no-emit and version/English/path/migration-digest/Mission Control contracts passed. Independent read-only review found no blocking issue; it noted that a real isolated-PostgreSQL V7 test would strengthen the separately verified wiring and verifier evidence.
5. Synchronize a separate clean-main clone and run normal guarded build. Retry authenticated no-write V7 host probe only when competing v6 test activity is quiescent; record exact refusal/success, not inferred authority.

## File Map

See the ten-file design map. No migration, runtime admission, owner guard, physical catalog, Mission Control or live service files are in scope.
