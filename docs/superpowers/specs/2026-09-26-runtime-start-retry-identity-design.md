# Exact runtime-start retry identity before future receipt publication

The producer seam audit found that a completed physical worktree and bound attempt meet the runtime session in `markStarting`, before child spawn. Its current `starting` retry path validates the recovery fence but returns the locked row without comparing caller-supplied session key, worktree, runtime path or transcript path. A retried launch with a crossed worktree could therefore appear accepted without even reaching a future positive receipt publisher.

For an already-`starting` session, compare each supplied identity field byte-for-byte against the locked persisted field. A mismatch fails with one stable error before returning a session; an omitted optional field retains the existing legacy retry behavior. The first `reserved`→`starting` transition and all transaction/lock, recovery-fence and child-spawn ordering stay unchanged. This is necessary pre-spawn hardening, not physical provenance, producer authentication, ownership or cutover authorization.

`markStarting` is not a pre-first-write boundary: the spawner already creates claim-scope directories and installs worktree-local wrappers before calling it. A future authenticated owner fence must relocate those writes or cover them under an earlier held physical/DB authorization; this narrow retry check does not authorize them.

Use real isolated PostgreSQL tests for exact retry, each crossed field, no state/version mutation after refusal, and existing no-optional retry compatibility. Run the focused repository test target, TypeScript and relevant execution-attempt suite. No live run, DB schema/migration, guard, service, selected dist or worktree cleanup belongs in this slice.

## File Map

- `src/execution/runtime-session-repository.ts`: locked-row retry identity equality.
- `tests/execution-attempts/runtime-session-repository.test.ts`: real PostgreSQL regression.
- `docs/superpowers/plans/2026-09-26-runtime-start-retry-identity.md`: implementation/verification record.
