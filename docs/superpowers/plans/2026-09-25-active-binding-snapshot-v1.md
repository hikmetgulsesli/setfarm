# Non-pre32 active binding snapshot V1

Status: implemented diagnostic root fix; PR delivery pending. No cutover authority.

## Causal scope

The approved positive physical/PostgreSQL owner contract needs to exercise
actual active execution rows. PRs #165-166 created a held pre-32 diagnostic,
but its cold census requires active attempt/session counts to be zero. Add a
separate read-only, non-pre32 same-transaction active-row/binding-row snapshot.
This must not change pre-32, migrations, admission, V1 zero-owner guard,
physical catalog or selected deployment. An empty result cannot classify any
physical worktree as a nonowner.

## File map / RED-GREEN

1. `tests/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.test.ts`:
   RED missing module, then positive attempt+session and orphan/null cases,
   crossed counts/identities, one repeatable-read/read-only transaction,
   malformed driver-result failure, hashes/frozen diagnostic output.
2. `src/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.ts`:
   compose existing strict V2 active and V1 binding observers on exactly one
   supplied transaction query; compare counts and overlapping identities.
3. `src/db-pg.ts`: expose a zero-input code-owned diagnostic wrapper that
   creates one read-only transaction and normalizes each postgres.js Result
   before either strict parser. Keep all source secrets out of output.
4. Add the focused test to the pure suite, run TypeScript/contracts and
   proportional regression tests, independent read-only review, PR and
   clean-main build. Actual host V6 inspection remains unchanged.

A later held physical pair and trusted source/birth receipt are separate gates.
This snapshot never proves physical ownership or nonownership by itself.

## Verification evidence

RED failed on the absent module. Focused GREEN 5/5 covers positive linked
attempt/session rows, crossed counts/identity, null half-links, postgres.js
Result metadata normalization and malformed metadata refusal. Pure suite
137/137, cutover suite 390/390, TypeScript no-emit, English/path contracts
and diff check passed. Independent read-only review found no blocker and
identified the malformed-Result test gap, which was then closed.
