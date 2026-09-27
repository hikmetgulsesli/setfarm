# Task6A diagnostic receipt DB snapshot adapter

Root is the sole writer. PR #217 coordinates injected physical/source/DB
callbacks, and PR #218 supplies a scoped held physical capability. The DB
callback remains unauthenticated. Add a code-owned, local PostgreSQL read-only
snapshot adapter that composes with the existing diagnostic protocol. This is
causally necessary for a physical/PostgreSQL-linked receipt candidate, but it
does not publish an owner receipt or authorize cutover.

## File Map

- `src/internal-production/baseline-positive-worktree-receipt-database-v1.ts`:
  import-inert consumer-specific adapter. Validate one canonical runtime root,
  a private local launcher URL, no ambient PG variables and resolved driver
  target before DB I/O. Hold one `REPEATABLE READ READ ONLY` transaction with
  bounded server/connection timeouts, verify effective role, and query at most
  two active attempt/session rows for the exact root using fixed parameterized
  SQL. Only the private callback passed to the diagnostic receipt protocol may
  see raw fence bytes; the exported function returns its canonical unpublished
  candidate only. Mask all DB/cleanup errors and close before returning.
- `src/internal-production/baseline-positive-worktree-receipt-protocol-v1.ts`
  and its test: exact-head Codex review found that an unbounded injected
  source/physical callback could run while the DB transaction remained open.
  Complete the DB snapshot before the second source/physical recheck, retaining
  the outer held interval and fail-closed candidate ordering. This is the
  smallest causal root fix, not a relaxation of a gate.
- `tests/internal-production/baseline-positive-worktree-receipt-database-v1.test.ts`:
  RED/GREEN import inertia, URL/root refusal before driver load, fixed query
  shape and one transaction, role/cardinality/crossed-row refusal, no fence or
  secret in output/errors, close and timeout behavior. A fake driver tests the
  production 5432 guard; a separate private PostgreSQL experiment may verify
  SQL against a nonproduction port without claiming wrapper coverage.
- `package.json`: include the new test in the standard pure test suite.

Run focused/adjacent pure tests, TypeScript, source manifest/digests,
independent read-only review, exact-head PR, SHA-bound merge, and clean-main
build/test. Do not change live role, service, selected CLI, credential,
migration, runtime guard or worktree. Injected physical/source ports still do
not authenticate their producers; no ownership or cutover claim follows.

## Verification record

- RED: the import-inert test failed because the adapter module did not exist.
- GREEN: focused fake-driver/URL tests 8/8, standard pure suite 354/354,
  source manifest 18/18, TypeScript, migration digests and diff check passed.
- The production local-5432 URL gate is not weakened to reach the private
  55437 fixture. Fake-driver evidence covers this wrapper; no positive live
  PostgreSQL receipt or owner birth is claimed. A read-only attempt to access
  the private fixture as `postgres` with the retained rehearsal password was
  denied; no role/credential was changed and this is not SQL parser evidence.
  Independent read-only review found no Medium+ issue, including after adding
  missing-attempt/session refusal cases. First exact-head Codex review found a
  P2 unbounded callback inside the transaction. The protocol now completes the
  DB callback before second source/physical rechecks, and the adapter opens
  and closes its DB client only inside that callback. RED/GREEN order and a
  stalled-second-source fake-driver test prove close before source resumes.
  A truly non-settling injected source/physical observer can still hold the
  outer diagnostic interval; JavaScript cannot safely cancel arbitrary ports
  with a bare `Promise.race`. New-head PR review and clean-main verification
  are pending.
